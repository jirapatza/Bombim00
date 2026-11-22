<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:372c6b829852b94e12763e74391b5eed6caedb1ae60bdb162c195721fa335fbe -->

<!-- coderabbit-ai-generated-section:v1:d95bbc111e12e04674924e4298ecfa47cb4a5e7ef6b3504f4846166fc04ab56b -->

<!-- coderabbit-ai-generated-section:v1:ce8ccd857978d3841b8c382f15040ae16072e809e3677be4253494b08e36c1e2 -->

<!-- coderabbit-ai-generated-section:v1:f6311527b3353215707341df3c44317d49722838e057e657fbe6ac5595f663ed -->

# คู่มือการติดตั้ง Bombim00

> **เลิกใช้แล้วเป็นตัวส่งหลัก** ตั้งแต่ `cloudflare/PRIMARY_CHECKER.json` บน main ตั้งเป็น `mode: cloudflare` และ `legacy_workflow: pr-only` ตัวตรวจและตัวส่งจริงคือ Cloudflare Worker ใน `cloudflare/` พร้อม `poll_seconds: 60` ไฟล์ตัวส่งรุ่นเดิม (`render.yaml`, `Dockerfile.worker`, `deploy/start_worker.py`, `lottery_worker.py`) ถูกลบออกแล้วเพราะไม่เคยถูก apply และการมีตัวส่งที่สองจะทำให้ส่งซ้ำ ส่วน `.github/workflows/lottery.yml` รันเฉพาะทดสอบใน PR ตาม [AGENTS.md](../AGENTS.md) ขั้นตอนย้อนกลับอยู่ใน [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) และหัวข้อ "ตัวตรวจ Python รุ่นเดิม" ด้านล่าง

## โครงสร้างปัจจุบัน

1. เว็บเป็น React + Vite ที่ build ผ่าน `npm run build` แล้วโฮสต์ไฟล์ static บน Cloudflare Pages
2. Cloudflare Worker ใน `cloudflare/` ตรวจผลทุก 60 วินาที เขียน runtime JSON ลง `runtime-live` และส่ง ntfy กับ Web Push จาก D1 ledger
3. โค้ดที่ตรวจแล้วอยู่บน main ส่วน runtime JSON อยู่บน runtime-live ห้ามนำโค้ดจาก runtime-live มารันหรือ merge กลับ main
4. หน้าเว็บอ่าน catalog, results และ status จาก runtime-live ผ่าน public GitHub raw URL ทุก 15 วินาที รวมถึงตอนที่แท็บถูกซ่อนอยู่ (เบราว์เซอร์จะชะลอให้เหลือประมาณหนึ่งครั้งต่อนาที) เพื่อให้เสียงอ่านผลยังทำงานได้

## ตั้งค่าและเปิดเว็บในเครื่อง

ใช้ Node.js 22 ตาม CI และ npm ตาม package-lock.json:

```sh
npm ci
npm run dev
```

เปิด http://localhost:3000 สำหรับทดสอบ frontend การเปิดหน้าเว็บไม่ได้เริ่มตัวตรวจผลหรือส่ง ntfy

## ตั้งค่า Cloudflare Worker (ตัวส่งหลักจริง)

ตั้งแต่ `cloudflare/PRIMARY_CHECKER.json` เป็น `mode: cloudflare` แล้ว `.github/workflows/lottery.yml` รันเฉพาะการทดสอบใน PR ไม่ตรวจผลตามกำหนดเวลาและไม่ส่ง ntfy จึงไม่ต้องตั้ง Actions secret สำหรับการส่งจริง

ตัวส่งจริงคือ Cloudflare Worker ให้ตั้งปลายทางไว้ที่ Worker ด้วยคำสั่ง `npx --no-install wrangler secret put NTFY_TOPIC` ตามขั้นตอนที่ 7 ของ [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) และ GitHub token ที่ Worker ต้องใช้คือสิทธิ์ Contents Read/Write พร้อม Actions Read

