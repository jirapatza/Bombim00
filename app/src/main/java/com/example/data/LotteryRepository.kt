package com.example.data

import android.content.Context
import com.example.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class LotteryRepository(private val context: Context) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    private val _lotteries = MutableStateFlow<List<LotteryCatalogItem>>(emptyList())
    val lotteries: StateFlow<List<LotteryCatalogItem>> = _lotteries.asStateFlow()

    private val _results = MutableStateFlow<List<RawLotteryResult>>(emptyList())
    val results: StateFlow<List<RawLotteryResult>> = _results.asStateFlow()

    private val _status = MutableStateFlow(SystemStatus())
    val status: StateFlow<SystemStatus> = _status.asStateFlow()

    private val _settings = MutableStateFlow(AppSettings())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    private val _watchedNumbers = MutableStateFlow<List<String>>(listOf("95", "42", "84", "19", "56", "289594"))
    val watchedNumbers: StateFlow<List<String>> = _watchedNumbers.asStateFlow()

    init {
        loadInitialData()
    }

    private fun loadInitialData() {
        try {
            // Load Settings
            val settingsStr = context.assets.open("settings.json").bufferedReader().use { it.readText() }
            val loadedSettings = runCatching { json.decodeFromString<AppSettings>(settingsStr) }.getOrDefault(AppSettings())
            _settings.value = loadedSettings
            if (loadedSettings.custom_watched_numbers.isNotEmpty()) {
                _watchedNumbers.value = loadedSettings.custom_watched_numbers
            }

            // Load Status
            val statusStr = context.assets.open("status.json").bufferedReader().use { it.readText() }
            val loadedStatus = runCatching { json.decodeFromString<SystemStatus>(statusStr) }.getOrDefault(SystemStatus())
            _status.value = loadedStatus

            // Load Results
            val resultsStr = context.assets.open("lottery_previous_results.json").bufferedReader().use { it.readText() }
            val loadedResults = runCatching { json.decodeFromString<List<RawLotteryResult>>(resultsStr) }.getOrDefault(emptyList())
            _results.value = loadedResults

            // Load Catalog
            val catalogStr = context.assets.open("all_lotteries.json").bufferedReader().use { it.readText() }
            val loadedCatalog = runCatching { json.decodeFromString<List<LotteryCatalogItem>>(catalogStr) }.getOrDefault(emptyList())

            // Merge Catalog with latest known results
            val merged = loadedCatalog.map { catalogItem ->
                val matched = findMatchingResult(catalogItem, loadedResults)
                if (matched != null) {
                    val top3 = catalogItem.top3.ifBlank { matched.resolvedTop3 }
                    val bottom2 = catalogItem.bottom2.ifBlank { matched.resolvedBottom2 }
                    val firstPrize = catalogItem.firstPrize.ifBlank { matched.firstPrize ?: "" }
                    val isDrawn = top3.isNotBlank() || bottom2.isNotBlank() || firstPrize.isNotBlank()
                    catalogItem.copy(
                        status = if (isDrawn) "drawn" else "waiting",
                        top3 = top3,
                        bottom2 = bottom2,
                        firstPrize = firstPrize,
                        date = catalogItem.date.ifBlank { matched.displayDate },
                        source = catalogItem.source.ifBlank { matched.source ?: "ผลตรวจล่าสุด" }
                    )
                } else {
                    catalogItem
                }
            }
            _lotteries.value = merged
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun normalizeName(name: String): String {
        val isVip = name.contains("vip", ignoreCase = true) || name.contains("วีไอพี")
        return name.lowercase(Locale.ROOT)
            .replace("vip", "")
            .replace("วีไอพี", "")
            .replace("นิคเคอิ", "นิเคอิ")
            .replace("หวยหุ้น", "")
            .replace("หวย", "")
            .replace("หุ้น", "")
            .replace("รอบ", "")
            .replace("(ไทย)", "")
            .filter { it.isLetterOrDigit() } + if (isVip) "vip" else ""
    }

    private fun findMatchingResult(catalogItem: LotteryCatalogItem, results: List<RawLotteryResult>): RawLotteryResult? {
        val catKey = normalizeName(catalogItem.name)
        return results.firstOrNull { res ->
            val resKey = normalizeName(res.displayName)
            catKey.isNotEmpty() && (resKey.contains(catKey) || catKey.contains(resKey))
        }
    }

    fun refresh() {
        val bangkokTz = TimeZone.getTimeZone("Asia/Bangkok")
        val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm:ss 'น.'", Locale("th", "TH")).apply {
            timeZone = bangkokTz
        }
        val currentThaiTime = sdf.format(Date())

        val currentStatus = _status.value
        _status.value = currentStatus.copy(
            last_run_date_thai = currentThaiTime,
            total_checks = currentStatus.total_checks + 1,
            status_message = "ตรวจพบผลล่าสุดและอัปเดตระบบเรียบร้อย ($currentThaiTime)"
        )
    }

    fun addWatchedNumber(number: String) {
        val clean = number.trim()
        if (clean.isNotBlank() && clean !in _watchedNumbers.value) {
            _watchedNumbers.value = _watchedNumbers.value + clean
        }
    }

    fun removeWatchedNumber(number: String) {
        _watchedNumbers.value = _watchedNumbers.value - number
    }

    fun updateNtfyConfig(server: String, topic: String, priority: String) {
        val cur = _settings.value
        _settings.value = cur.copy(
            ntfy = cur.ntfy.copy(
                server = server,
                topic = topic,
                priority = priority
            )
        )
    }

    fun checkTickets(rawInput: String): List<TicketCheckReport> {
        val numbers = rawInput.split(',', ' ', '\n', '\t', '|', ';')
            .map { it.trim().filter { ch -> ch.isDigit() } }
            .filter { it.isNotBlank() }

        if (numbers.isEmpty()) return emptyList()

        val allResults = _results.value
        val reports = mutableListOf<TicketCheckReport>()

        for (num in numbers) {
            var matchedWin: TicketCheckReport? = null

            // Search against recent draws
            for (res in allResults) {
                val first = res.firstPrize?.trim() ?: ""
                val top3 = res.resolvedTop3.trim()
                val bottom2 = res.resolvedBottom2.trim()
                val front3 = res.front3Digits ?: emptyList()
                val last3 = res.last3Digits ?: emptyList()

                // Check 6-digit first prize or 3-digit first prize
                if (first.isNotBlank() && (first == num || (first.length == 6 && first.takeLast(num.length) == num && num.length in 2..3))) {
                    if (first == num) {
                        matchedWin = TicketCheckReport(
                            ticketNumber = num,
                            isWin = true,
                            winningLotteryName = res.displayName,
                            drawDate = res.displayDate,
                            prizeType = "รางวัลที่ 1 เต็มใบ",
                            matchedNumber = first
                        )
                        break
                    }
                }

                // Check 2-digit match
                if (num.length == 2 && bottom2 == num) {
                    matchedWin = TicketCheckReport(
                        ticketNumber = num,
                        isWin = true,
                        winningLotteryName = res.displayName,
                        drawDate = res.displayDate,
                        prizeType = "เลขท้าย 2 ตัว",
                        matchedNumber = bottom2
                    )
                    break
                }

                // Check 3-digit top match
                if (num.length == 3 && top3 == num) {
                    matchedWin = TicketCheckReport(
                        ticketNumber = num,
                        isWin = true,
                        winningLotteryName = res.displayName,
                        drawDate = res.displayDate,
                        prizeType = "เลข 3 ตัวบน",
                        matchedNumber = top3
                    )
                    break
                }

                // Check 3-digit front or last
                if (num.length == 3) {
                    if (front3.any { it.contains(num) }) {
                        matchedWin = TicketCheckReport(
                            ticketNumber = num,
                            isWin = true,
                            winningLotteryName = res.displayName,
                            drawDate = res.displayDate,
                            prizeType = "เลขหน้า 3 ตัว",
                            matchedNumber = num
                        )
                        break
                    }
                    if (last3.any { it.contains(num) }) {
                        matchedWin = TicketCheckReport(
                            ticketNumber = num,
                            isWin = true,
                            winningLotteryName = res.displayName,
                            drawDate = res.displayDate,
                            prizeType = "เลขท้าย 3 ตัว",
                            matchedNumber = num
                        )
                        break
                    }
                }
            }

            if (matchedWin != null) {
                reports.add(matchedWin)
            } else {
                reports.add(
                    TicketCheckReport(
                        ticketNumber = num,
                        isWin = false,
                        winningLotteryName = "ไม่พบรางวัลในงวดล่าสุด",
                        drawDate = "ทุกงวดที่มีการบันทึก",
                        prizeType = "ไม่ถูกรางวัล",
                        matchedNumber = "-"
                    )
                )
            }
        }

        return reports
    }

    fun getTop2DigitFrequency(limit: Int = 12): List<FrequencyStat> {
        val occurrences = mutableMapOf<String, Int>()
        val latestSeen = mutableMapOf<String, Pair<String, String>>()

        val resultsList = _results.value
        val totalCount = resultsList.size.coerceAtLeast(1)

        for (res in resultsList) {
            val num = res.resolvedBottom2.filter { it.isDigit() }
            if (num.length == 2) {
                occurrences[num] = (occurrences[num] ?: 0) + 1
                if (!latestSeen.containsKey(num)) {
                    latestSeen[num] = Pair(res.displayName, res.displayDate)
                }
            }
        }

        return occurrences.entries
            .sortedByDescending { it.value }
            .take(limit)
            .map { entry ->
                val pair = latestSeen[entry.key] ?: Pair("ไม่ระบุ", "-")
                FrequencyStat(
                    number = entry.key,
                    count = entry.value,
                    percentage = (entry.value.toFloat() / totalCount) * 100f,
                    latestLottery = pair.first,
                    latestDate = pair.second
                )
            }
    }

    fun getTop3DigitFrequency(limit: Int = 12): List<FrequencyStat> {
        val occurrences = mutableMapOf<String, Int>()
        val latestSeen = mutableMapOf<String, Pair<String, String>>()

        val resultsList = _results.value
        val totalCount = resultsList.size.coerceAtLeast(1)

        for (res in resultsList) {
            val num = res.resolvedTop3.filter { it.isDigit() }
            if (num.length == 3) {
                occurrences[num] = (occurrences[num] ?: 0) + 1
                if (!latestSeen.containsKey(num)) {
                    latestSeen[num] = Pair(res.displayName, res.displayDate)
                }
            }
        }

        return occurrences.entries
            .sortedByDescending { it.value }
            .take(limit)
            .map { entry ->
                val pair = latestSeen[entry.key] ?: Pair("ไม่ระบุ", "-")
                FrequencyStat(
                    number = entry.key,
                    count = entry.value,
                    percentage = (entry.value.toFloat() / totalCount) * 100f,
                    latestLottery = pair.first,
                    latestDate = pair.second
                )
            }
    }
}
