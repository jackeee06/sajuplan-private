const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const tpl = 'file:///' + path.resolve(
    'C:/claudeworkspace/sajumoon/manse/packages/web/public/img/_og_template.html'
  ).replace(/\\/g, '/');
  const out = 'C:/claudeworkspace/sajumoon/manse/packages/web/public/img/og3.png';

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });
  await page.goto(tpl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800); // 웹폰트 로드 여유
  await page.screenshot({ path: out });
  await browser.close();
  console.log('saved', out);
})();
