# คู่มือการติดตั้งและใช้งานระบบ Lottery Alert (ระบบแจ้งเตือนผลหวย)

ระบบนี้แยกการทำงานออกเป็น 3 ส่วนหลัก:
1. **GitHub Actions Workflow + Python Checker**: ทำหน้าที่ตรวจผลหวยตามเวลาที่กำหนด และแจ้งเตือนผ่าน ntfy
2. **Cloudflare Worker API**: ทำหน้าที่เป็นตัวกลาง (Proxy) ปลอดภัย ถือ GitHub Token สำหรับหน้าเว็บควบคุม
3. **Web Dashboard**: หน้าเว็บควบคุมตั้งค่า อ่านสถานะ ตรวจสอบผลย้อนหลัง และสั่งการทำงาน

---

## 1. การเตรียม Secret ใน GitHub Repository

เข้าไปที่ **GitHub Repo > Settings > Secrets and variables > Actions > New repository secret**:

1. **`NTFY_TOPIC`** (สำคัญมาก)
   - ระบุชื่อ Topic ของ ntfy ที่คุณต้องการรับแจ้งเตือน (ควรตั้งชื่อที่ยาวและคาดเดายาก เช่น `th-lottery-alert-x9k2p8`)
   - **ข้อควรระวัง**: อย่าใส่ชื่อ topic ในโค้ดหรือไฟล์เอกสารสาธารณะ เพราะใครๆ ก็สามารถ Subscribe หรือส่งข้อความเข้า topic ได้

2. **เปิดสิทธิ์ Contents: Read and write ให้กับ GitHub Actions**
   - ไปที่ **Settings > Actions > General > Workflow permissions**
   - เลือก **Read and write permissions**
   - ติ๊กถูก **Allow GitHub Actions to create and approve pull requests**
   - กด Save

---

## 2. การ Deploy Cloudflare Worker (`api/worker.js`)

1. สร้าง Worker ใหม่ใน Cloudflare Dashboard หรือผ่าน Wrangler CLI:
   ```bash
   cd api
   npx wrangler deploy worker.js --name lottery-alert-proxy
   ```

2. ตั้งค่า Secrets ใน Cloudflare Worker:
   - **`GITHUB_TOKEN`**: Personal Access Token (PAT) จาก GitHub (สิทธิ์: `repo` หรือ Fine-grained: Contents R/W, Actions R/W)
   - **`DASH_PASSWORD`**: รหัสผ่านยาวๆ สำหรับปลดล็อกหน้า Dashboard เมื่อต้องการบันทึกค่า

3. ตั้งค่า Variables (Environment Variables):
   - **`REPO`**: `owner/repo-name` (เช่น `myuser/lottery-alert`)
   - **`BRANCH`**: `main`
   - **`WORKFLOW`**: `lottery.yml`
   - **`ALLOW_ORIGIN`**: `*` หรือโดเมนที่โฮสต์หน้าเว็บ Dashboard

---

4. **ตั้งค่า Cloud Run Server Secret ด้วย**
   - ไปที่ Cloud Run > เลือกบริการ Dashboard > Edit & Deploy New Revision > Variables & Secrets
   - เพิ่ม Secret/Environment Variable ชื่อ `DASH_PASSWORD` โดยใช้รหัสผ่านเดียวกับ Cloudflare Worker
   - ห้ามใส่รหัสผ่านในไฟล์โค้ดหรือ GitHub Repository
   - Server จะปฏิเสธคำขอ POST/PUT/PATCH/DELETE หากไม่มีรหัสผ่านที่ถูกต้อง และจะปิดการเขียนทั้งหมดเมื่อเป็น Production แต่ยังไม่ได้ตั้ง Secret
   - หน้าเว็บจะส่งรหัสผ่านที่บันทึกไว้จากการเชื่อมต่อ Dashboard ไปยัง API โดยอัตโนมัติ

## 3. การใช้งานหน้าเว็บ Dashboard

หน้าเว็บ Dashboard สามารถเปิดใช้งานได้ 2 รูปแบบ:
1. **โหมดอ่านอย่างเดียว (Read-only)**:
   - กรอก GitHub Raw Base URL เพื่อดู `status/status.json` และผลหวยย้อนหลัง
2. **โหมดควบคุมเต็มรูปแบบ (Full Control)**:
   - กรอก **Worker API URL** (เช่น `https://lottery-alert-proxy.yourname.workers.dev`)
   - กรอก **Dashboard Password** (`DASH_PASSWORD`)
   - สามารถ:
     - แก้ไขเปิด/ปิด แหล่งข้อมูล (`pholhuay`, `glo`, `sanook`)
     - แก้ไขตัวกรองรางวัลที่ต้องการแจ้งเตือน
     - สั่งตรวจสอบผลเดี๋ยวนี้ (Trigger Workflow Dispatch)
     - ทดสอบส่ง Notification ไปยัง ntfy
