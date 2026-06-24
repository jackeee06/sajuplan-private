# [AI 전용] SEO 서버렌더 (dynamic rendering) — 기술 상세

## 배경 사실 (중요)
- **사용자 사이트는 SSR 아니고 순수 CSR SPA.** README/PROJECT_NOTES 의 "user=SSR" 은 **오기**.
  - `web/user/package.json` build = `vite build` (SSR 빌드 없음), 서버 엔트리 없음.
  - `web/user/index.html` = 빈 `<div id="root">` + 부트 스피너, 전 페이지 `<title>사주플랜</title>` 동일.
  - → 크롤러/카톡 스크래퍼는 알맹이 0. 네이버(Yeti)는 JS 미실행 → 색인 불가였음.

## 아키텍처 — UA 기반 dynamic rendering
봇 UA 요청만 nginx 가 API 의 렌더 엔드포인트로 프록시 → 풀 HTML 반환. 사람은 nginx try_files 로 기존 SPA(index.html).
**클로킹 아님**: 봇에게 주는 본문 = 사람이 SPA 에서 보는 공개 데이터와 동일(구글 dynamic rendering 가이드 준수).

```
봇/스크래퍼 → nginx(sajuplan.com) → [UA 매칭] → proxy → 127.0.0.1:3001 /api/seo/render (X-Original-Path 헤더)
사람        → nginx → try_files /index.html (SPA)
```

## API 코드 (`api/src/user/seo/`)
- `seo.controller.ts` — `@Controller('seo')`
  - `GET /api/seo/render` — 원 경로는 `req.headers['x-original-path']`(폴백 `?path=`). `res.status().type('text/html').send(html)`.
  - `GET /api/seo/sitemap.xml` — `application/xml` 반환.
- `seo.service.ts` — 라우팅(정규식 매칭)으로 페이지별 렌더. 기존 공개 서비스 재사용:
  - `UserCounselorsService.getDetail(id)` / `.list({tab:'all',limit})`
  - `UserNoticesService.detail(id)` / `.list()`, `UserEventsService.detail(id)` / `.list()`
  - 3 모듈에 `exports: [Service]` 추가해 주입 가능하게 함.
  - **sitemap 상담사는 전용 SQL 전수조회** — `SELECT id FROM member WHERE role='counselor' AND left_at IS NULL` (list() 는 `Math.min(50,...)` cap 이라 sitemap 부적합 + 매번 stuck-state UPDATE 부작용 회피). `@Inject(SQL)`.
  - 캐시: 렌더 10분 / sitemap 30분(서버 메모리 Map, TTL).
- 메타 생성: 페이지별 `<title>`·`description`·canonical·OG(og:type/title/description/url/image/site_name/locale)·twitter card·JSON-LD.
  - JSON-LD: 메인=WebSite+Organization, 목록=CollectionPage, 상담사=Person+BreadcrumbList, 공지/이벤트=Article.
  - **별점(AggregateRating) 미포함** — UI 비노출 정책(`counselors.service.ts` rating_avg 주석)과 구조화데이터 불일치 패널티 회피. UI 부활 시 추가.
  - 이미지 절대 URL: API 상대 `/uploads/...` → `${userSiteUrl}/uploads/...` (nginx 가 sajuplan.com 에서도 alias 서빙).
  - 본문 HTML: `sanitizeBlock`(script/style/on이벤트/javascript: 제거). JSON-LD 는 `jsonLdSafe`(`<>&` 이스케이프, `</script>` 주입 방지).
- 배포: `_patch_api.py` FILES 에 6개 추가(seo 3 + counselors/notices/events module). pm2 `sajumoon-api`, 경로 `/data/wwwroot/api.sajumoon.co.kr`.

## nginx (`/usr/local/nginx/conf/vhost/sajuplan.com.conf`)
기존 coupon-og 패턴(`error_page 418 = @handler; if(UA) return 418`) 확장. **백업**: `*.bak.seo_20260625`.
```nginx
location = /sitemap.xml { proxy_pass http://127.0.0.1:3001/api/seo/sitemap.xml; ... }
location = / { error_page 418=@seo_render; if($http_user_agent ~* "<UA>") {return 418;} try_files /index.html =404; }
location = /counselors { ... 동일 ... }
location ~ ^/counselors/[0-9]+$ { ... }
location ~ ^/mypage/(notices|events)/[0-9]+$ { ... }
location @seo_render {
  proxy_set_header X-Original-Path $request_uri;
  rewrite ^ /api/seo/render break;   # named location 은 proxy_pass URI 금지 → rewrite+break
  proxy_pass http://127.0.0.1:3001;
}
```
- **봇 UA 정규식**: `googlebot|googleother|google-inspectiontool|bingbot|yeti|daumoa|yandexbot|baiduspider|duckduckbot|applebot|facebookexternalhit|twitterbot|kakaotalk-scrap|slackbot|telegrambot|whatsapp|slurp|petalbot`.
  - ⚠️ 네이버=`naver` 아닌 **`yeti`**(크롤러), 다음/카카오=`daumoa` 만. 바로 `naver`/`daum` 넣으면 **네이버앱/다음앱 인앱 브라우저 실사용자**가 정적 HTML 받아 앱 깨짐 → 절대 금지.
  - 카카오 스크래퍼=`kakaotalk-scrap`(공유 스크래퍼)만. 카톡 인앱 브라우저(`KAKAOTALK`)는 사람이라 제외.
- 함정: `@seo_render`(named) 와 정규식 location 은 **proxy_pass 에 URI part 금지** → `rewrite ^ /api/seo/render break;` 로 우회. `$request_uri` 는 rewrite 후에도 원본 유지.
- 적용 절차: 바이트 단위 앵커 앞 삽입(전체 재작성 X — 기존 비-UTF8 주석 바이트 보존) → `nginx -t` 통과 시에만 `nginx -s reload`, 실패 시 백업 복원.

## robots / sitemap
- `web/user/public/robots.txt` (+ prod 루트 `_put_prod_file.py` 배포). 공개 허용 + `/mng`·`/api`·`/uploads`·개인·내부파일 Disallow + `Sitemap: https://sajuplan.com/sitemap.xml`.
- sitemap = `/api/seo/sitemap.xml`(nginx `location = /sitemap.xml` 프록시). 정적 페이지 3 + 상담사 전수 + 공지/이벤트(서비스 list 50 cap).

## 검증
- `e2e/tests/114-seo-rendering.spec.ts` 6/6 — 봇=풀HTML(title/desc/og/canonical/jsonld/h1, sjm-boot 없음), 사람=SPA(id=root, og 없음), 카톡=og, 메인/목록 렌더, sitemap XML+상담사URL, robots Sitemap 줄.
- 실측: `curl -H 'User-Agent: Googlebot'` vs iPhone Safari UA 분기 정상.

## 미완 (사장님 계정 작업)
- 4단계 검색엔진 등록: 네이버 서치어드바이저 + 구글 서치콘솔 소유권확인(HTML 파일) → sitemap 제출. 소유권 파일 받으면 `_put_prod_file.py` 로 루트 배치(코드 변경 X). 가이드 `_SEO_SETUP_GUIDE.md`.

## 관련 메모리
- `[[project-seo-dynamic-rendering]]`
- `[[project-webview-stale-cache-kakao]]` (카톡 공유/캐시 맥락)
- `[[reference-deploy-windows-gotchas]]`
