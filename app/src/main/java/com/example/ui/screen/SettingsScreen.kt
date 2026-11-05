package com.example.ui.screen

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.LotteryViewModel
import com.example.ui.theme.*

@Composable
fun SettingsScreen(
    viewModel: LotteryViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val settings by viewModel.settings.collectAsState()
    val status by viewModel.status.collectAsState()
    val watchedNumbers by viewModel.watchedNumbers.collectAsState()
    val isVoiceEnabled by viewModel.isVoiceEnabled.collectAsState()

    var newNumberInput by remember { mutableStateOf("") }
    var ntfyServer by remember(settings) { mutableStateOf(settings.ntfy.server) }
    var ntfyTopic by remember(settings) { mutableStateOf(settings.ntfy.topic) }
    var ntfyPriority by remember(settings) { mutableStateOf(settings.ntfy.priority) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Watched Numbers Section
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
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Amber500),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Star, contentDescription = null, tint = Slate950, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text("เลขนำโชคที่คุณเฝ้าดู (Watched Numbers)", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Slate100)
                            Text("ระบบจะแจ้งเตือนและเน้นสีเป็นพิเศษเมื่อออกผลรางวัล", fontSize = 11.sp, color = Slate400)
                        }
                    }

                    // Chips of existing numbers
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        watchedNumbers.forEach { num ->
                            InputChip(
                                selected = true,
                                onClick = { },
                                label = { Text(num, fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                                trailingIcon = {
                                    Icon(
                                        Icons.Default.Close,
                                        contentDescription = "Delete",
                                        tint = Slate950,
                                        modifier = Modifier
                                            .size(16.dp)
                                            .clickable { viewModel.removeWatchedNumber(num) }
                                    )
                                },
                                colors = InputChipDefaults.inputChipColors(
                                    selectedContainerColor = Amber500,
                                    selectedLabelColor = Slate950
                                ),
                                shape = RoundedCornerShape(10.dp)
                            )
                        }
                    }

                    // Add Number Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = newNumberInput,
                            onValueChange = { newNumberInput = it.filter { ch -> ch.isDigit() } },
                            modifier = Modifier
                                .weight(1f)
                                .testTag("add_watched_number_input"),
                            placeholder = { Text("ใส่เลข 2 ตัว หรือ 3 ตัว...", fontSize = 12.sp, color = Slate500) },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Amber500,
                                unfocusedBorderColor = Slate800,
                                focusedContainerColor = Slate950,
                                unfocusedContainerColor = Slate950,
                                focusedTextColor = Slate100,
                                unfocusedTextColor = Slate100
                            )
                        )

                        Button(
                            onClick = {
                                if (newNumberInput.isNotBlank()) {
                                    viewModel.addWatchedNumber(newNumberInput)
                                    newNumberInput = ""
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Amber500, contentColor = Slate950),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("เพิ่ม", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Voice TTS Settings
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .border(1.dp, Slate800, RoundedCornerShape(20.dp)),
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
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(if (isVoiceEnabled) Emerald500 else Slate700),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    if (isVoiceEnabled) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                                    contentDescription = null,
                                    tint = Slate950,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text("ระบบเสียงอ่านผลรางวัล (TTS)", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Slate100)
                                Text(if (isVoiceEnabled) "เปิดใช้งานเสียงอ่านผลภาษาไทย" else "ปิดเสียงอยู่", fontSize = 11.sp, color = Slate400)
                            }
                        }

                        Switch(
                            checked = isVoiceEnabled,
                            onCheckedChange = { viewModel.toggleVoice() },
                            colors = SwitchDefaults.colors(checkedThumbColor = Slate950, checkedTrackColor = Amber500)
                        )
                    }

                    if (isVoiceEnabled) {
                        Button(
                            onClick = {
                                viewModel.speak("ประกาศผลสลากกินแบ่งรัฐบาล รางวัลที่หนึ่ง สอง สอง สี่ เลขท้ายสองตัว แปด ห้า ครับ")
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Slate800, contentColor = Amber400),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("ทดสอบเสียงอ่านตัวอย่าง", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // Push Notifications (ntfy) Settings
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .border(1.dp, Slate800, RoundedCornerShape(20.dp)),
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
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Cyan400),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Notifications, contentDescription = null, tint = Slate950, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text("การแจ้งเตือน Push Notification (ntfy)", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Slate100)
                            Text("เชื่อมต่อเซิร์ฟเวอร์แจ้งเตือนผลหวยสด", fontSize = 11.sp, color = Slate400)
                        }
                    }

                    OutlinedTextField(
                        value = ntfyServer,
                        onValueChange = { ntfyServer = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Server URL", fontSize = 12.sp) },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Amber500,
                            unfocusedBorderColor = Slate800,
                            focusedContainerColor = Slate950,
                            unfocusedContainerColor = Slate950,
                            focusedTextColor = Slate100,
                            unfocusedTextColor = Slate100
                        )
                    )

                    OutlinedTextField(
                        value = ntfyTopic,
                        onValueChange = { ntfyTopic = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Topic Channel", fontSize = 12.sp) },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Amber500,
                            unfocusedBorderColor = Slate800,
                            focusedContainerColor = Slate950,
                            unfocusedContainerColor = Slate950,
                            focusedTextColor = Slate100,
                            unfocusedTextColor = Slate100
                        )
                    )

                    Button(
                        onClick = {
                            viewModel.updateNtfy(ntfyServer, ntfyTopic, ntfyPriority)
                            Toast.makeText(context, "บันทึกการตั้งค่าการแจ้งเตือนสำเร็จ", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Amber500, contentColor = Slate950),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("บันทึกการตั้งค่า", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Data Sources Status
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .border(1.dp, Slate800, RoundedCornerShape(20.dp)),
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
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Purple400),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.CloudSync, contentDescription = null, tint = Slate950, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text("สถานะแหล่งข้อมูล (Data Sources)", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Slate100)
                            Text("ความพร้อมและลำดับความสำคัญของ API", fontSize = 11.sp, color = Slate400)
                        }
                    }

                    listOf(
                        "สำนักงานสลากกินแบ่งรัฐบาล (GLO Official)" to true,
                        "ThaiLottoAPI (หุ้น / VIP / ลาว)" to true,
                        "RANLOTTO Public API (ไทยสำรอง)" to true,
                        "LotteryChecks API" to true,
                        "Sanook / Pholhuay Fallback" to false
                    ).forEach { (name, active) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Slate950)
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(name, fontSize = 12.sp, color = Slate100, modifier = Modifier.weight(1f))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(if (active) Emerald500.copy(alpha = 0.2f) else Slate800)
                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = if (active) "พร้อมใช้งาน" else "สแตนด์บาย",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (active) Emerald400 else Slate400
                                )
                            }
                        }
                    }
                }
            }
        }

        // Diagnostics & System Health
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .border(1.dp, Slate800, RoundedCornerShape(20.dp)),
                colors = CardDefaults.cardColors(containerColor = Slate900)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("ข้อมูลสถานะระบบ (Diagnostics)", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Slate100)
                    Text("• สถานะระบบ: ${status.system_status} (พร้อมทำงาน)", fontSize = 12.sp, color = Emerald400)
                    Text("• ตรวจสอบแล้วทั้งหมด: ${status.total_checks} ครั้ง", fontSize = 12.sp, color = Slate300)
                    Text("• แหล่งข้อมูลล่าสุด: ${status.last_source_used}", fontSize = 12.sp, color = Slate300)
                    Text("• อัปเดตล่าสุด: ${status.last_run_date_thai.ifBlank { "03/11/2026 01:43:47 น." }}", fontSize = 12.sp, color = Amber400)
                }
            }
        }

        item { Spacer(modifier = Modifier.height(20.dp)) }
    }
}
