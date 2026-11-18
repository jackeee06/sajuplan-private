# [AI 전용] 전화타로 라이브 상담 — 기술 상세

## URL 파라미터 스펙

| 파라미터 | 설명 | 예시 |
|---|---|---|
| `role` | `counselor` 또는 `member` | `?role=counselor` |
| `session` | 상담 고유 ID (같으면 자동 같은 방) | `?session=consult-123` |
| `cName` | 상담사 이름 (고객 화면 상단 표시) | `?cName=라온선생` |
| `mName` | 고객 이름 (상담사 화면 상단 표시) | `?mName=홍길동` |
| `code` | 수동 방코드 (하위호환·테스트용) | `?code=1234` |
| `live=1` | 강제 라이브 모드 (hostname 무관) | `?live=1` |

## 세션 자동 매칭 로직 (api/src/server.ts)

```ts
POST /api/tarot/rooms { session?: string }
// session 없음 → genCode() 랜덤 4자리 → 새 방
// session 있음 → sessionToCode.get(session) 조회
//   있으면: 기존 방 반환(같은 session = 같은 방)
//   없으면: createRoom() → sessionToCode.set(session, code)
```

## 고객 자동 연결 로직 (LiveApp.tsx)

```ts
useEffect(() => {
  if (session && !code) {
    getOrCreateRoom(session) // POST /api/tarot/rooms { session }
      .then(c => { setCode(c); setJoined(true); }) // 자동 입장
  }
}, [session, code]);
```

## 앱 진입 — 홈 "타로상담" 스마트 버튼 (무코드 자동 페어링, 2026-06-26 ✅웹 배포)

**핵심**: 코드 입력 없음. 진행 중 타로 통화의 **consultation 매칭(서버)** 으로 양쪽에 같은 `session`을 내줘 자동 연결. 앱 재빌드 불필요(전부 web/user).

- **홈 슬림바 2분할**(`web/user/src/pages/Home.tsx`): 왼쪽 `무료 만세력`(외부 manse) / 오른쪽 `타로상담`(스마트).
- **스마트 동작**(`handleTarotClick`): 탭 시 `GET /api/user/consult/tarot-session` 호출
  - `active:true` → `openExternalUrl('https://tarotroom.sajuplan.com/?role=&session=&cName/mName=')` 로 **보드 즉시 입장**(role·상대이름은 서버가 매칭으로 판별).
  - `active:false` → 앱 내 설명 페이지 `/tarot-intro`(`TarotIntro.tsx`, 이미지+텍스트 안내 + "타로 상담사 보러가기" CTA).
- **설명 페이지 CTA 2종**(`TarotIntro.tsx` 하단): "타로 상담사 보러가기" → `/counselors?category=타로`(CounselorList가 URL `?category=` 읽어 타로 탭 자동선택) + "무료 타로 체험하러가기" → `openExternalUrl('https://tarot.sajuplan.com/')`(무료 솔로 타로).
- **진행 중 강조**: 홈 마운트 + `visibilitychange`(앱 복귀 순간)마다 `tarotSession()` 조회 → 진행 중이면 오른쪽 버튼이 **핑크 풀배경 + `animate-ping` 비콘 + "타로 상담 입장"** 으로 변신. 당황한 고객이 익숙한 이 버튼만 눌러도 보드로 들어가는 게 설계 의도.
- **백엔드**(`api/src/user/consult/consult.service.ts > getTarotSession` + controller `GET tarot-session`): 진행 중 전화 타로 판별 = `consultation roomid IS NULL AND ended_at IS NULL AND started_at>now()-60m AND counselor_category='타로' AND (counselor_id=me OR member_id=me) AND 같은 callid 종료행 없음`(좀비 CONNECT_CSR 방어). `session='call-'+callid`(양쪽 동일행 → 동일 callid → 동일 방). role은 counselor_id===me 판별.

> `code` 4자리 수동 페어링은 **하위호환·테스트 폴백**으로만 유지. 정식 진입은 위 무코드 경로.
> 보조 진입(선택): 상담사 마이페이지 / 고객 상담사 상세 하단바에도 같은 버튼을 둘 수 있음(현재는 홈 버튼이 양 모드 공통 1차 진입).

## 상태머신 전이 (session.ts)

```
lobby → (shuffle 이벤트) → shuffle
shuffle → (spread.lay 이벤트) → spread
spread → (card.pick, picks.length > 0) → picking
picking → (picks.length === need) → revealing
revealing → (모든 슬롯 pick됨 + 전부 revealed) → done
any → (reset) → lobby
```

## 역할별 UI 분기 핵심 코드

