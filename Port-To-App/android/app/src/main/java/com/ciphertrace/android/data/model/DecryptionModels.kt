package com.ciphertrace.android.data.model

import com.google.gson.annotations.SerializedName

data class DecryptionRequest(
    @SerializedName("document_id") val documentId: Int,
    @SerializedName("recipient_id") val recipientId: Int,
    @SerializedName("device_id") val deviceId: String? = null,
    @SerializedName("keystore_password") val keystorePassword: String? = null
)

data class DecryptionResponse(
    @SerializedName("event_id") val eventId: Int,
    @SerializedName("document_id") val documentId: Int,
    @SerializedName("recipient_name") val recipientName: String,
    @SerializedName("recipient_navy_id") val recipientNavyId: String,
    @SerializedName("session_nonce") val sessionNonce: String,
    @SerializedName("timestamp") val timestamp: String,
    @SerializedName("watermark_id") val watermarkId: String,
    @SerializedName("watermark_hex") val watermarkHex: String,
    @SerializedName("signature_algorithm") val signatureAlgorithm: String = "ML-DSA-65",
    @SerializedName("kem_algorithm") val kemAlgorithm: String = "ML-KEM-768",
    @SerializedName("ml_dsa_signature_preview") val mlDsaSignaturePreview: String,
    @SerializedName("ledger_block_index") val ledgerBlockIndex: Int,
    @SerializedName("ledger_block_hash") val ledgerBlockHash: String,
    @SerializedName("fabric_tx_id") val fabricTxId: String?,
    @SerializedName("download_url") val downloadUrl: String
)

data class VerificationGates(
    @SerializedName("watermark_valid") val watermarkValid: Boolean,
    @SerializedName("ledger_event_exists") val ledgerEventExists: Boolean,
    @SerializedName("ml_dsa_signature_valid") val mlDsaSignatureValid: Boolean,
    @SerializedName("merkle_inclusion_valid") val merkleInclusionValid: Boolean,
    @SerializedName("document_hash_match") val documentHashMatch: Boolean,
    @SerializedName("ledger_chain_integrity") val ledgerChainIntegrity: Boolean
)

data class ForensicAnalysisResponse(
    @SerializedName("status") val status: String,
    @SerializedName("watermark_detected") val watermarkDetected: Boolean,
    @SerializedName("watermark_id") val watermarkId: String?,
    @SerializedName("watermark_hex") val watermarkHex: String?,
    @SerializedName("recipient_name") val recipientName: String?,
    @SerializedName("recipient_navy_id") val recipientNavyId: String?,
    @SerializedName("decryption_timestamp") val decryptionTimestamp: String?,
    @SerializedName("device_id") val deviceId: String?,
    @SerializedName("document_name") val documentName: String?,
    @SerializedName("signature_valid") val signatureValid: Boolean,
    @SerializedName("ledger_block_index") val ledgerBlockIndex: Int?,
    @SerializedName("fabric_tx_id") val fabricTxId: String?,
    @SerializedName("fabric_committed") val fabricCommitted: Boolean,
    @SerializedName("verification_gates") val verificationGates: VerificationGates?,
    @SerializedName("forensic_confidence") val forensicConfidence: Float,
    @SerializedName("message") val message: String
)
