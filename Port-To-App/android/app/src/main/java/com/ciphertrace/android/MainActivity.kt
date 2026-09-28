package com.ciphertrace.android

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.fragment.app.FragmentActivity
import androidx.navigation.compose.rememberNavController
import com.ciphertrace.android.security.TokenManager
import com.ciphertrace.android.ui.navigation.NavGraph
import com.ciphertrace.android.ui.navigation.Screen
import com.ciphertrace.android.ui.theme.CipherTraceTheme

/**
 * Single-Activity host for CIPHERTRACE Android Native Client.
 * Extends FragmentActivity to support AndroidX BiometricPrompt hardware integration.
 */
class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val tokenManager = TokenManager(this)
        val initialDestination = if (tokenManager.isLoggedIn()) {
            Screen.Dashboard.route
        } else {
            Screen.Login.route
        }

        setContent {
            CipherTraceTheme {
                val navController = rememberNavController()
                NavGraph(
                    navController = navController,
                    startDestination = initialDestination
                )
            }
        }
    }
}
