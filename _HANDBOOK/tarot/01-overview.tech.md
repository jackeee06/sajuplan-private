# [AI 전용] 라이브 타로보드 — 기술 개요

## 정체

사주플랜과 **코드가 완전히 분리된 독립 제품**. 만세력과 동일한 모노레포 구조(`tarot/`). 의존성 단방향(사주플랜 → 타로만 허용, 역방향 금지). 회원·코인·결제 DB 미접근.

## 위치 / 배포

| 항목 | 마케팅 | 라이브 상담 |
|---|---|---|
| URL | `https://tarot.sajuplan.com` | `https://tarotroom.sajuplan.com` |
| 소스 | `tarot/packages/web/` | 동일 빌드 + `tarot/packages/api/` |
| 웹루트 | `/data/wwwroot/tarot` | 동일 webroot |
| nginx vhost | `tarot.sajuplan.com.conf` (공개) | `tarotroom.sajuplan.com.conf` (noindex, /ws /api/tarot 프록시) |
| API 서비스 | 없음 | pm2 `tarot-api` :8790 |
| SSL | acme.sh LetsEncrypt | 동일 |
| 배포툴 | `python tools/_tarot_deploy.py upload` | `python tools/_tarot_room_deploy.py {api\|vhost\|all}` |

> **hostname 분기** — App.tsx: `window.location.hostname.startsWith('tarotroom')` → 라이브 모드, 아니면 마케팅.

## 모노레포 구조 (`tarot/`)

```
tarot/
  packages/
    engine/  @tarot/engine  — 순수 함수(덱·스프레드·셔플·reducer). 의존성 0. vitest 14/14.
    api/     @tarot/api     — WebSocket 방코드 페어링·중계. esbuild CJS 번들. pm2 상시구동.
    web/     @tarot/web     — React 보드 UI. Vite+Tailwind. 60KB(gzip).
  scripts/
    fetch-cards.mjs   — RWS 78장 위키미디어 다운로드+sharp WebP 변환
    make-back.mjs     — 카드 뒷면 SVG→back.webp 생성
```

## 엔진 (@tarot/engine)

- `deck.ts` — 78장 데이터(id·이름·원소·정/역 키워드+한줄+상세+도메인별+상담질문)
- `spreads.ts` — 스프레드 6종(positions 좌표 데이터, 코드는 그대로 렌더)
- `session.ts` — 순수 reducer. `TarotPhase`: lobby→shuffle→spread→picking→revealing→done
- `draw.ts` — `shuffleDeck(seed)` Fisher-Yates + mulberry32 RNG(시드 결정론, 양쪽 동일 보장)
- `rng.ts` — xmur3+mulberry32 시드 기반 RNG

## 실시간 동기화 (@tarot/api)

- HTTP: `POST /api/tarot/rooms` `{ session? }` → `{ code }`
  - `session` 없으면 랜덤 4자리 코드
  - `session` 있으면 같은 session → 자동 같은 방(코드 불필요, 앱 연동 핵심)
- WS: `/ws?code=1234&role=counselor|member`
  - 접속 즉시 전체 스냅샷(`sync`) 수신(재접속 복구)
  - 이후 이벤트 broadcast(서버가 reduce로 권위 상태 유지)
- **이벤트 목록**: `spread.set` `three.set` `reversed.toggle` `shuffle` `spread.lay` `picking.start` `card.pick` `card.reveal` `card.revealAll` `reset` `sync`
- ⚠️ **api 번들은 CJS 필수** — `npm run bundle -w @tarot/api` → `dist/server.bundle.cjs`. ESM으로 번들하면 ws의 "Dynamic require of events" 에러로 즉사.

## Transport 패턴

```ts
interface TarotTransport { send(ev): void; subscribe(handler): () => void }
// 마케팅 솔로: LocalTransport (즉시 루프백, 네트워크 0)
// 라이브 상담: LiveTransport (WebSocket, 재연결 최대 6회)
```

## 역할 분리 (BoardRole)

| | solo | counselor | member |
|---|---|---|---|
| 배열 선택·셔플 | ✅ | ✅ | ❌ (화면 보기만) |
| 멈추기 | ✅ | ✅ | ❌ → "준비되면 말씀해주세요" |
| 카드 픽 | ✅ | ❌ (지켜봄) | ✅ |
| 카드 공개 탭 | ✅ | ✅ | ❌ (보기만) |
| 의미 상세 패널 | ✅ | ✅ | ❌ (카드 이름만) |
| 다음 리딩 버튼 | ✅ | ✅ | ❌ |

## 카드 데이터 구조

```ts
interface TarotMeaning {
  keywords: string[];  // 3~5개
  line: string;         // 한 줄(고객용 맛보기)
  detail?: string;      // 2~3문장 상세(상담사용)
  domains?: { love?; work?; money?; health? };  // 분야별(상담사용)
  questions?: string[]; // 상담 질문 2개(상담사용)
}
interface TarotCard {
  element: '불'|'물'|'공기'|'흙'|'영혼';
  upright: TarotMeaning;
  reversed: TarotMeaning;
  // ...
}
```

- 메이저 22장: 정/역 모두 detail+domains+questions 완전 작성
- 마이너 56장: domains+questions 수트별 작성, 수트 원소 자동 할당

## 이미지 자산

- 카드 앞면: `tarot/packages/web/public/tarot/<id>.webp` (RWS 퍼블릭 도메인, 420px, sharp WebP q74)
- 카드 뒷면: `back.webp` — CSS `url('/tarot/back.webp?v=N')`. 변경 시 `?v=` 올려 캐시 버스트.
- 뒷면 재생성: `node tarot/scripts/make-back.mjs`

## nginx tarotroom vhost 핵심

```nginx
location /api/tarot/ { proxy_pass http://127.0.0.1:8790; }
location /ws {
  proxy_pass http://127.0.0.1:8790;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;
}
add_header X-Robots-Tag "noindex, nofollow" always;
```

## 다음 세션 남은 작업

1. **앱 재빌드** — mobile/ 전화상담 화면에 "타로 열기" 버튼 추가. URL: `tarotroom.sajuplan.com?role=counselor&session=CONSULT_ID&mName=고객명`
2. **마케팅 결과화면** — 타로 결과 카톡 공유 OG 카드, 상담 유도(은은하게)
3. **E2E spec 공식화** — `e2e/tests/NN-tarot-board.spec.ts` 정식 등록
4. **상담사 앱 진입** — 앱이 세션ID+고객명 파라미터 붙여서 자동 연결(코드 입력 불필요)
