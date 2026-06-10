# [AI 전용] 배포 흐름 — 기술 상세

## 배포 종류

### 1. 일반 배포 (`deploy.sh`)
- **PROD 단일** (TEST 서버 2026-05-29 폐기)
- Vite 빌드 → rsync 또는 paramiko → 원격 적용
- `./deploy.sh both` 또는 `user` / `api`

### 2. 외과 배포 (`tools/_patch_*.py`)
- 변경 파일만 SFTP 직접 푸시
- 빌드 스킵 또는 부분 빌드
- 케이스:
  - md 파일만 변경
  - rsync hang (60초+) → 즉시 전환
  - 소수 파일 변경
  - Windows EBUSY 사고

### 3. 핵심 외과 도구
- `tools/_patch_api.py` — api 외과
- `tools/_patch_frontend.py` — web/user 또는 web/mng dist
- `tools/_patch_user_bundle.py` — user 번들 minimal
- `tools/_sync_handbook.py` — _HANDBOOK 동기화

## env 치환

빌드 결과 `index.html` 에 `__SAJUMOON_ENV__` placeholder → 배포 시 `prod` 또는 `test` 로 치환:
```bash
sed -i 's/__SAJUMOON_ENV__/prod/g' /data/wwwroot/sajumoon.co.kr/index.html
```

→ 누락 시 사고 (메모리 `[[deploy-env-substitution]]` 실 사고)

## 배포 락

`.deploy.lock` 디렉토리. 중단 시 잔재 → 1분+ "락 대기" 보이면 즉시 `rm -rf .deploy.lock` 후 재시도 (메모리 `[[deploy-stale-lock]]`).

## TEST 서버 (172.235.211.75) — ⚪ 폐기

2026-05-29 공식 폐기 결정. PROD 단일 운영. E2E TARGET 기본값 `prod` 로 변경 완료.

## 핵심 코드 위치

- `deploy.sh`, `deploy.config.sh`
- `tools/_patch_api.py`, `_patch_frontend.py`
- `tools/_sync_handbook.py` (운영 바이블 전용)

## CLAUDE.md 박제

- 모든 작업은 배포까지 한 세트
- 기본 **PROD 단일** (TEST 폐기 — 2026-05-29)
- 외과 배포 우선 조건: md / rsync hang / 소수 파일
- 결과 URL 항상 prod (sajuplan.com)

## 관련 메모리

- `[[deploy-env-substitution]]` (env 치환 누락 실 사고)
- `[[deploy-stale-lock]]` (락 잔재)
- `[[windows-tooling]]` (rsync 없는 환경)
- `[[deploy-surgical-rules]]` (외과 배포 규칙)
- `[[prod-api-code-path]]` (도메인 vs 경로 함정)
