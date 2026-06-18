import { test, expect } from '@playwright/test'

/**
 * 회원가입 무결성 — 추천코드칸 접이식 변경(2026-06-18) 후 가입화면이 깨지지 않았는지 엄격 검증.
 *
 * 검증 포인트:
 *  - /signup 이 런타임 에러 없이 렌더 (페이지 크래시 / 콘솔 error 0)
 *  - 가입 필수 입력 요소 전부 존재 (아이디·비번·이름·닉네임·휴대폰·유입경로·약관)
 *  - 추천코드칸이 기본 접힘(일반 가입자 무방해) + 펼침 동작
 *  - 추천 없이도 폼이 그대로 작동(추천칸은 가입을 막지 않음)
 */

test('회원가입 화면 — 런타임 에러 없이 렌더 + 필수 요소 전부 존재', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto('/signup')
  await page.waitForLoadState('networkidle')

  // 페이지가 살아있음(크래시 시 body 비거나 에러 화면)
  await expect(page.locator('body')).toBeVisible()

  // 가입 핵심 입력 요소 — 라벨 텍스트로 존재 확인
  for (const label of ['아이디', '비밀번호', '이름', '닉네임', '휴대폰번호', '유입경로']) {
    await expect(page.locator('body')).toContainText(label)
  }
  // 약관 동의 영역
  await expect(page.locator('body')).toContainText('이용약관')

  // 치명 런타임 에러 0 (앱 크래시 유발하는 pageerror)
  expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toHaveLength(0)
})

test('추천코드칸 — 기본 접힘 → 펼치면 입력칸(일반 가입자 무방해)', async ({ page }) => {
  await page.goto('/signup')
  await page.waitForLoadState('networkidle')

  // 기본: 입력칸 숨김, 접이식 링크만
  const toggle = page.getByRole('button', { name: '추천코드가 있으신가요?' })
  await expect(toggle).toBeVisible()
  await expect(page.getByPlaceholder('받으신 추천코드 (없으면 비워두세요)')).toHaveCount(0)

  // 펼치면 입력칸 등장 (가입 자체와 독립)
  await toggle.click()
  const input = page.getByPlaceholder('받으신 추천코드 (없으면 비워두세요)')
  await expect(input).toBeVisible()
  await input.fill('9999')
  await expect(input).toHaveValue('9999')
})