GitHub Actions ปัจจุบันเป็นงาน CI/ทดสอบ PR ไม่ใช่ตัวตรวจหรือส่งผลตามกำหนดเวลา; โดยเฉพาะ `.github/workflows/lottery.yml` มีเพียง Python regression tests และไม่มี `schedule` หรือ `workflow_dispatch`

> **หมายเหตุ:** หากจำเป็นต้องย้อนกลับไปใช้ระบบเดิม (Render/Python worker) ให้ทำตามขั้นตอนการย้อนกลับใน [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) ซึ่งรวมถึงการหยุด Cloudflare Worker ให้ปลอดภัยก่อน (`ENABLED=false` แล้ว deploy รอ invocation จบ ตรวจ D1 ไม่มี pending/uncertain)

## Render และการตรวจสุขภาพ (ทางเลือกสำรอง / Legacy)

ใช้ Dockerfile ของ repository ตัว nginx รับ `PORT` (ค่าเริ่มต้น 10000) ไม่ต้องใส่ DASH_PASSWORD หรือ GITHUB_TOKEN ให้ static frontend และไม่มี Express API หรือ `/api/health` ในเวอร์ชันนี้

- ตรวจหน้าเว็บด้วยการโหลด `/` และยืนยันว่า UI/JavaScript ทำงาน ไม่ใช้แค่ HTTP 200 ของ path อื่น เพราะ SPA fallback อาจคืน index.html
- ตรวจเวลา `status/status.json` บน runtime-live และสถานะ workflow ประกอบกัน หน้าเว็บอัปเดตได้ไม่ได้ยืนยันว่ามีผลงวดใหม่
- ผลย้อนหลังเก็บเพื่อดูประวัติเท่านั้น จะไม่ส่งเป็นแจ้งเตือนใหม่แม้ force_notify
- ntfy HTTP สำเร็จแปลว่า server รับข้อความ ยังไม่พิสูจน์ว่า Android รับหรืออ่านเสียงแล้ว

## การทดสอบก่อนเสนอ PR

```sh
npm run lint
npm test
npm run build
python -m pip install -r requirements.txt
python -m pytest -q tests
```

ชุดทดสอบใช้ข้อมูลจำลองสำหรับการส่งแจ้งเตือน ห้ามส่งแจ้งเตือนจริงหรือ deploy โดยไม่มีการอนุมัติ ผู้ดูแล core logic ต้องตรวจ PR ก่อน merge


<!-- /coderabbit-ai-generated:v1 -->

## วันออกและความเร็ว (การเปลี่ยนแปลงรอบนี้)

หน้า live และ summary ใช้วันปัจจุบัน Asia/Bangkok กรอง catalog ก่อนแสดงผล หวยจันทร์–ศุกร์ไม่แสดงเสาร์–อาทิตย์ ส่วนหวยรายวันยังแสดงทุกวัน รายการดาวโจนส์ปกติใช้วันอังคาร–เสาร์ตามวันประกาศหลังเที่ยงคืนในไทย ไม่ย้ายผลวันศุกร์ไปปนวันเสาร์

กติกาวันที่ยอมรับอยู่ใน `data/draw_weekdays.json` ซึ่งเป็นโค้ดที่ต้อง review; รายการแต่ละหวยใช้ `drawDays` ใน catalog บน runtime-live รองรับรายวัน จันทร์–ศุกร์ อังคาร–เสาร์ จันทร์/พุธ/ศุกร์ เสาร์–อาทิตย์ และวันศุกร์โดยเฉพาะ ไม่สร้างหวยเสาร์–อาทิตย์ขึ้นเองเมื่อไม่มีรายการจากเจ้าของตาราง หวยวันงวดไม่แน่นอนจะปรากฏเมื่อมีผลครบพร้อมวันที่จริงเท่านั้น ไม่เดาวันที่ 1/16

ก่อนส่ง ntfy ตรวจวันที่และวันออกด้วยกติกาเดียวกัน หวยที่ไม่รู้จักหรือไม่ตรงวันจะไม่ถูกส่ง หน้าเว็บอ่านข้อมูลใหม่ทุก 15 วินาทีเมื่อเปิดอยู่ และเปลี่ยนรายการเมื่อข้ามเที่ยงคืนแม้โหลดข้อมูลไม่สำเร็จ ผลครบที่ต้นทางประกาศก่อนเวลาโดยประมาณใน catalog จะแสดงได้ทันที

