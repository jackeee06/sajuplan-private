# [AI 전용] 도메인 매핑 — 기술 상세

## 환경별 매핑

| 환경 | 도메인 | 서버 IP | 코드 경로 |
|---|---|---|---|
| PROD | sajuplan.com | 104.64.128.103 | /data/wwwroot/sajumoon.co.kr |
| PROD (legacy) | sajumoon.co.kr | 104.64.128.103 (동일) | /data/wwwroot/sajumoon.co.kr |
| PROD API | api.sajuplan.com / api.sajumoon.co.kr | 104.64.128.103 | /data/wwwroot/api.sajumoon.co.kr |
| ~~TEST (폐기)~~ | ~~sajumoon.kr~~ | ~~172.235.211.75~~ | ~~/data/wwwroot/sajumoon.kr~~ |
| ~~TEST API (폐기)~~ | ~~api.sajumoon.kr~~ | ~~172.235.211.75~~ | ~~/data/wwwroot/api.sajumoon.kr~~ |

## ⚠️ 함정 (메모리 `[[prod-api-code-path]]`)

prod 도메인 = `api.sajuplan.com` 인데 실제 코드 경로 = `/data/wwwroot/api.sajumoon.co.kr`. 자주 헷갈림.

## 환경 분기 코드

`api/src/shared/env/runtime-env.ts` 의 MAP — 도메인 → 환경 (prod/test) → API URL 매핑.

프론트 빌드 시 `__SAJUMOON_ENV__` placeholder → 배포 시 sed 치환 (`prod` 또는 `test`).

→ 치환 누락 시 prod 가 test API 호출 사고 (메모리 `[[deploy-env-substitution]]` 실 사고)

## TEST 환경 의존성

> **⚠️ 2026-05-29 폐기 결정** — TEST 서버(sajumoon.kr / 172.235.211.75) 공식 폐기. PROD 단일 운영.

과거 의존성 (현재는 비활성):
- `runtime-env.ts` MAP 에 sajumoon.kr 매핑 코드 잔존 (동작 무방, 실 트래픽 없음)
- `deploy.config.sh` test 분기 코드 잔존 (사용 안 함)
- E2E TARGET 기본값 `prod` 로 변경 완료 (커밋 `097d67a6`)

## 미래 정리 계획 (보류)

장기적으로 test 환경을 `test.sajuplan.com` 로 마이그레이션 검토 가능. 단:
- DNS A 레코드 + SSL
- m2net 가맹점 등록 URL
- 카카오/네이버 OAuth redirect URI
- 알리고/BizM 발신자 도메인 인증
- runtime-env.ts MAP + 재배포

→ 현 단계는 안정성 우선 유지

## 관련 메모리

- `[[prod-api-code-path]]`
- `[[deploy-env-substitution]]`
- `[[sajumoon-project-basics]]`
