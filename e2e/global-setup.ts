import { chromium, FullConfig } from '@playwright/test'

/**
 * 모든 mng 테스트가 공유하는 admin 로그인 상태 — login throttle (분당 20회) 회피.
 *
 * 한 번만 로그인 → storageState.json 저장 → 모든 테스트가 사용.
 */
async function globalSetup(config: FullConfig) {
  const target = process.env.TARGET ?? 'test'
  const baseURL = target === 'prod' ? 'https://sajumoon.co.kr' : 'https://sajumoon.kr'

  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${baseURL}/mng/login`)
  await page.getByPlaceholder('admin').fill('admin')
  await page.getByPlaceholder('비밀번호를 입력하세요').fill('test1234!')
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL((url) => !url.toString().includes('/mng/login'), {
    timeout: 15_000,
  })
  await ctx.storageState({ path: 'storageState.json' })
  await browser.close()
  console.log(`[e2e global-setup] admin 로그인 완료 → storageState.json (TARGET=${target})`)
}

export default globalSetup
