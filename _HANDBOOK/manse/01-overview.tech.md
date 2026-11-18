# [AI 전용] 무료 만세력 — 기술 개요

## 정체

사주플랜과 **코드가 완전히 분리된 독립 제품**. 마케팅 유입 깔때기. 의존성 단방향(사주플랜 → 만세력 만 허용, 역방향 금지). 회원·코인·결제 DB 미접근.

## 위치 / 배포

| 항목 | 값 |
|---|---|
| 라이브 URL | `https://manse.sajuplan.com` |
| 소스 | 워크스페이스 `manse/` (사주플랜 `api`/`web` 밖) |
| DNS | 카페24, `*.sajuplan.com` 와일드카드 → 서브도메인 추가 작업 0 |
| 서버 | `104.64.128.103` (실 nginx 박스, OneinStack) |
| 웹루트 | `/data/wwwroot/manse` |
| nginx | `/usr/local/nginx/conf/vhost/manse.sajuplan.com.conf` (사주플랜 vhost 무수정, additive) |
| SSL | acme.sh LetsEncrypt |
| 배포툴 | `tools/_manse_deploy.py` (inspect/deep/deploy/upload). `nginx -t` 통과시만 reload+롤백. 재배포는 web 빌드 후 `upload` |

> ⚠️ 사주플랜 `_patch_frontend_fast.py` 와 **별개 배포 라인**.

## 모노레포 구조 (`manse/`, npm workspaces)

| 패키지 | 역할 |
|---|---|
| `packages/engine` | 계산 엔진 (순수 TS, 의존성 0). 절기 천문(Meeus)·년주입춘·월주절기·일주JDN·시주오서둔·십성·지장간·12운성·공망·대운·세운·월운·신살·격국·신강약·용신·합충형파해원진·12신살·음력·궁합 |
| `packages/api` | 무의존 node http 서비스. `POST /v1/manse`, API 키, CORS 임베드 |
| `packages/web` | Vite+React+Tailwind 적응형 프론트. 엔진 직접 번들(hybrid) |

## 엔진 진입점

```ts
import { computeManse, computeCompatibility, solarToLunar, monthDayPillars, monthSolarTerms } from "@manse/engine";
const chart = computeManse({ birth: "1990-06-15T07:20", gender: "M", longitude: 127.0 });
```

명식 출력 = 단일 JSON 스키마(`ManseChart`, types.ts). 엔진·API·웹·외부임베드가 공유.

## 검증

- 엔진 단위테스트: `cd manse && npm test` (vitest, 34/34 PASS)
- 시각 점검(육안): Playwright `e2e/_manse_shot.mjs`(전문가뷰)·`_manse_couple.mjs`(궁합)·`_manse_domain.mjs`(분야별 풀이)
- 정확도 핀: 일주 앵커(1949-10-01=甲子/1592-12-31=甲申), 음력(설날 2024/2025/2026·2000-01-01=음1999.11.25)

## 마케팅 두 청중

- **프로(상담사)**: 정확도가 무기 (일주검증·음력 천문계산·진태양시)
- **대중**: 해석·재미 (분야별 풀이·백분위 추정·궁합) — "참고" 라벨로 분리해 정확도 브랜드와 양립

## 관련
- `manse/02-engine-accuracy.tech.md` — 계산 알고리즘 상세
- 메모리 `project_manse_standalone`