```tsx
// TarotBoard.tsx
const isCounselor = role === 'counselor';
const isMember = role === 'member';

// 멈추기: 고객엔 안내문만
{isMember
  ? <p>준비되시면 상담사에게 말씀해주세요</p>
  : <button onClick={() => send({ t: 'spread.lay' })}>멈추기</button>
}

// 공개: 상담사만 탭 가능
<SpreadView
  revealing={!done && !isMember}  // 고객은 탭 불가
  onReveal={(slot) => send({ t: 'card.reveal', slot })}
/>

// 결과: 상담사=상세 패널, 고객=간결
{isCounselor || isSolo
  ? <CounselorMeaningPanel />   // 상세(설명+분야+질문)
  : <MemberSimplePanel />       // 카드 이름만
}
```

## 상담사 교육 가이드 — "전화타로 상담 사용법" (2026-06-26)

- **위치**: 상담사 마이페이지(`CounselorMyPage.tsx`) 메뉴 그리드 아래(메모장 밑) 전폭 핑크 버튼 "🔮 전화타로 상담 사용법". ⚠️ **`openExternalUrl` 아님** — `window.location.href='/tarot-guide.html'`(앱 WebView 안에서 same-origin 이동). 외부 브라우저로 열면 로그인 쿠키가 없어 게이트에 막히므로 반드시 인앱 이동.
- **🔒 상담사 전용 게이트**: 정적 HTML이라 URL만 알면 누구나 보던 문제 → 페이지 로드 시 `fetch('https://api.sajuplan.com/api/user/auth/me',{credentials:'include'})`(크로스도메인 쿠키) 로 본인 확인. **`role==='counselor'` 면 본문 표시, 아니면(비로그인 401·회원) "상담사 전용" 차단**. 쿠키 기반 인증이라 외부 브라우저(URL 공유)엔 쿠키 없음 → 자동 차단.
- **가이드 페이지**: `/data/wwwroot/sajumoon.co.kr/tarot-guide.html`(self-contained, noindex). `#content`는 기본 `display:none`, 게이트 통과해야 표시. 상단 `‹ 뒤로`(`history.back()`). 실제 보드 단계별 캡처(상담사 ↔ 고객 나란히) + 주석: 🖐상담사 할 일(버튼)/🎙멘트/🙋고객 화면. 진입(홈 "타로 상담 입장") + 4단계.
- **재생성**: `e2e/_guide.mjs`(라이브 보드 캡처 + 게이트 래퍼 생성) → `tools/_put_prod_file.py root@104.64.128.103 e2e/tarot-guide.html /data/wwwroot/sajumoon.co.kr/tarot-guide.html`.
- E2E: `120-tarot-entry.spec.ts` U-5(비로그인 차단)·U-5b(상담사=본문/회원=차단 mock)·U-6(마이페이지 버튼).

## 공용 상태배너 — 모든 작업지시/안내 통일 (board/StatusBanner.tsx, 2026-06-26)

- **반짝 핑 비콘 = "지금 할 일" 이정표.** 상담사·솔로·고객의 **모든** 대기/행동요청 안내가 이 한 줄(`StatusBanner`)로 통일. 기존 `CounselorAction`(큰 세로 스택+노란 amber 박스)·`LiveStatus`(●●●) 컴포넌트 **삭제**.
- `StatusBanner({tone, icon, head, sub})` = `flex w-full items-center gap-3 rounded-2xl px-4 py-3` + 좌측 `PingBeacon` + 우측 head(16px extrabold)/sub(12px).
  - `PingBeacon` = `h-11 w-11` 안에 accent-300 `animate-ping` 파동 + accent-500 원(`h-9`)에 아이콘. accent-200 미정의 → 파동 300.
  - `tone:'wait'` → 회색(`bg-gray-50 ring-gray-100`, 회색 글자) = 기다림/지켜봄. `tone:'do'` → 연핑크(`bg-accent-50 ring-accent-300`, head `text-accent-600`/sub `text-accent-500`) = 지금 행동(저압식, 큰 핑크블록 없음).
- TarotBoard 적용처(모두 StatusBanner): 로비(상담사 do·솔로 do)·셔플(상담사 do·솔로 wait)·픽(상담사 wait·솔로 do)·공개(do "탭해서 공개")·완료(do "전화로 해설"). 노란 강조박스 3개는 작은 회색 헬퍼(`text-[12px] text-gray-400`)로 강등. 실제 버튼(섞기/멈추기/공개/다음)은 버튼 유지.
- `MemberStatusBanner`는 `StatusBanner`의 얇은 래퍼(phase→tone/icon/head/sub). 대기=wait, 픽=do. 로비 미리보기: `isMember`면 그리드 위 "상담사가 고를 배열 미리보기" 캡션 + 미선택 타일 `opacity-40`. member 인라인 안내·흐린 가짜버튼·포지션칩·역방향 체크박스는 member 화면에서 제거(상단 배너가 대체).
- E2E: `e2e/tests/119-tarot-board.spec.ts` — 고객 입장 후 상담사 WS로 단계 진행 → 배너 전이(대기→셔플→do) + `bg-accent-50` 클래스 단언.

## "다음 리딩" 리셋 — 실수 방지 확인 모달 (board/TarotBoard.tsx, 2026-06-26)

