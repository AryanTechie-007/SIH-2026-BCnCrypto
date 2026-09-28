package com.ciphertrace.android.ui.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.NetworkCheck
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ciphertrace.android.data.api.ApiClient
import com.ciphertrace.android.data.repository.ProvenanceRepository
import com.ciphertrace.android.security.TokenManager
import com.ciphertrace.android.ui.components.GlassmorphicCard
import com.ciphertrace.android.ui.components.TacticalButton
import com.ciphertrace.android.ui.components.TopBar
import com.ciphertrace.android.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val tokenManager = remember { TokenManager(context) }
    val scope = rememberCoroutineScope()

    var serverUrl by remember { mutableStateOf(tokenManager.getServerUrl()) }
    var biometricEnabled by remember { mutableStateOf(tokenManager.isBiometricEnabled()) }
    var testResult by remember { mutableStateOf<String?>(null) }
    var isTesting by remember { mutableStateOf(false) }

    fun testConnection() {
        tokenManager.setServerUrl(serverUrl)
        ApiClient.reset()
        isTesting = true
        testResult = null
        scope.launch {
            val repository = ProvenanceRepository(context)
            val startTime = System.currentTimeMillis()
            val healthRes = repository.getSystemHealth()
            val elapsed = System.currentTimeMillis() - startTime
            isTesting = false
            if (healthRes.isSuccess) {
                val h = healthRes.getOrNull()
                testResult = "SUCCESS: Backend reachable in ${elapsed}ms (${h?.status}, Mode: ${h?.mode ?: "DEMO"})"
            } else {
                testResult = "ERROR: Failed to connect to $serverUrl (${healthRes.exceptionOrNull()?.localizedMessage})"
            }
        }
    }

    Scaffold(
        topBar = {
            TopBar(
                title = "FIELD TERMINAL SETTINGS",
                subtitle = "NETWORK & HARDWARE CONFIGURATION",
                showBackButton = true,
                onBackClick = onNavigateBack
            )
        },
        containerColor = CyberBgDark
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Network Configuration Card
            GlassmorphicCard {
                Text(
                    text = "BACKEND SERVER URL",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    color = CyberCyan
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = { serverUrl = it },
                    label = { Text("API Gateway Base URL") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CyberCyan,
                        unfocusedBorderColor = CyberCardBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Presets
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            serverUrl = TokenManager.DEFAULT_EMULATOR_URL
                            tokenManager.setServerUrl(serverUrl)
                            ApiClient.reset()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberCardDark)
                    ) {
                        Text("EMULATOR", fontSize = 10.sp, color = CyberCyan)
                    }

                    Button(
                        onClick = {
                            serverUrl = TokenManager.DEFAULT_LOCALHOST_URL
                            tokenManager.setServerUrl(serverUrl)
                            ApiClient.reset()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberCardDark)
                    ) {
                        Text("ADB REVERSE", fontSize = 10.sp, color = CyberCyan)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                TacticalButton(
                    text = if (isTesting) "TESTING PING..." else "TEST LIVE BACKEND CONNECTIVITY",
                    icon = Icons.Default.NetworkCheck,
                    onClick = { testConnection() },
                    enabled = !isTesting,
                    isPrimary = true
                )

                if (testResult != null) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = testResult!!,
                        color = if (testResult!!.startsWith("SUCCESS")) CyberEmerald else CyberCrimson,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Hardware Device Binding Card
            GlassmorphicCard {
                Text(
                    text = "HARDWARE DEVICE IDENTIFIERS",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    color = CyberCyan
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text("BOUND FINGERPRINT", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = TextMuted)
                Text(tokenManager.getDeviceFingerprint(), fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = TextPrimary)

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Biometric Hardware Gate", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Text("Require biometric confirmation for decryption", fontSize = 11.sp, color = TextSecondary)
                    }
                    Switch(
                        checked = biometricEnabled,
                        onCheckedChange = {
                            biometricEnabled = it
                            tokenManager.setBiometricEnabled(it)
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = CyberCyan,
                            checkedTrackColor = CyberCyanDim
                        )
                    )
                }
            }
        }
    }
}
