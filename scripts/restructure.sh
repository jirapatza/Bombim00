#!/usr/bin/env bash
# scripts/restructure.sh
# จัดโครงสร้างหลังแยกโปรเจกต์ Lottery Alert ตามแผนงาน

set -e

echo "=== เริ่มต้นจัดระเบียบโครงสร้าง Repository Lottery Alert ==="

# สร้างไดเรกทอรีที่จำเป็น
mkdir -p config status tests docs scripts api archive/android archive/web-template .github/workflows

# ย้ายแอป Android ถ้ามี
if [ -d "android" ]; then
  echo "-> ย้ายโฟลเดอร์ android/ ไปที่ archive/android/..."
  git mv android archive/ 2>/dev/null || mv android archive/
fi

# ย้ายไฟล์และเทมเพลตเก่าถ้ามี
for item in App.js android-app template; do
  if [ -e "$item" ]; then
    echo "-> ย้าย $item ไปที่ archive/..."
    git mv "$item" archive/ 2>/dev/null || mv "$item" archive/
  fi
done

# ตรวจสอบการมีอยู่ของไฟล์หลัก
echo "-> ตรวจสอบไฟล์สำคัญ:"
for f in lottery_checker.py settings_loader.py requirements.txt config/settings.json status/status.json lottery_previous_results.json api/worker.js .github/workflows/lottery.yml; do
  if [ -f "$f" ]; then
    echo "  [OK] $f"
  else
    echo "  [MISSING] $f"
  fi
done

echo ""
echo "=== จัดระเบียบโครงสร้างเรียบร้อยแล้ว! ==="
echo "ขั้นตอนถัดไป:"
echo "1. ตรวจสอบ git status และ commit โครงสร้างใหม่"
echo "2. ตั้งค่า Secret: NTFY_TOPIC ใน GitHub Settings > Secrets and variables > Actions"
echo "3. หากใช้ Worker ให้ deploy api/worker.js ไปที่ Cloudflare Workers"
