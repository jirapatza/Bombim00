package com.example.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.LotteryViewModel
import com.example.ui.theme.*

@Composable
fun TicketCheckerScreen(
    viewModel: LotteryViewModel,
    modifier: Modifier = Modifier
) {
    var inputNumbers by remember { mutableStateOf("") }
    val reports by viewModel.ticketReports.collectAsState()

    val winCount = remember(reports) { reports.count { it.isWin } }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Hero Card
        item {
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
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Amber500),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.ConfirmationNumber, contentDescription = null, tint = Slate950, modifier = Modifier.size(22.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("ตรวจสลากรางวัลอัตโนมัติ", fontSize = 17.sp, fontWeight = FontWeight.Black, color = Slate100)
                            Text("รองรับตรวจเลขเดี่ยว และตรวจชุดหลายใบพร้อมกัน", fontSize = 12.sp, color = Amber400)
                        }
                    }

                    Text(
                        text = "กรอกตัวเลขที่ต้องการตรวจ (คั่นด้วยเครื่องหมายจุลภาค เว้นวรรค หรือขึ้นบรรทัดใหม่):",
                        fontSize = 12.sp,
                        color = Slate300
                    )

                    OutlinedTextField(
                        value = inputNumbers,
                        onValueChange = { inputNumbers = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(110.dp)
                            .testTag("ticket_input_field"),
                        placeholder = { Text("ตัวอย่าง: 85, 224, 071, 95, 612", color = Slate500, fontSize = 13.sp) },
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Amber500,
                            unfocusedBorderColor = Slate800,
                            focusedContainerColor = Slate950,
                            unfocusedContainerColor = Slate950,
                            focusedTextColor = Slate100,
                            unfocusedTextColor = Slate100
                        )
                    )

                    // Quick Sample Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(
                            "85, 224" to "ผลงวดล่าสุด",
                            "071, 92" to "หวยออมสิน",
                            "612, 21" to "หวย ธ.ก.ส."
                        ).forEach { (sample, label) ->
                            AssistChip(
                                onClick = { inputNumbers = sample },
                                label = { Text(label, fontSize = 11.sp) },
                                colors = AssistChipDefaults.assistChipColors(
                                    containerColor = Slate800,
                                    labelColor = Slate300
                                ),
                                border = AssistChipDefaults.assistChipBorder(enabled = true, borderColor = Slate700),
                                shape = RoundedCornerShape(8.dp)
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                if (inputNumbers.isNotBlank()) {
                                    viewModel.checkTickets(inputNumbers)
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .testTag("check_tickets_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = Amber500, contentColor = Slate950),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("ตรวจผลรางวัลทันที", fontWeight = FontWeight.Bold)
                        }

                        if (inputNumbers.isNotEmpty() || reports.isNotEmpty()) {
                            OutlinedButton(
                                onClick = {
                                    inputNumbers = ""
                                    viewModel.checkTickets("")
                                },
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("ล้างข้อมูล", color = Slate400)
                            }
                        }
                    }
                }
            }
        }

        // Result Summary Banner
        if (reports.isNotEmpty()) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .border(
                            1.dp,
                            if (winCount > 0) Emerald500 else Slate800,
                            RoundedCornerShape(16.dp)
                        ),
                    colors = CardDefaults.cardColors(
                        containerColor = if (winCount > 0) Emerald900.copy(alpha = 0.35f) else Slate900
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(if (winCount > 0) Emerald500 else Slate700),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    if (winCount > 0) Icons.Default.EmojiEvents else Icons.Default.Info,
                                    contentDescription = null,
                                    tint = if (winCount > 0) Slate950 else Slate300,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = if (winCount > 0) "ยินดีด้วย! ถูกรางวัล $winCount รายการ 🎉" else "ไม่พบตัวเลขที่ถูกรางวัล",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (winCount > 0) Emerald400 else Slate300
                                )
                                Text(
                                    text = "ตรวจทั้งหมด ${reports.size} หมายเลข",
                                    fontSize = 11.sp,
                                    color = Slate400
                                )
                            }
                        }
                    }
                }
            }

            // Reports List
            items(reports) { rep ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .border(
                            1.dp,
                            if (rep.isWin) Emerald500.copy(alpha = 0.6f) else Slate800,
                            RoundedCornerShape(14.dp)
                        ),
                    colors = CardDefaults.cardColors(containerColor = Slate900)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Ticket Number Box
                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (rep.isWin) Emerald500 else Slate800),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = rep.ticketNumber,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                color = if (rep.isWin) Slate950 else Slate400
                            )
                        }

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (rep.isWin) rep.prizeType else "ไม่ถูกรางวัล",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (rep.isWin) Emerald400 else Slate400
                                )

                                if (rep.isWin) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(Emerald500)
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text("ถูกรางวัล", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Slate950)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(2.dp))

                            Text(
                                text = "${rep.winningLotteryName} (${rep.drawDate})",
                                fontSize = 12.sp,
                                color = Slate300
                            )

                            if (rep.isWin) {
                                Text(
                                    text = "หมายเลขรางวัลที่ออก: ${rep.matchedNumber}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Amber400
                                )
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(modifier = Modifier.height(20.dp)) }
    }
}
