import { test, expect } from '@playwright/test'
import * as path from 'node:path'
import * as fs from 'node:fs'

test.use({ storageState: { cookies: [], origins: [] } })

test('라온선생 후기 상세 — 정상 화면 재현', async ({ page }) => {
  const PROFILE_URL = 'https://sajuplan.com/uploads/member/1779435810281_93zl4g.jpg'

  await page.setViewportSize({ width: 390, height: 844 })

  await page.setContent(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
               background: white; max-width: 480px; margin: 0 auto; }
        .mode-bar { background: #7c3aed; color: white; font-size: 13px; font-weight: 600;
                    padding: 8px 16px; display: flex; align-items: center; gap: 6px;
                    position: sticky; top: 0; z-index: 10; }
        .mode-bar .badge { font-size: 11px; }
        .mode-bar .switch { margin-left: auto; background: rgba(255,255,255,0.2);
                            border-radius: 20px; padding: 4px 10px; font-size: 12px; }
        .header { height: 56px; padding: 0 16px; display: flex; align-items: center; gap: 12px;
                  border-bottom: 1px solid #f3f4f6; position: sticky; top: 36px;
                  background: white; z-index: 9; }
        .header .back { font-size: 20px; color: #374151; }
        .header h1 { font-size: 17px; font-weight: 600; color: #030712; }
        .body { padding: 16px; }
        .review-title { font-size: 18px; font-weight: 700; color: #030712; line-height: 1.4;
                        margin-bottom: 8px; }
        .reviewer { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .reviewer svg { flex-shrink: 0; }
        .reviewer-name { font-size: 14px; font-weight: 500; color: #1E2939; }
        .meta { font-size: 13px; color: #99A1AF; margin-bottom: 16px; }
        .content { font-size: 15px; line-height: 1.6; color: #1E2939; margin-bottom: 24px; }
        .divider { height: 1px; background: #f3f4f6; margin-bottom: 16px; }
        .reply-count { font-size: 14px; font-weight: 600; color: #1E2939; margin-bottom: 12px; }
        .reply-count span { color: #8259F5; }
        .reply-box { padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
        .reply-text { font-size: 15px; color: #1E2939; margin-bottom: 10px; }
        .reply-meta { display: flex; align-items: center; gap: 8px; }
        .reply-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
        .reply-author { font-size: 13px; color: #99A1AF; }
        .btn-list { margin-top: 24px; text-align: center; }
        .btn-list button { border: 1px solid #8259F5; color: #8259F5; background: white;
                           border-radius: 20px; padding: 8px 24px; font-size: 14px; font-weight: 500; }
        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; max-width: 480px; margin: 0 auto;
                      height: 60px; background: white; border-top: 1px solid #f3f4f6;
                      display: flex; align-items: center; }
        .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center;
                    gap: 4px; font-size: 11px; color: #99A1AF; }
        .nav-item.active { color: #ec4899; }
      </style>
    </head>
    <body>
      <div class="mode-bar">
        <span class="badge">🧡</span> 상담사 모드
        <span class="switch">회원 모드 ›</span>
      </div>

      <div class="header">
        <span class="back">←</span>
        <h1>상담 후기</h1>
      </div>

      <div class="body" style="padding-bottom: 80px;">
        <p class="review-title">재물운 사주 풀이가 명쾌해요</p>
        <div class="reviewer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#8259F5" stroke-width="1.4"/>
            <path d="M5 8L7 10L11 6" stroke="#8259F5" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="reviewer-name">지*</span>
        </div>
        <p class="meta">2026.06.03 · 11분 0초</p>
        <p class="content">올해 재물운이 어떤지 궁금해서 상담받았어요. 생각보다 훨씬 상세하게 달별로 설명해주셨고, 특히 하반기에 뜻밖의 수입이 생길 수 있다고 하셨는데 실제로 그런 기회가 찾아와서 신기했어요. 설명도 어렵지 않게 해주셔서 처음 사주 상담 받는 분들께도 추천드립니다.</p>

        <div class="divider"></div>

        <p class="reply-count">상담 답변 <span>1</span>건</p>
        <div class="reply-box">
          <p class="reply-text">^^</p>
          <div class="reply-meta">
            <img id="avatar" src="${PROFILE_URL}" class="reply-avatar" alt="라온선생 프로필" />
            <span class="reply-author">라온선생 · 2026.06.07 12:44</span>
          </div>
        </div>

        <div class="btn-list">
          <button>목록으로</button>
        </div>
      </div>

      <div class="bottom-nav">
        <div class="nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" stroke-width="1.6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>상담사</span>
        </div>
        <div class="nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" stroke-width="1.6"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <span>단골</span>
        </div>
        <div class="nav-item active">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="1.6"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22" stroke="#ec4899"/></svg>
          <span>홈</span>
        </div>
        <div class="nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span>수익금</span>
        </div>
        <div class="nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" stroke-width="1.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>마이</span>
        </div>
      </div>
    </body>
    </html>
  `)

  // 이미지 완전 로드 대기
  await page.waitForFunction(() => {
    const img = document.getElementById('avatar') as HTMLImageElement
    return img && img.complete && img.naturalWidth > 0
  }, { timeout: 10000 })

  const dir = path.resolve(__dirname, '../test-results')
  fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, 'verify-profile-image.png'), fullPage: false })

  const nw = await page.evaluate(() => {
    const img = document.getElementById('avatar') as HTMLImageElement
    return img.naturalWidth
  })
  expect(nw).toBeGreaterThan(0)
  console.log(`✅ 프로필 사진 정상 (naturalWidth=${nw})`)
})
