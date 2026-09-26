'use strict';

const { Contract } = require('fabric-contract-api');

class ForensicAuditContract extends Contract {

    constructor() {
        super('ForensicAuditContract');
    }

    async initLedger(ctx) {
        console.info('============= CIPHERTRACE Forensic Audit Chaincode Initialized =============');
    }

    /**
     * Records an immutable decryption viewing event with ML-DSA-65 post-quantum signature.
     * Enforced by Consortium Multi-Org Endorsement (Org1-Defense, Org2-Audit, Org3-Forensic).
     */
    async RecordDecryption(ctx, recordJson) {
        let record;
        try {
            record = JSON.parse(recordJson);
        } catch (err) {
            throw new Error(`Invalid JSON payload: ${err.message}`);
        }

        // Validate required fields (FIPS 203 / 204 compliant)
        const required = [
            'record_id',
            'watermark_id',
            'event_hash',
            'document_hash',
            'recipient_key_id',
            'recipient_id',
            'timestamp',
            'signature',
            'signature_algorithm',
            'kem_algorithm'
        ];

        for (const field of required) {
            if (!record[field]) {
                throw new Error(`Missing mandatory cryptographic audit field: ${field}`);
            }
        }

        const wmId = record.watermark_id.toLowerCase();
        if (!/^[0-9a-f]{20}$/.test(wmId)) {
            throw new Error(`watermark_id must be exactly 20 lowercase hex characters, got: ${wmId}`);
        }

        // Check if watermark already registered (prevent duplicates)
        const existingKey = `WM_${wmId}`;
        const existingBytes = await ctx.stub.getState(existingKey);
        if (existingBytes && existingBytes.length > 0) {
            throw new Error(`Duplicate watermark registration: watermark ${wmId} already committed on-chain`);
        }

        const txId = ctx.stub.getTxID();
        const clientIdentity = ctx.clientIdentity ? ctx.clientIdentity.getID() : 'unknown';

        const enrichedRecord = {
            ...record,
            fabric_tx_id: txId,
            endorsing_client: clientIdentity,
            committed_at: new Date().toISOString(),
            schema_version: "2"
        };

        const buffer = Buffer.from(JSON.stringify(enrichedRecord));

        // Primary key by record ID
        await ctx.stub.putState(`RECORD_${record.record_id}`, buffer);
        // Authoritative forensic lookup index by watermark ID
        await ctx.stub.putState(`WM_${wmId}`, buffer);
        // Document cross-reference index
        await ctx.stub.putState(`DOC_${record.document_hash}_${record.record_id}`, buffer);

        // Emit Fabric event for forensic monitors
        await ctx.stub.setEvent('DecryptionAudited', Buffer.from(JSON.stringify({
            record_id: record.record_id,
            watermark_id: wmId,
            recipient_id: record.recipient_id,
            document_hash: record.document_hash,
            tx_id: txId
        })));

        return JSON.stringify({
            status: "COMMITTED",
            tx_id: txId,
            watermark_id: wmId,
            record_id: record.record_id
        });
    }

    /**
     * Authoritative Forensic Lookup: Queries ledger by 20-character watermark ID.
     */
    async LookupByWatermark(ctx, watermarkId) {
        if (!watermarkId) {
            throw new Error('watermarkId parameter is required');
        }
        const cleanId = watermarkId.toLowerCase().trim();
        const recordBytes = await ctx.stub.getState(`WM_${cleanId}`);
        if (!recordBytes || recordBytes.length === 0) {
            throw new Error(`Watermark ${cleanId} not found in distributed ledger`);
        }
        return recordBytes.toString();
    }

    /**
     * Retrieves audit record by primary record ID.
     */
    async GetRecord(ctx, recordId) {
        const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);
        if (!recordBytes || recordBytes.length === 0) {
            throw new Error(`Record ${recordId} not found`);
        }
        return recordBytes.toString();
    }

    /**
     * Retrieves all committed forensic records across the consortium.
     */
    async GetAllRecords(ctx) {
        const iterator = await ctx.stub.getStateByRange('RECORD_', 'RECORD_\uffff');
        const allResults = [];
        let res = await iterator.next();
        while (!res.done) {
            if (res.value && res.value.value.toString()) {
                try {
                    const record = JSON.parse(res.value.value.toString('utf8'));
                    allResults.push(record);
                } catch (err) {
                    console.error(err);
                }
            }
            res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(allResults);
    }
}

module.exports = ForensicAuditContract;
