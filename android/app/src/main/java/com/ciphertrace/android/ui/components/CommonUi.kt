package com.ciphertrace.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ciphertrace.android.ui.theme.*

@Composable
fun GlassmorphicCard(
    modifier: Modifier = Modifier,
    borderColor: Color = CyberCardBorder,
    backgroundColor: Color = CyberCardDark.copy(alpha = 0.85f),
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .border(1.dp, borderColor, RoundedCornerShape(12.dp))
            .padding(16.dp),
        content = content
    )
}

@Composable
fun SecurityBadge(
    clearance: String,
    modifier: Modifier = Modifier
) {
    val (bgColor, textColor) = when {
        clearance.contains("TOP SECRET", ignoreCase = true) -> Pair(ClearanceTopSecret.copy(alpha = 0.15f), ClearanceTopSecret)
        clearance.contains("SECRET", ignoreCase = true) -> Pair(ClearanceSecret.copy(alpha = 0.15f), ClearanceSecret)
        else -> Pair(ClearanceConfidential.copy(alpha = 0.15f), ClearanceConfidential)
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(bgColor)
            .border(1.dp, textColor.copy(alpha = 0.5f), RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp)
    ) {
        Text(
            text = clearance.uppercase(),
            color = textColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.sp
        )
    }
}

@Composable
fun PqcChip(
    label: String,
    modifier: Modifier = Modifier,
    active: Boolean = true
) {
    val borderColor = if (active) CyberCyan.copy(alpha = 0.6f) else TextMuted
    val textColor = if (active) CyberCyan else TextMuted
    val bgColor = if (active) CyberCyan.copy(alpha = 0.1f) else Color.Transparent

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .border(1.dp, borderColor, RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
fun StatusIndicator(
    active: Boolean,
    label: String,
    modifier: Modifier = Modifier
) {
    val dotColor = if (active) CyberEmerald else CyberCrimson
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(dotColor)
        )
        Text(
            text = label,
            color = if (active) CyberEmerald else CyberCrimson,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = FontFamily.Monospace
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopBar(
    title: String,
    subtitle: String? = null,
    showBackButton: Boolean = false,
    onBackClick: () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {}
) {
    TopAppBar(
        title = {
            Column {
                Text(
                    text = title,
                    color = TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp
                )
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        color = CyberCyan,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.sp
                    )
                }
            }
        },
        navigationIcon = {
            if (showBackButton) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = CyberCyan
                    )
                }
            }
        },
        actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = CyberBgDark,
            navigationIconContentColor = CyberCyan,
            titleContentColor = TextPrimary,
            actionIconContentColor = CyberCyan
        )
    )
}

@Composable
fun TacticalButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    isPrimary: Boolean = true,
    enabled: Boolean = true
) {
    val bgBrush = if (isPrimary) {
        Brush.horizontalGradient(listOf(CyberCyanDim, CyberCyan))
    } else {
        Brush.horizontalGradient(listOf(CyberCardDark, CyberCardDark))
    }
    val contentColor = if (isPrimary) CyberBgDark else CyberCyan
    val borderModifier = if (!isPrimary) Modifier.border(1.dp, CyberCyan.copy(alpha = 0.5f), RoundedCornerShape(8.dp)) else Modifier

    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(50.dp)
            .then(borderModifier),
        enabled = enabled,
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isPrimary) CyberCyan else CyberCardDark,
            contentColor = contentColor,
            disabledContainerColor = CyberCardDark.copy(alpha = 0.5f),
            disabledContentColor = TextMuted
        )
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
            }
            Text(
                text = text.uppercase(),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.sp
            )
        }
    }
}
