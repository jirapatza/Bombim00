# Lottery Alert — React Web Application

A modern, high-performance React application built with TypeScript, Vite, and Tailwind CSS for tracking Thai government, foreign stock, and VIP lottery results in real time. Rewritten from Android Jetpack Compose to React while preserving all core features and business logic.

## Overview & Core Features

- **Live Lottery Results & Upcoming Draws (หน้าหลัก)**:
  - Real-time Bangkok clock ticker (Asia/Bangkok timezone).
  - Countdown timer to the next closing draw ("งวดที่ใกล้ปิดรับแทงที่สุด").
  - Country flags, category tags (หวยเช้า, หวยบ่าย, หวยเย็น, หวยดึก, หวยรัฐบาล, หวยหุ้น, หวย VIP).
  - Complete 3 ตัวบน, 2 ตัวล่าง, and รางวัลที่ 1 badges with gold & emerald highlights.
  - Thai Text-To-Speech (TTS) audio announcements using Web Speech API with spelled digits for natural pronunciation.
  - Watched lucky number indicators for instant alerts when a drawn number matches user preferences.

- **History & Frequency Statistics (ผลย้อนหลัง / สถิติ)**:
  - Timeline of over 4,000 recorded past lottery draws with search and filter capabilities.
  - Frequency analysis: Top 15 most drawn 2-digit pairs and top 15 3-digit numbers with visual progress indicators and draw percentages.

- **Daily Summary Table & Social Card Generator (ตารางผลและภาพแชร์)**:
  - Matrix view of all lotteries grouped by period (รอบเช้า, รอบบ่าย, รอบเย็น, รอบดึก, รวมทั้งวัน).
  - High-resolution Social Card image generator (HTML5 Canvas 1080px rendering) with gold header banner, country flags, and badges.
  - Instant sharing via Web Share API (`navigator.share`), PNG download, and one-tap formatted text summary copy.

- **Smart Ticket Checker (ตรวจสลากรางวัล)**:
  - Single and batch ticket verification against official and VIP/Stock results.
  - Win celebration effects with confetti and prize breakdown (รางวัลที่ 1, เลขท้าย 2 ตัว, 3 ตัวบน, เลขหน้า/เลขท้าย 3 ตัว).

- **Settings & Notification Center (ตั้งค่า & แจ้งเตือน)**:
  - Watched numbers management (add and remove lucky numbers with persistence).
  - Thai TTS voice preferences (toggle, speech rate, sample voice announcement).
  - ntfy Push notification configuration (server, topic, priority).
  - Real-time data sources health monitor (GLO, ThaiLottoAPI, RANLOTTO, LotteryChecks).
  - System diagnostics and audit history.

## Tech Stack & Architecture

- **Language:** TypeScript
- **UI Framework:** React 19 + Vite
- **Styling:** Tailwind CSS (Dark slate `#020617`, `#0F172A` with Gold & Amber accents `#F59E0B`, `#EAB308`, `#10B981`)
- **Icons:** Lucide React
- **Audio:** Web Speech API (`SpeechSynthesis`)
- **Graphics & Export:** HTML5 Canvas API + Web Share API
