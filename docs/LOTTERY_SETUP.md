<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:372c6b829852b94e12763e74391b5eed6caedb1ae60bdb162c195721fa335fbe -->

<!-- coderabbit-ai-generated-section:v1:d95bbc111e12e04674924e4298ecfa47cb4a5e7ef6b3504f4846166fc04ab56b -->

<!-- coderabbit-ai-generated-section:v1:ce8ccd857978d3841b8c382f15040ae16072e809e3677be4253494b08e36c1e2 -->

<!-- coderabbit-ai-generated-section:v1:f6311527b3353215707341df3c44317d49722838e057e657fbe6ac5595f663ed -->

# คู่มือการติดตั้ง Bombim00

> **เลิกใช้แล้วเป็นตัวส่งหลัก** ตั้งแต่ `cloudflare/PRIMARY_CHECKER.json` บน main ตั้งเป็น `mode: cloudflare` และ `legacy_workflow: pr-only` ตัวตรวจและตัวส่งจริงคือ Cloudflare Worker ใน `cloudflare/` พร้อม `poll_seconds: 60` ส่วน Render, `render.yaml`, `Dockerfile.worker`, `deploy/start_worker.py` และ `lottery_worker.py` เหลือเป็นทางสำรอง ส่วน `.github/workflows/lottery.yml` รันเฉพาะทดสอบใน PR ตาม [AGENTS.md](../AGENTS.md). ขั้นตอนสลับกลับไปใช้ระบบเดิมอยู่ใน [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md)

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

## ทางเลือกตัวตรวจต่อเนื่อง (ทางเลือกสำรอง / Legacy — ไม่ได้ใช้งานจริง)

> **คำเตือน:** นี่คือระบบสำรอง (fallback) ตัวส่งหลักจริงคือ Cloudflare Worker หากต้องการสลับมาใช้ Python worker ต้องหยุด Cloudflare Worker ให้ปลอดภัยก่อน ตามขั้นตอนใน [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) ห้ามเปิดตัวส่งทั้งสองพร้อมกัน

ในระบบเก่า Actions cron เคยเป็นค่าเริ่มต้น และเมื่อ 2026-11-07 เคยพบ schedule runs ห่างกันประมาณ 43–64 นาทีแม้ตั้ง cron ทุก 5 นาที แต่ปัจจุบัน `.github/workflows/lottery.yml` รันเฉพาะการทดสอบใน PR ไม่มี cron สำหรับส่งผล จึงไม่สามารถกลับไปใช้ Actions ได้ด้วยการเปลี่ยนตัวแปรเพียงอย่างเดียว

`lottery_worker.py` และ `Dockerfile.worker` เตรียมทางเลือกใช้ process ที่เปิดตลอดเวลา รอบใหม่เริ่มทุก 15 วินาทีเมื่อรอบก่อนเสร็จ หากต้นทางช้ารอบอาจนานกว่า 15 วินาที Sources หลักดึงขนานกัน ไม่ต้องบวกรอ timeout ทีละแหล่ง Government fallbacks ยังคงเลือกตามลำดับเดิม แต่รอ network ขนานกัน

การเปิดใช้ต้องได้รับอนุมัติ deployment และใช้บริการที่ไม่พักเครื่องพร้อม persistent disk มี worker เพียงหนึ่ง instance ทั้งระบบ (file lock ป้องกันได้เฉพาะ instance ที่ใช้ disk เดียวกัน):

1. Deploy PR ที่ review แล้วก่อน โดยยังไม่เริ่ม worker
**ก่อนขั้นที่ 2:** ถ้า Cloudflare Worker ยังส่งอยู่ ให้ตั้ง `ENABLED=false` แล้ว deploy รอ invocation ล่าสุดจบก่อน ตรวจ D1 ว่าไม่มี pending publish และไม่เหลือ uncertain ค้าง ตามหัวข้อการย้อนกลับใน [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) เพราะ Python worker ไม่อ่าน ledger ของ Worker จึงตัดผลแพ้ถูกไม่ได้เหมือนกัน

