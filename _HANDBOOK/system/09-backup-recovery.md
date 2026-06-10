# 백업 & 복구 가이드 (2026-06-07 확정)

> 이 문서는 "내가 까먹을 것 같아서" 만든 문서다. 사고가 생겼을 때 당황하지 말고 이 문서만 따라가면 된다.

---

## 현재 백업 구조 전체 한눈에

```
[사주플랜 서버 prod]
  ├── DB 백업: 매일 03:30 자동
  │     ├── 서버 로컬: /data/backup/db/ (7일 보관)
  │     └── 구글 드라이브: gdrive: (30일 보관) ← rclone 자동 업로드
  └── 업로드 파일: 매일 04:10 자동
        └── 서버 로컬: /data/backup/uploads/ (7일 보관)

[사장님 PC C:\claudeworkspace\sajumoon (소스코드)]
  ├── GitHub origin: github.com/inxight/sajumoon (개발자 공용)
  ├── GitHub mine:   github.com/jackeee06/sajuplan-private (사장님 전용 Private)
  │     └── 커밋할 때마다 두 곳 자동 push (post-commit hook)
  └── 로컬 폴더 복사: 매일 23:00 자동
        └── F:\backup\sajumoon\YYYY-MM-DD\ (10일 보관)
```

---

## DB 백업 상세

### 백업 파일 위치
- **서버**: `/data/backup/db/sajumoon_YYYYMMDD_HHMM.sql.gz`
- **구글 드라이브**: `gdrive:` 루트 (rclone 연동, jackeee06@gmail.com 계정)

### 보관 기간
| 위치 | 보관 기간 | 비고 |
|---|---|---|
| 서버 로컬 | **7일** | 오래된 것 자동 삭제 |
| 구글 드라이브 | **30일** | 오래된 것 자동 삭제 |

### 오늘 백업이 정상인지 확인하는 법 (서버 SSH)
```bash
tail -5 /var/log/sajumoon_db_backup.log
# "gdrive upload + retention done" 이 보이면 정상
```

---

## 소스코드 백업 상세

### GitHub 저장소 2개
| 저장소 | URL | 용도 | 공개여부 |
|---|---|---|---|
| origin | github.com/inxight/sajumoon | 개발자 공용 | Private |
| **mine** | **github.com/jackeee06/sajuplan-private** | **사장님 전용** | **Private** |

### 자동 push 동작
- **커밋할 때마다** 자동으로 origin + mine 두 곳에 동시 push됨
- `.git/hooks/post-commit` 스크립트로 구현 (2026-06-07 설치)
- 수동으로 push하려면:
  ```bash
  cd c:/claudeworkspace/sajumoon
  git push origin main
  git push mine main
  ```

### mine(사장님 저장소) 접속 정보
- URL: `https://github.com/jackeee06/sajuplan-private`
- 계정: `jackeee06@gmail.com`
- 토큰: `.git/config`에 URL에 포함되어 있음 (별도 관리 불필요)

---

## 로컬 PC 자동 백업 상세

### 설정 내용
| 항목 | 내용 |
|---|---|
| 실행 시각 | **매일 밤 23:00** |
| 백업 원본 | `C:\claudeworkspace\sajumoon\` |
| 백업 대상 | `F:\backup\sajumoon\YYYY-MM-DD\` |
| 보관 기간 | **10일** (자동 삭제) |
| 제외 폴더 | node_modules, .git, dist, dist2, dist3 |
| 로그 파일 | `C:\backup_scripts\sajumoon_backup.log` |
| 스크립트 위치 | `C:\backup_scripts\sajumoon_backup.ps1` |

### 백업 확인 방법
```
F:\backup\sajumoon\
  ├── 2026-06-07\   ← 오늘
  ├── 2026-06-06\   ← 어제
  ├── ...
  └── 2026-05-28\   ← 10일 전 (가장 오래된 것)
```

---

## 복구 시나리오별 대응

### 시나리오 1: DB 데이터가 이상해졌다 (오늘 자정 이후 사고)
**어제 새벽 3:30 백업으로 복구**
```bash
# 서버 SSH 접속 후
cd /data/backup/db/
ls -lt  # 날짜 확인

# 어제 백업으로 복구
gunzip -c sajumoon_20260606_0330.sql.gz | psql "postgresql://sajumoon:비번@127.0.0.1:5432/sajumoon"
```

### 시나리오 2: DB 사고를 며칠 뒤에 발견 (2~7일 전)
**구글 드라이브에서 해당 날짜 파일 다운로드**
1. `jackeee06@gmail.com` 구글 드라이브 접속
2. 루트에 `sajumoon_YYYYMMDD_HHMM.sql.gz` 파일들 있음
3. 원하는 날짜 다운로드 → 서버에 업로드 → 위 복구 명령 실행

### 시나리오 3: 소스코드가 망가졌다 (코드 실수)
**GitHub에서 이전 버전으로 되돌리기**
```bash
# 현재 PC에서
cd c:/claudeworkspace/sajumoon
git log --oneline -10  # 커밋 목록 확인
git checkout 커밋해시 -- 특정파일  # 특정 파일만 되돌리기
# 또는
git reset --hard 커밋해시  # 전체를 특정 시점으로 (주의!)
```

### 시나리오 4: PC가 바뀌었다 / 새 PC에서 작업 시작
```bash
# 1. Git 설치
# 2. 저장소 clone
git clone https://jackeee06:토큰@github.com/jackeee06/sajuplan-private.git sajumoon

# 3. 로컬 작업 환경 복원
cd sajumoon
npm install  # api, web/user, web/mng 각각

# 4. .env 파일 → 사장님이 보관 중인 것 복사
```
> `.env` 파일은 GitHub에 올라가지 않음. 별도 보관 필요 (아래 참고)

---

## ⚠️ GitHub에 올라가지 않는 중요 파일들 (별도 보관 필수)

| 파일 | 위치 | 내용 |
|---|---|---|
| `.env` | `api/.env` | DB 비번, JWT 시크릿, m2net 키, AG9 키 |
| `fcm-service-account.json` | `api/secrets/` | Firebase 푸시 서버 키 |

→ 이 파일들은 **로컬 백업(F:\backup\sajumoon\)에는 포함**되어 있음.
→ PC가 완전히 망가지면 서버 `/data/wwwroot/api.sajumoon.co.kr/.env`에서 복구 가능.

---

## 백업 시스템 담당자 연락처
- 서버: root@104.64.128.103 (비번: saju26moon@!!)
- GitHub mine: jackeee06@gmail.com
- 구글 드라이브: jackeee06@gmail.com
