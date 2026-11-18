# @manse/engine — 사주 만세력 계산 엔진

> 사주플랜 무료 만세력 제품의 **왕관 보석**. 생년월일시를 넣으면 사주 명식(년·월·일·시주 + 십성·지장간·12운성·신살·공망·대운)을 JSON 으로 돌려주는 **순수 함수 라이브러리**.
>
> 전체 제품 스펙: [`../_MANSE_SPEC.md`](../_MANSE_SPEC.md)

## ⚠️ 분리 원칙 (절대)

이 패키지는 **사주플랜을 모른다.** DB·NestJS·React·회원·코인·결제에 의존하지 않는다.

- ✅ 사주플랜 → 만세력 (가져다 씀)
- ❌ 만세력 → 사주플랜 (의존 금지)

그래야 만세력 API·웹위젯·앱·타사 임베드 어디든 같은 엔진을 꽂을 수 있다. 의존성은 **단방향**으로만 흐른다.

## 입출력

```ts
import { computeManse } from "@manse/engine";

const chart = computeManse({
  calendar: "solar",            // "solar" | "lunar"
  birth: "1990-06-15T07:20",    // 현지 민간시(태어난 시계 시각)
  gender: "M",                  // "M" | "F" (대운 방향 계산)
  longitude: 127.0,             // 출생지 경도(진태양시 보정). 기본 한국
  options: { hourBoundary: "midnight", trueSolarTime: true },
});
// → 명식 JSON (types.ts 의 ManseChart)
```

## 구조

| 파일 | 책임 |
|---|---|
| `src/constants.ts` | 천간·지지·60갑자·오행·음양·지장간·십성·12운성 테이블 (진실원) |
| `src/julian.ts` | 양력 ↔ 율리우스일(JDN/JDE) 변환, ΔT |
| `src/astronomy.ts` | 태양 황경(Meeus) → 24절기 정확 시각, 균시차(진태양시) |
| `src/pillars.ts` | 사주 기둥: 년주(입춘) · 월주(절기) · 일주(JDN) · 시주(오서둔) |
| `src/derive.ts` | 파생: 십성 · 지장간 · 12운성 · 공망 · 대운 |
| `src/index.ts` | `computeManse()` 진입점 + 명식 조립 |
| `test/` | **정확도 검증** — 원광만세력/KASI 골든 케이스 대조 |

## 🔴 정확도 핀(PIN) — 합격 게이트

엔진 "구조"가 완성돼도 **다음이 원광만세력/KASI 와 일치하기 전엔 합격 아님**:

1. **일주 앵커**(`constants.ts` `DAY_PILLAR_OFFSET`) — 60갑자 일진 기준점. 알려진 정답 명식 1개로 핀.
2. **절기 시각 정밀도** — 입춘/절입 경계가 분 단위로 KASI 절기표와 일치.
3. **경계 배터리** — 입춘 직전/직후, 야자시 23:30, 서머타임(1948~60·87~88), 진태양시 보정.

→ `test/` 의 골든 케이스가 모두 통과해야 비로소 "정확한 만세력". (스펙 §6)

## 개발

```bash
cd manse
npm install
npm test          # 정확도 검증
npm run build     # dist 산출 (API·웹·앱이 소비)
```