2. กำหนด repository Actions variable `LOTTERY_CHECKER_MODE=continuous` เพื่อหยุดตัวเขียนของ Actions และรอทุกงานเดิมจบ Worker ตรวจ variable และตรวจ active runs ก่อนทำงาน รอบ PR ยังคงทดสอบได้
3. สร้าง background worker จาก `Dockerfile.worker` ด้วย reviewed release นี้ ห้ามใช้โค้ดจาก runtime-live
4. Mount persistent disk ที่ `/var/data/lottery` และสร้างไฟล์ `.persistent-volume-confirmed` ใน disk นั้นเพื่อยืนยันการจัดเก็บถาวร
5. ตั้ง `GITHUB_REPOSITORY=jirapatza/Bombim00`, `LOTTERY_WORKER_STATE_DIR=/var/data/lottery`, secret `LOTTERY_RUNTIME_TOKEN` และ `NTFY_TOPIC` ของบริการนี้ โดย token ต้องมี Contents Read/Write, Variables Read และ Actions Read ห้ามใส่ token ใน build args, frontend หรือ log
6. Start `python lottery_worker.py` (Dockerfile มีคำสั่งนี้แล้ว) สามารถกำหนด `LOTTERY_POLL_SECONDS` ได้ แต่ไม่ต่ำกว่า 15 วินาที ห้ามตั้ง FORCE_NOTIFY=true
7. ตรวจ heartbeat ใน runtime-live/status/status.json และตรวจผลจริงงวดที่ตรงตารางหลังเปิดใช้ การรับข้อความบนโทรศัพท์ต้องตรวจแยกจาก ntfy server acceptance

Worker อ่านเฉพาะ JSON 4 ไฟล์จาก commit ที่ระบุ ไม่ execute source ของ runtime branch และเขียนเฉพาะ results/status เป็น commit เดียวบน runtime-live ไม่ force push หากส่งแล้ว publish ไม่สำเร็จจะ retry ข้อมูลที่บันทึกไว้ก่อน ไม่ส่ง ntfy ซ้ำ หากมีประวัติจากตัวเขียนอื่นเปลี่ยนไปจะหยุด publish และให้ตรวจ conflict

หาก process หยุดระหว่างส่งแล้วพบ `inflight.json` จะไม่ส่งต่ออัตโนมัติ ผู้ดูแลต้องตรวจ local history กับ ntfy และกระทบยอด runtime history ก่อนล้าง marker นี้ เพื่อไม่เดาว่าข้อความที่ค้างส่งสำเร็จหรือยัง ห้ามลบทั้ง state directory เพื่อบังคับให้เริ่มใหม่

**การกลับไปใช้ Actions:** ต้องเตรียม PR เพื่อคืน workflow ที่ตรวจผลและส่งจริงพร้อม `schedule`/`workflow_dispatch` ให้ผ่านการ review และได้รับอนุมัติก่อน ไม่ใช่แค่เปลี่ยน `LOTTERY_CHECKER_MODE` เพราะ workflow ปัจจุบันเป็น PR-only ก่อนเปิดตัวส่ง Actions ที่คืนมา ต้องหยุด Python worker ให้จบ รอ publish pending/การส่งที่ยังไม่แน่ชัดให้ตรวจสอบเสร็จ และยืนยันว่า Cloudflare Worker หยุดส่งอย่างปลอดภัยตาม [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) จากนั้นตั้ง `LOTTERY_CHECKER_MODE` ให้สอดคล้องกับ workflow ที่คืนมาและตรวจว่ามีตัวส่งเพียงตัวเดียว ห้ามเปิด Python/Actions/Cloudflare ส่งพร้อมกัน

