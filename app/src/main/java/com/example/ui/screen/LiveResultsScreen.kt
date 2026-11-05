package com.example.ui.screen

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.model.LotteryCatalogItem
import com.example.ui.LotteryViewModel
import com.example.ui.theme.*
import com.example.util.SocialShareUtil

@Composable
fun LiveResultsScreen(
    viewModel: LotteryViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lotteries by viewModel.lotteries.collectAsState()
    val watchedNumbers by viewModel.watchedNumbers.collectAsState()
    val selectedDetail by viewModel.selectedLotteryDetail.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var selectedPeriod by remember { mutableStateOf("ทั้งหมด") }
    var selectedCategory by remember { mutableStateOf("ทั้งหมด") }
    var selectedStatus by remember { mutableStateOf("ทั้งหมด") }

    val nextClosing = remember(lotteries) { viewModel.getNextClosingLottery() }

    // Filter lotteries
    val filteredLotteries = remember(lotteries, searchQuery, selectedPeriod, selectedCategory, selectedStatus) {
        lotteries.filter { item ->
            val matchQuery = searchQuery.isBlank() || item.name.contains(searchQuery, ignoreCase = true) || item.top3.contains(searchQuery) || item.bottom2.contains(searchQuery)
            val matchPeriod = when (selectedPeriod) {
                "ทั้งหมด" -> true
                "หวยเช้า" -> item.period == "morning" || item.periodLabel.contains("เช้า")
                "หวยบ่าย" -> item.period == "afternoon" || item.periodLabel.contains("บ่าย")
                "หวยเย็น" -> item.period == "evening" || item.periodLabel.contains("เย็น")
                "หวยดึก" -> item.period == "night" || item.periodLabel.contains("ดึก")
                else -> true
            }
            val matchCategory = when (selectedCategory) {
                "ทั้งหมด" -> true
                "รัฐบาล" -> item.category == "government" || item.name.contains("รัฐบาล") || item.name.contains("ออมสิน") || item.name.contains("ธ.ก.ส.")
                "หุ้น" -> item.category.contains("stock") || item.categoryLabel.contains("หุ้น")
                "VIP" -> item.category.contains("vip") || item.name.contains("VIP", ignoreCase = true) || item.name.contains("ลาว")
                else -> true
            }
            val matchStatus = when (selectedStatus) {
                "ทั้งหมด" -> true
                "ออกแล้ว" -> item.status == "drawn" || item.top3.isNotBlank() || item.bottom2.isNotBlank()
                "รอผล" -> item.status == "waiting" && item.top3.isBlank() && item.bottom2.isBlank()
                else -> true
            }
            matchQuery && matchPeriod && matchCategory && matchStatus
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Next Closing Ticker Banner
        item {
            nextClosing?.let { (item, remaining) ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .border(1.dp, Amber500.copy(alpha = 0.4f), RoundedCornerShape(20.dp)),
                    colors = CardDefaults.cardColors(containerColor = Slate900)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.horizontalGradient(
                                    listOf(Amber600.copy(alpha = 0.25f), Slate900)
                                )
                            )
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(Amber500),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Timer,
                                contentDescription = "Next Closing",
                                tint = Slate950,
                                modifier = Modifier.size(26.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "งวดที่ใกล้ปิดรับแทงที่สุด",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Amber400
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Amber500.copy(alpha = 0.2f))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = remaining,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Amber300
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "${item.flag} ${item.name}",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                color = Slate100
                            )
                            Text(
                                text = "ปิดรับแทง: ${item.closeTimeStr} • ออกผล: ${item.drawTimeStr}",
                                fontSize = 12.sp,
                                color = Slate400
                            )
                        }
                    }
                }
            }
        }

        // Search Input Field
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("search_lottery_input"),
                placeholder = { Text("ค้นหาชื่อหวย หรือตัวเลขผลรางวัล...", color = Slate400, fontSize = 14.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = Amber400) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", tint = Slate400)
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Amber500,
                    unfocusedBorderColor = Slate800,
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedTextColor = Slate100,
                    unfocusedTextColor = Slate100
                )
            )
        }

        // Period Filters
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "ช่วงเวลาและหมวดหมู่:",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate400
                )
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val periods = listOf("ทั้งหมด", "หวยเช้า", "หวยบ่าย", "หวยเย็น", "หวยดึก")
                    items(periods) { period ->
                        val selected = selectedPeriod == period
                        FilterChip(
                            selected = selected,
                            onClick = { selectedPeriod = period },
                            label = { Text(period, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Amber500,
                                selectedLabelColor = Slate950,
                                containerColor = Slate900,
                                labelColor = Slate300
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = selected,
                                selectedBorderColor = Amber500,
                                borderColor = Slate800
                            ),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val categories = listOf("ทั้งหมด", "รัฐบาล", "หุ้น", "VIP")
                    items(categories) { cat ->
                        val selected = selectedCategory == cat
                        FilterChip(
                            selected = selected,
                            onClick = { selectedCategory = cat },
                            label = { Text(cat, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Amber500,
                                selectedLabelColor = Slate950,
                                containerColor = Slate900,
                                labelColor = Slate300
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = selected,
                                selectedBorderColor = Amber500,
                                borderColor = Slate800
                            ),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }
            }
        }

        // Counter & Status Row
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "รายการหวยทั้งหมด (${filteredLotteries.size} รายการ)",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate300
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("ทั้งหมด", "ออกแล้ว", "รอผล").forEach { st ->
                        val isSel = selectedStatus == st
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSel) Amber500 else Slate800)
                                .clickable { selectedStatus = st }
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = st,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isSel) Slate950 else Slate300
                            )
                        }
                    }
                }
            }
        }

        // List of Lotteries
        if (filteredLotteries.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.SearchOff, contentDescription = null, tint = Slate600, modifier = Modifier.size(56.dp))
                        Spacer(modifier = Modifier.height(10.dp))
                        Text("ไม่พบหวยที่ตรงกับเงื่อนไขการค้นหา", color = Slate400, fontSize = 14.sp)
                    }
                }
            }
        } else {
            items(filteredLotteries, key = { it.id }) { item ->
                val isDrawn = item.status == "drawn" || item.top3.isNotBlank() || item.bottom2.isNotBlank() || item.firstPrize.isNotBlank()
                val isWatchedMatch = watchedNumbers.any { wn ->
                    (item.bottom2.isNotBlank() && item.bottom2 == wn) ||
                    (item.top3.isNotBlank() && item.top3 == wn) ||
                    (item.firstPrize.isNotBlank() && item.firstPrize.contains(wn))
                }

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .border(
                            1.dp,
                            if (isWatchedMatch) Amber500 else Slate800,
                            RoundedCornerShape(18.dp)
                        )
                        .clickable { viewModel.selectLotteryDetail(item) }
                        .testTag("lottery_card_${item.id}"),
                    colors = CardDefaults.cardColors(containerColor = Slate900)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp)
                    ) {
                        // Header: Flag, Name, Category chip, and Period
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(item.flag, fontSize = 24.sp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(
                                        text = item.name,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Slate100
                                    )
                                    Text(
                                        text = "${item.categoryLabel} • ปิด ${item.closeTimeStr}",
                                        fontSize = 11.sp,
                                        color = Slate400
                                    )
                                }
                            }

                            // Status badge
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(
                                        if (isDrawn) Emerald500.copy(alpha = 0.2f) else Slate800
                                    )
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = if (isDrawn) "ออกผลแล้ว" else "รอผล",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isDrawn) Emerald400 else Slate400
                                )
                            }
                        }

                        // Lucky Watch Highlight Banner
                        if (isWatchedMatch) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Amber500.copy(alpha = 0.15f))
                                    .border(1.dp, Amber500.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "★ ตรงกับเลขนำโชคที่คุณเฝ้าดู!",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Amber400
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Results Display
                        if (item.category == "government" && item.firstPrize.isNotBlank()) {
                            // Government Lottery style
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Column(
                                    modifier = Modifier
                                        .weight(1.5f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Amber500.copy(alpha = 0.15f))
                                        .padding(vertical = 8.dp, horizontal = 10.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text("รางวัลที่ 1", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Amber400)
                                    Text(
                                        text = item.firstPrize,
                                        fontSize = 22.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Amber400,
                                        letterSpacing = 2.sp
                                    )
                                }
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Emerald500.copy(alpha = 0.15f))
                                        .padding(vertical = 8.dp, horizontal = 10.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text("เลขท้าย 2 ตัว", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Emerald400)
                                    Text(
                                        text = item.bottom2.ifBlank { item.firstPrize.takeLast(2) },
                                        fontSize = 22.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Emerald400,
                                        letterSpacing = 2.sp
                                    )
                                }
                            }
                        } else {
                            // Stock / VIP style
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (isDrawn) Amber500.copy(alpha = 0.15f) else Slate800)
                                        .padding(vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text("3 ตัวบน", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (isDrawn) Amber400 else Slate400)
                                    Text(
                                        text = item.top3.ifBlank { if (isDrawn) "---" else "รอผล" },
                                        fontSize = 22.sp,
                                        fontWeight = FontWeight.Black,
                                        color = if (isDrawn) Amber400 else Slate500,
                                        letterSpacing = 1.sp
                                    )
                                }
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (isDrawn) Emerald500.copy(alpha = 0.15f) else Slate800)
                                        .padding(vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text("2 ตัวล่าง", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (isDrawn) Emerald400 else Slate400)
                                    Text(
                                        text = item.bottom2.ifBlank { if (isDrawn) "--" else "รอผล" },
                                        fontSize = 22.sp,
                                        fontWeight = FontWeight.Black,
                                        color = if (isDrawn) Emerald400 else Slate500,
                                        letterSpacing = 1.sp
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Action Buttons: TTS, Copy, Share, Details
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "งวด: ${item.date.ifBlank { "ล่าสุด" }}",
                                fontSize = 11.sp,
                                color = Slate400
                            )

                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                // Speak button
                                IconButton(
                                    onClick = { viewModel.speakLottery(item) },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        Icons.Default.VolumeUp,
                                        contentDescription = "Speak announcement",
                                        tint = Amber400,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }

                                // Copy button
                                IconButton(
                                    onClick = {
                                        val text = "${item.name}\n3 ตัวบน: ${item.top3}\n2 ตัวล่าง: ${item.bottom2}\nงวด: ${item.date}"
                                        SocialShareUtil.copyTextToClipboard(context, item.name, text)
                                    },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        Icons.Default.ContentCopy,
                                        contentDescription = "Copy text",
                                        tint = Slate300,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }

                                // Share button
                                IconButton(
                                    onClick = {
                                        val shareText = "📢 ผล${item.name}\n3 ตัวบน: ${item.top3}\n2 ตัวล่าง: ${item.bottom2}\nดูผลหวยเพิ่มเติมในแอป Lottery Alert"
                                        val sendIntent = Intent().apply {
                                            action = Intent.ACTION_SEND
                                            putExtra(Intent.EXTRA_TEXT, shareText)
                                            type = "text/plain"
                                        }
                                        context.startActivity(Intent.createChooser(sendIntent, "แชร์ผลหวย"))
                                    },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Share,
                                        contentDescription = "Share",
                                        tint = Slate300,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(modifier = Modifier.height(20.dp)) }
    }

    // Detail Modal Dialog
    selectedDetail?.let { item ->
        Dialog(onDismissRequest = { viewModel.selectLotteryDetail(null) }) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .border(1.dp, Amber500.copy(alpha = 0.5f), RoundedCornerShape(24.dp)),
                colors = CardDefaults.cardColors(containerColor = Slate900)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(item.flag, fontSize = 28.sp)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(item.name, fontSize = 20.sp, fontWeight = FontWeight.Black, color = Slate100)
                        }
                        IconButton(onClick = { viewModel.selectLotteryDetail(null) }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = Slate400)
                        }
                    }

                    HorizontalDivider(color = Slate800)

                    Text("ข้อมูลกำหนดเวลาการออกรางวัล:", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Amber400)
                    Text("• เวลาปิดรับแทง: ${item.closeTimeStr}", fontSize = 13.sp, color = Slate300)
                    Text("• เวลาออกผลรางวัล: ${item.drawTimeStr}", fontSize = 13.sp, color = Slate300)
                    Text("• วันที่เปิดให้แทง: ${item.drawDays.ifBlank { "ทุกวัน (จันทร์ - อาทิตย์)" }}", fontSize = 13.sp, color = Slate300)
                    Text("• แหล่งข้อมูล: ${item.source}", fontSize = 13.sp, color = Slate400)

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = { viewModel.speakLottery(item) },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Amber500, contentColor = Slate950),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.VolumeUp, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("ฟังเสียงประกาศ", fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = { viewModel.selectLotteryDetail(null) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            border = ButtonDefaults.outlinedButtonBorder.copy(brush = Brush.horizontalGradient(listOf(Slate700, Slate700)))
                        ) {
                            Text("ปิด", color = Slate300)
                        }
                    }
                }
            }
        }
    }
}
