package com.ciphertrace.android.data.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String
)

data class QuickLoginRequest(
    @SerializedName("officer") val officer: String
)

data class RegisterRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String,
    @SerializedName("display_name") val displayName: String,
    @SerializedName("navy_id") val navyId: String? = null,
    @SerializedName("rank") val rank: String? = "OFFICER",
    @SerializedName("command_unit") val commandUnit: String? = "TACTICAL COMMAND",
    @SerializedName("clearance_level") val clearanceLevel: String? = "LEVEL-5 TOP SECRET",
    @SerializedName("device_id") val deviceId: String? = null,
    @SerializedName("role") val role: String? = "RECIPIENT"
)

data class UserDto(
    @SerializedName("id") val id: Int,
    @SerializedName("username") val username: String,
    @SerializedName("name") val name: String,
    @SerializedName("navy_id") val navyId: String,
    @SerializedName("rank") val rank: String,
    @SerializedName("command_unit") val commandUnit: String,
    @SerializedName("clearance_level") val clearanceLevel: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("role") val role: String,
    @SerializedName("status") val status: String,
    @SerializedName("kem_key_id") val kemKeyId: String,
    @SerializedName("dsa_key_id") val dsaKeyId: String,
    @SerializedName("key_status") val keyStatus: String,
    @SerializedName("ml_kem_pub_preview") val mlKemPubPreview: String,
    @SerializedName("ml_dsa_pub_preview") val mlDsaPubPreview: String
)

data class AuthResponse(
    @SerializedName("user") val user: UserDto,
    @SerializedName("token") val token: String,
    @SerializedName("message") val message: String
)

data class MessageResponse(
    @SerializedName("message") val message: String
)

data class TokenRefreshResponse(
    @SerializedName("token") val token: String,
    @SerializedName("expires_in_minutes") val expiresInMinutes: Int,
    @SerializedName("message") val message: String
)

data class DeviceRegisterRequest(
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("device_type") val deviceType: String = "ANDROID",
    @SerializedName("device_fingerprint") val deviceFingerprint: String,
    @SerializedName("push_token") val pushToken: String? = null
)

data class DeviceRegisterResponse(
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("device_fingerprint") val deviceFingerprint: String,
    @SerializedName("registered") val registered: Boolean,
    @SerializedName("status") val status: String,
    @SerializedName("message") val message: String
)
