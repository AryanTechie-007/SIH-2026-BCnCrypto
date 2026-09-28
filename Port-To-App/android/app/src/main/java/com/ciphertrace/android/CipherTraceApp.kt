package com.ciphertrace.android

import android.app.Application
import com.ciphertrace.android.data.api.ApiClient
import com.ciphertrace.android.security.TokenManager

/**
 * Application entry point for CIPHERTRACE Android Native Client.
 */
class CipherTraceApp : Application() {

    override fun onCreate() {
        super.onCreate()
        // Initialize security token manager and prime network client
        val tokenManager = TokenManager(this)
        ApiClient.getApi(this)
    }
}
