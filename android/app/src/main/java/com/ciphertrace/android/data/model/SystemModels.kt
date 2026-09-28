package com.ciphertrace.android.data.model

import com.google.gson.annotations.SerializedName

data class SystemHealth(
    @SerializedName("status") val status: String,
    @SerializedName("mode") val mode: String?,
    @SerializedName("version") val version: String?,
    @SerializedName("database") val database: String?,
    @SerializedName("pqc_status") val pqcStatus: String?
)

data class ClusterNodeInfo(
    @SerializedName("id") val id: String,
    @SerializedName("role") val role: String,
    @SerializedName("status") val status: String,
    @SerializedName("pqc_level") val pqcLevel: String
)

data class ClusterNodesResponse(
    @SerializedName("nodes") val nodes: List<ClusterNodeInfo>,
    @SerializedName("consensus") val consensus: String
)
