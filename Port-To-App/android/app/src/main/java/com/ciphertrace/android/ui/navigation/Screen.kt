package com.ciphertrace.android.ui.navigation

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object Documents : Screen("documents")
    object DocumentDetail : Screen("document_detail/{documentId}") {
        fun createRoute(documentId: Int) = "document_detail/$documentId"
    }
    object Decryption : Screen("decryption/{documentId}") {
        fun createRoute(documentId: Int) = "decryption/$documentId"
    }
    object Provenance : Screen("provenance/{documentId}") {
        fun createRoute(documentId: Int) = "provenance/$documentId"
    }
    object EvidenceAudit : Screen("evidence_audit")
    object Settings : Screen("settings")
}
