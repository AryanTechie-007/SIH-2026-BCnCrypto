package com.ciphertrace.android.ui.screens.documents

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ciphertrace.android.data.model.DocumentProvenanceResponse
import com.ciphertrace.android.data.repository.DocumentRepository
import com.ciphertrace.android.ui.components.*
import com.ciphertrace.android.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun DocumentDetailScreen(
    documentId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToDecryption: (Int) -> Unit,
    onNavigateToProvenance: (Int) -> Unit
) {
    val context = LocalContext.current
    val repository = remember { DocumentRepository(context) }
    val scope = rememberCoroutineScope()

    var provenance by remember { mutableStateOf<DocumentProvenanceResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(documentId) {
        scope.launch {
            val result = repository.getDocumentProvenance(documentId)
            isLoading = false
            if (result.isSuccess) {
                provenance = result.getOrNull()
            } else {
                errorMessage = result.exceptionOrNull()?.localizedMessage ?: "Failed to load document metadata"
            }
        }
    }

    Scaffold(
        topBar = {
            TopBar(
                title = "ASSET DOSSIER",
                subtitle = "ASSET ID: #$documentId",
                showBackButton = true,
                onBackClick = onNavigateBack
            )
        },
        containerColor = CyberBgDark
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            when {
                isLoading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = CyberCyan)
                    }
                }
                errorMessage != null -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(text = "ERROR RETRIEVING METADATA", color = CyberCrimson, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = errorMessage!!, color = TextSecondary, fontSize = 12.sp)
                    }
                }
                provenance != null -> {
                    val doc = provenance!!
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Title & Clearance
                        GlassmorphicCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = doc.fileName,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                SecurityBadge(clearance = "LEVEL-5 TOP SECRET")
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                text = doc.title,
                                fontSize = 12.sp,
                                color = TextSecondary
                            )
                        }

                        // Cryptographic Hash & Specifications
                        GlassmorphicCard {
                            Text(
                                text = "NIST FIPS 202 SHA3-256 DIGEST",
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                color = CyberCyan,
                                letterSpacing = 1.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = doc.sha3Hash,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                color = TextPrimary,
                                lineHeight = 16.sp
                            )

                            Spacer(modifier = Modifier.height(16.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text("PAYLOAD SIZE", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = TextMuted)
                                    Text("${doc.sizeBytes} Bytes", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                }
                                Column {
                                    Text("RECIPIENTS", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = TextMuted)
                                    Text("${doc.totalDistributions} Envelopes", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                }
                                Column {
                                    Text("DECRYPTIONS", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = TextMuted)
                                    Text("${doc.totalDecryptions} Events", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CyberEmerald)
                                }
                            }
                        }

                        // Security Architecture Callout
                        GlassmorphicCard(borderColor = CyberCyan.copy(alpha = 0.3f)) {
                            Text(
                                text = "ZERO-STORAGE CRYPTOGRAPHIC INVARIANT",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                color = CyberCyan
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "The plaintext source document was securely shredded immediately following AES-256-GCM encryption. Decryption requires valid ML-KEM-768 decapsulation and dynamically embeds an indelible 2D DCT watermark.",
                                fontSize = 12.sp,
                                color = TextSecondary,
                                lineHeight = 18.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        // Action Buttons
                        TacticalButton(
                            text = "AUTHORIZE & DECRYPT DOCUMENT",
                            icon = Icons.Default.LockOpen,
                            onClick = { onNavigateToDecryption(documentId) },
                            isPrimary = true
                        )

                        TacticalButton(
                            text = "INSPECT BLOCKCHAIN PROVENANCE",
                            icon = Icons.Default.AccountTree,
                            onClick = { onNavigateToProvenance(documentId) },
                            isPrimary = false
                        )
                    }
                }
            }
        }
    }
}
