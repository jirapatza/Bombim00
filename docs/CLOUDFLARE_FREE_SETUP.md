<!-- coderabbit-ai-generated:v1 -->

# Cloudflare Workers Free: ตรวจผลหวยทุกนาที

สถานะ: เตรียมโค้ดสำหรับติดตั้ง ยังไม่เปิดใช้จริงโดยอัตโนมัติ ค่าเริ่มต้น `ENABLED=false`, `MODE=observe` ไม่มีการสร้างบริการหรือเปลี่ยนแผนจากการ build/test

## พิมพ์เขียว

```mermaid
flowchart TD
  A[Cron ทุก 1 นาที] --> B[ล็อก D1 ด้วย lease และ token]
  B --> C{โหมดทดลองหรือส่งจริง}
  C -->|ทดลอง| D[อ่าน runtime-live และแหล่งผลสาธารณะ]
  D --> E[บันทึกจำนวนผลและข้อผิดพลาด ไม่ส่ง ntfy]
  C -->|ส่งจริง| F[ตรวจ LOTTERY_CHECKER_MODE=cloudflare และ Actions เดิมจบแล้ว]
  F --> G[อ่านข้อมูล JSON จาก Git commit ที่ตรึงไว้]
  G --> H[ดึงผลหลายแหล่งและตรวจชื่อหวย วันที่ รางวัล วันออกรางวัล]
  H --> I[ตรวจประวัติเดิมและบันทึกเจตนาส่งใน D1]
  I --> J[ส่ง ntfy แล้วบันทึกผลส่ง]
  J --> K[บันทึกผลรอบนี้และสถานะรอ publish ใน D1]
  K --> L[เขียนเฉพาะ results/status สองไฟล์ไป runtime-live]
  L --> M[เว็บเดิมอ่านผลทุก 15 วินาทีและใช้เสียงเดิม]
```

- ตารางวันใช้ `data/draw_weekdays.json` เดิม รวมจันทร์–ศุกร์ วันศุกร์ และเสาร์–อาทิตย์ตามที่แต่ละรายการระบุ ไม่เดาวันหยุดตลาดหรือวันงวดพิเศษ
- ดึง ThaiLottoAPI, กลุ่มหุ้นจากผลหวย.com, ลาว EXTRA, 9 รอบจาก LotteryChecks และแหล่งรัฐบาลเดิม ต้องมีรางวัลบน/ล่างชัดเจน ไม่แต่งผล ไม่อนุมานเลขล่างจากเลขบน
- รางวัลรัฐบาลไทยต้องมีเลขรางวัลที่หนึ่งครบ 6 หลักและวันที่จริง จึงยืนยันงวดที่เลื่อนได้
- ประวัติชื่อหวย/วันที่/รางวัลเทียบกับ Python เดิมด้วย `tests/test_cloudflare_contract.py` และไม่ล้างประวัติการส่ง
- เปลี่ยนตัวเลือกผู้เขียนจากเดิม `continuous` (Python บนเครื่องถาวร) เป็นค่าใหม่ `cloudflare` สำหรับ Worker นี้โดยเฉพาะ Actions จะหยุดเขียนในทั้งสองค่านี้ และ Python เดิมไม่ยอมเริ่มในค่า cloudflare
- D1 เก็บเฉพาะ ledger และผลที่เปลี่ยนในรอบ ไม่คัดลอกประวัติทั้งหมดลงแถวเดียว เมื่อ retry publish จะอ่านประวัติเดิมจาก immutable Git commit ช่วยหลีกเลี่ยงขนาดแถว D1 สูงสุด 2 MB
- ส่งได้สูงสุด 3 รายการต่อ invocation เพื่อเผื่อเพดาน subrequest ที่เหลืออยู่จะมีสถานะ queued และลองในรอบถัดไป ถ้าผลหลายรายการออกพร้อมกันอาจเพิ่มหลายรอบนาที ไม่รับประกันว่าจะถึงมือถือภายใน 60 วินาที

## แผนฟรีและเงื่อนไขก่อนเปิดจริง

ใช้บัญชี Workers Free และ D1 Free เท่านั้น ไม่มีโค้ดเปิด Workers Paid, R2, Queues, Containers หรือบริการเสียเงิน ต้องตรวจแผนในหน้า Billing ของบัญชีที่เลือกก่อนติดตั้ง หากบัญชีนั้นเป็น Paid อยู่แล้วให้หยุดและใช้บัญชี Free ตามที่เจ้าของเลือก

