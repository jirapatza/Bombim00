# คู่มือระบบ Bombim00 Lottery Alert

## โครงสร้างระบบ

1. **React + Vite** แสดงหน้าเว็บและเก็บข้อมูลผู้ใช้ที่ไม่ใช่ความลับ เช่น เลขที่เฝ้าดู
2. **GitHub Actions** ตรวจผลหวยตามตารางเวลา ทุก 5 นาที (เวลาเริ่มจริงอาจคลาดเคลื่อนตามคิวของ GitHub)
3. **สาขา `runtime-live`** เก็บข้อมูล runtime ได้แก่ การตั้งค่า แคตตาล็อก ผลหวยย้อนหลัง และสถานะระบบ
4. **Cloudflare Worker (Live Data API)** อ่านเฉพาะ JSON ที่อนุญาตจาก repository Private แล้วส่งข้อมูลที่จำเป็นให้ Dashboard
5. **ntfy** ส่ง Push Notification จาก GitHub Actions เมื่อพบผลใหม่ที่ผ่านเงื่อนไขแจ้งเตือน

ตัวตรวจผลใช้โค้ดที่ผ่านการ review จาก `main` เท่านั้น Workflow overlay เฉพาะ runtime JSON ที่กำหนด และเขียนกลับเฉพาะไฟล์ผลกับสถานะ ห้ามนำ source code หรือ workflow จาก `runtime-live` มารัน

## ตั้งค่า GitHub Actions

ไปที่ Repository > Settings > Secrets and variables > Actions แล้วกำหนด:

- `NTFY_TOPIC`: Topic ที่อุปกรณ์สมัครรับอยู่ (เก็บเป็น Actions Secret)

จากนั้นไปที่ Settings > Actions > General > Workflow permissions และเปิด **Read and write permissions** เพื่อให้ Workflow บันทึกเฉพาะ `status/status.json` และ `lottery_previous_results.json` กลับไปยัง `runtime-live` ได้

ไฟล์ runtime ที่ Workflow ใช้:
- `config/settings.json`
- `data/all_lotteries.json`
- `lottery_previous_results.json`
- `status/status.json`

## ตั้งค่า Live Data API อย่างปลอดภัย

ไฟล์ Worker อยู่ที่ `cloudflare/lottery-data-worker.js` โดยให้ deploy เป็น Cloudflare Worker แยก เช่น `bombim00-live-data-api` หลังตรวจสอบ PR และอนุมัติการ deploy แล้ว

ตั้งค่า Worker ดังนี้:

- Secret `GITHUB_TOKEN`: Fine-grained GitHub token จำกัดเฉพาะ repository `jirapatza/Bombim00` และให้สิทธิ์ **Contents: Read-only** เท่านั้น
- Variable `ALLOWED_ORIGIN`: Origin ของหน้าเว็บที่ deploy จริง เช่น `https://your-dashboard.example` (ไม่ต้องใส่ path)
- Endpoint ที่หน้าเว็บเรียก: `GET /api/live-data`

Worker อ่านได้เฉพาะ:
- `data/all_lotteries.json`
- `lottery_previous_results.json`
- `status/status.json`

Worker ไม่อ่านหรือส่ง `config/settings.json`, ไม่รับ path จากผู้ใช้, ไม่มี API เขียนไฟล์หรือสั่ง Workflow และไม่ส่ง ntfy Token ให้เบราว์เซอร์

ตั้งค่า Build Environment ของ Vite ในโฮสต์หน้าเว็บ:

- `VITE_LOTTERY_API_BASE_URL`: URL หลักของ Worker เช่น `https://bombim00-live-data-api.<account>.workers.dev`

**ห้าม** ตั้งชื่อ secret เป็น `VITE_GITHUB_TOKEN` หรือฝัง GitHub Token ในตัวแปร `VITE_*` เพราะ Vite จะบรรจุตัวแปรเหล่านั้นลงใน JavaScript ที่ทุกคนเปิดดูได้

หลังตั้งค่า Worker และ URL แล้วจึง build/deploy หน้าเว็บเพื่อให้ Dashboard โหลดข้อมูลสดเมื่อเปิดหน้า และรีเฟรชอัตโนมัติทุก 60 วินาที ระหว่างที่ยังไม่ตั้งค่า API หน้าเว็บจะแสดงข้อมูลสำรองที่มากับ Build และแจ้งสถานะว่าไม่ได้เชื่อมต่อข้อมูลสด

## ตั้งค่า ntfy

- เปิดใช้งาน `channels.ntfy.enabled` ใน runtime settings
- เก็บ Topic จริงไว้ใน GitHub Actions Secret `NTFY_TOPIC`
- หน้าเว็บไม่แสดงหรือเก็บ Topic/Token ใน LocalStorage
- Workflow ไม่มีขั้นตอนทดสอบที่ส่งข้อความจริง การทดสอบส่งจริงต้องได้รับอนุญาตแยกต่างหาก

## การตรวจสอบและ CI

- ตรวจผลและประวัติ Workflow: https://github.com/jirapatza/Bombim00/actions/workflows/lottery.yml
- Runtime Smoke Tests ตรวจ TypeScript, Worker regression tests, Vite build, Python compile และ Python regression tests
- เมื่อไม่พบผลสด ระบบบันทึกสถานะ degraded แทนการแสดงว่าตรวจพบผลใหม่
- ประวัติผลหวยเก็บย้อนหลังโดยไม่ตัดเหลือ 500 รายการ
- CodeQL ต้องเปิด Code Scanning ใน Repository Settings ก่อนจึงจะรันได้

## คำสั่งพัฒนาเว็บ

- ติดตั้ง dependencies: `npm ci`
- ตรวจ TypeScript: `npm run lint`
- ทดสอบ Worker: `npm test`
- สร้างเว็บ: `npm run build`
- โฟลเดอร์ผลลัพธ์: `dist/`

ไม่ต้องใส่ GitHub Token หรือ ntfy Topic ใน Frontend build