- "다음 리딩"(`reset` 이벤트)은 현재 카드·풀이를 통째로 날리고 lobby로 → 상담 통화 중 실수 탭 치명적.
- **상담사**: 버튼 클릭 → 즉시 reset 안 보내고 `confirmReset` state로 **화면 중앙 큰 모달**(🔄 "정말 새로 뽑을까요?" + "지금 펼친 카드와 풀이가 모두 사라지고 처음으로 돌아갑니다" + [취소]/[네, 새로 뽑기]). 확인 눌러야 `send({t:'reset'})`. 배경 탭=취소.
- **솔로**(마케팅): 가벼운 자가 플레이 → 확인 없이 즉시 reset(빠른 재뽑기). `isCounselor ? setConfirmReset(true) : send(reset)`.
- E2E: `119-tarot-board.spec.ts` "다음 리딩 확인 모달" — 취소=리딩 보존, 확인=lobby 리셋 단언.

## 역할별 결과 패널 분리 — 솔로는 맛보기만 (2026-06-26)

⚠️ **상담사 화면(`CounselorMeaningPanel`)은 절대 건드리지 않음.** 솔로(무료)만 따로 뺐다.
- 이전엔 `isCounselor || isSolo` 가 같이 상담사 풀 패널(상세설명+분야별4+상담질문)을 봤음 → 무료가 유료 풀이를 다 줘버려 상담 전환 저해.
- 분리: `isCounselor` → `CounselorMeaningPanel`(전체, 불변) / `isSolo` → **`SoloResult`(맛보기: 카드명 + 정/역 + `meaning.line` 한 줄만 + 은은한 유도 "더 깊은 풀이는 전화타로 상담사와 →" → `sajuplan.com/counselors?category=타로`)** / 고객 → 기존 간결.
- 공개/완료 헤더 배너도 분리: 상담사 = "카드를 탭해서 한 장씩 공개하세요"/"전화로 해설해 주세요"(불변), **솔로 = "카드를 탭해 펼쳐 보세요"(공개) / 완료 단계 배너 없음**(상담사·전화 문구 제거). "아래 정보는 상담사 화면에만"도 `isCounselor`만.
- 원칙: 무료=맛보기·노골 CTA 금지([[project_no_ai_saju_analysis]]). 솔로는 tarot 패키지(앱 의존성0)라 유도는 절대URL `<a href>`.

## 상담사 의미 패널 — 곁눈질 가독성 (board/TarotBoard.tsx CounselorMeaningPanel, 2026-06-26)

- 상담사·솔로 전용. 전화하며 곁눈질로 읽는 "커닝페이퍼"라 **글자를 크게**(작으면 읽기에 집중하느라 자기 해석을 놓침).
- 본문 사이즈: 카드명 19px, 키워드 14px, 카드 설명(detail) 16px/leading-relaxed, 분야별 의미(love/work/money/health) 14px·라벨 12px, 상담 질문(읽어주는 문장) 16px. 여백도 확대(p-2.5, py-3, mx-3.5). **재축소 금지**(가독성 의도).

## 카드 공개 연출 — 과한 액션 (board/Card3D.tsx + index.css, 2026-06-26)

- 카드 `revealed` false→true **순간에만** 1회 버스트(재접속 시 이미 공개된 카드엔 안 터짐 — `prevFlipped` ref 게이트, 850ms 후 자동 정리).
- 3겹 효과: `reveal-pop`(카드 scale 1→1.18→1) + `reveal-ring`(금빛 amber 링 scale 0.55→1.7 fade) + `reveal-spark`(✨ 6개가 `--dx/--dy`로 사방 비산). CSS 키프레임 `revealPop/revealRing/revealSpark`(index.css).
- 상담사·솔로·고객 **모든 화면**에서 동일 발화(상담사가 탭→고객 reveal 동기화 시 양쪽 버스트). 픽 시 `PickFlash` 숫자와 합쳐져 더 풍성.

## PickFlash 구현 (board/PickFlash.tsx)

- `state.picks.length` 변경 시 `key` 증가 → CSS animation 재트리거
- `isDone = count >= total` → "✓ 완료!" 표시
- CSS: `pickFlash` (0.75s, scale 0.3→1.4→1→1.8 + opacity 0→1→1→0)
- 크기: 숫자 400px, 완료 340px (화면 꽉 채우는 임팩트)

## pm2 상시구동 (tarot-api)

```bash
# 배포
npm run bundle -w @tarot/api  # → dist/server.bundle.cjs (CJS 필수!)
python tools/_tarot_room_deploy.py api

# 서버 상태 확인
pm2 describe tarot-api
curl http://127.0.0.1:8790/api/tarot/health

# 로그
pm2 logs tarot-api --lines 20
```

> ⚠️ ESM 번들(`server.bundle.mjs`) 금지 — ws가 CJS `require`를 쓰므로 즉사.