ข้อจำกัดอ้างอิงเอกสารวันที่ 7 พ.ย. 2026: Workers Free 100,000 requests/วันต่อบัญชี, CPU 10 ms/invocation และ 50 subrequests/invocation; Cron ทุกนาทีประมาณ 1,440 ครั้ง/วันก่อนรวม health/การเรียกอื่น D1 Free มี 5 ล้าน rows read/วัน, 100,000 rows written/วัน, 5 GB รวม และสูงสุด 50 binding queries/invocation โค้ดจำกัด external fetch ไม่เกิน 38 ครั้งต่อรอบปกติ บวก D1 ไม่เกินประมาณ 12 ครั้ง รวมทางเดินข้อผิดพลาดทั่วไป ไม่มี network retry อัตโนมัติใน invocation

**Build และการทดสอบในเครื่องไม่ยืนยัน CPU 10 ms บน Cloudflare** ต้องรันโหมด observe บนบัญชี Free และตรวจ CPU/subrequests/errors ใน Metrics หรือ `wrangler tail --format json` ทั้งรอบธรรมดาและรอบผลออกพร้อมกัน ก่อนเปลี่ยนเป็น deliver ถ้าเกินเพดานให้คง Actions และปรับแบ่งงานใน PR ถัดไป ห้ามแก้ด้วยการอัปเกรด Paid โดยไม่ได้รับอนุญาต การดึง HTML และประวัติที่โตขึ้นอาจทำให้เกิน CPU ในอนาคตได้

เมื่อชนโควตาฟรีอาจเกิด error/หยุดตรวจจนรีเซ็ต ไม่มีคำสั่งเปิดแผนเสียเงินจากระบบนี้ การใช้บริการอื่นหรือบัญชี Paid มีเงื่อนไขค่าบริการของตนเอง

อ้างอิง: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

## ติดตั้งหลังเจ้าของอนุมัติ PR นี้

ใช้ reviewed main ที่มีการแก้ครั้งนี้แล้ว ห้ามติดตั้งจาก runtime-live และห้ามนำ token ของ Coding Agent มาใช้เป็น runtime token

1. ใช้ Node 24/npm 11 แล้ว `cd cloudflare && npm ci` ตรวจว่าเป็นบัญชี Free: `npx --no-install wrangler login --device` และ `npx --no-install wrangler whoami` Device login ใช้ลิงก์กับรหัสชั่วคราว จึงอนุญาตจากมือถือได้โดยไม่ส่งรหัสผ่านในแชต
2. สร้าง D1 เพียงครั้งเดียว: `npx --no-install wrangler d1 create bombim00-lottery-state --location apac --update-config=false` ถ้ามีฐานเดิมให้ใช้ฐานเดิม ห้ามสร้างซ้ำหรือล้าง ledger
3. ใส่ UUID ที่ได้: `node configure.mjs <database_id> [account_id]` จะสร้าง `wrangler.local.json` ที่ไม่เข้า Git และยังหยุดทำงานอยู่
4. ใช้ `npx --no-install wrangler d1 migrations apply DB --remote --config wrangler.local.json` ห้ามรันไฟล์ migration ตรงเพื่อรีเซ็ตฐานที่มีข้อมูล
5. ติดตั้งตัวหยุดไว้ก่อน: `npx --no-install wrangler deploy --config wrangler.local.json`
6. เจ้าของสร้าง fine-grained GitHub PAT เฉพาะ `jirapatza/Bombim00`: Contents read/write, Actions read และ Variables read จากนั้นใส่ผ่าน `npx --no-install wrangler secret put LOTTERY_RUNTIME_TOKEN --config wrangler.local.json` ใช้ token ที่เจ้าของสร้างเท่านั้น ไม่ส่งลงแชต ไม่ commit และไม่คัดลอกจาก credential ของ Coding Agent
7. ใส่ปลายทางเดิมผ่าน `npx --no-install wrangler secret put NTFY_TOPIC --config wrangler.local.json` ไม่ใช้ชื่อ topic สุ่มอัตโนมัติและไม่ส่งข้อความทดสอบโดยไม่ได้สั่ง
8. ใน local config เปลี่ยน `ENABLED` เป็นสตริง `true` คง `MODE=observe` แล้ว deploy ด้วย config เดิม ตัวเดิมยังทำงานตามปกติ ตรวจ `/health` และ Metrics/CPU/ข้อผิดพลาดจริงตาม gate ข้างต้น ครอบคลุมแหล่งที่สำคัญและช่วงผลออกพร้อมกัน ตรวจ Settings ของ runtime-live ว่าแหล่งที่ต้องการเปิดใช้งานจริง
9. เมื่อโหมดทดลองผ่านแล้ว เจ้าของตั้ง GitHub repository variable `LOTTERY_CHECKER_MODE=cloudflare` และรอทุก Actions checker เดิมจบ ถ้ามี Python worker ให้หยุดจนจบรอบด้วย `gh variable set LOTTERY_CHECKER_MODE --body cloudflare --repo jirapatza/Bombim00` ต้องใช้บัญชีที่มีสิทธิ์ Variables write ห้ามข้ามเมื่อได้ 403
10. เปลี่ยน local config เป็น `MODE=deliver` แล้ว deploy ตรวจ `/health`, GitHub runtime-live status/results, การยอมรับส่งจาก ntfy และให้เจ้าของยืนยันว่าโทรศัพท์ได้รับจริง การที่ ntfy HTTP200 ไม่พิสูจน์ว่าโทรศัพท์ได้รับหรือพูดเสียงไทยแล้ว

