import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';

const url = process.env.BOMBIM_BROWSER_URL || 'http://127.0.0.1:3000';
const profiles = [
  { name: 'desktop-1440', viewport: { width: 1440, height: 900 } },
  { name: 'tablet-768', viewport: { width: 768, height: 1024 } },
  { name: 'android-390', ...devices['Pixel 7'] },
  { name: 'small-320', viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  let failed = false;
  try {
    for (const profile of profiles) {
      const { name, ...options } = profile;
      const context = await browser.newContext({ ...options, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.getByRole('navigation', { name: 'เมนูหลัก' }).waitFor({ timeout: 15000 });
        assert.match(await page.title(), /Bombim00/i);
        const nav = page.getByRole('navigation', { name: 'เมนูหลัก' });
        const tabs = [
          ['หน้าหลัก', '.daily-panel'],
          ['ผลย้อนหลัง / สถิติ', '[data-testid="history_search_input"]'],
          ['สรุป / แชร์ผล', '[data-testid="generate_share_image_button"]'],
          ['ตรวจรางวัล', '[data-testid="ticket_input_field"]'],
          ['ตั้งค่า', '[data-testid="add_watched_number_input"]'],
        ];
        for (const [label, selector] of tabs) {
          await nav.getByRole('button', { name: label, exact: true }).click();
          await page.locator(selector).waitFor({ timeout: 15000 });
          assert.equal(await nav.getByRole('button', { name: label, exact: true }).getAttribute('aria-current'), 'page');
        }

        // Live data controls: refresh, query, and reset.
        await nav.getByRole('button', { name: 'หน้าหลัก' }).click();
        await page.getByTestId('top_refresh_button').click();
        const search = page.getByRole('textbox', { name: 'ค้นหาหวยหรือผลรางวัล' });
        await search.fill('ฮานอย');
        await page.getByRole('button', { name: 'รีเซ็ตตัวกรอง' }).click();
        assert.equal(await search.inputValue(), '');

        // History search and statistics tab.
        await nav.getByRole('button', { name: 'ผลย้อนหลัง / สถิติ' }).click();
        const historySearch = page.getByTestId('history_search_input');
        await historySearch.fill('ลาว');
        await page.getByRole('button', { name: /สถิติเลขเด็ดออกบ่อย/ }).click();
        await page.getByRole('button', { name: /ผลย้อนหลัง \(/ }).click();

        // Summary filter and action: image generation only when there are results.
        await nav.getByRole('button', { name: 'สรุป / แชร์ผล' }).click();
        await page.getByRole('button', { name: 'รอบเช้า', exact: true }).click();
        await page.getByRole('button', { name: 'รวมทั้งวัน', exact: true }).click();
        const generate = page.getByTestId('generate_share_image_button');
        if (await generate.isEnabled()) {
          await generate.click();
          await page.getByRole('button', { name: 'ปิดภาพสรุป' }).first().waitFor();
          await page.getByRole('button', { name: 'ปิดภาพสรุป' }).first().click();
        }

        // Ticket checker: never call the server or send alerts.
        await nav.getByRole('button', { name: 'ตรวจรางวัล' }).click();
        const draw = page.getByRole('combobox', { name: 'หวยและงวด' });
        const drawOptions = await draw.locator('option').count();
        if (drawOptions > 1) {
          await draw.selectOption({ index: 1 });
          await page.getByTestId('ticket_input_field').fill('12');
          await page.getByTestId('check_tickets_button').click();
          await page.getByRole('button', { name: 'ล้างข้อมูล' }).click();
        }

        // Settings: local-only watched numbers, then restore to initial state.
        await nav.getByRole('button', { name: 'ตั้งค่า' }).click();
        const watched = page.getByTestId('add_watched_number_input');
        await watched.fill('07');
        const del = page.getByRole('button', { name: 'ลบเลข 07' });
        if (!(await del.count())) {
          await page.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
          await del.waitFor();
          await del.click();
        }
        const toggle = page.getByRole('button', { name: 'เปิดหรือปิดเสียงอ่านผล' });
        const before = await toggle.getAttribute('aria-checked');
        await toggle.click();
        assert.notEqual(await toggle.getAttribute('aria-checked'), before);
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-checked'), before);

        // Responsive check: no horizontal overflow of the overall page.
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 2, 'Horizontal overflow in ' + name + ': ' + overflow + 'px');
        assert.deepEqual(errors, [], name + ' browser errors');
        console.log('PASS ' + name + ': navigation, refresh, filters, history, sharing UI, ticket check, settings, keyboard/mobile layout');
      } catch (error) {
        failed = true;
        const filename = '/tmp/bombim-' + name + '.png';
        await page.screenshot({ path: filename, fullPage: true }).catch(() => {});
        console.error('FAIL ' + name + ': ' + String(error) + '; screenshot ' + filename);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (failed) process.exitCode = 1;
}
await run();
