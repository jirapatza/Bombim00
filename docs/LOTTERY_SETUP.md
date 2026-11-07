<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ce8ccd857978d3841b8c382f15040ae16072e809e3677be4253494b08e36c1e2 -->

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

## วันออกและความเร็ว (การเปลี่ยนแปลงรอบนี้)

หน้า live และ summary ใช้วันปัจจุบัน Asia/Bangkok กรอง catalog ก่อนแสดงผล หวยจันทร์–ศุกร์ไม่แสดงเสาร์–อาทิตย์ ส่วนหวยรายวันยังแสดงทุกวัน รายการดาวโจนส์ปกติใช้วันอังคาร–เสาร์ตามวันประกาศหลังเที่ยงคืนในไทย ไม่ย้ายผลวันศุกร์ไปปนวันเสาร์

กติกาวันที่ยอมรับอยู่ใน `data/draw_weekdays.json` ซึ่งเป็นโค้ดที่ต้อง review; รายการแต่ละหวยใช้ `drawDays` ใน catalog บน runtime-live รองรับรายวัน จันทร์–ศุกร์ อังคาร–เสาร์ จันทร์/พุธ/ศุกร์ เสาร์–อาทิตย์ และวันศุกร์โดยเฉพาะ ไม่สร้างหวยเสาร์–อาทิตย์ขึ้นเองเมื่อไม่มีรายการจากเจ้าของตาราง หวยวันงวดไม่แน่นอนจะปรากฏเมื่อมีผลครบพร้อมวันที่จริงเท่านั้น ไม่เดาวันที่ 1/16

ก่อนส่ง ntfy ตรวจวันที่และวันออกด้วยกติกาเดียวกัน หวยที่ไม่รู้จักหรือไม่ตรงวันจะไม่ถูกส่ง หน้าเว็บอ่านข้อมูลใหม่ทุก 15 วินาทีเมื่อเปิดอยู่ และเปลี่ยนรายการเมื่อข้ามเที่ยงคืนแม้โหลดข้อมูลไม่สำเร็จ ผลครบที่ต้นทางประกาศก่อนเวลาโดยประมาณใน catalog จะแสดงได้ทันที

ตารางวันใน catalog ยังไม่ใช่ปฏิทินวันหยุดตลาดเฉพาะประเทศ หากมีวันหยุดพิเศษ ต้องปรับ catalog ตามประกาศจริง ไม่ถือว่ามีผลเพียงเพราะถึงเวลาที่ระบุ

## ทางเลือกตัวตรวจต่อเนื่อง (ยังไม่เปิดใช้โดยอัตโนมัติ)

Actions cron ยังคงเป็นค่าเริ่มต้น การตรวจพบเมื่อ 2026-11-07 พบ schedule runs ห่างกันประมาณ 43–64 นาที แม้ตั้ง cron ทุก 5 นาที ดังนั้นเปลี่ยน cron อย่างเดียวไม่รับประกันความเร็ว

`lottery_worker.py` และ `Dockerfile.worker` เตรียมทางเลือกใช้ process ที่เปิดตลอดเวลา รอบใหม่เริ่มทุก 15 วินาทีเมื่อรอบก่อนเสร็จ หากต้นทางช้ารอบอาจนานกว่า 15 วินาที Sources หลักดึงขนานกัน ไม่ต้องบวกรอ timeout ทีละแหล่ง Government fallbacks ยังคงเลือกตามลำดับเดิม แต่รอ network ขนานกัน

การเปิดใช้ต้องได้รับอนุมัติ deployment และใช้บริการที่ไม่พักเครื่องพร้อม persistent disk มี worker เพียงหนึ่ง instance ทั้งระบบ (file lock ป้องกันได้เฉพาะ instance ที่ใช้ disk เดียวกัน):

