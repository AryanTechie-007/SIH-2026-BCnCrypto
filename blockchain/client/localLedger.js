'use strict';

/**
 * localLedger.js -- Local standalone ledger engine for Windows / offline development.
 *
 * Implements the exact validation and storage rules of:
 *   - blockchain/chaincode/forensic-audit/lib/forensicAudit.js
 *   - blockchain/chaincode/key-registry/lib/keyRegistry.js
 *
 * Persists ledger state to blockchain/data/local-ledger.json so transactions,
 * registered public keys, and decryption records persist across runs without
 * requiring a Docker container.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const WM_PATTERN = /^[0-9a-f]{20}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const KEY_SPECS = {
    kem: { algorithm: 'ML-KEM-768', length: 1184 },
    dsa: { algorithm: 'ML-DSA-65', length: 1952 },
};

const REQUIRED_RECORD_FIELDS = [
    'record_id',
    'watermark_id',
    'recipient_id',
    'document_hash',
    'watermarked_doc_hash',
    'timestamp',
    'pqc_algorithm',
    'signature',
    'recipient_pubkey_fingerprint',
];

const REQUIRED_KEY_FIELDS = [
    'username',
    'kem_algorithm',
    'kem_public_key',
    'dsa_algorithm',
    'dsa_public_key',
];

const DEFAULT_IDENTITY = process.env.DEFAULT_IDENTITY || 'user-042';

class LedgerError extends Error {
    constructor(message, kind = 'unknown', cause) {
        super(message);
        this.name = 'LedgerError';
        this.kind = kind;
        if (cause) this.cause = cause;
    }
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getOrgDir() {
    const fabricSamples = process.env.FABRIC_SAMPLES;
    const repoRoot = path.resolve(__dirname, '..', '..');
    const defaultCrypto = path.join(repoRoot, 'blockchain', 'crypto', 'test-network', 'organizations');

    if (!fabricSamples) {
        if (fs.existsSync(defaultCrypto)) return defaultCrypto;
        const directCrypto = path.join(repoRoot, 'blockchain', 'crypto');
        if (fs.existsSync(path.join(directCrypto, 'peerOrganizations'))) return directCrypto;
        return null;
    }

    const candidates = [
        path.join(fabricSamples, 'test-network', 'organizations'),
        path.join(fabricSamples, 'organizations'),
        fabricSamples,
        path.join(fabricSamples, 'test-network'),
    ];

    for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'peerOrganizations'))) {
            return c;
        }
    }

    if (fs.existsSync(defaultCrypto)) return defaultCrypto;
    return path.join(fabricSamples, 'test-network', 'organizations');
}

function getDataFilePath() {
    if (process.env.LOCAL_LEDGER_FILE) {
        return process.env.LOCAL_LEDGER_FILE;
    }
    const repoRoot = path.resolve(__dirname, '..', '..');
    return path.join(repoRoot, 'blockchain', 'data', 'local-ledger.json');
}

function loadState() {
    const file = getDataFilePath();
    try {
        if (fs.existsSync(file)) {
            const data = fs.readFileSync(file, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.warn(`[localLedger] could not read state file ${file}:`, err.message);
    }
    return { records: {}, keys: {} };
}

function saveState(state) {
    const file = getDataFilePath();
    try {
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
        console.error(`[localLedger] failed to save state to ${file}:`, err.message);
    }
}

/** Lists all identities present in FABRIC_SAMPLES */
function listIdentities() {
    const orgDir = getOrgDir();
    const found = {};
    if (!orgDir || !fs.existsSync(orgDir)) {
        return found;
    }

    const orgs = [
        { domain: 'org1.example.com', mspId: 'Org1MSP' },
        { domain: 'org2.example.com', mspId: 'Org2MSP' }
    ];

    for (const { domain, mspId } of orgs) {
        const usersDir = path.join(orgDir, 'peerOrganizations', domain, 'users');
        if (!fs.existsSync(usersDir)) continue;

        let entries;
        try {
            entries = fs.readdirSync(usersDir);
        } catch {
            continue;
        }

        for (const entry of entries) {
            const mspDir = path.join(usersDir, entry, 'msp');
            const signcerts = path.join(mspDir, 'signcerts');
            const keystore = path.join(mspDir, 'keystore');
            if (!fs.existsSync(signcerts) || !fs.existsSync(keystore)) continue;

            const name = entry.split('@')[0];
            if (!found[name]) {
                found[name] = { name, mspId, mspDir };
            }
        }
    }
    return found;
}