Cron ของ Cloudflare อาจใช้เวลาถึง 15 นาทีในการกระจายตารางครั้งแรก ผลในเว็บยังอาจช้าจากการเผยแพร่ raw GitHub/cache และเวลาอัปเดตของแหล่งต้นทาง

## การตรวจสุขภาพและซ่อม

`GET /health` เป็น read-only ไม่เปิด endpoint สำหรับสั่งส่งหรือ reset สาธารณะ และไม่แสดง token/topic/ประวัติผลเต็ม คืน 503 เมื่อหยุด สถานะเก่า ค้าง publish หรือมีผลส่งไม่แน่นอน

- GitHub publish ล้มเหลว: รอบถัดไปใช้ผลเดิมใน D1 ลอง publish ก่อน ไม่ส่ง ntfy ซ้ำ และไม่ทับประวัติที่มีคนอื่นแก้
- ntfy ปฏิเสธแน่นอน เช่น 429: รอรอบถัดไปแล้วลองส่งรายการเดิมอีกครั้ง แม้ผู้ให้ข้อมูลไม่คืนรายการนั้นแล้ว
- timeout, 5xx หรือระบบหยุดระหว่างส่ง: เก็บ `uncertain` ไว้ ไม่เดาว่าส่งสำเร็จ ไม่ส่งรายการนั้นซ้ำอัตโนมัติ รายการอื่นตรวจต่อได้ ต่างจาก Python worker เดิมที่หยุดทั้ง process เมื่อมี inflight; หลักการป้องกันการส่งซ้ำยังคงอยู่
- ตรวจรายการที่ต้องพิสูจน์: `node recovery.mjs status` ใช้ local config และบัญชี Cloudflare ที่ได้รับอนุญาต
- ก่อนแก้สถานะให้ตั้ง `ENABLED=false` และ deploy รอ invocation/lease เดิมหมด ตรวจ ntfy history แล้วใช้ `node recovery.mjs resolve <id> sent "หลักฐาน ID ข้อความที่ ntfy รับแล้ว"` หรือ `failed` เฉพาะเมื่อมีหลักฐานว่าถูกปฏิเสธจริง คำสั่งไม่ส่ง ntfy และไม่ทำงานขณะมี lease หรือค้าง publish ห้ามลบฐานเพื่อให้ส่งใหม่ ห้ามใช้ sent เพื่อกลบ error
- ถ้ามี pending ให้เปิด deliver จน publish จบก่อนหยุด ถ้าเกิด runtime_conflict ต้องตรวจประวัติทั้งสองฝั่งก่อนแก้ ห้าม force-update runtime-live

## ย้อนกลับ

ตั้ง `ENABLED=false` และ deploy รอรอบที่เริ่มแล้วจบ ตรวจว่าไม่มี pending และพิสูจน์ uncertain ทุกตัวก่อน จากนั้นค่อยเปลี่ยน `LOTTERY_CHECKER_MODE` เป็น `actions` และเปิด/dispatch checker เดิมตามปกติ เก็บ D1 ไว้เป็นหลักฐาน ห้ามเปิด Python/Actions/Cloudflare ส่งพร้อมกัน การสลับกลับอาจกลับมาช้าตาม scheduler ของ GitHub

## ทดสอบในเครื่อง

จาก root: `npm run lint && npm test && npm run build`, `python -m pytest tests/ -q`

จาก cloudflare: `npm ci`, `npm test`, `npm audit --audit-level=high`, `npm run build`, `npm run db:local`, `npm run dev -- --port 8787`

ในอีก terminal: `curl -i http://localhost:8787/health` ต้องคืน paused/503 ตามค่าเริ่มต้น แล้ว `curl 'http://localhost:8787/__scheduled?cron=*+*+*+*+*'` ต้องไม่เปลี่ยน ledger หรือส่งจริง Local workerd/D1 แยกจากฐาน production
