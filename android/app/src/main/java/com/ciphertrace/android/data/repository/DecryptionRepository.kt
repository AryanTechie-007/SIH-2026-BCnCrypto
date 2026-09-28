package com.ciphertrace.android.data.repository

import android.content.Context
import com.ciphertrace.android.data.api.ApiClient
import com.ciphertrace.android.data.model.DecryptionRequest
import com.ciphertrace.android.data.model.DecryptionResponse
import com.ciphertrace.android.security.TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DecryptionRepository(private val context: Context) {

    private val api = ApiClient.getApi(context)
    private val tokenManager = TokenManager(context)

    suspend fun decryptDocument(
        documentId: Int,
        keystorePassword: String? = null
    ): Result<DecryptionResponse> = withContext(Dispatchers.IO) {
        try {
            val req = DecryptionRequest(
                documentId = documentId,
                recipientId = tokenManager.getUserId(),
                deviceId = tokenManager.getDeviceFingerprint(),
                keystorePassword = keystorePassword
            )
            val res = api.decryptDocument(req)
            Result.success(res)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
