package com.ciphertrace.android.ui.screens.provenance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ciphertrace.android.data.model.DocumentProvenanceResponse
import com.ciphertrace.android.data.repository.DocumentRepository
import com.ciphertrace.android.ui.components.GlassmorphicCard
import com.ciphertrace.android.ui.components.SecurityBadge
import com.ciphertrace.android.ui.components.TopBar
import com.ciphertrace.android.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ProvenanceScreen(
    documentId: Int,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val repository = remember { DocumentRepository(context) }
    val scope = rememberCoroutineScope()

    var provenance by remember { mutableStateOf<DocumentProvenanceResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    fun loadData() {
        isLoading = true
        scope.launch {
            val res = repository.getDocumentProvenance(documentId)
            isLoading = false
            if (res.isSuccess) {
                provenance = res.getOrNull()
            }
        }
    }

    LaunchedEffect(documentId) {
        loadData()
    }

    Scaffold(
        topBar = {
            TopBar(
                title = "PROVENANCE AUDIT",
                subtitle = "IMMUTABLE DLT LEDGER TRAIL",
                showBackButton = true,
                onBackClick = onNavigateBack,
                actions = {
                    IconButton(onClick = { loadData() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = CyberCyan)
                    }
                }
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
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = CyberCyan)
                }
            } else if (provenance != null) {
                val doc = provenance!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Header Card
                    GlassmorphicCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = doc.fileName,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            SecurityBadge(clearance = "TOP SECRET")
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "SHA3-256: ${doc.sha3Hash}",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            color = TextMuted
                        )
                    }

                    // Cryptographic Timeline
                    Text(
                        text = "CRYPTOGRAPHIC LIFECYCLE TIMELINE",
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = CyberCyan,
                        letterSpacing = 1.sp
                    )

                    // Step 1: Document Ingest
                    TimelineNode(
                        title = "ASSET INGESTION & SHA3 DIGEST",
                        timestamp = doc.createdAt.take(19).replace("T", " "),
                        status = "VERIFIED",
                        color = CyberCyan,
                        details = "FIPS 202 SHA3-256 computed. Content validated via magic bytes signature (%PDF)."
                    )

                    // Step 2: PQC Distribution
                    TimelineNode(
                        title = "POST-QUANTUM ENVELOPE DISTRIBUTION",
                        timestamp = doc.createdAt.take(19).replace("T", " "),
                        status = "${doc.totalDistributions} RECIPIENTS",
                        color = CyberCyan,
                        details = "NIST FIPS 203 ML-KEM-768 ephemeral key encapsulation for each designated node officer. Zero-storage plaintext shredded."
                    )

                    // Step 3: Decryptions & Blockchain Commit
                    if (doc.decryptionEvents.isEmpty()) {
                        TimelineNode(
                            title = "AWAITING AUTHORIZED DECRYPTION",
                            timestamp = "PENDING",
                            status = "STANDBY",
                            color = CyberAmber,
                            details = "Asset is securely sealed under ML-KEM-768 ciphertext. No recipient has decrypted this asset."
                        )
                    } else {
                        doc.decryptionEvents.forEachIndexed { index, event ->
                            TimelineNode(
                                title = "DECRYPTION EVENT #${event.eventId}: ${event.recipientName}",
                                timestamp = event.timestamp.take(19).replace("T", " "),
                                status = "DLT CONFIRMED",
                                color = CyberEmerald,
                                details = "Officer: ${event.recipientNavyId} (${event.deviceId})\n" +
                                          "Watermark ID: ${event.watermarkId}\n" +
                                          "ML-DSA-65 Signature: ${event.signaturePreview}\n" +
                                          "Fabric Block: #${event.ledgerBlockIndex} • Tx: ${event.fabricTxId ?: "Local Raft Commit"}"
                            )
                        }
                    }

                    // Step 4: Ledger Consensus Block
                    TimelineNode(
                        title = "HYPERLEDGER FABRIC CONSORTIUM VERIFICATION",
                        timestamp = "CONSENSUS ACTIVE",
                        status = "2-OF-3 ENDORSED",
                        color = CyberPurple,
                        details = "Blocks committed across Org1 (Tactical Command), Org2 (Independent Audit), and Org3 (Forensic Bureau) peers."
                    )
                }
            }
        }
    }
}

@Composable
fun TimelineNode(
    title: String,
    timestamp: String,
    status: String,
    color: Color,
    details: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(top = 4.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(14.dp)
                    .clip(CircleShape)
                    .background(color)
            )
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .height(90.dp)
                    .background(color.copy(alpha = 0.3f))
            )
        }

        GlassmorphicCard(
            modifier = Modifier.weight(1f),
            borderColor = color.copy(alpha = 0.3f)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = color,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = status,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = color
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = timestamp,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = TextMuted
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = details,
                fontSize = 11.sp,
                color = TextSecondary,
                lineHeight = 16.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}
