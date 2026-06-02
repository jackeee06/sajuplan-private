# E2E 테스트 함정 모음

## ⚠️ networkidle 절대 사용 금지 (2026-06-03)

### 원인
sajuplan.com은 WebSocket / 폴링 연결이 항상 활성 상태.
`waitForLoadState('networkidle')` = "모든 네트워크 요청이 500ms 이상 없을 때"
→ 이 조건이 절대 충족되지 않아 테스트가 무한 대기 후 타임아웃.

### 규칙
```
❌ await page.waitForLoadState('networkidle')
✅ await page.waitForLoadState('domcontentloaded')
✅ await page.waitForLoadState('load')
✅ await page.waitForSelector('.특정요소')
```

---

## ⚠️ bcrypt 해시 SQL 직접 삽입 금지 (2026-06-03)

### 원인
`$2b$12$...` 해시 안의 `$` 문자가 쉘에서 변수로 해석됨 → 해시가 깨져 로그인 불가.

### 규칙
bcrypt 해시를 SQL에 넣을 때는 반드시 SFTP로 .sql 파일을 서버에 올린 뒤 `psql -f` 실행.

---

## ⚠️ prod e2e 계정 로그인 방법 (2026-06-03)

sajuplan.com은 HTTP-only 쿠키 + 크로스도메인(api.sajuplan.com).
UI 로그인은 headless에서 타임아웃 위험.

### 올바른 방법
```typescript
const res = await page.request.post(`https://api.sajuplan.com/api/user/auth/login`, {
  data: { mb_id: 'e2e_member', password: 'e2e_test_2026' },
})
const match = res.headers()['set-cookie']?.match(/sjm_user=([^;]+)/)
if (match) {
  await context.addCookies([{
    name: 'sjm_user', value: match[1],
    domain: 'sajuplan.com', path: '/',
    httpOnly: true, secure: true, sameSite: 'None',
  }])
}
await page.goto('/목표경로')
await page.waitForLoadState('domcontentloaded')  // networkidle 절대 금지
```

### prod e2e 계정
- mb_id: `e2e_member` (일반회원) / `e2e_dual` (상담사)
- password: `e2e_test_2026`
- DB 수정: SFTP로 .sql 파일 업로드 후 `psql -f` 실행