เป้าหมาย 15 วินาทีเป็นช่วง polling ไม่ใช่ SLA เวลาถึงโทรศัพท์ ยังขึ้นกับเวลาที่ provider เปิดเผยข้อมูล/แคช, network และ ntfy/Android โดย LotteryChecks fallback มี cache ที่เอกสารระบุ 300 วินาที จึงไม่กล่าวอ้างว่าแจ้งทันทีทุกแหล่ง ข้อมูลหน้าเว็บยังผ่าน GitHub raw/CDN และอาจมี cache แม้เปลี่ยน URL query ทุก polling bucket

หมายเหตุสถานะ: ผลทดสอบด้วย mocks/Preview ที่กล่าวถึงในหัวข้อนี้เป็นประวัติการพัฒนา **ทางเลือก Python/Render รุ่นเดิม** ไม่ใช่สถานะของตัวส่งหลักปัจจุบัน ซึ่งได้ย้ายไปใช้ Cloudflare Worker ตามต้นเอกสารแล้ว


<!-- /coderabbit-ai-generated:v1 -->

## เปิด worker บน Render ด้วย Blueprint (ทางเลือกสำรอง / Legacy)

> **คำเตือน:** นี่คือระบบสำรอง (fallback) ตัวส่งหลักจริงคือ Cloudflare Worker หากต้องการสลับมาใช้ Render worker ต้องหยุด Cloudflare Worker ให้ปลอดภัยก่อน ตามขั้นตอนใน [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) ห้ามเปิดตัวส่งทั้งสองพร้อมกัน **Render/Python worker รุ่นนี้ส่งเฉพาะ ntfy ไม่ส่ง Web Push** ผู้ใช้ Web Push จะไม่ได้รับการแจ้งเตือนระหว่าง fallback เจ้าของต้องยอมรับผลกระทบนี้ก่อนอนุมัติการสลับ

ไฟล์ `render.yaml` เตรียม service `bombim00-lottery-worker` แยกจากเว็บเดิม ใช้ Dockerfile.worker, main branch, persistent disk 1 GB และหนึ่ง instance ไม่แก้ configuration ของเว็บเดิม และปิด automatic deployment ของ worker ไว้เพื่อให้ตรวจแต่ละ release ก่อนใช้งาน Blueprint นี้ยังไม่ถูก apply และไม่ได้สร้างบริการที่มีค่าใช้จ่าย

