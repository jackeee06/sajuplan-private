# 사주플랜 SEO / 마케팅 셋업 가이드 (2026-06-25)

웹 개방(2026-06-21) 후 검색·카톡 유입을 강력하게 끌어오기 위한 SEO 인프라.
**1~3·5단계는 구현·배포·검증 완료. 4단계(검색엔진 등록)만 사장님 계정 작업이 남음.**

---

## 무엇이 깔렸나 (완료)

사용자 사이트는 CSR SPA 라 원래 크롤러/카톡 스크래퍼가 **빈 로딩 화면**만 봤다.
이제 **dynamic rendering** 으로 봇에게만 풀 HTML 을 그려서 준다(사람은 기존 SPA 그대로 = 회귀 없음).

| 구성 | 내용 | 위치 |
|---|---|---|
| SEO 렌더 엔진 | 봇/스크래퍼 UA → 페이지별 `<title>`·`description`·**OG**·**JSON-LD**·본문 풀 HTML | `api/src/user/seo/` |
| 대상 페이지 | 메인 `/`, 상담사 목록 `/counselors`, **상담사 상세 `/counselors/:id`**, 공지 `/mypage/notices/:id`, 이벤트 `/mypage/events/:id` | — |
| nginx 봇 분기 | 봇 UA(`googlebot·yeti(네이버)·daumoa·bingbot·kakaotalk-scrap` 등)만 API 로 프록시, 사람은 SPA | `vhost/sajuplan.com.conf` |
| sitemap | `https://sajuplan.com/sitemap.xml` — 활성 상담사 전수 + 공개페이지 실시간 생성 | `/api/seo/sitemap.xml` |
| robots | 공개 허용 / `/mng`·`/api`·개인·내부파일 차단 + `Sitemap:` 줄 | `web/user/public/robots.txt` |

**검증 완료**: E2E `e2e/tests/114-seo-rendering.spec.ts` 6/6 통과. 봇=풀HTML, 사람=SPA, 카톡=OG카드, sitemap/robots 정상.

### 함께 켜진 마케팅 효과
- **네이버·구글 색인** — 봇이 알맹이를 받으므로 상담사 프로필이 검색에 노출 가능.
- **카톡 공유 카드** — 상담사 링크를 카톡에 보내면 사진·이름·소개가 카드로 뜬다(스크래퍼도 OG 받음).
- ⚠️ **별점은 일부러 안 넣음** — 현재 UI 가 별점 비노출 정책이라, 구조화 데이터에 별점을 넣으면 화면-데이터 불일치로 구글 패널티. UI 부활 시 그때 JSON-LD `AggregateRating` 추가.

---

## 4단계: 검색엔진 등록 (사장님 작업 — 한 번만)

색인이 실제로 일어나려면 사이트를 검색엔진 콘솔에 **소유권 등록 + sitemap 제출** 해야 한다.
계정 로그인이 필요해 제가 대신 못 누른다. 아래 순서로 진행 후 **소유권 파일(또는 코드)만 저에게 주시면 즉시 설치**합니다.

### A. 네이버 서치어드바이저 (한국 유입 1순위)
1. https://searchadvisor.naver.com → 네이버 로그인
2. **웹마스터도구 → 사이트 등록** → `https://sajuplan.com` 입력
3. **소유확인** 방법 = **HTML 파일 업로드** 선택 → `naverXXXXXX.html` 파일 다운로드
4. 그 파일을 **저에게 전달** → 제가 `sajuplan.com` 루트에 배치 → "확인" 클릭
5. 확인되면 **요청 → 사이트맵 제출** 에 `https://sajuplan.com/sitemap.xml` 입력
6. (선택) **요청 → 웹페이지 수집** 으로 메인·주요 상담사 URL 즉시 수집 요청

### B. 구글 서치콘솔
1. https://search.google.com/search-console → 구글 로그인
2. **속성 추가 → URL 접두어** → `https://sajuplan.com`
3. 소유확인 = **HTML 파일** → `googleXXXX.html` 다운로드 → **저에게 전달** → 루트 배치 → 확인
4. 좌측 **Sitemaps** → `sitemap.xml` 제출
5. (선택) **URL 검사** 에 상담사 상세 URL 넣고 "색인 생성 요청"

### C. (선택) 다음/빙
- 빙: https://www.bing.com/webmasters — 구글 서치콘솔 연동 import 가 가장 빠름.
- 다음(카카오)은 별도 등록 도구 없음. 네이버·구글로 충분.

> **소유권 파일(naverXXX.html / googleXXX.html)을 주시면** `python tools/_put_prod_file.py` 로 즉시 루트에 올립니다(코드 변경·재배포 불필요). 파일 대신 "메타태그 방식" 코드를 주셔도 home 렌더에 심어 드립니다.

---

## 색인은 시간이 걸린다 (기대치)
- 등록 즉시 뜨지 않음 — 구글 며칠, 네이버 1~2주가 보통.
- sitemap 제출 + URL 수집 요청으로 **가속**은 가능.
- 진행 상황은 서치콘솔/서치어드바이저의 "색인 현황(제출 N / 색인 M)" 에서 추적.

## 운영 메모
- 새 상담사 추가/탈퇴는 sitemap 에 **자동 반영**(요청 시마다 DB 실시간 생성, 30분 캐시).
- 다시 앱 전용으로 막아도 SEO 는 무관(봇 분기는 별개). 단 robots/sitemap 은 유지 권장.
- 렌더 캐시: 페이지 10분 / sitemap 30분(서버 메모리). 즉시 갱신 필요하면 pm2 reload.
- 되돌리기: `vhost/sajuplan.com.conf.bak.seo_20260625` 백업 존재 → 복원 후 `nginx -s reload`.
