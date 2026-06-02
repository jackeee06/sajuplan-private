import { chromium, FullConfig } from '@playwright/test'

/**
 * 세 종류의 로그인 세션을 미리 만들어 spec 별로 선택 사용:
 *  - storageState.json        : admin (mng 페이지용)
 *  - user_dual_storage.json   : e2e_dual (회원+상담사 듀얼 역할자, 모드 전환 자동화용)
 *  - user_member_storage.json : e2e_member (일반 회원, 회원 영역 자동화용)
 *
 * 한 번만 로그인 → 모든 테스트가 재사용 (login throttle 회피).
 */
async function globalSetup(_config: FullConfig) {
  const target = process.env.TARGET ?? 'test'
  const baseURL = target === 'prod' ? 'https://sajuplan.com' : 'https://sajumoon.kr'

  const browser = await chromium.launch()

  // 1) admin 로그인 (mng) — 비번은 E2E_ADMIN_PW 환경변수에서 읽음 (없으면 default 시도)
  //   사장님이 admin 비번을 바꾼 뒤로는 환경변수 설정 후 실행:
  //     $env:E2E_ADMIN_PW = "실제비번"; npx playwright test
  //   환경변수 미설정 또는 로그인 실패 시 admin spec 들은 자동 skip.
  const adminId = process.env.E2E_ADMIN_ID ?? 'admin'
  const adminPw = process.env.E2E_ADMIN_PW ?? 'test1234!'
  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  try {
    await adminPage.goto(`${baseURL}/mng/login`)
    await adminPage.getByPlaceholder('admin').fill(adminId)
    await adminPage.getByPlaceholder('비밀번호를 입력하세요').fill(adminPw)
    await adminPage.getByRole('button', { name: '로그인' }).click()
    await adminPage.waitForURL((url) => !url.toString().includes('/mng/login'), {
      timeout: 15_000,
    })
    await adminCtx.storageState({ path: 'storageState.json' })
    console.log(`[e2e global-setup] admin 로그인 완료 → storageState.json`)
  } catch (e) {
    console.warn(
      `[e2e global-setup] admin 로그인 실패 — 빈 storageState 저장 (admin spec 자동 skip):`,
      (e as Error).message.slice(0, 120),
    )
    console.warn(
      `[e2e global-setup] 비번이 바뀐 경우: E2E_ADMIN_PW 환경변수 설정 후 재실행`,
    )
    await adminCtx.storageState({ path: 'storageState.json' })
  } finally {
    await adminCtx.close()
  }

  // 2) e2e_dual 로그인 (사용자 듀얼 역할자) — API 직접 호출로 쿠키 받기 (UI 의존성 0, 더 robust)
  if (target === 'test') {
    const userCtx = await browser.newContext()
    const userPage = await userCtx.newPage()
    try {
      const apiBase = target === 'prod' ? 'https://api.sajuplan.com' : 'https://api.sajumoon.kr'
      // origin 설정 위해 frontend 도메인 일단 진입 (about:blank 대신 — cookie 도메인 호환)
      await userPage.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      // 페이지 내에서 fetch credentials: include 로 로그인 → 쿠키 자동 저장
      const loginResult = await userPage.evaluate(async (apiBaseUrl) => {
        try {
          const r = await fetch(`${apiBaseUrl}/api/user/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mb_id: 'e2e_dual', password: 'e2e_test_2026' }),
            credentials: 'include',
          })
          return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) }
        } catch (e) {
          return { ok: false, error: (e as Error).message }
        }
      }, apiBase)
      console.log(`[e2e global-setup] e2e_dual API 로그인:`, JSON.stringify(loginResult).slice(0, 150))
      await userCtx.storageState({ path: 'user_dual_storage.json' })
      console.log(`[e2e global-setup] → user_dual_storage.json 저장`)
    } catch (e) {
      console.warn(`[e2e global-setup] e2e_dual 로그인 실패 — 빈 storage:`, (e as Error).message)
      await userCtx.storageState({ path: 'user_dual_storage.json' })
    } finally {
      await userCtx.close()
    }

    // 3) e2e_member 로그인 (일반 회원) — 회원 영역 spec 용
    const memberCtx = await browser.newContext()
    const memberPage = await memberCtx.newPage()
    try {
      const apiBase = 'https://api.sajumoon.kr'
      await memberPage.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      const loginResult = await memberPage.evaluate(async (apiBaseUrl) => {
        try {
          const r = await fetch(`${apiBaseUrl}/api/user/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mb_id: 'e2e_member', password: 'e2e_test_2026' }),
            credentials: 'include',
          })
          return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) }
        } catch (e) {
          return { ok: false, error: (e as Error).message }
        }
      }, apiBase)
      console.log(
        `[e2e global-setup] e2e_member API 로그인:`,
        JSON.stringify(loginResult).slice(0, 150),
      )
      await memberCtx.storageState({ path: 'user_member_storage.json' })
      console.log(`[e2e global-setup] → user_member_storage.json 저장`)
    } catch (e) {
      console.warn(
        `[e2e global-setup] e2e_member 로그인 실패 — 빈 storage:`,
        (e as Error).message.slice(0, 120),
      )
      await memberCtx.storageState({ path: 'user_member_storage.json' })
    } finally {
      await memberCtx.close()
    }
  } else {
    // prod — e2e 계정 prod DB에 생성됨 (2026-06-03). API 로그인으로 세션 저장.
    const apiBase = 'https://api.sajuplan.com'
    for (const [file, mbId] of [
      ['user_member_storage.json', 'e2e_member'],
      ['user_dual_storage.json', 'e2e_dual'],
    ] as [string, string][]) {
      const ctx = await browser.newContext()
      const pg = await ctx.newPage()
      try {
        await pg.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        const r = await pg.evaluate(async ([base, id]) => {
          const res = await fetch(`${base}/api/user/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mb_id: id, password: 'e2e_test_2026' }),
            credentials: 'include',
          })
          return { ok: res.ok, status: res.status }
        }, [apiBase, mbId])
        console.log(`[e2e global-setup] prod ${mbId} 로그인:`, JSON.stringify(r))
        await ctx.storageState({ path: file })
      } catch (e) {
        console.warn(`[e2e global-setup] prod ${mbId} 실패:`, (e as Error).message.slice(0, 80))
        await ctx.storageState({ path: file })
      } finally {
        await pg.close()
        await ctx.close()
      }
    }
  }

  await browser.close()
  console.log(`[e2e global-setup] 완료 (TARGET=${target})`)
}

export default globalSetup
