package com.example.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LotteryCatalogItem(
    val id: String = "",
    val name: String = "",
    val category: String = "",
    val categoryLabel: String = "",
    val period: String = "",
    val periodLabel: String = "",
    val flag: String = "🇹🇭",
    val drawTimeStr: String = "",
    val closeTimeStr: String = "",
    val drawDays: String = "",
    val status: String = "waiting",
    val top3: String = "",
    val bottom2: String = "",
    val firstPrize: String = "",
    val date: String = "",
    val source: String = ""
)

@Serializable
data class RawLotteryResult(
    @SerialName("ชื่อหวย") val lotteryName: String? = null,
    @SerialName("หวย") val altLotteryName: String? = null,
    @SerialName("หมวดหวย") val category: String? = null,
    @SerialName("งวดวันที่") val drawDateThai: String? = null,
    @SerialName("วันที่จัดรูปแบบ") val drawDateIso: String? = null,
    @SerialName("รางวัลที่_1") val firstPrize: String? = null,
    @SerialName("เลขท้าย_2_ตัว") val last2Digits: String? = null,
    @SerialName("เลขบน_3_ตัว") val top3: String? = null,
    @SerialName("เลขล่าง_2_ตัว") val bottom2: String? = null,
    @SerialName("เลขหน้า_3_ตัว") val front3Digits: List<String>? = emptyList(),
    @SerialName("เลขท้าย_3_ตัว") val last3Digits: List<String>? = emptyList(),
    @SerialName("รางวัลข้างเคียงรางวัลที่_1") val adjacentPrizes: List<String>? = emptyList(),
    @SerialName("แหล่งข้อมูล") val source: String? = null,
    @SerialName("เวลาที่ตรวจพบ") val detectedAt: String? = null,
    @SerialName("สถานะการแจ้งเตือน") val notifyStatus: String? = null
) {
    val displayName: String
        get() = lotteryName ?: altLotteryName ?: "ไม่ระบุชื่อ"

    val displayDate: String
        get() = drawDateIso ?: drawDateThai ?: "ไม่ระบุงวด"

    val resolvedTop3: String
        get() = top3 ?: firstPrize?.takeLast(3) ?: ""

    val resolvedBottom2: String
        get() = bottom2 ?: last2Digits ?: ""
}

@Serializable
data class SystemStatusLog(
    val timestamp: String = "",
    val level: String = "INFO",
    val message: String = ""
)

@Serializable
data class SystemStatus(
    val system_status: String = "healthy",
    val last_run_timestamp: String = "",
    val last_run_date_thai: String = "",
    val total_checks: Int = 0,
    val last_source_used: String = "",
    val status_message: String = "",
    val active_sources_count: Int = 0,
    val latest_draw_detected: String = "",
    val notifications_sent_today: Int = 0,
    val notification_failures: Int = 0,
    val recent_logs: List<SystemStatusLog> = emptyList()
)

@Serializable
data class NtfyConfig(
    val enabled: Boolean = true,
    val server: String = "https://ntfy.sh",
    val topic: String = "lottery-alert-live",
    val priority: String = "high",
    val tags: List<String> = listOf("moneybag", "dart", "loudspeaker")
)

@Serializable
data class SourceConfig(
    val enabled: Boolean = true,
    val name: String = "",
    val url: String = "",
    val priority: Int = 1
)

@Serializable
data class AppSettings(
    val app_name: String = "Lottery Alert System Pro",
    val ntfy: NtfyConfig = NtfyConfig(),
    val sources: Map<String, SourceConfig> = emptyMap(),
    val custom_watched_numbers: List<String> = listOf("95", "42", "84", "19", "56", "289594"),
    val speech_polite_ending: String = "ครับ",
    val speech_rate: Float = 1.0f
)

data class TicketCheckReport(
    val ticketNumber: String,
    val isWin: Boolean,
    val winningLotteryName: String,
    val drawDate: String,
    val prizeType: String,
    val matchedNumber: String
)

data class FrequencyStat(
    val number: String,
    val count: Int,
    val percentage: Float,
    val latestLottery: String,
    val latestDate: String
)
