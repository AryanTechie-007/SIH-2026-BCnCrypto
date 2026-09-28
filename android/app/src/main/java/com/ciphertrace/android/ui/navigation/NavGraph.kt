package com.ciphertrace.android.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.ciphertrace.android.ui.screens.auth.LoginScreen
import com.ciphertrace.android.ui.screens.dashboard.DashboardScreen
import com.ciphertrace.android.ui.screens.decryption.DecryptionScreen
import com.ciphertrace.android.ui.screens.documents.DocumentDetailScreen
import com.ciphertrace.android.ui.screens.documents.DocumentListScreen
import com.ciphertrace.android.ui.screens.evidence.EvidenceAuditScreen
import com.ciphertrace.android.ui.screens.provenance.ProvenanceScreen
import com.ciphertrace.android.ui.screens.settings.SettingsScreen

@Composable
fun NavGraph(
    navController: NavHostController,
    startDestination: String = Screen.Login.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToSettings = {
                    navController.navigate(Screen.Settings.route)
                }
            )
        }

        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToDocuments = {
                    navController.navigate(Screen.Documents.route)
                },
                onNavigateToEvidenceAudit = {
                    navController.navigate(Screen.EvidenceAudit.route)
                },
                onNavigateToSettings = {
                    navController.navigate(Screen.Settings.route)
                },
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Dashboard.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Documents.route) {
            DocumentListScreen(
                onNavigateBack = { navController.popBackStack() },
                onDocumentClick = { docId ->
                    navController.navigate(Screen.DocumentDetail.createRoute(docId))
                }
            )
        }

        composable(
            route = Screen.DocumentDetail.route,
            arguments = listOf(navArgument("documentId") { type = NavType.IntType })
        ) { backStackEntry ->
            val docId = backStackEntry.arguments?.getInt("documentId") ?: 1
            DocumentDetailScreen(
                documentId = docId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToDecryption = { id ->
                    navController.navigate(Screen.Decryption.createRoute(id))
                },
                onNavigateToProvenance = { id ->
                    navController.navigate(Screen.Provenance.createRoute(id))
                }
            )
        }

        composable(
            route = Screen.Decryption.route,
            arguments = listOf(navArgument("documentId") { type = NavType.IntType })
        ) { backStackEntry ->
            val docId = backStackEntry.arguments?.getInt("documentId") ?: 1
            DecryptionScreen(
                documentId = docId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToProvenance = { id ->
                    navController.navigate(Screen.Provenance.createRoute(id))
                }
            )
        }

        composable(
            route = Screen.Provenance.route,
            arguments = listOf(navArgument("documentId") { type = NavType.IntType })
        ) { backStackEntry ->
            val docId = backStackEntry.arguments?.getInt("documentId") ?: 1
            ProvenanceScreen(
                documentId = docId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.EvidenceAudit.route) {
            EvidenceAuditScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
