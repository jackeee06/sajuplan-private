// 🔮 정통 타로 스프레드(배열) 6종 — 데이터 정의
// 좌표 x,y 는 보드 영역 기준 백분율(%). 카드의 "중심"이 그 지점에 온다.
// rot: 카드 회전(도). 코드는 이 데이터대로 슬롯만 배치한다 (_TARO_SPEC.md §2.4, §3.2)

import type { Spread, ThreeCardSet } from './types.js';

// 쓰리카드는 같은 3슬롯에 "포지션 의미 세트"를 갈아끼울 수 있다 (상담사가 선택).
export const THREE_CARD_SETS: ThreeCardSet[] = [
  { key: 'ppf', nameKo: '과거 · 현재 · 미래', labels: ['과거', '현재', '미래'] },
  { key: 'sar', nameKo: '상황 · 행동 · 결과', labels: ['상황', '행동', '결과'] },
  { key: 'bms', nameKo: '몸 · 마음 · 영혼', labels: ['몸', '마음', '영혼'] },
  { key: 'ymr', nameKo: '나 · 상대 · 관계', labels: ['나', '상대', '관계'] },
];

export const SPREADS: Spread[] = [
  {
    key: 'one',
    nameKo: '원카드',
    desc: '오늘의 카드 · 예/아니오 · 한 줄 조언',
    count: 1,
    layout: 'single',
    positions: [{ idx: 0, nameKo: '핵심', hint: '지금 가장 중요한 메시지', x: 50, y: 50 }],
  },
  {
    key: 'three',
    nameKo: '쓰리카드',
    desc: '가장 다용도 — 과거·현재·미래 등(포지션 세트 선택)',
    count: 3,
    layout: 'row',
    positions: [
      { idx: 0, nameKo: '과거', hint: '흘러온 흐름', x: 22, y: 50 },
      { idx: 1, nameKo: '현재', hint: '지금의 상태', x: 50, y: 50 },
      { idx: 2, nameKo: '미래', hint: '향하는 방향', x: 78, y: 50 },
    ],
  },
  {
    key: 'five',
    nameKo: '파이브카드(말발굽)',
    desc: '원인부터 결과까지 흐름 보기',
    count: 5,
    layout: 'arc',
    positions: [
      { idx: 0, nameKo: '현재', hint: '지금 상황', x: 14, y: 64 },
      { idx: 1, nameKo: '장애', hint: '걸림돌·과제', x: 32, y: 40 },
      { idx: 2, nameKo: '조언', hint: '도움이 되는 태도', x: 50, y: 30 },
      { idx: 3, nameKo: '주변', hint: '주변 환경·영향', x: 68, y: 40 },
      { idx: 4, nameKo: '결과', hint: '예상되는 흐름', x: 86, y: 64 },
    ],
  },
  {
    key: 'celtic',
    nameKo: '켈틱 크로스',
    desc: '가장 유명한 종합 심층 배열 (10장)',
    count: 10,
    layout: 'celtic',
    positions: [
      { idx: 0, nameKo: '현재 상황', hint: '핵심 주제', x: 30, y: 46 },
      { idx: 1, nameKo: '장애물', hint: '가로지르는 과제', x: 30, y: 46, rot: 90 },
      { idx: 2, nameKo: '토대', hint: '바탕·무의식', x: 30, y: 70 },
      { idx: 3, nameKo: '과거', hint: '지나온 영향', x: 13, y: 46 },
      { idx: 4, nameKo: '가능한 미래', hint: '머리 위 — 가능성', x: 30, y: 22 },
      { idx: 5, nameKo: '가까운 미래', hint: '곧 다가올 흐름', x: 47, y: 46 },
      { idx: 6, nameKo: '자기 인식', hint: '나의 태도', x: 80, y: 76 },
      { idx: 7, nameKo: '주변 환경', hint: '외부 영향', x: 80, y: 54 },
      { idx: 8, nameKo: '희망과 두려움', hint: '속마음', x: 80, y: 32 },
      { idx: 9, nameKo: '최종 결과', hint: '종합 결말', x: 80, y: 10 },
    ],
  },
  {
    key: 'relationship',
    nameKo: '관계 스프레드',
    desc: '연애·궁합 — 나와 상대, 관계의 흐름',
    count: 6,
    layout: 'relationship',
    positions: [
      { idx: 0, nameKo: '나', hint: '나의 마음·상태', x: 24, y: 34 },
      { idx: 1, nameKo: '상대', hint: '상대의 마음·상태', x: 76, y: 34 },
      { idx: 2, nameKo: '관계 현재', hint: '둘 사이 지금', x: 50, y: 34 },
      { idx: 3, nameKo: '과거', hint: '쌓여온 흐름', x: 32, y: 66 },
      { idx: 4, nameKo: '미래', hint: '나아갈 방향', x: 68, y: 66 },
      { idx: 5, nameKo: '조언', hint: '관계를 위한 조언', x: 50, y: 86 },
    ],
  },
  {
    key: 'choice',
    nameKo: '양자택일',
    desc: 'A와 B 사이 — 각 선택의 흐름과 결과',
    count: 5,
    layout: 'choice',
    positions: [
      { idx: 0, nameKo: '나(현재)', hint: '선택 앞의 나', x: 50, y: 82 },
      { idx: 1, nameKo: 'A 선택', hint: 'A로 갈 때의 상황', x: 24, y: 54 },
      { idx: 2, nameKo: 'A 결과', hint: 'A의 결말', x: 24, y: 24 },
      { idx: 3, nameKo: 'B 선택', hint: 'B로 갈 때의 상황', x: 76, y: 54 },
      { idx: 4, nameKo: 'B 결과', hint: 'B의 결말', x: 76, y: 24 },
    ],
  },
];

export const SPREAD_BY_KEY: Record<string, Spread> = Object.fromEntries(
  SPREADS.map((s) => [s.key, s]),
);
