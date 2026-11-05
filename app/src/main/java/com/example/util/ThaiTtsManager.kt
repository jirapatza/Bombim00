package com.example.util

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import com.example.model.LotteryCatalogItem
import com.example.model.RawLotteryResult
import java.util.Locale

class ThaiTtsManager(private val context: Context) : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var isInitialized = false

    init {
        try {
            tts = TextToSpeech(context.applicationContext, this)
        } catch (e: Exception) {
            Log.e("ThaiTtsManager", "TTS initialization error", e)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val thaiLocale = Locale("th", "TH")
            val result = tts?.setLanguage(thaiLocale)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                // Fallback to default locale
                tts?.language = Locale.getDefault()
            }
            tts?.setSpeechRate(0.95f)
            isInitialized = true
        }
    }

    fun speak(text: String) {
        if (!isInitialized) return
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "LOTTERY_TTS_${System.currentTimeMillis()}")
    }

    fun stop() {
        tts?.stop()
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }

    companion object {
        fun spellOutDigits(number: String): String {
            val digitNames = mapOf(
                '0' to "ศูนย์",
                '1' to "หนึ่ง",
                '2' to "สอง",
                '3' to "สาม",
                '4' to "สี่",
                '5' to "ห้า",
                '6' to "หก",
                '7' to "เจ็ด",
                '8' to "แปด",
                '9' to "เก้า"
            )
            return number.filter { it.isDigit() }
                .map { digitNames[it] ?: it.toString() }
                .joinToString(" ")
        }

        fun buildAnnouncement(item: LotteryCatalogItem, result: RawLotteryResult?, politeParticle: String = "ครับ"): String {
            val name = item.name.ifBlank { result?.displayName ?: "หวย" }
            val isGov = name.contains("สลากกินแบ่ง") || name.contains("รัฐบาล")
            
            val top3 = if (item.top3.isNotBlank()) item.top3 else result?.resolvedTop3 ?: ""
            val bottom2 = if (item.bottom2.isNotBlank()) item.bottom2 else result?.resolvedBottom2 ?: ""
            val firstPrize = if (item.firstPrize.isNotBlank()) item.firstPrize else result?.firstPrize ?: ""

            return if (isGov && firstPrize.isNotBlank()) {
                val spelledFirst = spellOutDigits(firstPrize)
                val spelled2 = spellOutDigits(bottom2)
                "ประกาศผลสลากกินแบ่งรัฐบาล รางวัลที่หนึ่ง $spelledFirst เลขท้ายสองตัว $spelled2 $politeParticle"
            } else if (top3.isNotBlank() && bottom2.isNotBlank()) {
                val spelledTop = spellOutDigits(top3)
                val spelledBottom = spellOutDigits(bottom2)
                "ประกาศผล $name สามตัวบน $spelledTop สองตัวล่าง $spelledBottom $politeParticle"
            } else {
                "ผล $name งวดล่าสุด ยังรอผลการออกรางวัล $politeParticle"
            }
        }
    }
}
