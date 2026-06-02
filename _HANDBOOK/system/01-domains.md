# 사주플랜 도메인 (실제 운영 vs 테스트)

## 한 줄로 답하면
**실제 운영은 sajuplan.com (옛 sajumoon.co.kr 도 같이 살아있음). 테스트 환경은 sajumoon.kr 별도 서버. 셋 다 살아있어야 정상.**

## 도메인 매핑

| 환경 | 사용자 도메인 | API 도메인 | 용도 |
|---|---|---|---|
| **실제 운영** | sajuplan.com | api.sajuplan.com | 회원 실 사용 |
| **옛 브랜드** | sajumoon.co.kr | api.sajumoon.co.kr | 옛 도메인 호환 (같은 서비스) |
| **테스트** | sajumoon.kr | api.sajumoon.kr | 개발/QA 검증 |

## 이런 상황을 보셨나요?

### "회원이 sajumoon.co.kr 에서 접속해요"

→ 옛 브랜드 도메인. 사주플랜 (sajuplan.com) 과 같은 서비스. 정상.

### "새 기능 테스트는 어디서?"

→ sajumoon.kr (테스트 환경) 에서 검증 후 실제 운영 배포.

### "sajumoon.kr 끊으면 안 돼요?"

→ ❌ 절대 X. 테스트 환경 자체. 끊으면 신규 기능 검증 불가 + 외부 서비스 등록 (m2net push 등) 가 sajumoon.kr 가리킬 가능성 → 결제·정산 push 실패 위험.

## 이건 정상인가요? 에러인가요?

| 상황 | 답변 |
|---|---|
| sajuplan.com 접속 → 정상 서비스 | ✅ 정상 |
| sajumoon.co.kr 접속 → 같은 서비스 | ✅ 정상 (옛 도메인 호환) |
| sajumoon.kr 끊김 | ❌ 사고. 즉시 복구 |
| sajuplan.com 에 회원 못 가입 | ❌ critical 사고 |

## 관련 항목
- [배포 흐름](system/02-deploy)
- [외부 서비스 협의](system/06-external-vendors)
