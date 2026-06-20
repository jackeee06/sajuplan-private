import { test, expect } from '@playwright/test'

/**
 * 관리자 페이지 헤더 좌측 정렬 회귀 스펙 (2026-06-19)
 *
 * 문제: 헤더가 flex justify-between 이라 액션 버튼이 넓은 래퍼의 "오른쪽 끝"으로 밀려
 *       제목과 버튼 사이에 거대한 빈 가로 여백이 생김(사장님 지적, 팝업레이어 등).
 * 수정: 버튼을 제목 바로 아래 좌측 정렬 한 줄로 내림 → 버튼 x ≈ 제목 x.
 *
 * 검증: 각 페이지에서 액션 버튼의 left(x)가 제목 h1 의 left(x)와 거의 같은지(좌측 정렬) 확인.
 *       (수정 전이면 버튼 x 가 제목보다 수백 px 오른쪽 → 실패)
 */
const WEB = 'https://sajuplan.com/mng'

const CASES: { path: string; heading: string; button: string }[] = [
  { path: '/popup-layers', heading: '팝업레이어 관리', button: '팝업 추가' },
  { path: '/banners', heading: '배너 관리', button: '배너추가' },
  { path: '/contents', heading: '내용 관리', button: '내용 추가' },
  { path: '/faqs', heading: 'FAQ 관리', button: 'FAQ 카테고리 추가' },
  { path: '/consultations', heading: '사용(상담) 내역', button: '엑셀다운로드' },
  { path: '/payments', heading: '결제 내역', button: '엑셀다운로드' },
]

test.describe('관리자 헤더 좌측 정렬', () => {
  test.use({ storageState: 'storageState.json' }) // 슈퍼관리자

  for (const c of CASES) {
    test(`${c.heading} — 버튼이 제목과 같은 좌측에`, async ({ page }) => {
      await page.goto(`${WEB}${c.path}`, { waitUntil: 'domcontentloaded' })
      const h1 = page.getByRole('heading', { name: c.heading, level: 1 })
      await expect(h1).toBeVisible({ timeout: 12000 })
      const btn = page.getByRole('button', { name: c.button }).or(page.getByRole('link', { name: c.button })).first()
      await expect(btn).toBeVisible()

      const hb = await h1.boundingBox()
      const bb = await btn.boundingBox()
      expect(hb && bb).toBeTruthy()
      // 버튼 left 가 제목 left 와 거의 같음(좌측 정렬). 수정 전이면 수백 px 우측이라 실패.
      expect(Math.abs((bb!.x) - (hb!.x)), `${c.path} 버튼이 좌측 정렬`).toBeLessThan(40)
    })
  }
})
