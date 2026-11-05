# คู่มือระบบ Bombim00 Lottery Alert

## โครงสร้างปัจจุบัน

1. **React + Vite** สร้างหน้าเว็บจากข้อมูล JSON ที่อยู่ใน repository
2. **GitHub Actions** ทำหน้าที่ตรวจผลหวยตามตารางเวลา ทุก 5 นาที (เวลาเริ่มจริงอาจคลาดเคลื่อนตามคิวของ GitHub)
3. **สาขา `runtime-live`** เก็บไฟล์ข้อมูลที่เปลี่ยนระหว่างการทำงาน ได้แก่ การตั้งค่า แคตตาล็อก ผลหวยย้อนหลัง และสถานะระบบ
4. **ntfy** ใช้ส่ง Push Notification เมื่อพบผลใหม่ที่ผ่านเงื่อนไขแจ้งเตือน

ตัวตรวจผลทำงานบน GitHub Actions เท่านั้น ไม่มี Python runner หรือ Express API แยกในเว็บแอปปัจจุบัน

> หมายเหตุ: หน้าเว็บ React ใช้ JSON ที่รวมอยู่ใน build ปัจจุบัน การเปลี่ยนข้อมูลใน `runtime-live` จะอัปเดตผลการตรวจและการแจ้งเตือน แต่หน้าเว็บที่ deploy ไปแล้วจะยังไม่ดึงข้อมูล runtime สดโดยอัตโนมัติ จนกว่าจะมีการเพิ่มการอ่านข้อมูลสดจากสาขานี้

## ตั้งค่า GitHub Actions

ไปที่ Repository > Settings > Secrets and variables > Actions แล้วกำหนด:

- `NTFY_TOPIC`: Topic ที่อุปกรณ์ของคุณสมัครรับอยู่ (แนะนำให้เก็บเป็น Actions Secret)

จากนั้นไปที่ Settings > Actions > General > Workflow permissions และเปิด **Read and write permissions** เพื่อให้ Workflow บันทึกเฉพาะ `status/status.json` และ `lottery_previous_results.json` กลับไปยังสาขา `runtime-live` ได้

สาขา `runtime-live` ต้องมีไฟล์ข้อมูลเหล่านี้:
- `config/settings.json`
- `data/all_lotteries.json`
- `lottery_previous_results.json`
- `status/status.json`

อย่านำ source code หรือไฟล์ workflow จาก `runtime-live` มารัน ตัวตรวจผลต้องใช้โค้ดที่ผ่านการ review จาก `main` เท่านั้น

## ตั้งค่าแหล่งแจ้งเตือน

- เปิดใช้งาน `channels.ntfy.enabled` ใน `config/settings.json`
- ตั้งค่า `channels.ntfy.server` และ Topic ให้ตรงกับแอป ntfy
- หากตั้งค่า `NTFY_TOPIC` เป็น Actions Secret ค่านั้นจะถูกใช้ก่อนค่าในไฟล์ตั้งค่า
- Workflow นี้ไม่มีขั้นตอนส่งข้อความทดสอบอัตโนมัติ การทดสอบส่งจริงต้องได้รับอนุญาตแยกต่างหาก

## การตรวจสอบและ CI

- ตรวจผลและประวัติ Workflow: https://github.com/jirapatza/Bombim00/actions/workflows/lottery.yml
- Runtime Smoke Tests จะตรวจ TypeScript, สร้างเว็บด้วย Vite, compile Python และรัน regression tests
- เมื่อไม่พบผลสด ระบบจะบันทึกสถานะ degraded แทนการแสดงว่าตรวจพบผลใหม่
- ประวัติผลหวยจะถูก merge กับข้อมูลเดิมโดยไม่จำกัดจำนวน 500 รายการ และ Workflow จะเขียนกลับเฉพาะไฟล์ผลกับสถานะที่กำหนดไว้

## การ deploy หน้าเว็บ

หน้าเว็บเป็น React/Vite frontend:
- ติดตั้ง dependencies: `npm ci`
- ตรวจ TypeScript: `npm run lint`
- สร้างไฟล์เว็บ: `npm run build`
- โฟลเดอร์ผลลัพธ์: `dist/`

ไม่ต้องตั้งค่า `DASH_PASSWORD`, `GITHUB_TOKEN` หรือ `APP_URL` ให้กับ frontend build ปัจจุบัน เพราะไม่มี Express API อยู่ใน source tree ปัจจุบัน.