async function firstFileIn(dir) {
    const names = (await fsp.readdir(dir)).filter((n) => !n.startsWith('.'));
    if (names.length === 0) throw new LedgerError(`no files in ${dir}`, 'config');
    return path.join(dir, names[0]);
}

/** Returns the caller's certificate information from the identity bundle. */
async function whoAmI(identityName) {
    const name = identityName || DEFAULT_IDENTITY;
    const identities = listIdentities();
    const info = identities[name];

    if (!info) {
        // If identity wasn't found in bundle directory, synthesize a default identity
        const isOrg2 = name.toLowerCase().includes('org2') || name.toLowerCase().includes('bob');
        const mspId = isOrg2 ? 'Org2MSP' : 'Org1MSP';
        const domain = isOrg2 ? 'org2.example.com' : 'org1.example.com';
        return {
            msp_id: mspId,
            common_name: `${name}@${domain}`,
            username: name,
            is_admin: name.toLowerCase().includes('admin'),
            raw_id: `x509::/C=US/ST=California/L=San Francisco/OU=client/CN=${name}@${domain}::/C=US/ST=California/L=San Francisco/O=${domain}/CN=ca.${domain}`
        };
    }

    try {
        const certFile = await firstFileIn(path.join(info.mspDir, 'signcerts'));
        const certPem = await fsp.readFile(certFile, 'utf8');
        const cert = new crypto.X509Certificate(certPem);

        const subjectLines = cert.subject.split('\n');
        let cn = '';
        let ou = 'client';
        for (const line of subjectLines) {
            if (line.startsWith('CN=')) cn = line.slice(3).trim();
            if (line.startsWith('OU=')) ou = line.slice(3).trim();
        }

        const username = cn ? cn.split('@')[0] : name;
        const isAdmin = ou.toLowerCase() === 'admin';

        return {
            msp_id: info.mspId,
            common_name: cn || `${name}@example.com`,
            username: username,
            is_admin: isAdmin,
            raw_id: `x509::/C=US/ST=California/L=San Francisco/OU=${ou}/CN=${cn}::${cert.issuer}`
        };
    } catch (err) {
        throw new LedgerError(`cannot read certificate for ${name}: ${err.message}`, 'config', err);
    }
}

/** Writes a decryption record to the local ledger */
async function submitRecord(record, identityName) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new LedgerError('record must be an object', 'validation');
    }

    for (const field of REQUIRED_RECORD_FIELDS) {
        if (record[field] === undefined || record[field] === '') {
            throw new LedgerError(`missing required field: ${field}`, 'validation');
        }
    }

    const wmId = record.watermark_id;
    if (!WM_PATTERN.test(wmId)) {
        throw new LedgerError('watermark_id must be exactly 20 lowercase hex characters', 'validation');
    }
    if (!SHA256_PATTERN.test(record.document_hash)) {
        throw new LedgerError('document_hash must be a 64-char lowercase hex SHA-256 digest', 'validation');
    }
    if (!SHA256_PATTERN.test(record.watermarked_doc_hash)) {
        throw new LedgerError('watermarked_doc_hash must be a 64-char lowercase hex SHA-256 digest', 'validation');
    }

    const name = identityName || DEFAULT_IDENTITY;
    if (record.recipient_id && record.recipient_id !== name) {
        throw new LedgerError(
            `record names recipient_id "${record.recipient_id}" but is being submitted as "${name}"`,
            'identity'
        );
    }

    const state = loadState();
    if (state.records[wmId]) {
        throw new LedgerError(`a record for watermark ${wmId} already exists`, 'duplicate');
    }

    state.records[wmId] = { ...record };
    saveState(state);

    return state.records[wmId];
}

