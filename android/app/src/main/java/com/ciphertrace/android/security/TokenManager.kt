package com.ciphertrace.android.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Hardware-backed security manager for session JWTs and cryptographic identity metadata.
 * Uses Android Keystore MasterKey and AES-256-GCM encrypted preferences.
 */
class TokenManager(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = try {
        EncryptedSharedPreferences.create(
            context,
            "ciphertrace_secure_vault",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback for emulator environments without hardware KeyStore support
        context.getSharedPreferences("ciphertrace_dev_vault", Context.MODE_PRIVATE)
    }

    companion object {
        private const val KEY_JWT_TOKEN = "jwt_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USERNAME = "username"
        private const val KEY_NAME = "name"
        private const val KEY_NAVY_ID = "navy_id"
        private const val KEY_RANK = "rank"
        private const val KEY_ROLE = "role"
        private const val KEY_CLEARANCE = "clearance_level"
        private const val KEY_SERVER_URL = "custom_server_url"
        private const val KEY_BIOMETRIC_ENABLED = "biometric_enabled"
        private const val KEY_DEVICE_FINGERPRINT = "device_fingerprint"

        const val DEFAULT_EMULATOR_URL = "http://10.0.2.2:8000/"
        const val DEFAULT_LOCALHOST_URL = "http://127.0.0.1:8000/"
    }

    fun saveAuth(
        token: String,
        userId: Int,
        username: String,
        name: String,
        navyId: String,
        rank: String,
        role: String,
        clearance: String
    ) {
        prefs.edit().apply {
            putString(KEY_JWT_TOKEN, token)
            putInt(KEY_USER_ID, userId)
            putString(KEY_USERNAME, username)
            putString(KEY_NAME, name)
            putString(KEY_NAVY_ID, navyId)
            putString(KEY_RANK, rank)
            putString(KEY_ROLE, role)
            putString(KEY_CLEARANCE, clearance)
            apply()
        }
    }

    fun getToken(): String? = prefs.getString(KEY_JWT_TOKEN, null)

    fun getUserId(): Int = prefs.getInt(KEY_USER_ID, -1)

    fun getUsername(): String? = prefs.getString(KEY_USERNAME, null)

    fun getName(): String = prefs.getString(KEY_NAME, "Officer") ?: "Officer"

    fun getNavyId(): String = prefs.getString(KEY_NAVY_ID, "NAVY-0001") ?: "NAVY-0001"

    fun getRank(): String = prefs.getString(KEY_RANK, "TACTICAL OFFICER") ?: "TACTICAL OFFICER"

    fun getRole(): String = prefs.getString(KEY_ROLE, "RECIPIENT") ?: "RECIPIENT"

    fun getClearance(): String = prefs.getString(KEY_CLEARANCE, "TOP SECRET") ?: "TOP SECRET"

    fun isLoggedIn(): Boolean = !getToken().isNullOrBlank()

    fun clearAuth() {
        prefs.edit().apply {
            remove(KEY_JWT_TOKEN)
            remove(KEY_USER_ID)
            remove(KEY_USERNAME)
            remove(KEY_NAME)
            remove(KEY_NAVY_ID)
            remove(KEY_RANK)
            remove(KEY_ROLE)
            remove(KEY_CLEARANCE)
            apply()
        }
    }

    // ── Server URL Configuration ─────────────────────────────────────
    fun getServerUrl(): String {
        return prefs.getString(KEY_SERVER_URL, DEFAULT_EMULATOR_URL) ?: DEFAULT_EMULATOR_URL
    }

    fun setServerUrl(url: String) {
        val sanitized = if (!url.endsWith("/")) "$url/" else url
        prefs.edit().putString(KEY_SERVER_URL, sanitized).apply()
    }

    // ── Biometric & Device Binding ────────────────────────────────────
    fun isBiometricEnabled(): Boolean = prefs.getBoolean(KEY_BIOMETRIC_ENABLED, true)

    fun setBiometricEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_BIOMETRIC_ENABLED, enabled).apply()
    }

    fun getDeviceFingerprint(): String {
        var fp = prefs.getString(KEY_DEVICE_FINGERPRINT, null)
        if (fp == null) {
            fp = "DEV-" + java.util.UUID.randomUUID().toString().substring(0, 8).uppercase()
            prefs.edit().putString(KEY_DEVICE_FINGERPRINT, fp).apply()
        }
        return fp
    }
}
