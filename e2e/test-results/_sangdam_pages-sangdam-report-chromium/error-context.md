# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: _sangdam_pages.spec.ts >> sangdam report
- Location: tests\_sangdam_pages.spec.ts:14:7

# Error details

```
TimeoutError: page.screenshot: Timeout 10000ms exceeded.
Call log:
  - taking page screenshot
  - waiting for fonts to load...

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - link "사주플랜 ADMIN" [ref=e6] [cursor=pointer]:
      - /url: /mng/dashboard
      - img "사주플랜" [ref=e7]
      - generic [ref=e8]: ADMIN
    - navigation [ref=e10]:
      - generic [ref=e11]:
        - heading "관리 메뉴" [level=3] [ref=e12]
        - list [ref=e13]:
          - listitem [ref=e14]:
            - link "대시보드" [ref=e15] [cursor=pointer]:
              - /url: /mng/dashboard
              - img [ref=e16]
              - generic [ref=e21]: 대시보드
          - listitem [ref=e22]:
            - link "전체 메뉴" [ref=e23] [cursor=pointer]:
              - /url: /mng/all-menus
              - img [ref=e24]
              - generic [ref=e29]: 전체 메뉴
          - listitem [ref=e30]:
            - button "회원현황" [ref=e31] [cursor=pointer]:
              - img [ref=e32]
              - generic [ref=e37]: 회원현황
              - img [ref=e38]
            - list [ref=e40]:
              - listitem [ref=e41]:
                - link "고객 리스트" [ref=e42] [cursor=pointer]:
                  - /url: /mng/members/customers
              - listitem [ref=e43]:
                - link "상담사 리스트" [ref=e44] [cursor=pointer]:
                  - /url: /mng/members/counselors
              - listitem [ref=e45]:
                - link "상담사 신청 내역" [ref=e46] [cursor=pointer]:
                  - /url: /mng/members/counselor-apply
              - listitem [ref=e47]:
                - link "⭐ 출석 관리" [ref=e48] [cursor=pointer]:
                  - /url: /mng/attendance
              - listitem [ref=e49]:
                - link "⭐ 등급 관리" [ref=e50] [cursor=pointer]:
                  - /url: /mng/grade
              - listitem [ref=e51]:
                - link "모집인 관리" [ref=e52] [cursor=pointer]:
                  - /url: /mng/promoters
          - listitem [ref=e53]:
            - button "매출현황" [ref=e54] [cursor=pointer]:
              - img [ref=e55]
              - generic [ref=e57]: 매출현황
              - img [ref=e58]
            - list [ref=e60]:
              - listitem [ref=e61]:
                - link "사용(상담) 내역" [ref=e62] [cursor=pointer]:
                  - /url: /mng/consultations
              - listitem [ref=e63]:
                - link "⭐ 환불 이력" [ref=e64] [cursor=pointer]:
                  - /url: /mng/refunds
              - listitem [ref=e65]:
                - link "⭐ 고객보호비용 내역" [ref=e66] [cursor=pointer]:
                  - /url: /mng/short-call-refunds
              - listitem [ref=e67]:
                - link "⭐ 운영 KPI" [ref=e68] [cursor=pointer]:
                  - /url: /mng/ops-kpi
              - listitem [ref=e69]:
                - link "충전금액 설정" [ref=e70] [cursor=pointer]:
                  - /url: /mng/charge-amounts
              - listitem [ref=e71]:
                - link "결제 내역" [ref=e72] [cursor=pointer]:
                  - /url: /mng/payments
              - listitem [ref=e73]:
                - link "코인·수익금 원장" [ref=e74] [cursor=pointer]:
                  - /url: /mng/points/history
              - listitem [ref=e75]:
                - link "정산 이력" [ref=e76] [cursor=pointer]:
                  - /url: /mng/settlements
              - listitem [ref=e77]:
                - link "⭐ 선지급 관리" [ref=e78] [cursor=pointer]:
                  - /url: /mng/payouts
              - listitem [ref=e79]:
                - link "⭐ 추천수익금" [ref=e80] [cursor=pointer]:
                  - /url: /mng/referrals
          - listitem [ref=e81]:
            - link "쿠폰존 관리" [ref=e82] [cursor=pointer]:
              - /url: /mng/coupon-zones
              - img [ref=e83]
              - generic [ref=e85]: 쿠폰존 관리
          - listitem [ref=e86]:
            - link "쿠폰·코인 정책" [ref=e87] [cursor=pointer]:
              - /url: /mng/coupon-coin-guide
              - img [ref=e88]
              - generic [ref=e90]: 쿠폰·코인 정책
          - listitem [ref=e91]:
            - button "상담관리" [ref=e92] [cursor=pointer]:
              - img [ref=e93]
              - generic [ref=e95]: 상담관리
              - img [ref=e96]
            - list [ref=e98]:
              - listitem [ref=e99]:
                - link "상담후기 관리" [ref=e100] [cursor=pointer]:
                  - /url: /mng/posts/review
              - listitem [ref=e101]:
                - link "후기 신고 관리" [ref=e102] [cursor=pointer]:
                  - /url: /mng/review-reports
              - listitem [ref=e103]:
                - link "상담문의" [ref=e104] [cursor=pointer]:
                  - /url: /mng/posts/qa
              - listitem [ref=e105]:
                - link "1:1문의(상담사)" [ref=e106] [cursor=pointer]:
                  - /url: /mng/posts/qa_counselor
              - listitem [ref=e107]:
                - link "상담사 고객센터 문의" [ref=e108] [cursor=pointer]:
                  - /url: /mng/counselor-inquiries
              - listitem [ref=e109]:
                - link "채팅내역 리스트" [ref=e110] [cursor=pointer]:
                  - /url: /mng/chat-history
          - listitem [ref=e111]:
            - button "게시판관리" [ref=e112] [cursor=pointer]:
              - img [ref=e113]
              - generic [ref=e116]: 게시판관리
              - img [ref=e117]
          - listitem [ref=e119]:
            - button "알림" [ref=e120] [cursor=pointer]:
              - img [ref=e121]
              - generic [ref=e124]: 알림
              - img [ref=e125]
          - listitem [ref=e127]:
            - link "통계" [ref=e128] [cursor=pointer]:
              - /url: /mng/stats
              - img [ref=e129]
              - generic [ref=e131]: 통계
          - listitem [ref=e132]:
            - button "권한관리" [ref=e133] [cursor=pointer]:
              - img [ref=e134]
              - generic [ref=e136]: 권한관리
              - img [ref=e137]
          - listitem [ref=e139]:
            - button "기타" [ref=e140] [cursor=pointer]:
              - img [ref=e141]
              - generic [ref=e145]: 기타
              - img [ref=e146]
          - listitem [ref=e148]:
            - button "환경설정" [ref=e149] [cursor=pointer]:
              - img [ref=e150]
              - generic [ref=e153]: 환경설정
              - img [ref=e154]
      - list [ref=e157]:
        - listitem [ref=e158]:
          - link "메모장" [ref=e159] [cursor=pointer]:
            - /url: /mng/memo
            - img [ref=e160]
            - generic [ref=e163]: 메모장
        - listitem [ref=e164]:
          - link "📖 운영 바이블" [ref=e165] [cursor=pointer]:
            - /url: /mng/handbook
            - img [ref=e166]
            - generic [ref=e168]: 📖 운영 바이블
        - listitem [ref=e169]:
          - link "🤖 운영 바이블 AI" [ref=e170] [cursor=pointer]:
            - /url: /mng/handbook-ai
            - img [ref=e171]
            - generic [ref=e174]: 🤖 운영 바이블 AI
      - generic [ref=e175]:
        - heading "설정" [level=3] [ref=e176]
        - list [ref=e177]:
          - listitem [ref=e178]:
            - link "로그아웃" [ref=e179] [cursor=pointer]:
              - /url: /mng/login
              - img [ref=e180]
              - generic [ref=e183]: 로그아웃
  - generic [ref=e184]:
    - banner [ref=e185]:
      - generic [ref=e186]:
        - button "dark mode toggle" [ref=e187] [cursor=pointer]:
          - img [ref=e188]
        - button "admin_e2e" [ref=e191] [cursor=pointer]:
          - generic [ref=e192]: admin_e2e
          - img [ref=e193]
    - main [ref=e195]:
      - generic [ref=e196]:
        - generic [ref=e197]:
          - heading "후기 신고 관리" [level=1] [ref=e198]
          - generic [ref=e199]: 사용자가 신고한 후기 — 검토 후 숨김/반려
          - generic [ref=e200]: · 전체 0건
        - generic [ref=e201]:
          - paragraph [ref=e202]: 📋 신고 처리 안내
          - table [ref=e203]:
            - rowgroup [ref=e204]:
              - row "신고 사유 욕설·비방 / 허위 사실 / 광고·스팸 / 개인정보 노출 / 기타" [ref=e205]:
                - cell "신고 사유" [ref=e206]
                - cell "욕설·비방 / 허위 사실 / 광고·스팸 / 개인정보 노출 / 기타" [ref=e207]
              - row "자동 숨김 동일 후기에 신고 3회 이상 누적 시 자동 숨김 처리됨 (관리자 복원 가능)" [ref=e208]:
                - cell "자동 숨김" [ref=e209]
                - cell "동일 후기에 신고 3회 이상 누적 시 자동 숨김 처리됨 (관리자 복원 가능)" [ref=e210]
              - row "처리 상태 대기(미검토) → 검토 완료 / 숨김(노출 차단) / 반려(신고 기각)" [ref=e211]:
                - cell "처리 상태" [ref=e212]
                - cell "대기(미검토) → 검토 완료 / 숨김(노출 차단) / 반려(신고 기각)" [ref=e213]
              - row "처리 방법 행을 클릭하면 후기 본문·신고자 확인 후 상태 변경 + 관리자 메모 저장" [ref=e214]:
                - cell "처리 방법" [ref=e215]
                - cell "행을 클릭하면 후기 본문·신고자 확인 후 상태 변경 + 관리자 메모 저장" [ref=e216]
        - generic [ref=e217]:
          - button "대기" [ref=e218] [cursor=pointer]:
            - generic [ref=e220]: 대기
          - button "전체" [ref=e221] [cursor=pointer]:
            - generic [ref=e222]: 전체
          - button "검토 완료" [ref=e223] [cursor=pointer]:
            - generic [ref=e225]: 검토 완료
          - button "숨김" [ref=e226] [cursor=pointer]:
            - generic [ref=e228]: 숨김
          - button "반려" [ref=e229] [cursor=pointer]:
            - generic [ref=e231]: 반려
        - table [ref=e234]:
          - rowgroup [ref=e235]:
            - row "ID 신고일 사유 후기 제목 신고자 상태" [ref=e236]:
              - columnheader "ID" [ref=e237]
              - columnheader "신고일" [ref=e238]
              - columnheader "사유" [ref=e239]
              - columnheader "후기 제목" [ref=e240]
              - columnheader "신고자" [ref=e241]
              - columnheader "상태" [ref=e242]
          - rowgroup [ref=e243]:
            - row "자료가 없습니다." [ref=e244]:
              - cell "자료가 없습니다." [ref=e245]
        - generic [ref=e246]:
          - paragraph [ref=e247]: 페이지 1 / 1
          - paragraph [ref=e248]: 총 0건
```

# Test source

```ts
  1  | import { test } from '@playwright/test'
  2  | import fs from 'fs'
  3  | const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_sangdam'
  4  | fs.mkdirSync(SHOT, { recursive: true })
  5  | test.use({ viewport: { width: 1500, height: 950 } })
  6  | 
  7  | const pages = [
  8  |   ['report', 'https://sajuplan.com/mng/review-reports'],
  9  |   ['qa', 'https://sajuplan.com/mng/posts/qa'],
  10 |   ['inquiry', 'https://sajuplan.com/mng/counselor-inquiries'],
  11 |   ['chat', 'https://sajuplan.com/mng/chat-history'],
  12 | ]
  13 | for (const [name, url] of pages) {
  14 |   test(`sangdam ${name}`, async ({ page }) => {
  15 |     await page.goto(url)
  16 |     await page.waitForLoadState('load').catch(() => {})
  17 |     await page.waitForTimeout(2400)
> 18 |     await page.screenshot({ path: `${SHOT}/${name}.png`, clip: { x: 150, y: 80, width: 1200, height: 560 } })
     |                ^ TimeoutError: page.screenshot: Timeout 10000ms exceeded.
  19 |   })
  20 | }
  21 | 
```