ตารางวันใน catalog ยังไม่ใช่ปฏิทินวันหยุดตลาดเฉพาะประเทศ หากมีวันหยุดพิเศษ ต้องปรับ catalog ตามประกาศจริง ไม่ถือว่ามีผลเพียงเพราะถึงเวลาที่ระบุ

## ตัวตรวจ Python รุ่นเดิม (ลบตัวส่ง Render ออกแล้ว)

> **สถานะ:** ตัวตรวจและตัวส่งจริงคือ Cloudflare Worker ใน `cloudflare/` ตาม `cloudflare/PRIMARY_CHECKER.json` (`mode: cloudflare`, `legacy_workflow: pr-only`) ไฟล์ `render.yaml`, `Dockerfile.worker`, `deploy/start_worker.py` และ `lottery_worker.py` ถูก**ลบออกจาก repository** เพราะ Blueprint ไม่เคยถูก apply จึงไม่เคยมีหลักฐานว่าทำงานได้จริง และการเปิดตัวส่งที่สองพร้อม Cloudflare จะทำให้ส่งซ้ำ

สิ่งที่ยังอยู่ใน repository คือ `lottery_checker.py`, `settings_loader.py` และ `draw_schedule.py` พร้อมชุดทดสอบใน `tests/` ซึ่งรันเฉพาะใน PR ตาม `.github/workflows/lottery.yml` เพื่อเป็นตาข่ายกันความผิดพลาดของกติกาวัน งวด และการจับคู่ชื่อหวย ไม่มี cron และไม่เขียน runtime-live

**กติกาเดิมยังใช้บังคับ:** ต้องมีตัวส่งจริงเพียงตัวเดียว ห้ามเปิด Actions/Python/Cloudflare ส่งพร้อมกัน ตัวเขียน runtime-live คือ Cloudflare Worker เท่านั้น

**การย้อนกลับ:** ทำตามหัวข้อ "ย้อนกลับ" ใน [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) — ตั้ง `ENABLED=false` แล้ว deploy, รอรอบที่เริ่มแล้วจบ, กระทบยอด D1 ให้ไม่มี `queued`/pending/uncertain ค้าง จากนั้นจึงเปิด Actions checker กลับด้วย PR ที่เจ้าของอนุมัติ (คืน `schedule`/`workflow_dispatch` ใน `lottery.yml`) ระบบ Render/Python worker รุ่นเก่าเอากลับได้ด้วย `git revert` ของ commit ที่ลบ แต่ต้องผ่านการ review และตรวจค่าใช้จ่ายก่อนทุกครั้ง

**ผลกระทบที่ต้องยอมรับหากย้อนกลับไป Actions:** Actions cron ไม่แม่น (เคยห่าง 43–64 นาทีเมื่อ 2026-11-07) และไม่ส่ง Web Push

## ทางเลือก Cloudflare Free ตรวจทุกนาที

**สถานะปัจจุบัน:** Cloudflare Worker JavaScript ใน `cloudflare/` เป็นตัวตรวจและส่งจริงทุก 60 วินาทีแล้ว ตาม `cloudflare/PRIMARY_CHECKER.json` (`mode: cloudflare`, `legacy_workflow: pr-only`) โดยใช้ D1 เก็บประวัติการส่งและสถานะรอ publish ส่วนขั้นตอนเปิดใช้โหมดทดลองใน [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) เป็นประวัติการย้ายระบบ ไม่ใช่งานที่ต้องทำซ้ำ การเปลี่ยนกลับไปใช้ Python worker หรือ Actions ต้องทำตามหัวข้อย้อนกลับในคู่มือดังกล่าวและตรวจว่ามีตัวส่งจริงเพียงตัวเดียว ห้ามเปิดส่งพร้อมกัน


<!-- /coderabbit-ai-generated:v1 -->