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

## 서버 타임존 (KST 정렬 — 2026-06-17 교정)

PROD 서버(104.64.128.103)의 OS·DB·앱이 **모두 `Asia/Seoul` (KST +0900)** 로 정렬돼 있어야 정상.

**적용 지점 3곳 (이 셋이 전부 KST 여야 함):**
| 레이어 | 설정 위치 | 값 | 확인 명령 |
|---|---|---|---|
| OS | `/etc/localtime` → `/usr/share/zoneinfo/Asia/Seoul` | KST | `date '+%Z%z'` → `KST+0900` |
| PostgreSQL | `/etc/postgresql/18/main/postgresql.conf` **783줄 `timezone`**, **645줄 `log_timezone`** | `'Asia/Seoul'` | `SELECT current_setting('TIMEZONE'), now()` → `+09` |
| 앱(NestJS) | TZ 환경변수 **없음** → OS localtime 따라감 | (OS=KST) | `node -e "new Date().getTimezoneOffset()"` → `-540` |

**왜 중요한가 (날짜 경계):** `timestamptz` 저장값은 UTC 라 타임존 무관하게 안전. 단 `now()`·`CURRENT_DATE`·`date_trunc('month',CURRENT_DATE)`·node `new Date()` 는 **서버 로컬 타임존 기준** → 여기가 +08(중국)이면 한국보다 1시간 일찍 날짜가 넘어가 **오늘상담·이번달 정산 컷오프·출석 일1회 리셋이 전날·전월로 샘**. 명시적으로 `AT TIME ZONE 'Asia/Seoul'` 또는 `+09` 쓴 쿼리는 영향 없음(이미 정확).

**2026-06-17 교정 (옵션 B — OS+DB 통째 KST):**
1. `postgresql.conf` 783/645줄 `Asia/Shanghai` → `Asia/Seoul` (백업 `.bak_tz_20260617`)
2. `timedatectl set-timezone Asia/Seoul`
3. `systemctl restart postgresql@18-main postgresql.service` + `pm2 restart sajumoon-api`
4. 검증: `now()`=+09, node offset=-540, API health 200, `_verify_money_integrity.py` PASS
- 교정 전 상태: OS·DB 모두 `Asia/Shanghai (+0800)` (initdb 가 OS 기준으로 conf 에 박았던 잔재)
- NestJS `@Cron` 들은 코드에 `timeZone:'Asia/Seoul'` 명시돼 있어 교정과 무관하게 이미 정상. **OS crontab**(DB백업 03:30 등)만 +08→KST 로 이동(원래 의도대로 개선).

**진단 쿼리:** `SELECT current_setting('TIMEZONE'), now(), CURRENT_DATE` 가 `+08` 이면 사고 → 위 3곳 점검.

## 관련 메모리

- `[[prod-api-code-path]]`
- `[[deploy-env-substitution]]`
- `[[sajumoon-project-basics]]`
- `[[server-timezone-kst]]`
