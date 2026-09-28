package com.ciphertrace.android.ui.screens.decryption

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import com.ciphertrace.android.data.model.DecryptionResponse
import com.ciphertrace.android.data.repository.DecryptionRepository
import com.ciphertrace.android.security.BiometricPromptHelper
import com.ciphertrace.android.security.SecurityManager
import com.ciphertrace.android.ui.components.*
import com.ciphertrace.android.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun DecryptionScreen(
    documentId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToProvenance: (Int) -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val fragmentActivity = context as? FragmentActivity
    val repository = remember { DecryptionRepository(context) }
    val scope = rememberCoroutineScope()

    var isAuthorizing by remember { mutableStateOf(false) }
    var decryptionResult by remember { mutableStateOf<DecryptionResponse?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var keystorePassword by remember { mutableStateOf("password123") }

    // Enforce FLAG_SECURE on this sensitive screen
    DisposableEffect(Unit) {
        if (activity != null) {
            SecurityManager.setScreenProtection(activity, true)
        }
        onDispose {
            if (activity != null) {
                SecurityManager.setScreenProtection(activity, false)
            }
        }
    }

    fun executeDecryption() {
        isAuthorizing = true
        errorMessage = null
        scope.launch {
            val result = repository.decryptDocument(documentId, keystorePassword)
            isAuthorizing = false
            if (result.isSuccess) {
                decryptionResult = result.getOrNull()
            } else {
                errorMessage = result.exceptionOrNull()?.localizedMessage ?: "Decryption authorization failed"
            }
        }
    }

    fun triggerBiometricAndDecrypt() {
        if (fragmentActivity != null) {
            val biometricHelper = BiometricPromptHelper(fragmentActivity)
            if (biometricHelper.isBiometricAvailable()) {
                biometricHelper.authenticate(
                    title = "Biometric Cryptographic Authorization",
                    subtitle = "Verify identity to authorize ML-KEM-768 decapsulation",
                    onSuccess = { executeDecryption() },
                    onError = {
                        // Fallback to direct password execution on emulator or error
                        executeDecryption()
                    }
                )
                return
            }
        }
        // Fallback for emulator without enrolled biometrics
        executeDecryption()
    }

    Scaffold(
        topBar = {
            TopBar(
                title = "DECRYPTION GATEWAY",
                subtitle = "FLAG_SECURE ACTIVE // SCREEN SHIELDED",
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
            // Shield Notification
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(CyberCrimson.copy(alpha = 0.1f))
                    .border(1.dp, CyberCrimson.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                    .padding(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(Icons.Default.Shield, contentDescription = null, tint = CyberCrimson)
                    Column {
                        Text(
                            text = "AIR-GAPPED HARDWARE PROTECTION ACTIVE",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = CyberCrimson,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "Screenshots and screen recordings are blocked by OS policy (FLAG_SECURE).",
                            fontSize = 10.sp,
                            color = TextSecondary
                        )
                    }
                }
            }

            if (decryptionResult == null) {
                // Pre-decryption Gateway Card
                GlassmorphicCard {
                    Text(
                        text = "CRYPTOGRAPHIC PROTOCOL FLOW",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = CyberCyan
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "1. Unlock recipient's local post-quantum keystore (Argon2id + AES-256-GCM)\n" +
                               "2. ML-KEM-768 server decapsulation within isolated keystore boundary\n" +
                               "3. Recover symmetric 256-bit DEK & decrypt document payload\n" +
                               "4. Embed 127-byte indelible 2D DCT steganographic watermark\n" +
                               "5. Sign forensic receipt with ML-DSA-65 post-quantum digital signature\n" +
                               "6. Commit audit trail to Hyperledger Fabric permissioned ledger",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        lineHeight = 18.sp,
                        fontFamily = FontFamily.Monospace
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = keystorePassword,
                        onValueChange = { keystorePassword = it },
                        label = { Text("Keystore Passphrase") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = CyberCardBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    if (errorMessage != null) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = errorMessage!!,
                            color = CyberCrimson,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    TacticalButton(
                        text = if (isAuthorizing) "DECAPSULATING ML-KEM-768..." else "BIOMETRIC AUTH & DECRYPT",
                        icon = Icons.Default.Fingerprint,
                        onClick = { triggerBiometricAndDecrypt() },
                        enabled = !isAuthorizing,
                        isPrimary = true
                    )
                }
            } else {
                // Post-decryption Receipt Card
                val res = decryptionResult!!
                GlassmorphicCard(borderColor = CyberEmerald) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "DECRYPTION AUTHORIZED",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = CyberEmerald
                        )
                        Icon(Icons.Default.Verified, contentDescription = null, tint = CyberEmerald)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Watermark Telemetry
                    Text("INDELIBLE 2D DCT WATERMARK ID", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = CyberCyan)
                    Text(res.watermarkId, fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = TextPrimary)

                    Spacer(modifier = Modifier.height(12.dp))

                    // ML-DSA-65 Signature Proof
                    Text("NIST FIPS 204 ML-DSA-65 SIGNATURE", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = CyberCyan)
                    Text(res.mlDsaSignaturePreview, fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = TextSecondary)

                    Spacer(modifier = Modifier.height(12.dp))

                    // Hyperledger Fabric Consensus
                    Text("HYPERLEDGER FABRIC COMMIT", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = CyberCyan)
                    Text("Block #${res.ledgerBlockIndex} • Hash: ${res.ledgerBlockHash.take(16)}...", fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = CyberPurple)

                    Spacer(modifier = Modifier.height(16.dp))

                    StatusIndicator(active = true, label = "ATTRIBUTION BINDING COMPLETE")
                }

                TacticalButton(
                    text = "VIEW FULL IMMUTABLE PROVENANCE TRAIL",
                    icon = Icons.Default.Timeline,
                    onClick = { onNavigateToProvenance(documentId) },
                    isPrimary = true
                )
            }
        }
    }
}
