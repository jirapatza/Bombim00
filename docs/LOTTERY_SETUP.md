<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:f6311527b3353215707341df3c44317d49722838e057e657fbe6ac5595f663ed -->

# คู่มือการติดตั้ง Bombim00

## โครงสร้างปัจจุบัน

1. Render ใช้ Dockerfile build React ด้วย Vite แล้วให้บริการไฟล์ static ด้วย nginx
2. GitHub Actions ใน `.github/workflows/lottery.yml` ตรวจผลและส่ง ntfy ตามกำหนดทุกห้านาที การรันอาจล่าช้าได้
3. โค้ดที่ตรวจแล้วอยู่บน main ส่วน runtime JSON อยู่บน runtime-live ห้ามนำโค้ดจาก runtime-live มารันหรือ merge กลับ main
4. หน้าเว็บอ่าน catalog, results และ status จาก runtime-live ผ่าน public GitHub raw URL ทุกหนึ่งนาทีเมื่อหน้าเว็บเปิดอยู่

## ตั้งค่าและเปิดเว็บในเครื่อง

ใช้ Node.js 22 ตาม CI และ npm ตาม package-lock.json:

```sh
npm ci
npm run dev
```

เปิด http://localhost:3000 สำหรับทดสอบ frontend การเปิดหน้าเว็บไม่ได้เริ่มตัวตรวจผลหรือส่ง ntfy

## ตั้งค่า GitHub Actions

กำหนด Actions secret `NTFY_TOPIC` ให้ตรงกับ topic ที่โทรศัพท์สมัครรับ และให้ workflow มี Contents Read/Write สำหรับบันทึกผลลง runtime-live

ค่าแหล่งข้อมูลและช่องแจ้งเตือนใช้ `config/settings.json` จาก runtime-live; ต้องตรวจ server และสถานะเปิดช่องก่อนรัน อย่าเผยแพร่ token/password ในไฟล์หรือ log

การตั้งค่า ntfy และเลขเฝ้าดูในหน้าเว็บเก็บเฉพาะเบราว์เซอร์ ไม่ได้เปลี่ยนค่าของ Actions

## Render และการตรวจสุขภาพ

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