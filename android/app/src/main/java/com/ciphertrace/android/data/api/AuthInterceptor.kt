package com.ciphertrace.android.data.api

import com.ciphertrace.android.security.TokenManager
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Injects cryptographic session bearer token and mobile hardware metadata into outgoing API calls.
 */
class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()

        // Inject JWT bearer authorization if available
        tokenManager.getToken()?.let { token ->
            builder.header("Authorization", "Bearer $token")
        }

        // Inject mobile hardware fingerprint and platform identification
        builder.header("X-Device-Fingerprint", tokenManager.getDeviceFingerprint())
        builder.header("X-Client-Platform", "Android-Native")
        builder.header("Accept", "application/json")

        val response = chain.proceed(builder.build())

        // If the server rejects the token (e.g. revoked or expired)
        if (response.code == 401 && tokenManager.isLoggedIn()) {
            tokenManager.clearAuth()
        }

        return response
    }
}
