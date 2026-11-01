# คู่มือการติดตั้ง Bombim00

## โครงสร้างปัจจุบัน

1. **Render Web Service** ให้บริการหน้าเว็บ React และ Express API
2. **GitHub Actions** เป็นตัวตรวจผลหวยเพียงระบบเดียว ทำงานตาม Schedule ใน `.github/workflows/lottery.yml`
3. **GitHub repository JSON** เป็นแหล่งเก็บถาวรของการตั้งค่า แคตตาล็อก ผลหวย สถานะล่าสุด และประวัติการตรวจระบบ
4. **ntfy** ใช้แจ้งเตือนมือถือ และ **LINE Messaging API** ใช้แจ้งเตือน LINE OA/กลุ่ม

ไม่มี Cloudflare Worker, Firebase หรือ Python runner ซ้ำใน Render อีกต่อไป

## ตั้งค่า GitHub Actions

เปิด Repository > Settings > Secrets and variables > Actions แล้วกำหนด:

- `NTFY_TOPIC`: Topic ที่แอป ntfy สมัครรับอยู่
- `LINE_CHANNEL_ACCESS_TOKEN`: Channel access token จาก LINE Developers (ถ้าเปิดใช้ LINE)
- `LINE_TARGET_ID`: User ID หรือ Group ID ปลายทาง (ถ้าเปิดใช้ LINE)

ใน Settings > Actions > General > Workflow permissions ให้เปิด **Read and write permissions** เพื่อให้ workflow บันทึกไฟล์สถานะและผลหวยได้

## ตั้งค่า Render

ใน Render > Bombim00 > Environment ให้ตั้งค่า:

- `DASH_PASSWORD`: รหัสผ่านสำหรับ API ที่เปลี่ยนแปลงข้อมูล
- `GITHUB_TOKEN`: GitHub token ที่มี Contents Read/Write และ Actions Read/Write สำหรับ repository นี้
- `APP_URL`: `https://bombim00.onrender.com`
- `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_TARGET_ID`: ใช้เฉพาะเมื่อต้องการทดสอบส่ง LINE จากหน้าเว็บ

ห้ามส่ง Token หรือ Password ลงในแชตหรือ commit ลง repository

## ตรวจสอบระบบ

- เปิดหน้าเว็บ: https://bombim00.onrender.com
- ตรวจสอบ Workflow: https://github.com/jirapatza/Bombim00/actions/workflows/lottery.yml
- ตรวจสอบ API health: `/api/health`
- การกดสั่งตรวจผลหมายถึงส่งคำสั่งให้ GitHub Actions เท่านั้น ไม่ใช่การยืนยันว่าตรวจเสร็จแล้ว
- LINE Notify ยุติบริการแล้ว ระบบใช้ LINE Messaging API แทน
