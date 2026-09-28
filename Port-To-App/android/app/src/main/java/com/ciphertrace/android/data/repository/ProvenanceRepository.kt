package com.ciphertrace.android.data.repository

import android.content.Context
import com.ciphertrace.android.data.api.ApiClient
import com.ciphertrace.android.data.model.ClusterNodesResponse
import com.ciphertrace.android.data.model.LedgerBlockItem
import com.ciphertrace.android.data.model.LedgerVerificationResponse
import com.ciphertrace.android.data.model.SystemHealth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ProvenanceRepository(context: Context) {

    private val api = ApiClient.getApi(context)

    suspend fun getLedgerBlocks(): Result<List<LedgerBlockItem>> = withContext(Dispatchers.IO) {
        try {
            val blocks = api.getLedgerBlocks()
            Result.success(blocks)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyLedger(): Result<LedgerVerificationResponse> = withContext(Dispatchers.IO) {
        try {
            val verification = api.verifyLedger()
            Result.success(verification)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getClusterNodes(): Result<ClusterNodesResponse> = withContext(Dispatchers.IO) {
        try {
            val nodes = api.getClusterNodes()
            Result.success(nodes)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getSystemHealth(): Result<SystemHealth> = withContext(Dispatchers.IO) {
        try {
            val health = api.getHealth()
            Result.success(health)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
