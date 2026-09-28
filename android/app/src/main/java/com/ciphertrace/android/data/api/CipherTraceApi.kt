package com.ciphertrace.android.data.api

import com.ciphertrace.android.data.model.*
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit REST API interface for CIPHERTRACE backend.
 * Mirrors the contract defined in web frontend/src/api/client.ts.
 */
interface CipherTraceApi {

    // ── Authentication ────────────────────────────────────────────────
    @POST("api/auth/login")
    suspend fun login(@Body req: LoginRequest): AuthResponse

    @POST("api/auth/quick-login")
    suspend fun quickLogin(@Body req: QuickLoginRequest): AuthResponse

    @POST("api/auth/register")
    suspend fun register(@Body req: RegisterRequest): AuthResponse

    @POST("api/auth/logout")
    suspend fun logout(): MessageResponse

    @GET("api/auth/me")
    suspend fun getCurrentUser(): UserDto

    @GET("api/auth/users")
    suspend fun getUsers(): List<UserDto>

    @POST("api/auth/refresh")
    suspend fun refreshToken(): TokenRefreshResponse

    @POST("api/auth/devices/register")
    suspend fun registerDevice(@Body req: DeviceRegisterRequest): DeviceRegisterResponse

    // ── Documents ─────────────────────────────────────────────────────
    @GET("api/documents")
    suspend fun getDocuments(): List<DocumentItem>

    @POST("api/documents/distribute")
    suspend fun distributeDocument(@Body req: DistributeRequest): DistributionResponse

    @GET("api/documents/{id}/provenance")
    suspend fun getDocumentProvenance(@Path("id") id: Int): DocumentProvenanceResponse

    // ── Decryption & Attribution ──────────────────────────────────────
    @POST("api/decryption/decrypt")
    suspend fun decryptDocument(@Body req: DecryptionRequest): DecryptionResponse

    @Streaming
    @GET("api/decryption/download/{eventId}")
    suspend fun downloadWatermarkedPdf(@Path("eventId") eventId: Int): Response<ResponseBody>

    // ── Ledger & Blockchain Verification ──────────────────────────────
    @GET("api/ledger/blocks")
    suspend fun getLedgerBlocks(): List<LedgerBlockItem>

    @GET("api/ledger/verify")
    suspend fun verifyLedger(): LedgerVerificationResponse

    @GET("api/ledger/nodes")
    suspend fun getClusterNodes(): ClusterNodesResponse

    // ── System Health ─────────────────────────────────────────────────
    @GET("api/system/health")
    suspend fun getHealth(): SystemHealth
}
