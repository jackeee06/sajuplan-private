const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto('file://' + __dirname.replace(/\\/g, '/') + '/date_map.html');
  await page.waitForTimeout(1500); // 폰트 로드 대기
  const el = await page.$('#cap');
  await el.screenshot({ path: __dirname.replace(/\\/g, '/') + '/date_course.png' });
  await browser.close();
  console.log('done');
})();
