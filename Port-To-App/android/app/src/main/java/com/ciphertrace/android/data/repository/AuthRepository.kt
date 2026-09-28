package com.ciphertrace.android.data.repository

import android.content.Context
import com.ciphertrace.android.data.api.ApiClient
import com.ciphertrace.android.data.model.*
import com.ciphertrace.android.security.SecurityManager
import com.ciphertrace.android.security.TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthRepository(private val context: Context) {

    private val api = ApiClient.getApi(context)
    private val tokenManager = TokenManager(context)

    suspend fun login(username: String, password: String): Result<AuthResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.login(LoginRequest(username = username, password = password))
            tokenManager.saveAuth(
                token = response.token,
                userId = response.user.id,
                username = response.user.username,
                name = response.user.name,
                navyId = response.user.navyId,
                rank = response.user.rank,
                role = response.user.role,
                clearance = response.user.clearanceLevel
            )
            // Auto-register mobile hardware binding
            registerDevice()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun quickLogin(officer: String): Result<AuthResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.quickLogin(QuickLoginRequest(officer = officer))
            tokenManager.saveAuth(
                token = response.token,
                userId = response.user.id,
                username = response.user.username,
                name = response.user.name,
                navyId = response.user.navyId,
                rank = response.user.rank,
                role = response.user.role,
                clearance = response.user.clearanceLevel
            )
            registerDevice()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun registerDevice(): Result<DeviceRegisterResponse> = withContext(Dispatchers.IO) {
        try {
            val req = DeviceRegisterRequest(
                deviceName = SecurityManager.getDeviceModelName(),
                deviceType = "ANDROID",
                deviceFingerprint = tokenManager.getDeviceFingerprint()
            )
            val res = api.registerDevice(req)
            Result.success(res)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getCurrentUser(): Result<UserDto> = withContext(Dispatchers.IO) {
        try {
            val user = api.getCurrentUser()
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            api.logout()
        } catch (_: Exception) {
            // Ignore network failures on logout
        } finally {
            tokenManager.clearAuth()
        }
        Result.success(Unit)
    }

    fun isLoggedIn(): Boolean = tokenManager.isLoggedIn()
    fun getOfficerName(): String = tokenManager.getName()
    fun getOfficerRank(): String = tokenManager.getRank()
    fun getOfficerNavyId(): String = tokenManager.getNavyId()
    fun getClearance(): String = tokenManager.getClearance()
}
