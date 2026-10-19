package com.example.attendanceapp.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = RedPrimary,
    secondary = RedSecondary,
    tertiary = RedTertiary,
    background = Color.White,
    surface = Color.White,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = Color.Black,
    onSurface = Color.Black
)

@Composable
fun AttendanceAppTheme(
  // Force light theme
  darkTheme: Boolean = false,
  // Disable dynamic color so we keep our red contrast colors
  dynamicColor: Boolean = false,
  content: @Composable () -> Unit,
) {
  val colorScheme = LightColorScheme

  MaterialTheme(colorScheme = colorScheme, typography = Typography, content = content)
}
