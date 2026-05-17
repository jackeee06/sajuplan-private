import { defineConfig, devices } from '@playwright/test'

/**
 * Sajumoon E2E 테스트 설정.
 *
 * 환경 선택:
 *   TARGET=test  → https://sajumoon.kr (test 서버, 기본값)
 *   TARGET=prod  → https://sajumoon.co.kr (운영 서버)
 *
 * 실행:
 *   npm test                      → test 서버
 *   TARGET=prod npm test          → 운영 서버 (안전한 read-only 시나리오만)
 *   npx playwright test --headed  → 브라우저 보이게 실행 (디버깅)
 */

const TARGET = process.env.TARGET ?? 'test'
const BASE_URLS: Record<string, string> = {
  test: 'https://sajumoon.kr',
  prod: 'https://sajumoon.co.kr',
}
const BASE_URL = BASE_URLS[TARGET] ?? BASE_URLS.test

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // 같은 admin 계정 로그인 충돌 방지
  workers: 1,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    storageState: 'storageState.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
