package com.example.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.LotteryRepository
import com.example.model.*
import com.example.util.ThaiTtsManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

class LotteryViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = LotteryRepository(application)
    val ttsManager = ThaiTtsManager(application)

    val lotteries: StateFlow<List<LotteryCatalogItem>> = repository.lotteries
    val results: StateFlow<List<RawLotteryResult>> = repository.results
    val status: StateFlow<SystemStatus> = repository.status
    val settings: StateFlow<AppSettings> = repository.settings
    val watchedNumbers: StateFlow<List<String>> = repository.watchedNumbers

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _isVoiceEnabled = MutableStateFlow(true)
    val isVoiceEnabled: StateFlow<Boolean> = _isVoiceEnabled.asStateFlow()

    private val _ticketReports = MutableStateFlow<List<TicketCheckReport>>(emptyList())
    val ticketReports: StateFlow<List<TicketCheckReport>> = _ticketReports.asStateFlow()

    private val _selectedLotteryDetail = MutableStateFlow<LotteryCatalogItem?>(null)
    val selectedLotteryDetail: StateFlow<LotteryCatalogItem?> = _selectedLotteryDetail.asStateFlow()

    private val _top2Stats = MutableStateFlow<List<FrequencyStat>>(emptyList())
    val top2Stats: StateFlow<List<FrequencyStat>> = _top2Stats.asStateFlow()

    private val _top3Stats = MutableStateFlow<List<FrequencyStat>>(emptyList())
    val top3Stats: StateFlow<List<FrequencyStat>> = _top3Stats.asStateFlow()

    init {
        loadStats()
    }

    fun loadStats() {
        viewModelScope.launch {
            _top2Stats.value = repository.getTop2DigitFrequency(15)
            _top3Stats.value = repository.getTop3DigitFrequency(15)
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            delay(600)
            repository.refresh()
            loadStats()
            _isRefreshing.value = false
        }
    }

    fun toggleVoice() {
        _isVoiceEnabled.value = !_isVoiceEnabled.value
        if (!_isVoiceEnabled.value) {
            ttsManager.stop()
        }
    }

    fun speak(text: String) {
        if (_isVoiceEnabled.value) {
            ttsManager.speak(text)
        }
    }

    fun speakLottery(item: LotteryCatalogItem) {
        if (!_isVoiceEnabled.value) return
        val matchedRes = results.value.firstOrNull { it.displayName.contains(item.name) || item.name.contains(it.displayName) }
        val speech = ThaiTtsManager.buildAnnouncement(item, matchedRes, settings.value.speech_polite_ending)
        ttsManager.speak(speech)
    }

    fun checkTickets(input: String) {
        viewModelScope.launch {
            _ticketReports.value = repository.checkTickets(input)
        }
    }

    fun addWatchedNumber(num: String) {
        repository.addWatchedNumber(num)
    }

    fun removeWatchedNumber(num: String) {
        repository.removeWatchedNumber(num)
    }

    fun selectLotteryDetail(item: LotteryCatalogItem?) {
        _selectedLotteryDetail.value = item
    }

    fun updateNtfy(server: String, topic: String, priority: String) {
        repository.updateNtfyConfig(server, topic, priority)
    }

    fun getNextClosingLottery(): Pair<LotteryCatalogItem, String>? {
        val list = lotteries.value
        if (list.isEmpty()) return null

        val bangkokTz = TimeZone.getTimeZone("Asia/Bangkok")
        val now = Calendar.getInstance(bangkokTz)
        val curMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

        var closestItem: LotteryCatalogItem? = null
        var minDiff = Int.MAX_VALUE
        var remainingDesc = ""

        for (item in list) {
            val closeTime = item.closeTimeStr
            val parts = Regex("(\\d{1,2})[:.](\\d{2})").find(closeTime)
            if (parts != null) {
                val hour = parts.groupValues[1].toIntOrNull() ?: continue
                val minute = parts.groupValues[2].toIntOrNull() ?: continue
                val targetMinutes = hour * 60 + minute

                val diff = if (targetMinutes >= curMinutes) {
                    targetMinutes - curMinutes
                } else {
                    targetMinutes + (24 * 60) - curMinutes
                }

                if (diff in 1..<minDiff) {
                    minDiff = diff
                    closestItem = item
                    val diffHours = diff / 60
                    val diffMins = diff % 60
                    remainingDesc = if (diffHours > 0) "เหลืออีก $diffHours ชม. $diffMins นาที" else "เหลืออีก $diffMins นาที"
                }
            }
        }

        return closestItem?.let { Pair(it, remainingDesc) }
    }

    override fun onCleared() {
        super.onCleared()
        ttsManager.shutdown()
    }
}
