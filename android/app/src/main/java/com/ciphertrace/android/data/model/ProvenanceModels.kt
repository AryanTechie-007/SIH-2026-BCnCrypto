package com.ciphertrace.android.data.model

import com.google.gson.annotations.SerializedName

data class ProvenanceDecryptionEvent(
    @SerializedName("event_id") val eventId: Int,
    @SerializedName("recipient_id") val recipientId: Int,
    @SerializedName("recipient_name") val recipientName: String,
    @SerializedName("recipient_navy_id") val recipientNavyId: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("timestamp") val timestamp: String,
    @SerializedName("watermark_id") val watermarkId: String,
    @SerializedName("watermark_hex") val watermarkHex: String,
    @SerializedName("signature_algorithm") val signatureAlgorithm: String,
    @SerializedName("kem_algorithm") val kemAlgorithm: String,
    @SerializedName("signature_preview") val signaturePreview: String,
    @SerializedName("ledger_block_index") val ledgerBlockIndex: Int,
    @SerializedName("ledger_block_hash") val ledgerBlockHash: String,
    @SerializedName("fabric_tx_id") val fabricTxId: String?,
    @SerializedName("blockchain_confirmed") val blockchainConfirmed: Boolean
)

data class DocumentProvenanceResponse(
    @SerializedName("document_id") val documentId: Int,
    @SerializedName("file_name") val fileName: String,
    @SerializedName("title") val title: String,
    @SerializedName("sha3_hash") val sha3Hash: String,
    @SerializedName("size_bytes") val sizeBytes: Long,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("total_distributions") val totalDistributions: Int,
    @SerializedName("decryption_events") val decryptionEvents: List<ProvenanceDecryptionEvent>,
    @SerializedName("total_decryptions") val totalDecryptions: Int,
    @SerializedName("integrity_verified") val integrityVerified: Boolean
)

data class LedgerBlockItem(
    @SerializedName("id") val id: Int,
    @SerializedName("prev_block_hash") val prevBlockHash: String,
    @SerializedName("block_hash") val blockHash: String,
    @SerializedName("merkle_root") val merkleRoot: String,
    @SerializedName("timestamp") val timestamp: String,
    @SerializedName("data") val data: String,
    @SerializedName("endorsers") val endorsers: String
)

data class LedgerVerificationResponse(
    @SerializedName("valid") val valid: Boolean,
    @SerializedName("chain_length") val chainLength: Int,
    @SerializedName("verified_at") val verifiedAt: String,
    @SerializedName("message") val message: String
)
