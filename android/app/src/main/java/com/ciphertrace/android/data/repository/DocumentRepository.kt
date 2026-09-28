package com.ciphertrace.android.data.repository

import android.content.Context
import com.ciphertrace.android.data.api.ApiClient
import com.ciphertrace.android.data.model.DocumentItem
import com.ciphertrace.android.data.model.DocumentProvenanceResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DocumentRepository(context: Context) {

    private val api = ApiClient.getApi(context)

    suspend fun getDocuments(): Result<List<DocumentItem>> = withContext(Dispatchers.IO) {
        try {
            val docs = api.getDocuments()
            Result.success(docs)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDocumentProvenance(documentId: Int): Result<DocumentProvenanceResponse> = withContext(Dispatchers.IO) {
        try {
            val provenance = api.getDocumentProvenance(documentId)
            Result.success(provenance)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
