# ⚠️ 변경 불가 인프라 항목 (INFRA LOCKED)

> Claude 작업 전 필독. 아래 항목은 실제 서버 인프라와 직결되어 있어
> 코드·설정에서 변경 시 운영 서비스 즉시 중단됩니다.

---

## 🔴 절대 변경 금지 항목

### 서버 경로 (실제 디렉토리)

| 용도 | 경로 | 이유 |
|---|---|---|
| API 코드 | `/data/wwwroot/api.sajumoon.co.kr` | nginx vhost · deploy.sh 기준 경로 |
| 사용자/어드민 프론트 | `/data/wwwroot/sajumoon.co.kr` | nginx vhost · deploy.sh 기준 경로 |
| DB 백업 | `/data/backup/db/` | cron 스크립트 하드코딩 |
| Uploads | `/data/wwwroot/api.sajumoon.co.kr/uploads/` | 파일 서빙 경로 |

> 경로를 바꾸려면 nginx vhost 재설정 + SSL 인증서 재발급 + 모든 deploy 스크립트 수정 필요.

---

### 도메인 (DNS + nginx 연결)

| 도메인 | 용도 | 변경 시 영향 |
|---|---|---|
| `sajuplan.com` | 사용자 프론트 (PROD 메인) | 실 사용자 접속 불가 |
| `api.sajuplan.com` | API (PROD) | 결제·채팅·인증 전부 중단 |
| `sajumoon.co.kr` | 사용자 프론트 (legacy 도메인) | 기존 북마크 사용자 차단 |
| `api.sajumoon.co.kr` | API (실제 서버 경로 기준 도메인) | nginx + deploy 스크립트 기준 |

> **코드 내 `api.sajumoon.co.kr` 문자열은 서버 경로이므로 표시 이름이 아님. 절대 삭제·변경 금지.**

---

### 배포 스크립트 내 하드코딩 경로

| 파일 | 참조 항목 |
|---|---|
| `tools/_patch_api.py` | `/data/wwwroot/api.sajumoon.co.kr` |
| `tools/_patch_frontend.py` | `/data/wwwroot/sajumoon.co.kr` |
| `tools/_patch_frontend_alt.py` | 동일 |
| `tools/deploy_sync.py` | 동일 |
| `tools/_setup_db_backup.py` | ENV_FILE, BACKUP_DIR |
| `tools/_setup_gdrive_backup.py` | 동일 |
| `api/src/shared/env/runtime-env.ts` | 도메인 → 환경 매핑 MAP |

---

### 외부 서비스 등록 URL

| 서비스 | 등록된 URL | 변경 시 영향 |
|---|---|---|
| m2net (통화/결제 PG) | `api.sajuplan.com` 콜백 | 결제·통화 push 전부 실패 |
| BizM (알림톡) | 발신프로필 도메인 | 알림톡 발송 중단 |
| 카카오 OAuth | redirect URI 화이트리스트 | 카카오 로그인 불가 |
| Google rclone | `/root/.config/rclone/rclone.conf` | Google Drive 백업 중단 |

---

## 🟡 변경 가능하지만 주의 필요

| 항목 | 조건 |
|---|---|
| GitHub repo 이름 (`sajumoon` → `sajuplan`) | remote URL 업데이트 필요 |
| 로컬 작업폴더명 (`sajumoon` → `sajuplan`) | VSCode 재시작 필요 |
| 어드민 UI 라벨 내 `sajumoon` 텍스트 | 기능 영향 없음, 표시만 |

---

## 📋 미래 인프라 전환 체크리스트 (지금은 보류)

TEST 환경을 `test.sajuplan.com`으로 전환하거나 서버 경로를 sajuplan으로 정리하려면 다음 전부 필요:

- [ ] nginx vhost 재설정 (`sajumoon.co.kr` → `sajuplan.com` 통합)
- [ ] DNS A 레코드 확인
- [ ] SSL 인증서 재발급 (Let's Encrypt)
- [ ] m2net 가맹점 콜백 URL 변경
- [ ] 카카오·네이버 OAuth redirect URI 변경
- [ ] BizM 발신프로필 도메인 변경
- [ ] `runtime-env.ts` MAP 수정 + 재빌드
- [ ] 모든 `tools/_*.py` 경로 문자열 일괄 수정
- [ ] `_setup_db_backup.py` ENV_FILE 경로 수정
- [ ] `rclone.conf` 갱신

> 작성: 2026-06-02 | 다음 검토: 정식 운영 후 m2net 협의 완료 시
