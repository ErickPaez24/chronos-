package com.chronosabc.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.chronosabc.ui.admin.AdminHomeScreen
import com.chronosabc.ui.login.LoginScreen
import com.chronosabc.ui.user.UserHomeScreen
import com.chronosabc.ui.biometric.UsbTestScreen

object Destinations {
    const val LOGIN = "login"
    const val ADMIN_HOME = "admin_home"
    const val USER_HOME = "user_home"
    const val USB_TEST = "usb_test"
}

@Composable
fun ChronosNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = Destinations.LOGIN,
        modifier = modifier
    ) {
        composable(Destinations.LOGIN) {
            LoginScreen(
                onAdminLogin = {
                    navController.navigate(Destinations.ADMIN_HOME) {
                        popUpTo(Destinations.LOGIN) { inclusive = true }
                    }
                },
                onUserLogin = {
                    navController.navigate(Destinations.USER_HOME) {
                        popUpTo(Destinations.LOGIN) { inclusive = true }
                    }
                },
                onUsbTest = {
                    navController.navigate(Destinations.USB_TEST)
                }
            )
        }
        composable(Destinations.ADMIN_HOME) {
            AdminHomeScreen()
        }
        composable(Destinations.USER_HOME) {
            UserHomeScreen()
        }
        composable(Destinations.USB_TEST) {
            UsbTestScreen(
                onBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}
