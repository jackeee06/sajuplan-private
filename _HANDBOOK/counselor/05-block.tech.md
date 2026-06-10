# 상담사 회원 차단 — 기술 상세

## 데이터 구조

```sql
CREATE TABLE counselor_block (
  id                  BIGSERIAL PRIMARY KEY,
  counselor_id        BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  member_id           BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  blocked_by_admin_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  reason              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (counselor_id, member_id)
);
-- 인덱스: counselor_id, member_id 각각
```

`(counselor_id, member_id)` UNIQUE 제약 — 동일 관계 중복 등록 시 UPDATE로 처리.

---

## API 엔드포인트

모두 `AdminAuthGuard` 적용.

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/admin/members/counselors/:id/blocks` | 차단 목록 조회 |
| `POST` | `/api/admin/members/counselors/:id/blocks` | 차단 추가 (member_id 또는 member_phone) |
| `DELETE` | `/api/admin/members/counselors/:id/blocks/:memberId` | 차단 해제 |

### POST body
```json
{
  "member_id": 132,          // 회원 ID (우선)
  "member_phone": "01012345678", // 또는 전화번호로 찾기
  "reason": "욕설"           // 선택
}
```

---

## 상담사 목록 필터링

`user/counselors/counselors.service.ts` — `list()` 및 `search()` 양쪽에 적용.

```sql
-- requesterId(로그인 회원) 있을 때만 추가
AND NOT EXISTS (
  SELECT 1 FROM counselor_block cb
   WHERE cb.counselor_id = m.id
     AND cb.member_id = ${requesterId}
)
```

- 비로그인 상태: 필터 없음 (모든 상담사 노출)
- 로그인 상태: 차단된 상담사 자동 제외
- 목록 조회 + 검색 (`/user/counselors/search`) 모두 적용

---

## 어드민 UI 위치

| 화면 | 위치 | 기능 |
|------|------|------|
| 상담 내역 (`ConsultationList.tsx`) | 각 행 맨 오른쪽 [차단] 버튼 | 해당 상담사가 해당 회원 즉시 차단 |
| 상담사 상세 (`CounselorForm.tsx`) | 페이지 하단 "차단 관리" 섹션 (`BlockPanel`) | 휴대폰 번호 또는 ID로 차단 추가 + 목록 관리 + 해제 |

---

## 코드 위치

| 파일 | 역할 |
|------|------|
| `api/db/migrations/20260610000000_counselor_block.sql` | 테이블 생성 마이그레이션 |
| `api/src/admin/members/members.service.ts` | `listBlocks()`, `addBlock()`, `removeBlock()` |
| `api/src/admin/members/members.controller.ts` | GET/POST/DELETE 엔드포인트 |
| `api/src/user/counselors/counselors.service.ts` | `list()`, `search()` 에 blockExclude 필터 추가 |
| `web/mng/src/pages/CounselorForm.tsx` | `BlockPanel` 컴포넌트 (하단 섹션) |
| `web/mng/src/pages/ConsultationList.tsx` | 각 행 [차단] 버튼 |

---

## 동작 검증 (2026-06-10 E2E)

| 시나리오 | 결과 |
|---------|------|
| 차단 전 상담사 목록에 포함 | ✅ |
| 차단 후 로그인 회원 목록에서 제외 | ✅ |
| 차단 후 검색에서도 제외 | ✅ |
| 차단 해제 후 목록 복원 | ✅ |
| 비로그인 시 차단 미적용 (정상) | ✅ |
| 전화번호로 차단 추가 | ✅ |

---

## 정책

- **관계 단위**: 상담사 1명 ↔ 회원 1명. 다른 상담사에게 영향 없음.
- **비인지 원칙**: 회원에게 차단 사실 미통보. 조용히 사라짐.
- **진행 중 상담**: 이미 진행 중인 상담에 영향 없음. 다음 접속부터 적용.
- **중복 등록**: `ON CONFLICT DO UPDATE` — 사유만 갱신됨.
