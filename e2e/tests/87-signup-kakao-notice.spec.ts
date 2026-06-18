import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * [2026-06-12] 회원가입 인증번호 = 카카오톡 안내 회귀 방지.
 *
 * 상담사 신고: "인증번호가 문자(SMS)로 오는 줄 알고 기다린다. 카톡으로 온다고 안내해야 한다."
 * 우리는 SMS 미사용 → 인증번호는 카카오톡 알림톡 전용. 폴백 없음.
 *
 * Fix (Signup.tsx):
 *  - 휴대폰 입력칸 아래 상시 노출되는 카카오톡 안내 박스
 *  - 전송 버튼 글자를 "카카오톡으로 인증번호 받기" (카톡 노란색 풀폭) 로 변경
 *
 * 이 spec 은 비로그인 기준 /signup 진입 시 안내가 보이는지만 확인 (실제 발송 X).
 */

test.describe('회원가입 — 인증번호 카카오톡 안내', () => {
  test('카카오톡으로 인증번호 받기 버튼 + SMS 아님 안내 노출', async ({ page }) => {
    await page.goto('/signup')

    // 카톡 전송 버튼 — 사장님 승인 문구 그대로
    const kakaoBtn = page.getByRole('button', { name: /카카오톡으로 인증번호 받기/ })
    await expect(kakaoBtn).toBeVisible()

    // 상시 안내 박스 — "카카오톡으로 발송됩니다"
    await expect(page.getByText(/카카오톡.*으로 발송됩니다/)).toBeVisible()

    // "문자(SMS)가 아니니 카카오톡을 확인" 안내 — 상담사 신고 핵심 해소
    await expect(page.getByText(/문자\(SMS\)가 아니니/)).toBeVisible()
  })
})
