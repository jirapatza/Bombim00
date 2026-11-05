# Lottery Alert — Android Application

A modern, high-performance Android application built with Kotlin and Jetpack Compose for tracking Thai government, foreign stock, and VIP lottery results in real time.

## Overview & Core Features

- **Live Lottery Results & Upcoming Draws (หน้าหลัก)**:
  - Real-time Bangkok clock ticker (Asia/Bangkok timezone).
  - Countdown timer to the next closing draw ("งวดที่ใกล้ปิดรับแทงที่สุด").
  - Country flags, category tags (หวยเช้า, หวยบ่าย, หวยเย็น, หวยดึก, หวยรัฐบาล, หวยหุ้น, หวย VIP).
  - Complete 3 ตัวบน, 2 ตัวล่าง, and รางวัลที่ 1 badges with gold & emerald highlights.
  - Native Thai Text-To-Speech (TTS) audio announcements with spelled digits for natural pronunciation.
  - Watched lucky number indicators for instant alerts when a drawn number matches user preferences.

- **History & Frequency Statistics (ผลย้อนหลัง / สถิติ)**:
  - Timeline of over 4,000 recorded past lottery draws with search and filter capabilities.
  - Frequency analysis: Top 15 most drawn 2-digit pairs and top 15 3-digit numbers with visual progress indicators and draw percentages.

- **Daily Summary Table & Social Card Generator (ตารางผลและภาพแชร์)**:
  - Matrix view of all 51 lotteries grouped by period (รอบเช้า, รอบบ่าย, รอบเย็น, รอบดึก, รวมทั้งวัน).
  - High-resolution Social Card image generator (Canvas rendering on Android Bitmap) with gold header banner, country flags, and badges.
  - Instant sharing via Android Share Intent (`Intent.ACTION_SEND` with `FileProvider`) and one-tap formatted text summary copy.

- **Smart Ticket Checker (ตรวจสลากรางวัล)**:
  - Single and batch ticket verification against official and VIP/Stock results.
  - Win celebration effects and prize breakdown (รางวัลที่ 1, เลขท้าย 2 ตัว, 3 ตัวบน, เลขหน้า/เลขท้าย 3 ตัว).

- **Settings & Notification Center (ตั้งค่า & แจ้งเตือน)**:
  - Watched numbers management (add and remove lucky numbers).
  - Thai TTS voice preferences (toggle, speech rate, polite endings).
  - ntfy Push notification configuration (server, topic, priority).
  - Real-time data sources health monitor (GLO, ThaiLottoAPI, RANLOTTO, LotteryChecks).
  - System diagnostics and audit history.

## Tech Stack & Architecture

- **Language:** Kotlin
- **UI Framework:** Jetpack Compose (Material 3)
- **Architecture:** MVVM (Model-View-ViewModel) + Repository Pattern
- **State Management:** Kotlin Coroutines & StateFlow
- **Serialization:** kotlinx.serialization
- **Audio:** Android TextToSpeech (`android.speech.tts.TextToSpeech`)
- **Image & Sharing:** Android Graphics Canvas + FileProvider
- **Theme:** Luxury Dark Slate (`#020617`, `#0F172A`) with Gold & Amber accents (`#F59E0B`, `#EAB308`, `#10B981`)
