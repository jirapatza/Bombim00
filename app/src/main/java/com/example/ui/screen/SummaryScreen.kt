package com.example.ui.screen

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.ui.LotteryViewModel
import com.example.ui.theme.*
import com.example.util.SocialShareUtil
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@Composable
fun SummaryScreen(
    viewModel: LotteryViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lotteries by viewModel.lotteries.collectAsState()

    var selectedPeriodTab by remember { mutableStateOf("รวมทั้งวัน") }
    var previewBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var isGeneratingImage by remember { mutableStateOf(false) }

    val bangkokDateStr = remember {
        val sdf = SimpleDateFormat("dd MMMM yyyy", Locale("th", "TH")).apply {
            timeZone = TimeZone.getTimeZone("Asia/Bangkok")
        }
        sdf.format(Date())
    }

    val periodOptions = listOf("รวมทั้งวัน", "รอบเช้า", "รอบบ่าย", "รอบเย็น", "รอบดึก")

    val displayedItems = remember(lotteries, selectedPeriodTab) {
        when (selectedPeriodTab) {
            "รอบเช้า" -> lotteries.filter { it.period == "morning" || it.periodLabel.contains("เช้า") }
            "รอบบ่าย" -> lotteries.filter { it.period == "afternoon" || it.periodLabel.contains("บ่าย") }
            "รอบเย็น" -> lotteries.filter { it.period == "evening" || it.periodLabel.contains("เย็น") }
            "รอบดึก" -> lotteries.filter { it.period == "night" || it.periodLabel.contains("ดึก") }
            else -> lotteries
        }
    }

    val drawnCount = displayedItems.count { it.status == "drawn" || it.top3.isNotBlank() || it.bottom2.isNotBlank() }
    val waitingCount = displayedItems.size - drawnCount

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        // Top Header Card with Summary Metrics
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .border(1.dp, Amber500.copy(alpha = 0.3f), RoundedCornerShape(20.dp)),
            colors = CardDefaults.cardColors(containerColor = Slate900)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("สรุปผลหวยรายวัน", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Slate100)
                        Text("ประจำวันที่ $bangkokDateStr", fontSize = 12.sp, color = Amber400)
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(Amber500)
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "${displayedItems.size} รายการ",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            color = Slate950
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Emerald500.copy(alpha = 0.15f))
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("ออกผลแล้ว", fontSize = 11.sp, color = Emerald400)
                            Text("$drawnCount หวย", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Emerald400)
                        }
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Slate800)
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("รอออกรางวัล", fontSize = 11.sp, color = Slate400)
                            Text("$waitingCount หวย", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Slate300)
                        }
                    }
                }

                // Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            isGeneratingImage = true
                            val bmp = SocialShareUtil.generateSummaryBitmap(
                                context = context,
                                title = "สรุปผลหวยประจำวัน",
                                dateText = bangkokDateStr,
                                periodLabel = selectedPeriodTab,
                                items = displayedItems
                            )
                            previewBitmap = bmp
                            isGeneratingImage = false
                        },
                        modifier = Modifier
                            .weight(1.2f)
                            .testTag("generate_share_image_button"),
                        colors = ButtonDefaults.buttonColors(containerColor = Amber500, contentColor = Slate950),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("สร้างรูปภาพแชร์", fontWeight = FontWeight.Black, fontSize = 13.sp)
                    }

                    OutlinedButton(
                        onClick = {
                            val textBuilder = StringBuilder()
                            textBuilder.append("📢 สรุปผลหวยประจำวัน ($selectedPeriodTab)\n")
                            textBuilder.append("🗓 วันที่ $bangkokDateStr\n\n")
                            displayedItems.forEach { item ->
                                val top = item.top3.ifBlank { "รอผล" }
                                val btm = item.bottom2.ifBlank { "รอผล" }
                                textBuilder.append("${item.flag} ${item.name}: บน $top / ล่าง $btm\n")
                            }
                            textBuilder.append("\nติดตามผลหวยสดได้ที่ Lottery Alert")
                            SocialShareUtil.copyTextToClipboard(context, "สรุปผลหวย $selectedPeriodTab", textBuilder.toString())
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                        border = ButtonDefaults.outlinedButtonBorder.copy(
                            brush = androidx.compose.ui.graphics.SolidColor(Amber500.copy(alpha = 0.5f))
                        )
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = null, tint = Amber400, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("คัดลอกข้อความ", color = Amber400, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Period Tab Selector
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(periodOptions) { p ->
                val selected = selectedPeriodTab == p
                FilterChip(
                    selected = selected,
                    onClick = { selectedPeriodTab = p },
                    label = { Text(p, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Amber500,
                        selectedLabelColor = Slate950,
                        containerColor = Slate900,
                        labelColor = Slate300
                    ),
                    shape = RoundedCornerShape(12.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Summary Table Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Slate900)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("ชื่อหวย & รอบ", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, modifier = Modifier.weight(1.4f))
            Text("3 ตัวบน", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Amber400, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            Text("2 ตัวล่าง", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Emerald400, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Summary Table Rows
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(displayedItems, key = { it.id }) { item ->
                val isDrawn = item.status == "drawn" || item.top3.isNotBlank() || item.bottom2.isNotBlank()
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .border(1.dp, Slate800, RoundedCornerShape(12.dp)),
                    colors = CardDefaults.cardColors(containerColor = Slate900)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            modifier = Modifier.weight(1.4f),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(item.flag, fontSize = 18.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Column {
                                Text(
                                    text = item.name,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Slate100
                                )
                                Text(
                                    text = item.closeTimeStr,
                                    fontSize = 10.sp,
                                    color = Slate400
                                )
                            }
                        }

                        // Top 3
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isDrawn) Amber500 else Slate800)
                                .padding(vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = item.top3.ifBlank { if (isDrawn) "---" else "รอผล" },
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black,
                                color = if (isDrawn) Slate950 else Slate500
                            )
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        // Bottom 2
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isDrawn) Emerald500 else Slate800)
                                .padding(vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = item.bottom2.ifBlank { if (isDrawn) "--" else "รอผล" },
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black,
                                color = if (isDrawn) Slate950 else Slate500
                            )
                        }
                    }
                }
            }
            item { Spacer(modifier = Modifier.height(20.dp)) }
        }
    }

    // Image Preview & Share Dialog
    previewBitmap?.let { bmp ->
        Dialog(onDismissRequest = { previewBitmap = null }) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .border(1.dp, Amber500, RoundedCornerShape(24.dp)),
                colors = CardDefaults.cardColors(containerColor = Slate900)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("ภาพสรุปผลหวย (Social Card)", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Slate100)
                        IconButton(onClick = { previewBitmap = null }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = Slate400)
                        }
                    }

                    // Render Preview Image
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(340.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, Slate800, RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            bitmap = bmp.asImageBitmap(),
                            contentDescription = "Summary Card Preview",
                            modifier = Modifier.fillMaxSize()
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                SocialShareUtil.shareBitmap(context, bmp, "สรุปผลหวยประจำวัน $selectedPeriodTab ($bangkokDateStr)")
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Amber500, contentColor = Slate950),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("แชร์รูปภาพทันที", fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = { previewBitmap = null },
                            modifier = Modifier.weight(0.6f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("เสร็จสิ้น", color = Slate300)
                        }
                    }
                }
            }
        }
    }
}
