package com.example.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.screen.*
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

enum class AppTab(val title: String, val icon: ImageVector, val tag: String) {
    LIVE("หน้าหลัก", Icons.Default.Layers, "nav_live"),
    HISTORY("ผลย้อนหลัง", Icons.Default.History, "nav_history"),
    SUMMARY("ตารางสรุป", Icons.Default.TableChart, "nav_summary"),
    CHECKER("ตรวจรางวัล", Icons.Default.Search, "nav_checker"),
    SETTINGS("ตั้งค่า", Icons.Default.Settings, "nav_settings")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    viewModel: LotteryViewModel
) {
    var currentTab by remember { mutableStateOf(AppTab.LIVE) }
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val isVoiceEnabled by viewModel.isVoiceEnabled.collectAsState()

    // Bangkok Clock ticker
    var currentTimeString by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        val sdf = SimpleDateFormat("HH:mm:ss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("Asia/Bangkok")
        }
        while (true) {
            currentTimeString = sdf.format(Date())
            delay(1000)
        }
    }

    // BackHandler: Return to LIVE if on another tab
    BackHandler(enabled = currentTab != AppTab.LIVE) {
        currentTab = AppTab.LIVE
    }

    val infiniteTransition = rememberInfiniteTransition(label = "rotation")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "refresh_rotation"
    )

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Slate950,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Lottery Alert",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                color = Slate100
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Amber500)
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("PRO", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Slate950)
                            }
                        }
                        if (currentTimeString.isNotEmpty()) {
                            Text(
                                text = "🇹🇭 $currentTimeString น. (เวลาไทย)",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = Amber400
                            )
                        }
                    }
                },
                actions = {
                    // Voice Toggle Icon
                    IconButton(
                        onClick = { viewModel.toggleVoice() },
                        modifier = Modifier.testTag("top_voice_toggle")
                    ) {
                        Icon(
                            if (isVoiceEnabled) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                            contentDescription = "Toggle voice",
                            tint = if (isVoiceEnabled) Amber400 else Slate500
                        )
                    }

                    // Refresh Button
                    IconButton(
                        onClick = { viewModel.refresh() },
                        modifier = Modifier.testTag("top_refresh_button")
                    ) {
                        Icon(
                            Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = Slate100,
                            modifier = if (isRefreshing) Modifier.rotate(rotation) else Modifier
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Slate950,
                    titleContentColor = Slate100
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = Slate900,
                contentColor = Slate100,
                modifier = Modifier.navigationBarsPadding()
            ) {
                AppTab.values().forEach { tab ->
                    val isSelected = currentTab == tab
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentTab = tab },
                        icon = {
                            Icon(
                                tab.icon,
                                contentDescription = tab.title,
                                modifier = Modifier.size(22.dp)
                            )
                        },
                        label = {
                            Text(
                                tab.title,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Slate950,
                            selectedTextColor = Amber400,
                            indicatorColor = Amber500,
                            unselectedIconColor = Slate400,
                            unselectedTextColor = Slate400
                        ),
                        modifier = Modifier.testTag(tab.tag)
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (currentTab) {
                AppTab.LIVE -> LiveResultsScreen(viewModel = viewModel)
                AppTab.HISTORY -> HistoryScreen(viewModel = viewModel)
                AppTab.SUMMARY -> SummaryScreen(viewModel = viewModel)
                AppTab.CHECKER -> TicketCheckerScreen(viewModel = viewModel)
                AppTab.SETTINGS -> SettingsScreen(viewModel = viewModel)
            }
        }
    }
}
