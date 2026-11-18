import { chromium } from '@playwright/test';

const URL = 'http://localhost:4188/';
const OUT = 'C:/claudeworkspace/sajumoon/tarot/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(600);
await p.screenshot({ path: OUT + 'shot1-lobby.png' });

await p.getByRole('button', { name: /쓰리카드/ }).click();
await p.waitForTimeout(250);
await p.screenshot({ path: OUT + 'shot2-selected.png' });

await p.getByRole('button', { name: /카드 섞기/ }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: OUT + 'shot3-shuffle.png' });

await p.getByRole('button', { name: /여기서 멈추기/ }).click();
await p.waitForTimeout(600);
await p.screenshot({ path: OUT + 'shot4-fan.png' });

for (const n of [12, 40, 68]) {
  await p.getByRole('button', { name: `카드 ${n}`, exact: true }).click({ force: true });
  await p.waitForTimeout(250);
}
await p.waitForTimeout(300);
await p.screenshot({ path: OUT + 'shot5-revealing.png' });

await p.getByRole('button', { name: /전부 펼치기/ }).click();
await p.waitForTimeout(900);
await p.screenshot({ path: OUT + 'shot6-done.png', fullPage: true });

await b.close();
console.log('shots done');
