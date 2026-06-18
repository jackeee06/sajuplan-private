const { chromium } = require('playwright');
const dir = 'c:/claudeworkspace/sajumoon/_tmp_date_map';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto('file://' + dir + '/date_map.html');
  await page.waitForTimeout(1800); // 폰트 로드 대기
  const el = await page.$('#cap');
  await el.screenshot({ path: dir + '/date_course.png' });
  await browser.close();
  console.log('done');
})();
