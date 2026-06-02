# [AI 전용] 운영 바이블 AI 시스템 — 기술 상세

## 구축 이력

| 시점 | 단계 | 내용 |
|---|---|---|
| 2026-05-30 | Phase 1 | 키워드 검색 (정확도 60%) — 초기 구축 |
| 2026-05-31 | Phase 2-A | LLM RAG (정확도 90-95%) — Anthropic Claude 통합 |
| 2026-05-31 | Phase 2-B | Agent + SQL Tool — 실제 DB 조회로 진단 능력 |

## 시스템 아키텍처

```
관리자 자연어 질문
  ↓
프론트: /mng/handbook-ai (AdminHandbookAI.tsx)
  ↓ POST /api/admin/handbook/ask
백엔드: AdminHandbookRagService.ask()
  ↓
  1. 세션 결정 (신규 또는 이어쓰기) → handbook_chat_session
  2. 옛 turn 불러옴 (멀티턴, 최근 10턴)
  3. 키워드 검색으로 관련 바이블 4개 항목 추출 (.md + .tech.md 양쪽)
  4. system prompt 빌드 (컨텍스트 + 출처 강제 + SQL Tool 사양)
  5. Claude API 호출 with tools=[sql_query]
  ↓
LLM Tool Use Loop (최대 5 라운드):
  - LLM 이 "DB 조회 필요" 판단 → tool_use 응답
  - 백엔드가 HandbookSqlToolService.execute() 호출
    - validateSql (SELECT/WITH 만, 위험 키워드 차단)
    - addLimit (LIMIT 100 강제)
    - maskSensitive (phone/password/bank_account 마스킹)
    - readonly DB (handbook_readonly user) 로 실행
  - 결과를 LLM 에게 tool_result 로 전달
  - LLM 이 추가 Tool 호출 또는 최종 답변
  ↓
  6. 대화 저장 (handbook_chat_message)
  7. 답변 + 출처 + SQL 실행 이력 반환
```

## DB 스키마 (3개 테이블)

### handbook_config (단일 row)
- `id` INT PRIMARY KEY DEFAULT 1 CHECK (id=1)
- `api_key` TEXT — Anthropic API 키 (sk-ant-...)
- `model` VARCHAR — claude-sonnet-4-6 / claude-opus-4-7 / claude-haiku-4-5-20251001
- `max_tokens` INT — 1000 default
- `enabled` BOOLEAN — 활성화 토글
- `updated_at`, `updated_by` (admin id FK)

### handbook_chat_session
- `id` BIGSERIAL
- `admin_id` INT FK → member(id)
- `title` VARCHAR — 첫 질문 80자
- `created_at`, `updated_at`

### handbook_chat_message
- `id` BIGSERIAL
- `session_id` BIGINT FK → handbook_chat_session
- `role` VARCHAR — 'user' / 'assistant'
- `content` TEXT
- `sources` JSONB — assistant 답변의 출처 + SQL 실행 이력
- `tokens_in`, `tokens_out` INT — 비용 추적
- `created_at`

## 핵심 코드 위치

| 파일 | 역할 |
|---|---|
| `api/src/admin/handbook/handbook.module.ts` | NestJS 모듈 정의 |
| `api/src/admin/handbook/handbook.controller.ts` | HTTP 라우트 9개 |
| `api/src/admin/handbook/handbook.service.ts` | Phase 1 (키워드 검색) |
| `api/src/admin/handbook/handbook-rag.service.ts` | Phase 2-A/B (RAG + Agent) |
| `api/src/admin/handbook/sql-tool.service.ts` | SQL Tool 안전 가드 |
| `api/src/shared/db/db.module.ts` | SQL_READONLY 토큰 등 |
| `web/mng/src/pages/AdminHandbook.tsx` | 운영자용 바이블 (키워드 검색) |
| `web/mng/src/pages/AdminHandbookAI.tsx` | AI 채팅 UI |
| `web/mng/src/pages/AdminHandbookConfig.tsx` | API 키 설정 (슈퍼) |
| `_HANDBOOK/` | 콘텐츠 (운영자용 + .tech.md) |
| `api/db/migrations/20260531000000_handbook_rag.sql` | DB 마이그레이션 |
| `tools/_sync_handbook.py` | 콘텐츠 PROD 동기화 |

## API 라우트 (9개)

| 메서드 | 경로 | 권한 |
|---|---|---|
| GET | `/api/admin/handbook/index` | admin |
| GET | `/api/admin/handbook/item?slug=...` | admin (.tech.md 차단) |
| GET | `/api/admin/handbook/search?q=...` | admin |
| **POST** | **`/api/admin/handbook/ask`** | admin (Phase 2-A/B RAG) |
| GET | `/api/admin/handbook/sessions` | admin (본인만) |
| GET | `/api/admin/handbook/sessions/:id` | admin (본인만) |
| DELETE | `/api/admin/handbook/sessions/:id` | admin (본인만) |
| GET | `/api/admin/handbook/config` | admin |
| PUT | `/api/admin/handbook/config` | **슈퍼만** |

## SQL Tool 안전 가드 (상세)

