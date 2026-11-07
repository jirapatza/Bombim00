<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:372c6b829852b94e12763e74391b5eed6caedb1ae60bdb162c195721fa335fbe -->

<!-- coderabbit-ai-generated-section:v1:d95bbc111e12e04674924e4298ecfa47cb4a5e7ef6b3504f4846166fc04ab56b -->

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

## เปิด worker บน Render ด้วย Blueprint

ไฟล์ `render.yaml` เตรียม service `bombim00-lottery-worker` แยกจากเว็บเดิม ใช้ Dockerfile.worker, main branch, persistent disk 1 GB และหนึ่ง instance ไม่แก้ configuration ของเว็บเดิม และปิด automatic deployment ของ worker ไว้เพื่อให้ตรวจแต่ละ release ก่อนใช้งาน Blueprint นี้ยังไม่ถูก apply และไม่ได้สร้างบริการที่มีค่าใช้จ่าย

ตรวจและอนุมัติค่าใช้จ่าย compute/disk ที่ Render แสดงก่อนสร้าง service เพราะ worker พร้อม disk เป็นบริการแบบชำระเงินตาม [คู่มือ persistent disks](https://render.com/docs/disks) ไม่เก็บค่าใช้จ่ายตายตัวในเอกสารนี้

ลำดับเปิดใช้ที่แนะนำ:

1. ให้เจ้าของตรวจและอนุมัติ PR #50 ก่อน merge เนื่องจากมีการเปลี่ยน core logic/workflow ตาม AGENTS.md
2. หลัง merge ใช้ Render Dashboard > New Blueprint เลือก repository นี้และไฟล์ render.yaml ตรวจว่าแผนสร้างเฉพาะ worker แยกหนึ่งตัว พร้อม disk ที่ `/var/data/lottery` หากมี service ชื่อซ้ำให้ตรวจ configuration ก่อน apply
3. ตั้ง LOTTERY_RUNTIME_TOKEN และ NTFY_TOPIC ในช่อง secret ของ Render ที่ Blueprint ถาม ห้ามส่งค่าลับในแชตหรือ commit token ใช้สิทธิ์ Contents Read/Write, Variables Read, Actions Read เฉพาะ repository นี้
4. ปล่อยให้ service เตรียมพร้อมก่อน การเริ่ม worker จะตรวจ LOTTERY_CHECKER_MODE ที่ GitHub และปฏิเสธการส่งถ้า Actions ยังเป็นตัวเขียนอยู่ การที่เริ่มไม่สำเร็จตรงนี้ไม่ใช่เหตุให้ลบการตรวจ single writer
5. เมื่อ service/disk/secrets พร้อมแล้ว ให้บัญชีที่มีสิทธิ์ตั้ง Actions variable LOTTERY_CHECKER_MODE=continuous และรอ checker เดิมจบทุกงาน จากนั้น restart/deploy worker เพื่อเริ่มรอบตรวจ ห้ามเปิดหลายตัวพร้อมกัน
6. Render ใช้ `python /app/deploy/start_worker.py` ซึ่งตรวจ mount point จริงก่อนสร้าง marker `.persistent-volume-confirmed` แล้วเริ่ม worker ถ้าไม่ได้ mount disk จะหยุดก่อนใช้ storage ชั่วคราว จึงไม่ต้องเปิด shell เพื่อสร้าง marker เองเมื่อใช้ Blueprint นี้ การรัน worker โดยตรงตามคู่มือเดิมยังต้องยืนยัน disk เอง
7. เปิดดู worker logs และ runtime-live/status/status.json ยืนยัน timestamp อัปเดตต่อเนื่อง จากนั้นรอผลงวดที่ตรงตารางและตรวจว่า ntfy/โทรศัพท์รับผล พร้อมเทียบเวลาต้นทาง–ตรวจพบ–server รับข้อความ การเห็นเว็บโหลดได้หรือ CI ผ่านไม่แทนขั้นตรวจผลจริงนี้

การเปิด Blueprint อาจทำให้เกิดค่าใช้จ่ายทันทีตามหน้าสรุปของ Render ต้องตรวจหน้าแผนก่อนยืนยัน [Blueprint specification](https://render.com/docs/blueprint-spec) เป็นแหล่งอ้างอิง field ที่ใช้ ส่วน [Background workers](https://render.com/docs/background-workers) อธิบายประเภท service

สถานะตรวจครั้งล่าสุด: PR preview ที่ https://bombim-pr-50.onrender.com เปิดได้และกรองรายการวันเสาร์ถูกต้อง GitHub integration ของ task อ่าน/แก้ variables และ secrets ไม่ได้ (HTTP 403) และ cloud browser ยังไม่ได้ login Render จึงยังไม่ได้ apply Blueprint หรือสลับตัวส่งจริง อย่าปิด checker เดิมก่อนบริการใหม่และสิทธิ์พร้อม


<!-- /coderabbit-ai-generated:v1 -->

## ทางเลือก Cloudflare Free ตรวจทุกนาที

มี Worker JavaScript แยกใน `cloudflare/` พร้อม D1 เก็บประวัติการส่งและสถานะรอ publish ค่าเริ่มต้นหยุดทำงานและเป็นโหมดทดลอง อ่านขั้นตอนติดตั้ง พิมพ์เขียว ข้อจำกัด CPU ของแผนฟรี การเปิดใช้โดยไม่ส่งซ้ำ และการย้อนกลับที่ [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) ต้องให้เจ้าของอนุมัติ PR ที่เกี่ยวข้องและผ่านโหมดทดลองบนบัญชี Free ก่อนสลับ `LOTTERY_CHECKER_MODE=cloudflare` ห้ามเปิดพร้อมกับ Python worker/Actions


<!-- /coderabbit-ai-generated:v1 -->