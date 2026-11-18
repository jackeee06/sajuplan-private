import { chromium } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';

const html = pathToFileURL('C:/claudeworkspace/sajumoon/e2e/_seo_card_mockup.html').href;
const outPath = 'C:/claudeworkspace/sajumoon/e2e/_seo_card_compare.png';
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 980, height: 720 });
await page.goto(html, { waitUntil: 'networkidle' });
// 이미지 로드 대기
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log('OK -> ' + outPath);