### 1. SQL 검증 (`validateSql`)
```typescript
const lower = trimmed.toLowerCase()
if (!lower.startsWith('select') && !lower.startsWith('with')) {
  throw new Error('SELECT 또는 WITH 만 허용됨')
}
const blocked = ['insert', 'update', 'delete', 'truncate', 'drop', 'alter', 'create', 'grant', 'revoke', 'comment']
for (const kw of blocked) {
  if (new RegExp(`\\b${kw}\\b`, 'i').test(trimmed)) {
    throw new Error(`금지 키워드: ${kw}`)
  }
}
if (trimmed.includes(';')) throw new Error('여러 쿼리 차단')
```

### 2. LIMIT 자동 추가 (`addLimit`)
- `LIMIT \d+` 정규식 없으면 `LIMIT 100` append

### 3. DB user 권한 (PostgreSQL 레벨)
- `handbook_readonly` user
- `GRANT SELECT ON ALL TABLES IN SCHEMA public`
- `ALTER USER handbook_readonly SET statement_timeout = '10s'`
- INSERT/UPDATE/DELETE 시도 → `permission denied for table ...` 즉시 거부

### 4. 민감 필드 마스킹 (`maskSensitive`)
- **완전 마스킹** (`***`): password, password_hash, bank_account, card_no, billing_key, social_uid, verification_code
- **부분 마스킹** (`010-****-5678`): phone, mobile, tel, telno, caller_phone, callee_phone

### 5. Tool Use 루프 cap
- `MAX_ROUNDS = 5` (무한 루프 차단)
- 각 라운드에서 LLM 이 추가 tool_use 또는 final answer 결정

## Anthropic SDK 통합

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: config.api_key })
const tools: Anthropic.Tool[] = [
  {
    name: 'sql_query',
    description: '사주플랜 DB SELECT 쿼리 실행. INSERT/UPDATE/DELETE 차단. LIMIT 100 자동.',
    input_schema: { type: 'object', properties: { sql, purpose }, required: ['sql', 'purpose'] }
  }
]

const response = await client.messages.create({
  model: config.model,
  max_tokens: config.max_tokens,
  system: systemPrompt,
  messages,
  tools
})
```

## 시스템 프롬프트 정책

- 운영자 친화 톤 (코드 라인 X, 메뉴 위치 O)
- 출처 강제 (`📚 출처:` 형식)
- 컨텍스트 외 답변 거부 ("바이블에 정보 없습니다")
- 추측 금지
- 간결성 (2-5단락)
- SQL Tool 사용 가이드라인 (필요할 때만, 최소 컬럼만, 진단 포함)

## 비용 추적

`handbook_chat_message.tokens_in / tokens_out` 컬럼에 매 query 토큰 기록.

```sql
-- 월별 토큰 사용량
SELECT
  DATE_TRUNC('month', created_at) AS month,
  SUM(tokens_in) AS total_in,
  SUM(tokens_out) AS total_out,
  ROUND(SUM(tokens_in)::numeric / 1000000 * 3, 4) AS cost_in_usd_sonnet,
  ROUND(SUM(tokens_out)::numeric / 1000000 * 15, 4) AS cost_out_usd_sonnet
FROM handbook_chat_message
WHERE role='assistant'
GROUP BY month
ORDER BY month DESC;
```

## 함정 / 알려진 이슈

1. **Anthropic 결제 막힘 (한국)**: 평가 액세스도 결제 정보 필요. 다른 카드 / 카드사 해외결제 풀기 / OpenAI 대체 검토.
2. **SQL 마스킹 누락 필드**: 새 테이블/컬럼 추가 시 sensitive 목록에 추가 필요. `sql-tool.service.ts` `sensitiveFields` / `phoneFields` Set.
3. **컨텍스트 토큰 비용**: 바이블 4개 항목 + .tech.md = 약 8-16K 토큰. 멀티턴 누적 시 cost ↑.
4. **세션 30턴 이상**: 옛 turn 10턴만 컨텍스트. 그 이전 발화 안 됨. 사용자가 "처음에 뭐라고 했지?" 못 물음.
5. **OpenAI 미지원**: 현재 Anthropic SDK 만 사용. OpenAI 도 지원하려면 별도 모듈 + provider 토글 필요.

## 백로그

- [ ] OpenAI 지원 추가 (provider 토글)
- [ ] 답변 피드백 (👍 / 👎) 수집 → 시스템 프롬프트 개선
- [ ] 자주 묻는 질문 자동 발견 → 바이블 보강 트리거
- [ ] 대화 공유 기능
- [ ] FCM 푸시 차단 정책에 RAG 호출도 포함

## 보안 정책

- API 키는 DB 평문 저장 (운영자 페이지 마스킹 표시)
  → DB 직접 접근 못 하는 운영자에겐 안전
  → DB 백업 시 키 포함됨 (백업 파일 보안 중요)
- `.tech.md` UI 차단 (`.tech` 접미사 slug 거부)
- 슈퍼 권한만 키 변경 가능 (`is_super` 가드)
- 모든 query / SQL 실행이 `handbook_chat_message` 에 영구 기록 (감사)