/** Reads a decryption record by watermark ID */
async function queryRecord(watermarkId) {
    if (!watermarkId) {
        throw new LedgerError('watermarkId must not be empty', 'validation');
    }
    const state = loadState();
    return state.records[watermarkId] || null;
}

/** Returns all decryption records on the ledger */
async function getAllRecords() {
    const state = loadState();
    return Object.values(state.records);
}

/** Registers user public keys on the ledger */
async function registerKeys(keys, identityName) {
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
        throw new LedgerError('keys must be an object', 'validation');
    }

    for (const field of REQUIRED_KEY_FIELDS) {
        if (typeof keys[field] !== 'string' || keys[field] === '') {
            throw new LedgerError(`missing required field: ${field}`, 'validation');
        }
    }

    const username = keys.username;
    if (!USERNAME_PATTERN.test(username)) {
        throw new LedgerError('username must be 1-64 letters, digits, dots, underscores or hyphens', 'validation');
    }

    const name = identityName || DEFAULT_IDENTITY;
    if (username !== name) {
        throw new LedgerError(
            `keys name user "${username}" but are being submitted as "${name}"`,
            'identity'
        );
    }

    const state = loadState();
    if (state.keys[username]) {
        throw new LedgerError(`a key record for user ${username} already exists`, 'duplicate');
    }

    // Decode and check KEM and DSA keys
    const decodeKey = (prefix) => {
        const spec = KEY_SPECS[prefix];
        if (keys[`${prefix}_algorithm`] !== spec.algorithm) {
            throw new LedgerError(`${prefix}_algorithm must be ${spec.algorithm}`, 'validation');
        }
        const encoded = keys[`${prefix}_public_key`];
        const decoded = Buffer.from(encoded, 'base64');
        if (!BASE64_PATTERN.test(encoded) || decoded.toString('base64') !== encoded) {
            throw new LedgerError(`${prefix}_public_key must be standard base64`, 'validation');
        }
        if (decoded.length !== spec.length) {
            throw new LedgerError(
                `${prefix}_public_key must be ${spec.length} bytes for ${spec.algorithm}, got ${decoded.length}`,
                'validation'
            );
        }
        return decoded;
    };

    const kemKey = decodeKey('kem');
    const dsaKey = decodeKey('dsa');

    const who = await whoAmI(name);

    const record = {
        username,
        msp_id: who.msp_id || 'Org1MSP',
        kem_algorithm: KEY_SPECS.kem.algorithm,
        kem_public_key: keys.kem_public_key,
        kem_key_fingerprint: sha256(kemKey),
        dsa_algorithm: KEY_SPECS.dsa.algorithm,
        dsa_public_key: keys.dsa_public_key,
        dsa_key_fingerprint: sha256(dsaKey),
        registered_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };

    state.keys[username] = record;
    saveState(state);

    return record;
}

/** Retrieves registered public keys for username */
async function getKeys(username) {
    if (!username) {
        throw new LedgerError('username must not be empty', 'validation');
    }
    const state = loadState();
    return state.keys[username] || null;
}

/** Returns all registered public keys */
async function getAllKeys() {
    const state = loadState();
    return Object.values(state.keys);
}

async function close() {
    // No open sockets in local mode
}

module.exports = {
    listIdentities,
    whoAmI,
    submitRecord,
    queryRecord,
    getAllRecords,
    registerKeys,
    getKeys,
    getAllKeys,
    close,
    LedgerError,
};
