package com.ciphertrace.android.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ciphertrace.android.data.repository.AuthRepository
import com.ciphertrace.android.data.repository.ProvenanceRepository
import com.ciphertrace.android.ui.components.*
import com.ciphertrace.android.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun DashboardScreen(
    onNavigateToDocuments: () -> Unit,
    onNavigateToEvidenceAudit: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val authRepo = remember { AuthRepository(context) }
    val provenanceRepo = remember { ProvenanceRepository(context) }
    val scope = rememberCoroutineScope()

    var ledgerBlockHeight by remember { mutableStateOf<Int?>(null) }
    var ledgerValid by remember { mutableStateOf(true) }
    var systemStatus by remember { mutableStateOf("ONLINE") }

    LaunchedEffect(Unit) {
        scope.launch {
            val verifyRes = provenanceRepo.verifyLedger()
            if (verifyRes.isSuccess) {
                ledgerBlockHeight = verifyRes.getOrNull()?.chainLength
                ledgerValid = verifyRes.getOrNull()?.valid ?: true
            }
            val healthRes = provenanceRepo.getSystemHealth()
            if (healthRes.isSuccess) {
                systemStatus = healthRes.getOrNull()?.status?.uppercase() ?: "ONLINE"
            }
        }
    }

    Scaffold(
        topBar = {
            TopBar(
                title = "FIELD COMMAND",
                subtitle = "TERMINAL // ${authRepo.getOfficerNavyId()}",
                actions = {
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = CyberCyan)
                    }
                    IconButton(onClick = {
                        scope.launch {
                            authRepo.logout()
                            onLogout()
                        }
                    }) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Logout", tint = CyberCrimson)
                    }
                }
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
            // Operator Profile Card
            GlassmorphicCard(borderColor = CyberCyan.copy(alpha = 0.5f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = authRepo.getOfficerName(),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "${authRepo.getOfficerRank()} • ${authRepo.getOfficerNavyId()}",
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            color = CyberCyan
                        )
                    }
                    SecurityBadge(clearance = authRepo.getClearance())
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    StatusIndicator(active = true, label = "DEVICE BOUND")
                    StatusIndicator(active = ledgerValid, label = "DLT SYNCED")
                    StatusIndicator(active = systemStatus == "ONLINE", label = systemStatus)
                }
            }

            // Cryptographic Invariants Grid
            Text(
                text = "CRYPTOGRAPHIC TELEMETRY",
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = TextSecondary,
                letterSpacing = 1.sp
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CryptoMetricCard(
                    modifier = Modifier.weight(1f),
                    title = "NIST FIPS 203",
                    subtitle = "ML-KEM-768",
                    detail = "1088B Ciphertext",
                    accent = CyberCyan
                )
                CryptoMetricCard(
                    modifier = Modifier.weight(1f),
                    title = "NIST FIPS 204",
                    subtitle = "ML-DSA-65",
                    detail = "3309B Signature",
                    accent = CyberEmerald
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CryptoMetricCard(
                    modifier = Modifier.weight(1f),
                    title = "2D DCT STEGANO",
                    subtitle = "RS(255,127)",
                    detail = "Invisible Watermark",
                    accent = CyberAmber
                )
                CryptoMetricCard(
                    modifier = Modifier.weight(1f),
                    title = "FABRIC DLT",
                    subtitle = if (ledgerBlockHeight != null) "BLOCK #$ledgerBlockHeight" else "BLOCK #7",
                    detail = "2-of-3 Consortium",
                    accent = CyberPurple
                )
            }

            // Action Launchers
            Text(
                text = "TERMINAL WORKFLOWS",
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = TextSecondary,
                letterSpacing = 1.sp
            )

            ActionLauncherItem(
                title = "Classified Documents Vault",
                description = "Inspect post-quantum encrypted envelopes and trigger biometric decapsulation",
                icon = Icons.Default.Description,
                onClick = onNavigateToDocuments
            )

            ActionLauncherItem(
                title = "Forensic Tamper Lab",
                description = "Verify watermarked document attribution and 6 cryptographic verification gates",
                icon = Icons.Default.Search,
                onClick = onNavigateToEvidenceAudit
            )

            ActionLauncherItem(
                title = "Field Terminal Settings",
                description = "Configure host network address (10.0.2.2 / LAN), device fingerprint, and biometrics",
                icon = Icons.Default.Tune,
                onClick = onNavigateToSettings
            )
        }
    }
}

@Composable
fun CryptoMetricCard(
    title: String,
    subtitle: String,
    detail: String,
    accent: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    GlassmorphicCard(
        modifier = modifier,
        borderColor = accent.copy(alpha = 0.3f)
    ) {
        Text(
            text = title,
            fontSize = 9.sp,
            fontFamily = FontFamily.Monospace,
            color = TextMuted,
            letterSpacing = 0.5.sp
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = subtitle,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = accent
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = detail,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            color = TextSecondary
        )
    }
}

@Composable
fun ActionLauncherItem(
    title: String,
    description: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    GlassmorphicCard(
        modifier = Modifier.clickable { onClick() }
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .background(CyberCyan.copy(alpha = 0.1f), androidx.compose.foundation.shape.CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = icon, contentDescription = null, tint = CyberCyan, modifier = Modifier.size(24.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Text(
                    text = description,
                    fontSize = 11.sp,
                    color = TextSecondary,
                    lineHeight = 16.sp
                )
            }
            Icon(imageVector = Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted)
        }
    }
}