ตรวจและอนุมัติค่าใช้จ่าย compute/disk ที่ Render แสดงก่อนสร้าง service เพราะ worker พร้อม disk เป็นบริการแบบชำระเงินตาม [คู่มือ persistent disks](https://render.com/docs/disks) ไม่เก็บค่าใช้จ่ายตายตัวในเอกสารนี้

ลำดับเปิดใช้ที่แนะนำ (เฉพาะเมื่อได้รับอนุมัติให้สลับจาก Cloudflare ไป Render/Python):

1. ให้เจ้าของตรวจและอนุมัติ PR สำหรับการสลับระบบ ค่าใช้จ่าย Render และการหยุด Web Push ชั่วคราวตาม [AGENTS.md](../AGENTS.md) **ก่อนสร้างหรือ apply Blueprint** ตรวจบริการเดิมว่าจะไม่ทำงานซ้ำ
2. **หยุด Cloudflare Worker ก่อนสร้างหรือเริ่ม Render worker:** ตั้ง `ENABLED=false` แล้ว deploy; รอ invocation/lease ที่กำลังรันจบ ตรวจและกระทบยอด D1 ทั้งรายการ `queued` (ต้องไม่มีรายการที่ยังไม่ได้ส่ง), pending publish และ uncertain ที่ยังไม่รู้ผล ตาม [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) ห้ามเดินหน้าจนกระทบยอดครบ การตรวจของ Python worker ดูเพียง `LOTTERY_CHECKER_MODE` ของ Actions ไม่ได้ตรวจว่า Cloudflare หยุดแล้ว จึงต้องยืนยันแยกต่างหาก
3. ตั้ง Actions variable `LOTTERY_CHECKER_MODE=continuous` และรอ checker ของ Actions ที่อาจค้างอยู่จบทุกงาน **ก่อน apply Blueprint** (ปัจจุบัน Actions เป็น PR-only; ตัวแปรนี้ใช้เป็น guard ของ Python worker รุ่นเดิม)
4. เมื่อยืนยันว่าตัวส่งหลักหยุดสนิท และ variable พร้อมแล้ว ใช้ Render Dashboard > New Blueprint เลือก repository นี้และไฟล์ `render.yaml` ตรวจว่ามี worker เพียงหนึ่ง instance พร้อม persistent disk ที่ `/var/data/lottery` ก่อน apply
5. ตั้ง `LOTTERY_RUNTIME_TOKEN` และ `NTFY_TOPIC` ใน secret ของ Render ห้ามส่ง token ในแชตหรือ commit; token ใช้สิทธิ์ Contents Read/Write, Variables Read และ Actions Read เฉพาะ repository นี้
6. Render ใช้ `python /app/deploy/start_worker.py` เพื่อตรวจ mount point จริงก่อนสร้าง `.persistent-volume-confirmed`; ถ้าไม่มี disk ให้หยุด ไม่ใช้ storage ชั่วคราว ห้ามเริ่ม worker ก่อนเงื่อนไขข้างต้นครบ
7. ตรวจ worker logs, heartbeat ที่ `runtime-live/status/status.json` และผลจริงตามตาราง จากนั้นยืนยันการรับ ntfy บนโทรศัพท์แยกจากผล HTTP acceptance; ยืนยันอีกครั้งว่าช่อง Web Push จะไม่ทำงานระหว่าง fallback

การเปิด Blueprint อาจทำให้เกิดค่าใช้จ่ายทันทีตามหน้าสรุปของ Render ต้องตรวจหน้าแผนก่อนยืนยัน [Blueprint specification](https://render.com/docs/blueprint-spec) เป็นแหล่งอ้างอิง field ที่ใช้ ส่วน [Background workers](https://render.com/docs/background-workers) อธิบายประเภท service

**บันทึกการทดสอบระบบ Render รุ่นเดิม (ไม่ใช่สถานะปัจจุบัน):** PR preview เดิมที่ https://bombim-pr-50.onrender.com เคยเปิดได้และทดสอบการกรองวันเสาร์ แต่ขณะทดสอบไม่ได้ apply Blueprint หรือสลับตัวส่งจริง ปัจจุบัน Cloudflare Worker เป็นตัวส่งหลักตามต้นเอกสาร ห้ามใช้ผลทดสอบเก่าเป็นหลักฐานว่าบริการ Render พร้อมใช้งาน หากจะสลับระบบต้องตรวจสิทธิ์ ความพร้อมบริการ และทำตามลำดับหยุด Cloudflare ก่อน


<!-- /coderabbit-ai-generated:v1 -->

## ทางเลือก Cloudflare Free ตรวจทุกนาที

**สถานะปัจจุบัน:** Cloudflare Worker JavaScript ใน `cloudflare/` เป็นตัวตรวจและส่งจริงทุก 60 วินาทีแล้ว ตาม `cloudflare/PRIMARY_CHECKER.json` (`mode: cloudflare`, `legacy_workflow: pr-only`) โดยใช้ D1 เก็บประวัติการส่งและสถานะรอ publish ส่วนขั้นตอนเปิดใช้โหมดทดลองใน [CLOUDFLARE_FREE_SETUP.md](CLOUDFLARE_FREE_SETUP.md) เป็นประวัติการย้ายระบบ ไม่ใช่งานที่ต้องทำซ้ำ การเปลี่ยนกลับไปใช้ Python worker หรือ Actions ต้องทำตามหัวข้อย้อนกลับในคู่มือดังกล่าวและตรวจว่ามีตัวส่งจริงเพียงตัวเดียว ห้ามเปิดส่งพร้อมกัน


<!-- /coderabbit-ai-generated:v1 -->