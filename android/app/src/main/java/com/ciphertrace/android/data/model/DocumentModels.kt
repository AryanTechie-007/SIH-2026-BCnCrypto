package com.ciphertrace.android.data.model

import com.google.gson.annotations.SerializedName

data class DocumentItem(
    @SerializedName("id") val id: Int,
    @SerializedName("file_name") val fileName: String,
    @SerializedName("title") val title: String,
    @SerializedName("sha3_hash") val sha3Hash: String,
    @SerializedName("size_bytes") val sizeBytes: Long,
    @SerializedName("created_at") val createdAt: String
)

data class DistributeRequest(
    @SerializedName("document_id") val documentId: Int,
    @SerializedName("recipient_ids") val recipientIds: List<Int>? = null
)

data class KeyEnvelopeInfo(
    @SerializedName("recipient_id") val recipientId: Int,
    @SerializedName("recipient_navy_id") val recipientNavyId: String,
    @SerializedName("recipient_name") val recipientName: String,
    @SerializedName("kem_algorithm") val kemAlgorithm: String,
    @SerializedName("kem_ciphertext_preview") val kemCiphertextPreview: String
)

data class DistributionResponse(
    @SerializedName("document_id") val documentId: Int,
    @SerializedName("document_name") val documentName: String,
    @SerializedName("document_sha3") val documentSha3: String,
    @SerializedName("total_envelopes") val totalEnvelopes: Int,
    @SerializedName("envelopes") val envelopes: List<KeyEnvelopeInfo>,
    @SerializedName("envelope_file_name") val envelopeFileName: String
)
