package com.example.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.LotteryViewModel
import com.example.ui.theme.*
import com.example.util.SocialShareUtil

@Composable
fun HistoryScreen(
    viewModel: LotteryViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val results by viewModel.results.collectAsState()
    val top2Stats by viewModel.top2Stats.collectAsState()
    val top3Stats by viewModel.top3Stats.collectAsState()

    var activeSubTab by remember { mutableStateOf(0) } // 0 = History, 1 = Stats
    var searchQuery by remember { mutableStateOf("") }

    val filteredResults = remember(results, searchQuery) {
        if (searchQuery.isBlank()) {
            results.take(80)
        } else {
            results.filter { res ->
                res.displayName.contains(searchQuery, ignoreCase = true) ||
                (res.firstPrize?.contains(searchQuery) == true) ||
                res.resolvedTop3.contains(searchQuery) ||
                res.resolvedBottom2.contains(searchQuery) ||
                res.displayDate.contains(searchQuery)
            }.take(80)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        // Tab Selector Row
        TabRow(
            selectedTabIndex = activeSubTab,
            containerColor = Slate900,
            contentColor = Amber500,
            divider = {},
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .border(1.dp, Slate800, RoundedCornerShape(16.dp))
        ) {
            Tab(
                selected = activeSubTab == 0,
                onClick = { activeSubTab = 0 },
                text = { Text("ผลย้อนหลัง (${results.size})", fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                icon = { Icon(Icons.Default.History, contentDescription = null, modifier = Modifier.size(18.dp)) },
                selectedContentColor = Amber400,
                unselectedContentColor = Slate400
            )
            Tab(
                selected = activeSubTab == 1,
                onClick = { activeSubTab = 1 },
                text = { Text("สถิติเลขเด็ดออกบ่อย", fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                icon = { Icon(Icons.Default.TrendingUp, contentDescription = null, modifier = Modifier.size(18.dp)) },
                selectedContentColor = Amber400,
                unselectedContentColor = Slate400
            )
        }

        Spacer(modifier = Modifier.height(14.dp))

        if (activeSubTab == 0) {
            // Search Input
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("history_search_input"),
                placeholder = { Text("ค้นหาชื่อหวย หรืองวดวันที่ หรือตัวเลข...", color = Slate400, fontSize = 13.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Amber400) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = null, tint = Slate400)
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Amber500,
                    unfocusedBorderColor = Slate800,
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedTextColor = Slate100,
                    unfocusedTextColor = Slate100
                )
            )

            Spacer(modifier = Modifier.height(10.dp))

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(filteredResults) { item ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .border(1.dp, Slate800, RoundedCornerShape(16.dp)),
                        colors = CardDefaults.cardColors(containerColor = Slate900)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = item.displayName,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Slate100
                                )
                                Text(
                                    text = item.displayDate,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Amber400
                                )
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                // Top3 / First Prize
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(Amber500.copy(alpha = 0.15f))
                                        .padding(horizontal = 10.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(if (item.category == "government") "รางวัลที่ 1" else "3 ตัวบน", fontSize = 10.sp, color = Amber400)
                                        Text(
                                            text = item.firstPrize?.takeIf { it.isNotBlank() } ?: item.resolvedTop3.ifBlank { "-" },
                                            fontSize = 18.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Amber300
                                        )
                                    }
                                }

                                // Bottom2
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(Emerald500.copy(alpha = 0.15f))
                                        .padding(horizontal = 10.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text("2 ตัวล่าง", fontSize = 10.sp, color = Emerald400)
                                        Text(
                                            text = item.resolvedBottom2.ifBlank { "-" },
                                            fontSize = 18.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Emerald400
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "แหล่ง: ${item.source ?: "ระบบหลัก"}",
                                    fontSize = 11.sp,
                                    color = Slate400
                                )

                                IconButton(
                                    onClick = {
                                        val text = "${item.displayName} งวด ${item.displayDate}\nบน: ${item.resolvedTop3} / ล่าง: ${item.resolvedBottom2}"
                                        SocialShareUtil.copyTextToClipboard(context, item.displayName, text)
                                    },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.ContentCopy, contentDescription = "Copy", tint = Slate300, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
                item { Spacer(modifier = Modifier.height(20.dp)) }
            }
        } else {
            // Statistics & Frequency Tab
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                item {
                    Text(
                        text = "🔥 15 อันดับ เลขท้าย 2 ตัวที่ออกบ่อยที่สุด (2-Digit Frequency)",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = Amber400
                    )
                }

                items(top2Stats) { stat ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, Slate800, RoundedCornerShape(14.dp)),
                        colors = CardDefaults.cardColors(containerColor = Slate900)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(46.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Amber500),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = stat.number,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Slate950
                                )
                            }

                            Spacer(modifier = Modifier.width(14.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "ออกแล้ว ${stat.count} ครั้ง",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Slate100
                                    )
                                    Text(
                                        text = String.format("%.1f%%", stat.percentage),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Amber400
                                    )
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                LinearProgressIndicator(
                                    progress = { (stat.count.toFloat() / (top2Stats.firstOrNull()?.count ?: 1)).coerceIn(0f, 1f) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp)),
                                    color = Amber500,
                                    trackColor = Slate800
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "งวดล่าสุด: ${stat.latestLottery} (${stat.latestDate})",
                                    fontSize = 11.sp,
                                    color = Slate400
                                )
                            }
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "⭐ 15 อันดับ เลข 3 ตัวบนที่ออกบ่อยที่สุด (3-Digit Frequency)",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = Emerald400
                    )
                }

                items(top3Stats) { stat ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, Slate800, RoundedCornerShape(14.dp)),
                        colors = CardDefaults.cardColors(containerColor = Slate900)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(46.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Emerald500),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = stat.number,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Slate950
                                )
                            }

                            Spacer(modifier = Modifier.width(14.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "ออกแล้ว ${stat.count} ครั้ง",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Slate100
                                    )
                                    Text(
                                        text = String.format("%.1f%%", stat.percentage),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Emerald400
                                    )
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                LinearProgressIndicator(
                                    progress = { (stat.count.toFloat() / (top3Stats.firstOrNull()?.count ?: 1)).coerceIn(0f, 1f) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp)),
                                    color = Emerald500,
                                    trackColor = Slate800
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "งวดล่าสุด: ${stat.latestLottery} (${stat.latestDate})",
                                    fontSize = 11.sp,
                                    color = Slate400
                                )
                            }
                        }
                    }
                }

                item { Spacer(modifier = Modifier.height(20.dp)) }
            }
        }
    }
}
