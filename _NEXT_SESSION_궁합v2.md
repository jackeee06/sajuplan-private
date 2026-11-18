# 다음 세션 핸드오프 — 궁합 v2 (경쟁사 상위호환 업그레이드)

> ✅ **완료·라이브 (2026-06-28)** — 이 핸드오프는 소비됨. 재트리거 불필요.
> 구현물: `portal/packages/web/src/lib/coupleEngine.ts`(buildCoupleFortune=만세 computeCompatibility+룰) + `components/couple/CoupleView.tsx` 전면교체(종합/겉·속궁합·합충근거칩·오행상보·신살케미·분야별4·관계 타임라인·갈등팁·행운숫자/공유·상담CTA). E2E 121 P-6 v2확장 19/19 통과, 바이블 _HANDBOOK/portal 현행화. 상세는 메모리 `project_unse_portal`.
> 남은 후순위: 데일리 "오늘의 케미" 리텐션, OG 서버 공유카드.

> **트리거**: 사장님이 "궁합 v2 해줘" / "궁합 풍성하게" 라고 하면 이 문서 먼저 읽고 바로 구현 착수.
> 작성: 2026-06-28. 운세 포털(unse.sajuplan.com) 궁합 화면을 경쟁사 상위호환으로.

---

## 0. 현재 상태 (왜 하는가)
- 지금 궁합(`portal/packages/web/src/components/couple/CoupleView.tsx`)은 **포털 시드 텍스트 함수**(`@portal/engine compatibility(birthA,birthB)`)를 씀 → 점수 1개 + 두 줄. 사장님 "부끄럽도록 간단".
- **오늘의 운세를 만세 엔진에 연결했던 것과 똑같은 상황** → 만세 엔진으로 갈아끼우면 경쟁사 상위호환.

## 1. 🔑 결정적 사실 — 계산은 새로 안 해도 됨 (작업 90%가 UI+룰텍스트)
만세 엔진에 이미 있음 (`@manse/engine`, Vite alias로 포털 결합 완료):
- **`computeCompatibility(inputA, inputB)`** → `{ a: ManseChart, b: ManseChart, compat: Compatibility }`
- `Compatibility = { score:0~100, level:"천생연분/좋은 궁합/무난/노력필요", factors: CompatFactor[] }`
- `factors`는 이미 **점수 근거**를 담음: `일간 관계 — 상대에게 정재(+8)`, `일지 육합 — 천생연분 기운(+15)`, `일지 충 — 마찰 주의(-12)`, `오행 상호보완` 등 (analysis.ts `compatibilityScore`)
- 각 `ManseChart`엔 오행분포·신살 20종·일주동물·십성·일지 다 있음.
- ⚠️ computeManse는 음력 직접입력 막음 → `lunarToSolar` 변환 후 넣기(이미 dailyEngine.ts `lunarToSolarDate` 있음). 입력은 공통 `MyInfoBar`(나) + 상대 생일.

## 2. 경쟁사 공부 결과 (10곳, 2026-06-28 조사 — 확인/추정 혼재)
**메타**: 신한라이프·NH농협·우리은행 = 전부 **신비운 화이트라벨**(같은 결과). 대부분 폼·결제 게이트(무료=맛보기, 깊은 건 유료 9,900/1,500원). → 우리는 과금 대신 **상담 유도**로 치환.

**경쟁사 궁합 = 공통 결과 구조(합집합)** ↔ 우리 엔진 보유여부:
| 섹션 | 잘하는 곳 | 우리 보유 |
|---|---|---|
| 두 사람 명식 나란히(일간·오행·띠) | 포스텔러 프로·척척 | ✅ |
| 종합 점수 + 레벨 | 전부 | ✅ compat.score/level |
| 겉궁합(띠)·속궁합(일주/사주) 구분 | 우리궁합·신운세·척척 | ✅ 연지/일지 |
| 합충 근거(일간합·일지충/원진) | 우리궁합·포스텔러 | ✅ **compat.factors 그대로** |
| ⭐오행 상보 그래프("부족 오행 채워줌") | **척척사주** | ✅ 두 chart elements |
| 신살 케미(도화·역마 관계) | 포스텔러(신살 多) | ✅ 신살 20종 |
| 분야별: 성격·애정·금전·결혼생활·자녀 | **인연궁합 앱**(표준) | 🔼 룰 생성 |
| 좋은점/조심할점/갈등 대처법 | 운세의신(유료급 장문) | 🔼 룰 생성 |
| 데일리 "오늘의 케미" 리텐션 | 인연궁합 앱 | 🆕 (후순위) |

