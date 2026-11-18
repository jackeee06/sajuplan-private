// 엠투넷 웹콘솔 자동 로그인 → 화면 캡쳐 (읽기 전용).
//   목적: 사장님이 손으로 캡쳐하던 passcall.co.kr 콘솔 화면을 Claude 가 직접 열어 캡쳐→판독.
//   ⚠️ 이 스크립트는 로그인·이동·캡쳐만 한다. 코인지급/상태변경 등 돈 바꾸는 클릭은 절대 넣지 않는다.
//
//   사용:  node e2e/m2net-console.mjs [출력파일명]
//   비번:  프로젝트 루트 .env.local 의 M2NET_CONSOLE_ID / _PW / _URL (git 제외됨)
//
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')

// .env.local 파싱 (KEY='value')
function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*'?([^'\r\n]*)'?\s*$/)
      if (m) env[m[1]] = m[2]
    }
  } catch { /* noop */ }
  return env
}

const env = loadEnv()
const URL = env.M2NET_CONSOLE_URL || 'https://passcall.co.kr:32831/index'
const ID = env.M2NET_CONSOLE_ID
const PW = env.M2NET_CONSOLE_PW
const OUT = resolve(ROOT, 'e2e', process.argv[2] || '_m2net_shot.png')
// 두번째 인자 = 열고 싶은 메뉴 이름(부분일치). 없으면 로그인 직후 메인 캡쳐.
const MENU = process.argv[3] || ''

// 엠투넷 AG9 콘솔 메뉴 지도 (2026-07-10 자동추출). 이름만 대면 그 화면으로 감.
//   [CP관리자관리]  CP정보확인및수정
//   [상담-원부관리] 상담사원부 · 회원원부
//   [상담-결과관리] 상담상세내역 · 통화상세내역 · 일별상담현황 · 일별선불현황 · 일별후불현황
//                    · 월별선불현황 · 월별후불현황 · 상담사실적관리
//   [상담-기타관리] 결제내역 · 충전이력 · 차감이력 · VIP관리 · 블랙리스트 · 가상계좌입금내역
//                    · 예약원부 · 예약취소이력 · 상담연결실패이력 · 상담사수정이력
//   [문자발송관리]  템플릿관리 · 발송대기 · 발송결과 · 발송통계

if (!ID || !PW) {
  console.error('✗ .env.local 에 M2NET_CONSOLE_ID / M2NET_CONSOLE_PW 가 없습니다.')
  process.exit(2)
}

const log = (...a) => console.log('[m2net]', ...a)

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await ctx.newPage()
  try {
    log('로그인 페이지 여는 중:', URL)
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)

    // 로그인 폼은 iframe(coreframe) 안일 수 있으므로 프레임 전체를 훑어 찾는다.
    const frames = page.frames()
    log('프레임 수:', frames.length)

    let filled = false
    for (const f of frames) {
      // ID 입력칸 후보: value=sajumoon* 또는 근처 라벨 'Log-in ID'
      const idInput = f.locator('input[type="text"], input:not([type])').first()
      const pwInput = f.locator('input[type="password"]').first()
      if ((await pwInput.count()) > 0 && (await idInput.count()) > 0) {
        log('로그인 폼 발견 — 프레임 url:', f.url() || '(main)')
        await idInput.fill(ID)
        await pwInput.fill(PW)
        // LOG IN — 제출 버튼 후보를 순서대로 시도, 없으면 엔터
        const btnCandidates = [
          f.locator('input[type=submit]'),
          f.locator('button'),
          f.getByText(/LOG\s*IN/i),
          f.locator('a[href*="login"], img[src*="login" i]'),
        ]
        let clicked = false
        for (const b of btnCandidates) {
          if ((await b.count()) > 0) {
            await b.first().click({ timeout: 3000 }).then(() => { clicked = true }).catch(() => {})
            if (clicked) break
          }
        }
        if (!clicked) await pwInput.press('Enter')
        filled = true
        break
      }
    }
    if (!filled) log('⚠️ 로그인 폼을 못 찾음 — 현재 화면 그대로 캡쳐합니다.')

    await page.waitForTimeout(4000) // 로그인 후 프레임 로드 대기

    // 메뉴명이 주어지면 좌측 메뉴(mkmenu 프레임)에서 클릭 → 우측 콘텐츠 로드
    if (MENU) {
      const menuFrame = page.frames().find((f) => f.url().includes('mkmenu'))
      if (menuFrame) {
        const link = menuFrame.getByText(MENU, { exact: false }).first()
        if ((await link.count()) > 0) {
          log('메뉴 클릭(JS):', MENU)
          // 트리가 접혀 안 보여도 DOM 클릭으로 onclick(reverseClick) 직접 발동
          await link.evaluate((el) => el.click()).catch((e) => log('클릭 경고:', e.message))
          await page.waitForTimeout(3500) // 콘텐츠 프레임 로드 대기
        } else {
          log('⚠️ 메뉴 못 찾음:', MENU, '— 메인 화면 캡쳐')
        }
      }
    }

    mkdirSync(dirname(OUT), { recursive: true })
    await page.screenshot({ path: OUT, fullPage: true })
    log('✓ 캡쳐 저장:', OUT)
    log('  최종 URL:', page.url())
    log('  프레임 수(로그인후):', page.frames().length)
  } catch (e) {
    log('✗ 오류:', e.message)
    try { await page.screenshot({ path: OUT }) ; log('  (오류 시점 화면 캡쳐:', OUT, ')') } catch {}
    process.exitCode = 1
  } finally {
    await browser.close()
  }
})()
