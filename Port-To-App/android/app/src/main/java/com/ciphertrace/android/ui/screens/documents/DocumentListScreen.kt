package com.ciphertrace.android.ui.screens.documents

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ciphertrace.android.data.model.DocumentItem
import com.ciphertrace.android.data.repository.DocumentRepository
import com.ciphertrace.android.ui.components.GlassmorphicCard
import com.ciphertrace.android.ui.components.PqcChip
import com.ciphertrace.android.ui.components.SecurityBadge
import com.ciphertrace.android.ui.components.TopBar
import com.ciphertrace.android.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun DocumentListScreen(
    onNavigateBack: () -> Unit,
    onDocumentClick: (Int) -> Unit
) {
    val context = LocalContext.current
    val repository = remember { DocumentRepository(context) }
    val scope = rememberCoroutineScope()

    var documents by remember { mutableStateOf<List<DocumentItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun loadDocuments() {
        isLoading = true
        errorMessage = null
        scope.launch {
            val result = repository.getDocuments()
            isLoading = false
            if (result.isSuccess) {
                documents = result.getOrNull() ?: emptyList()
            } else {
                errorMessage = result.exceptionOrNull()?.localizedMessage ?: "Failed to retrieve documents"
            }
        }
    }

    LaunchedEffect(Unit) {
        loadDocuments()
    }

    Scaffold(
        topBar = {
            TopBar(
                title = "CLASSIFIED ASSETS",
                subtitle = "POST-QUANTUM PROTECTED VAULT",
                showBackButton = true,
                onBackClick = onNavigateBack,
                actions = {
                    IconButton(onClick = { loadDocuments() }) {
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
                .padding(horizontal = 16.dp)
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
                        Text(text = "NETWORK ALERT", color = CyberCrimson, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = errorMessage!!, color = TextSecondary, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { loadDocuments() }) {
                            Text("RETRY")
                        }
                    }
                }
                documents.isEmpty() -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = "No classified documents registered yet in node registry.",
                            color = TextSecondary,
                            fontSize = 13.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize().padding(vertical = 12.dp)
                    ) {
                        items(documents) { doc ->
                            DocumentListItem(doc = doc, onClick = { onDocumentClick(doc.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DocumentListItem(doc: DocumentItem, onClick: () -> Unit) {
    GlassmorphicCard(
        modifier = Modifier.clickable { onClick() }
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = doc.fileName,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Text(
                    text = "SHA3-256: ${doc.sha3Hash.take(16)}...",
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    color = TextMuted
                )
            }
            SecurityBadge(clearance = "TOP SECRET")
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PqcChip(label = "ML-KEM-768")
                PqcChip(label = "AES-256-GCM")
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = CyberCyan)
        }
    }
}
