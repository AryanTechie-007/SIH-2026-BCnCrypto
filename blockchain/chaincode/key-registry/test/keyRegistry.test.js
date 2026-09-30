/*
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';
const crypto = require('crypto');
const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const expect = chai.expect;

const { Context } = require('fabric-contract-api');
const { ChaincodeStub } = require('fabric-shim');

const KeyRegistry = require('../lib/keyRegistry.js');

chai.use(sinonChai);

const ISSUER = '/C=US/ST=California/L=San Francisco/O=org1.example.com/CN=ca.org1.example.com';

function identityFor(cn, style = 'openssl') {
    const subject = style === 'openssl'
        ? `/C=US/ST=California/L=San Francisco/OU=client/CN=${cn}`
        : `CN=${cn},OU=client,L=San Francisco,ST=California,C=US`;
    return {
        getID: () => `x509::${subject}::${ISSUER}`,
        getMSPID: () => 'Org1MSP',
    };
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('Key Registry Tests', () => {
    let transactionContext, chaincodeStub, contract, kemKey, dsaKey, keys;

    beforeEach(() => {
        transactionContext = new Context();

        chaincodeStub = sinon.createStubInstance(ChaincodeStub);
        transactionContext.setChaincodeStub(chaincodeStub);
        transactionContext.clientIdentity = identityFor('alice@org1.example.com');
        chaincodeStub.states = {};

        chaincodeStub.putState.callsFake(async (key, value) => {
            chaincodeStub.states[key] = value;
        });

        // Like a real peer, a missing key yields an empty buffer.
        chaincodeStub.getState.callsFake(async (key) => {
            return chaincodeStub.states[key] || Buffer.alloc(0);
        });

        chaincodeStub.getStateByRange.callsFake(async () => {
            const entries = Object.entries(chaincodeStub.states)
                .sort(([a], [b]) => a.localeCompare(b));
            let i = 0;
            return {
                next: async () => {
                    if (i < entries.length) {
                        const [key, value] = entries[i++];
                        return { value: { key, value }, done: false };
                    }
                    return { done: true };
                },
                close: sinon.stub().resolves(),
            };
        });

        // fabric-shim hands back seconds as a protobuf Long.
        chaincodeStub.getTxTimestamp.returns({ seconds: { toString: () => '1790000000' }, nanos: 0 });

        contract = new KeyRegistry();

        kemKey = crypto.randomBytes(1184);
        dsaKey = crypto.randomBytes(1952);
        keys = {
            username: 'alice',
            kem_algorithm: 'ML-KEM-768',
            kem_public_key: kemKey.toString('base64'),
            dsa_algorithm: 'ML-DSA-65',
            dsa_public_key: dsaKey.toString('base64'),
        };
    });

    async function expectError(promise, message) {
        try {
            await promise;
        } catch (err) {
            expect(err.message).to.include(message);
            return;
        }
        expect.fail(`expected an error containing "${message}"`);
    }

    describe('Test RegisterKeys', () => {
        it('should store the keys under the username and emit an event', async () => {
            const ret = await contract.RegisterKeys(transactionContext, JSON.stringify(keys));
            const record = JSON.parse(ret);

            expect(record).to.eql({
                username: 'alice',
                msp_id: 'Org1MSP',
                kem_algorithm: 'ML-KEM-768',
                kem_public_key: keys.kem_public_key,
                kem_key_fingerprint: sha256(kemKey),
                dsa_algorithm: 'ML-DSA-65',
                dsa_public_key: keys.dsa_public_key,
                dsa_key_fingerprint: sha256(dsaKey),
                registered_at: '2026-09-21T14:13:20Z',
            });
            expect((await chaincodeStub.getState('alice')).toString()).to.equal(ret);
            expect(chaincodeStub.setEvent).to.have.been.calledOnceWith('KeysRegistered', sinon.match.instanceOf(Buffer));
        });

        it('should store the record with deterministically sorted keys', async () => {
            const ret = await contract.RegisterKeys(transactionContext, JSON.stringify(keys));
            const fields = Object.keys(JSON.parse(ret));
            expect(fields).to.eql([...fields].sort());
        });

        it('should ignore fields outside the schema', async () => {
            const ret = await contract.RegisterKeys(transactionContext,
                JSON.stringify({ ...keys, msp_id: 'Org2MSP', registered_at: 'yesterday', extra: 'x' }));
            const record = JSON.parse(ret);
            expect(record.msp_id).to.equal('Org1MSP');
            expect(record.registered_at).to.equal('2026-09-21T14:13:20Z');
            expect(record).to.not.have.property('extra');
        });

        it('should accept a numeric timestamp', async () => {
            chaincodeStub.getTxTimestamp.returns({ seconds: 0, nanos: 0 });
            const ret = await contract.RegisterKeys(transactionContext, JSON.stringify(keys));
            expect(JSON.parse(ret).registered_at).to.equal('1970-01-01T00:00:00Z');
        });

        it('should accept an RFC2253-style identity string', async () => {
            transactionContext.clientIdentity = identityFor('alice@org1.example.com', 'rfc2253');
            await contract.RegisterKeys(transactionContext, JSON.stringify(keys));
            expect(chaincodeStub.putState).to.have.been.calledOnce;
        });

        it('should return error when keysJSON is not valid JSON', async () => {
            await expectError(contract.RegisterKeys(transactionContext, '{not json'), 'not valid JSON');
        });

        it('should return error when keysJSON is not an object', async () => {
            await expectError(contract.RegisterKeys(transactionContext, '[]'), 'must be a JSON object');
            await expectError(contract.RegisterKeys(transactionContext, 'null'), 'must be a JSON object');
        });

        for (const field of ['username', 'kem_algorithm', 'kem_public_key', 'dsa_algorithm', 'dsa_public_key']) {
            it(`should return error when ${field} is missing or empty`, async () => {
                const missing = { ...keys };
                delete missing[field];
                await expectError(contract.RegisterKeys(transactionContext, JSON.stringify(missing)),
                    `missing required field: ${field}`);
                await expectError(contract.RegisterKeys(transactionContext, JSON.stringify({ ...keys, [field]: '' })),
                    `missing required field: ${field}`);
            });
        }

        it('should return error for a username with illegal characters', async () => {
            await expectError(contract.RegisterKeys(transactionContext, JSON.stringify({ ...keys, username: 'al ice' })),
                'username must be');
        });

        it('should reject keys naming a different user', async () => {
            transactionContext.clientIdentity = identityFor('bob@org1.example.com');
            await expectError(contract.RegisterKeys(transactionContext, JSON.stringify(keys)), 'identity mismatch');
            expect(chaincodeStub.putState).to.not.have.been.called;
        });

        it('should reject an identity without a CN', async () => {
            transactionContext.clientIdentity = {
                getID: () => `x509::/C=US/OU=client::${ISSUER}`,
                getMSPID: () => 'Org1MSP',
            };
            await expectError(contract.RegisterKeys(transactionContext, JSON.stringify(keys)),
                'could not determine the submitting identity');
        });

        it('should return error when the user already has keys', async () => {
            await contract.RegisterKeys(transactionContext, JSON.stringify(keys));
            await expectError(contract.RegisterKeys(transactionContext, JSON.stringify(keys)),
                'a key record for user alice already exists');
        });

        it('should return error for the wrong algorithm', async () => {
            await expectError(contract.RegisterKeys(transactionContext, JSON.stringify({ ...keys, kem_algorithm: 'ML-KEM-512' })),
                'kem_algorithm must be ML-KEM-768');
            await expectError(contract.RegisterKeys(transactionContext, JSON.stringify({ ...keys, dsa_algorithm: 'Ed25519' })),
                'dsa_algorithm must be ML-DSA-65');
        });

        it('should return error for a key that is not base64', async () => {
            await expectError(contract.RegisterKeys(transactionContext, JSON.stringify({ ...keys, kem_public_key: 'not base64!' })),
                'kem_public_key must be standard base64');
        });

        it('should return error for a key of the wrong size', async () => {
            const short = crypto.randomBytes(1000).toString('base64');
            await expectError(contract.RegisterKeys(transactionContext, JSON.stringify({ ...keys, dsa_public_key: short })),
                'dsa_public_key must be 1952 bytes for ML-DSA-65, got 1000');
        });
    });

    describe('Test GetKeys', () => {
        it('should return the stored record', async () => {
            const ret = await contract.RegisterKeys(transactionContext, JSON.stringify(keys));
            expect(await contract.GetKeys(transactionContext, 'alice')).to.equal(ret);
        });

        it('should return error when the user has no keys', async () => {
            await expectError(contract.GetKeys(transactionContext, 'nobody'), 'no record found for user nobody');
        });

        it('should return error when getState returns null', async () => {
            chaincodeStub.getState.resolves(null);
            await expectError(contract.GetKeys(transactionContext, 'alice'), 'no record found');
        });
    });

    describe('Test KeysExist', () => {
        it('should report whether a user has keys', async () => {
            expect(await contract.KeysExist(transactionContext, 'alice')).to.equal(false);
            await contract.RegisterKeys(transactionContext, JSON.stringify(keys));
            expect(await contract.KeysExist(transactionContext, 'alice')).to.equal(true);
        });
    });

    describe('Test GetAllKeys', () => {
        it('should return an empty array when nobody is registered', async () => {
            expect(JSON.parse(await contract.GetAllKeys(transactionContext))).to.eql([]);
        });

        it('should return every registered user', async () => {
            await contract.RegisterKeys(transactionContext, JSON.stringify(keys));
            transactionContext.clientIdentity = identityFor('bob@org1.example.com');
            await contract.RegisterKeys(transactionContext, JSON.stringify({ ...keys, username: 'bob' }));

            const all = JSON.parse(await contract.GetAllKeys(transactionContext));
            expect(all.map((r) => r.username)).to.eql(['alice', 'bob']);
        });

        it('should wrap non-JSON values with their key', async () => {
            chaincodeStub.states.carol = Buffer.from('garbage');
            expect(JSON.parse(await contract.GetAllKeys(transactionContext))).to.eql([{ username: 'carol', raw: 'garbage' }]);
        });
    });
});
