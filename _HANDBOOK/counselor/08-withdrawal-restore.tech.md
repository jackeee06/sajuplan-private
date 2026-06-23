# [AI 전용] 탈퇴 상담사 복구 — 기술 상세

## 배경 (실제 사고 — 2026-06-23 이아린/조연제)
- 상담사(member 267, IARIN)가 탈퇴(`left_at` set) → 같은 전화로 재가입(member 273, IARIN87, role=user).
- 옛 계정 267은 탈퇴해도 `dtmfno=29 / csrid=20164 / m2net 등록`을 그대로 보유.
- 새 계정 273 승인 시도 → 승인 가드에 막힘. 둘 다 이력 0이라 **267 복구 + 273 정리**로 해결.

## 핵심 사실 (중요)
- **탈퇴(`withdrawMe`)는 `left_at = now()`만 찍는다.** m2net 등록을 절대 풀지 않음 (`api/src/user/auth/auth.service.ts` `withdrawMe`).
- → 탈퇴 상담사의 **csrid·dtmfno·m2net 라우팅은 살아있음**. 복구 시 `left_at`만 비우면 **재연동 없이 즉시 라우팅 정상**.
- dtmfno UNIQUE 인덱스 `ux_member_dtmfno_notnull` 은 `WHERE dtmfno IS NOT NULL AND dtmfno<>''` (탈퇴 여부 무시) → 탈퇴 계정도 dtmfno 점유 유지.

## 왜 새 계정 승인이 막히나 (승인 가드)
`api/src/admin/counselor-apply/counselor-apply.service.ts` `approve()`:
- `existingByPhone`: `WHERE phone = ? AND left_at IS NULL` → 활성 새 계정(273)을 찾음.
- 신청서 mb_id ≠ 활성 계정 mb_id → `ConflictException('같은 휴대폰으로 다른 아이디(...) 회원이 있습니다')`.
- 또는 옛 신청이 이미 `accepted` → `'이미 승인된 신청입니다'`.

## 복구 API
**`POST /admin/members/counselors/:id/restore`** (`members.controller.ts` → `members.service.ts restoreCounselor`)
- 대상이 `role='counselor'` 아니면 ConflictException. `left_at == null` 이면 `restored:false`(이미 활성).
- ① 같은 전화의 다른 활성 계정(`phone=? AND id<>? AND left_at IS NULL`) → `left_at=now()` (중복 정리, `retired_ids` 반환)
- ② 대상 `left_at = NULL` (복구)
- ③ m2net: `csrid` 있으면 그대로(재연동 안 함). **없을 때만** `linkCounselorToM2net(id)` 호출.
- 반환: `{ ok, restored, retired_ids[], m2net|null, message }`
- 전부 `left_at` 토글 → 되돌림 가능, 돈/식별자 변경 없음.

## 자동 감지 (승인 화면)
`counselor-apply.service.ts detail()` 응답에 `withdrawn_counselor` 추가:
```sql
SELECT id, mb_id, nickname FROM member
 WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g') = <신청전화digits>
   AND role='counselor' AND left_at IS NOT NULL
 ORDER BY id DESC LIMIT 1
```
- 있으면 프론트 `CounselorApplyDetail.tsx` 가 노란 배너 + "기존 계정 복구" 버튼 노출.
- 버튼: restore 호출 → 이 신청 `status='cancelled'` → 상담사 상세로 navigate.

## 코드 위치
| 구분 | 파일 |
|---|---|
| 복구 서비스/라우트 | `api/src/admin/members/members.{service,controller}.ts` (`restoreCounselor`) |
| 상세에 left_at 노출 | `members.service.ts getCounselorDetail` (SELECT `m.left_at`) |
| 자동감지 | `api/src/admin/counselor-apply/counselor-apply.service.ts detail()` (`withdrawn_counselor`) |
| 상담사 상세 복구 버튼 | `web/mng/src/pages/CounselorForm.tsx` (`leftAt` 배너) |
| 승인 화면 감지 배너 | `web/mng/src/pages/CounselorApplyDetail.tsx` |

## 함정
- 복구 시 m2net **재연동 호출하지 말 것**(csrid 있으면). 탈퇴가 등록을 안 풀어서 그대로 라우팅됨. 불필요한 재연동은 오히려 csrid 재발급 위험.
- 비번찾기는 `left_at IS NULL`만 조회 → 복구로 활성 계정이 하나만 남아야 정상 동작(중복 정리가 그래서 필요).
- 직접 SQL `left_at` 토글로도 가능하지만, 중복 정리·m2net 분기 때문에 **복구 API/버튼을 쓸 것**.

## 관련
- [상담사 신청 + 승인](counselor/01-apply)
- [듀얼 계정](member/04-dual-account)
- 메모리: 탈퇴→재가입 복구 정책 / m2net 미해제 사실
