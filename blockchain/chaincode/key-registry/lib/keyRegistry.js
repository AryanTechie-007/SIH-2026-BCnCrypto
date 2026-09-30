'use strict';

const crypto = require('crypto');
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

// Usernames are the ledger key and must equal the certificate CN that
// new-recipient.sh issues, which only allows these characters.
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

// Public key sizes fixed by NIST FIPS 203 (ML-KEM-768) and FIPS 204 (ML-DSA-65).
const KEY_SPECS = {
    kem: { algorithm: 'ML-KEM-768', length: 1184 },
    dsa: { algorithm: 'ML-DSA-65', length: 1952 },
};

const REQUIRED_FIELDS = [
    'username',
    'kem_algorithm',
    'kem_public_key',
    'dsa_algorithm',
    'dsa_public_key',
];

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * One record per user: the public halves of their ML-KEM (encryption) and
 * ML-DSA (signing) keys. Senders read the KEM key to encrypt for a
 * recipient; the forensic tool reads the DSA key to verify signatures.
 *
 * Records are write-once and may only be written by the user they name, so
 * nobody can substitute their own key for someone else's.
 */
class KeyRegistry extends Contract {

    // ---------------------------------------------------------------- write

    async RegisterKeys(ctx, keysJSON) {
        let input;
        try {
            input = JSON.parse(keysJSON);
        } catch (err) {
            throw new Error('keysJSON is not valid JSON');
        }
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new Error('keysJSON must be a JSON object');
        }

        for (const field of REQUIRED_FIELDS) {
            if (typeof input[field] !== 'string' || input[field] === '') {
                throw new Error(`missing required field: ${field}`);
            }
        }

        const username = input.username;
        if (!USERNAME_PATTERN.test(username)) {
            throw new Error('username must be 1-64 letters, digits, dots, underscores or hyphens');
        }

        this._assertSubmitterIs(ctx, username);

        if (await this.KeysExist(ctx, username)) {
            throw new Error(`a key record for user ${username} already exists`);
        }

        const kemKey = this._decodeKey(input, 'kem');
        const dsaKey = this._decodeKey(input, 'dsa');

        // Only whitelisted fields are stored. msp_id and registered_at come
        // from the transaction itself, never from the caller.
        const record = {
            username,
            msp_id: ctx.clientIdentity.getMSPID(),
            kem_algorithm: KEY_SPECS.kem.algorithm,
            kem_public_key: input.kem_public_key,
            kem_key_fingerprint: sha256(kemKey),
            dsa_algorithm: KEY_SPECS.dsa.algorithm,
            dsa_public_key: input.dsa_public_key,
            // Same digest the forensic records carry as recipient_pubkey_fingerprint.
            dsa_key_fingerprint: sha256(dsaKey),
            registered_at: this._txTime(ctx),
        };

        const stored = stringify(sortKeysRecursive(record));
        await ctx.stub.putState(username, Buffer.from(stored));
        ctx.stub.setEvent('KeysRegistered', Buffer.from(stored));
        return stored;
    }

    // ---------------------------------------------------------------- reads

    async GetKeys(ctx, username) {
        const recordJSON = await ctx.stub.getState(username);
        if (!recordJSON || recordJSON.length === 0) {
            throw new Error(`no record found for user ${username}`);
        }
        return recordJSON.toString();
    }

    async KeysExist(ctx, username) {
        const recordJSON = await ctx.stub.getState(username);
        return recordJSON !== null && recordJSON.length > 0;
    }

    async GetAllKeys(ctx) {
        const results = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let res = await iterator.next();
        while (!res.done) {
            const strValue = res.value.value.toString('utf8');
            try {
                results.push(JSON.parse(strValue));
            } catch (err) {
                results.push({ username: res.value.key, raw: strValue });
            }
            res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(results);
    }

    // ------------------------------------------------------------ internals

    /** Base64-decode <prefix>_public_key and check it against KEY_SPECS. */
    _decodeKey(input, prefix) {
        const spec = KEY_SPECS[prefix];
        if (input[`${prefix}_algorithm`] !== spec.algorithm) {
            throw new Error(`${prefix}_algorithm must be ${spec.algorithm}`);
        }

        const encoded = input[`${prefix}_public_key`];
        const decoded = Buffer.from(encoded, 'base64');
        // Node's decoder silently skips bad characters, so insist that the
        // input round-trips exactly.
        if (!BASE64_PATTERN.test(encoded) || decoded.toString('base64') !== encoded) {
            throw new Error(`${prefix}_public_key must be standard base64`);
        }
        if (decoded.length !== spec.length) {
            throw new Error(
                `${prefix}_public_key must be ${spec.length} bytes for ${spec.algorithm}, got ${decoded.length}`);
        }
        return decoded;
    }

    /** Transaction timestamp: identical on every endorsing peer, unlike Date.now(). */
    _txTime(ctx) {
        const ts = ctx.stub.getTxTimestamp();
        const seconds = typeof ts.seconds === 'number' ? ts.seconds : Number(ts.seconds.toString());
        return new Date(seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    }

    _assertSubmitterIs(ctx, username) {
        const cn = this._commonName(ctx.clientIdentity.getID());
        if (!cn) {
            throw new Error('could not determine the submitting identity');
        }
        if (this._stripDomain(cn) !== username) {
            throw new Error(
                `identity mismatch: record names user "${username}" ` +
                `but was submitted by "${cn}"`
            );
        }
    }

    // Identity parsing, identical to forensicAudit.js. See the comments there
    // for why the separator is detected rather than assumed.

    _subjectComponents(identityId) {
        const parts = identityId.split('::');
        const subject = parts.length >= 2 ? parts[1] : identityId;
        const sep = subject.trimStart().startsWith('/') ? '/' : ',';
        return subject.split(sep).map((s) => s.trim()).filter(Boolean);
    }

    _subjectFields(identityId, field) {
        if (typeof identityId !== 'string') {
            return [];
        }
        const prefix = `${field}=`;
        return this._subjectComponents(identityId)
            .filter((c) => c.startsWith(prefix))
            .map((c) => c.slice(prefix.length).trim());
    }

    _commonName(identityId) {
        return this._subjectFields(identityId, 'CN')[0] || null;
    }

    _stripDomain(cn) {
        if (!cn) {
            return null;
        }
        const at = cn.indexOf('@');
        return at === -1 ? cn : cn.slice(0, at);
    }
}

module.exports = KeyRegistry;