1. Deploy PR ที่ review แล้วก่อน โดยยังไม่เริ่ม worker
2. กำหนด repository Actions variable `LOTTERY_CHECKER_MODE=continuous` เพื่อหยุดตัวเขียนของ Actions และรอทุกงานเดิมจบ Worker ตรวจ variable และตรวจ active runs ก่อนทำงาน รอบ PR ยังคงทดสอบได้
3. สร้าง background worker จาก `Dockerfile.worker` ด้วย reviewed release นี้ ห้ามใช้โค้ดจาก runtime-live
4. Mount persistent disk ที่ `/var/data/lottery` และสร้างไฟล์ `.persistent-volume-confirmed` ใน disk นั้นเพื่อยืนยันการจัดเก็บถาวร
5. ตั้ง `GITHUB_REPOSITORY=jirapatza/Bombim00`, `LOTTERY_WORKER_STATE_DIR=/var/data/lottery`, secret `LOTTERY_RUNTIME_TOKEN` และ `NTFY_TOPIC` ของบริการนี้ โดย token ต้องมี Contents Read/Write, Variables Read และ Actions Read ห้ามใส่ token ใน build args, frontend หรือ log
6. Start `python lottery_worker.py` (Dockerfile มีคำสั่งนี้แล้ว) สามารถกำหนด `LOTTERY_POLL_SECONDS` ได้ แต่ไม่ต่ำกว่า 15 วินาที ห้ามตั้ง FORCE_NOTIFY=true
7. ตรวจ heartbeat ใน runtime-live/status/status.json และตรวจผลจริงงวดที่ตรงตารางหลังเปิดใช้ การรับข้อความบนโทรศัพท์ต้องตรวจแยกจาก ntfy server acceptance

Worker อ่านเฉพาะ JSON 4 ไฟล์จาก commit ที่ระบุ ไม่ execute source ของ runtime branch และเขียนเฉพาะ results/status เป็น commit เดียวบน runtime-live ไม่ force push หากส่งแล้ว publish ไม่สำเร็จจะ retry ข้อมูลที่บันทึกไว้ก่อน ไม่ส่ง ntfy ซ้ำ หากมีประวัติจากตัวเขียนอื่นเปลี่ยนไปจะหยุด publish และให้ตรวจ conflict

หาก process หยุดระหว่างส่งแล้วพบ `inflight.json` จะไม่ส่งต่ออัตโนมัติ ผู้ดูแลต้องตรวจ local history กับ ntfy และกระทบยอด runtime history ก่อนล้าง marker นี้ เพื่อไม่เดาว่าข้อความที่ค้างส่งสำเร็จหรือยัง ห้ามลบทั้ง state directory เพื่อบังคับให้เริ่มใหม่

ก่อนกลับไปใช้ Actions ต้องหยุด worker ให้จบและ publish pending ให้เสร็จ แล้วจึงเปลี่ยน LOTTERY_CHECKER_MODE ออกจาก continuous ห้ามเปิดสองตัวพร้อมกัน

เป้าหมาย 15 วินาทีเป็นช่วง polling ไม่ใช่ SLA เวลาถึงโทรศัพท์ ยังขึ้นกับเวลาที่ provider เปิดเผยข้อมูล/แคช, network และ ntfy/Android โดย LotteryChecks fallback มี cache ที่เอกสารระบุ 300 วินาที จึงไม่กล่าวอ้างว่าแจ้งทันทีทุกแหล่ง ข้อมูลหน้าเว็บยังผ่าน GitHub raw/CDN และอาจมี cache แม้เปลี่ยน URL query ทุก polling bucket

สถานะ ณ การพัฒนา: ทดสอบด้วย mocks และ Preview แล้ว ยังไม่ได้สลับ Actions variable, เพิ่มบริการภายนอก, ส่งข้อความจริง หรือ deploy จึงยังไม่ถือว่าการแจ้งผลแบบ realtime ใน production เปิดใช้งานแล้ว


<!-- /coderabbit-ai-generated:v1 -->