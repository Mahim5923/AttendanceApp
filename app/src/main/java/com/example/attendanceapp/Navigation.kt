package com.example.attendanceapp

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.attendanceapp.ui.main.*
import androidx.compose.animation.togetherWith
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
@Composable
fun MainNavigation() {
    val context = LocalContext.current
    val app = context.applicationContext as AttendanceApplication
    val viewModel: MainScreenViewModel = viewModel(factory = MainScreenViewModelFactory(app.repository))

    val currentUser = viewModel.getCurrentUser()
    val initialRoute = if (currentUser.isNotBlank() && currentUser != "Unknown") {
        if (viewModel.isAdmin()) AdminDashboard else EmployeeDashboard
    } else {
        Login
    }
    
    val backStack = rememberNavBackStack(initialRoute)

    val appConfig by viewModel.appConfig.collectAsState()
    
    LaunchedEffect(appConfig) {
        appConfig?.let { config ->
            try {
                val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
                val currentVersion = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    packageInfo.longVersionCode.toInt()
                } else {
                    @Suppress("DEPRECATION")
                    packageInfo.versionCode
                }
                
                if (config.latestVersionCode > currentVersion) {
                    backStack.clear()
                    backStack.add(ForceUpdate(config.updateUrl))
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }


    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        transitionSpec = { fadeIn(animationSpec = tween(150)) togetherWith fadeOut(animationSpec = tween(150)) },
        popTransitionSpec = { fadeIn(animationSpec = tween(150)) togetherWith fadeOut(animationSpec = tween(150)) },
        entryProvider = entryProvider {
            entry<Login> {
                LoginScreen(
                    viewModel = viewModel,
                    onNavigate = { navKey -> 
                        backStack.clear()
                        backStack.add(navKey) 
                    },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<EmployeeDashboard> {
                MainScreen(
                    viewModel = viewModel,
                    onItemClick = { navKey -> backStack.add(navKey) },
                    onLogout = { 
                        backStack.clear()
                        backStack.add(Login)
                    },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<EmployeeProfile> {
                EmployeeProfileScreen(
                    viewModel = viewModel,
                    onNavigateBack = { backStack.removeLastOrNull() },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<AdminDashboard> {
                AdminDashboardScreen(
                    viewModel = viewModel,
                    onNavigate = { navKey -> backStack.add(navKey) },
                    onLogout = { 
                        backStack.clear()
                        backStack.add(Login)
                    },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<AdminEmployeeDetail> { key ->
                AdminEmployeeDetailScreen(
                    employeeId = key.employeeId,
                    viewModel = viewModel,
                    onNavigate = { navKey -> backStack.add(navKey) },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<AdminEmployeeSettings> { key ->
                AdminEmployeeSettingsScreen(
                    employeeId = key.employeeId,
                    viewModel = viewModel,
                    onNavigateBack = { backStack.removeLastOrNull() },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<MarkAttendance> { key ->
                MarkAttendanceScreen(
                    attendanceTypeStr = key.type,
                    viewModel = viewModel,
                    onNavigateBack = { backStack.removeLastOrNull() },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<ViewAttendance> {
                ViewAttendanceScreen(
                    viewModel = viewModel,
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<Calculator> {
                CalculatorScreen(
                    viewModel = viewModel,
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<RequestLeave> {
                RequestLeaveScreen(
                    viewModel = viewModel,
                    onNavigateBack = { backStack.removeLastOrNull() },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<ManageLeaves> {
                ManageLeavesScreen(
                    viewModel = viewModel,
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<ManageBranches> {
                ManageBranchesScreen(
                    viewModel = viewModel,
                    onNavigateBack = { backStack.removeLastOrNull() },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<ChatListScreenKey> {
                ChatListScreen(
                    viewModel = viewModel,
                    onNavigate = { navKey -> backStack.add(navKey) },
                    onBack = { backStack.removeLastOrNull() }
                )
            }
            entry<ChatScreenKey> { key ->
                ChatScreen(
                    viewModel = viewModel,
                    chatPartnerId = key.chatPartnerId,
                    chatPartnerName = key.chatPartnerName,
                    onBack = { backStack.removeLastOrNull() }
                )
            }
            entry<MonthlyReport> {
                MonthlyReportScreen(
                    viewModel = viewModel,
                    onNavigateBack = { backStack.removeLastOrNull() },
                    modifier = Modifier.safeDrawingPadding()
                )
            }
            entry<ForceUpdate> { key ->
                ForceUpdateScreen(
                    updateUrl = key.updateUrl,
                    modifier = Modifier.safeDrawingPadding()
                )
            }
        },
    )
}
