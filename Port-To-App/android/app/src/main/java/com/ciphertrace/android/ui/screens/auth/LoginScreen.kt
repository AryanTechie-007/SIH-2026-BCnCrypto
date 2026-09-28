package com.ciphertrace.android.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ciphertrace.android.data.repository.AuthRepository
import com.ciphertrace.android.ui.components.GlassmorphicCard
import com.ciphertrace.android.ui.components.TacticalButton
import com.ciphertrace.android.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onNavigateToSettings: () -> Unit
) {
    val context = LocalContext.current
    val repository = remember { AuthRepository(context) }
    val scope = rememberCoroutineScope()

    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val quickOfficers = listOf(
        Pair("NAVY-0001", "Capt. A. Verma"),
        Pair("NAVY-0002", "Cdr. R. Sharma"),
        Pair("NAVY-0003", "Lt. Cdr. S. Nair"),
        Pair("NAVY-0004", "Investigator K. Patel")
    )

    fun performLogin(u: String, p: String) {
        if (u.isBlank() || p.isBlank()) {
            errorMessage = "Please enter credentials"
            return
        }
        isLoading = true
        errorMessage = null
        scope.launch {
            val result = repository.login(u, p)
            isLoading = false
            if (result.isSuccess) {
                onLoginSuccess()
            } else {
                errorMessage = result.exceptionOrNull()?.localizedMessage ?: "Authentication failed"
            }
        }
    }

    fun performQuickLogin(officerKey: String) {
        isLoading = true
        errorMessage = null
        scope.launch {
            val result = repository.quickLogin(officerKey)
            isLoading = false
            if (result.isSuccess) {
                onLoginSuccess()
            } else {
                errorMessage = result.exceptionOrNull()?.localizedMessage ?: "Quick login failed"
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CyberBgDark)
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Brand Header
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(CyberCyan.copy(alpha = 0.1f))
                .border(1.dp, CyberCyan, RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Security,
                contentDescription = null,
                tint = CyberCyan,
                modifier = Modifier.size(36.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "CIPHERTRACE",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            letterSpacing = 2.sp
        )

        Text(
            text = "POST-QUANTUM CRYPTOGRAPHIC FIELD TERMINAL",
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            color = CyberCyan,
            letterSpacing = 1.sp
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Main Login Card
        GlassmorphicCard {
            Text(
                text = "OPERATOR AUTHENTICATION",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = TextSecondary,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Service ID / Username") },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = CyberCyan) },
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

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Keystore Passphrase") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = CyberCyan) },
                visualTransformation = PasswordVisualTransformation(),
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
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = errorMessage!!,
                    color = CyberCrimson,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            TacticalButton(
                text = if (isLoading) "AUTHENTICATING..." else "INITIATE SECURE SESSION",
                onClick = { performLogin(username, password) },
                enabled = !isLoading,
                isPrimary = true
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Quick Demonstration Login section for SIH Judges
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "DEMO OPERATOR SHORTCUTS",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = TextMuted,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "SETTINGS",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = CyberCyan,
                    modifier = Modifier.clickable { onNavigateToSettings() }
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(quickOfficers) { (id, label) ->
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(CyberCardDark)
                            .border(1.dp, CyberCardBorder, RoundedCornerShape(8.dp))
                            .clickable { performQuickLogin(id) }
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Column {
                            Text(
                                text = label,
                                color = TextPrimary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = id,
                                color = CyberCyan,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
            }
        }
    }
}