**💎 차별화 공백(아무도 한 화면에 안 함 = 1등 먹을 곳)**:
1. **관계 시계열 타임라인** — 첫인상 → 연애 시절 → 결혼 후 가정운. (신운세는 대운 별도제품, 운세의신은 인생 3분할만)
2. **오행 상보 그래프 + 한 줄 요약 + 상담 CTA 3단 압축** (척척은 그래프만/뽐뿌는 요약만)
3. **속궁합을 무료 맛보기로** (경쟁사는 유료벽) → 맛보기 후 상담 유도

**톤(타임루팡·뽐뿌)**: 한자·전문어 최소, 해요체, 긴 풀이 끝 **한 줄 TL;DR**. 시차보정 숫자 노출로 "정밀하다" 신뢰.

## 3. 구현할 궁합 v2 구성 (순서)
1. `MyInfoBar`(나) + 상대 생일 입력 (현행 유지)
2. **종합**: 점수 도넛 + 레벨 + **겉궁합/속궁합 2개 미니 점수**
3. **두 명식 미니** 나란히/스택(각자 일간·오행·띠·일주동물) — NatalChart 축소 재사용 검토
4. **합충 근거 칩**: `compat.factors`를 핑크(+)/회색(−) 칩으로 ("일지 육합 — 천생연분 +15")
5. ⭐**오행 상보 그래프**: 두 사람 오행 합산 5축 막대 + "당신의 부족한 水를 상대가 채워줘요" 상보 카피
6. **신살 케미**: 도화/역마 등 관계 뱃지(길성/흉살 색구분 — 만세 마케팅서 이미 색분리)
7. **분야별 4**: 성격·애정·금전·결혼생활 점수+해석(룰, factors/오행 기반 분기)
8. ⭐**관계 시계열 타임라인**: 첫인상→연애→결혼 후 3단(룰) — 차별화 핵심
9. 좋은점/조심할점/**갈등 대처법**(룰)
10. 두 사람 행운 숫자 + **OG 공유카드**(바이럴)
11. **상담 CTA**(속궁합 깊은 풀이·결혼 적기는 상담으로)

## 4. 지킬 원칙
- **AI 완결분석 금지**([[project_no_ai_saju_analysis]]) — 풍성한 룰베이스 맛보기 + 깊은 건 상담 CTA. 사주GPT의 "잘 맞음"은 ①구체 시기 ②항목 디테일 양 ③개인화 UX(추천칩·톤)에서 나옴 = 전부 룰로 복제 가능, 완결답만 상담으로.
- 핵심 간지·합충·오행·신살 = **정확**(만세 엔진), 점수·문장 = 해석(과장 OK).
- 이름 빨강·핑크 금지([[feedback_no_red_names]], 오행 의미색 빨강은 예외 OK), 그라데이션 금지([[feedback_no_gradients]]), 모바일 375px, 결정론.

## 5. 건드릴 파일 / 패턴
- 엔진 결합: 이미 됨(vite.config alias `@manse/engine`). 새 래퍼 `lib/coupleEngine.ts`에 `buildCoupleFortune(profile, partnerBirth)` = computeCompatibility 호출 + 룰 텍스트(분야별·시계열·갈등팁) 생성.
- UI: `CoupleView.tsx` 결과부 전면 교체. 두 명식 미니/오행상보/타임라인 컴포넌트 신규.
- 배포: `python tools/_portal_deploy.py upload` (PowerShell, 절대경로). 빌드 `npm run build -w @portal/web`.
- 검증: E2E `e2e/tests/121-unse-portal.spec.ts` P-6 확장(seedProfile→상대입력→오행상보·타임라인·합충근거·명식 노출 단언). 0 failed.
- 바이블: 끝나면 _HANDBOOK/portal 현행화(궁합 v2).

## 6. 후순위(이번 v2엔 안 넣어도 됨)
- 데일리 "오늘의 케미"(두 사람 등록→매일 케미+FCM, 로또 토요루프 모델) — 별도 증축.
- 톤 프리셋(따뜻한/직설), 추천질문 칩(상담유도형).

## 출처(조사 근거)
신비운(shinhanlife/nonghyup/wooribank.sinbiun.com), 인연궁합앱(com.ipapas.harmonylite), 운세의신(unsin.co.kr), 우리궁합(gunghap.com), 신운세(sinunse.com), 사주GPT(sajugpt.co.kr), 포스텔러프로(pro.forceteller.com), 타임루팡(timelupin.com), 척척사주(sajuplus.com), 뽐뿌(ppomppu.co.kr/fortune), 사주포럼(점수분해모델).
