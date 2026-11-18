// 🔮 @tarot/engine — 공용 타입 정의 (순수, 의존성 0)

export type Arcana = 'major' | 'minor';
export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';

export interface CardDomains {
  love?: string;   // 연애·관계
  work?: string;   // 직업·목표
  money?: string;  // 금전·물질
  health?: string; // 건강·에너지
}

export interface TarotMeaning {
  keywords: string[];
  line: string;     // 한 줄(고객용 맛보기)
  detail?: string;  // 2~3문장 상세 설명(상담사용)
  domains?: CardDomains; // 분야별 의미(상담사용)
  questions?: string[];  // 상담 질문 제안(상담사용)
}

export type Element = '불' | '물' | '공기' | '흙' | '영혼';

export interface TarotCard {
  id: string;
  arcana: Arcana;
  suit?: Suit;
  element: Element;  // 카드 원소
  number: number;
  nameKo: string;
  nameEn: string;
  img: string;
  upright: TarotMeaning;
  reversed: TarotMeaning;
}

// ── 스프레드(배열) ───────────────────────────────
export interface SpreadPosition {
  idx: number; // 0-based 슬롯 번호 = 뽑는 순서
  nameKo: string;
  hint: string;
  x: number; // 0~100 (%)
  y: number; // 0~100 (%)
  rot?: number;
}

export type SpreadLayout = 'single' | 'row' | 'arc' | 'celtic' | 'relationship' | 'choice';

export interface Spread {
  key: string;
  nameKo: string;
  desc: string;
  count: number;
  layout: SpreadLayout;
  positions: SpreadPosition[];
}

export interface ThreeCardSet {
  key: string;
  nameKo: string;
  labels: [string, string, string];
}

// ── 세션 상태머신 (보드의 심장 — 순수 reducer) ──────
export type TarotPhase =
  | 'lobby' // 스프레드 선택 / 방코드 입력 대기
  | 'shuffle' // 고객이 섞는 중
  | 'spread' // 부채로 펼쳐짐, 픽 대기
  | 'picking' // 카드 고르는 중
  | 'revealing' // 한 장씩 공개·풀이
  | 'done'; // 모두 공개됨

export interface TarotPick {
  slot: number; // 스프레드 슬롯 번호
  deckPos: number; // 펼쳐진 덱에서 뽑힌 위치(deckOrder 인덱스)
  revealed: boolean;
}

export interface TarotState {
  spreadKey: string | null;
  threeSet: string; // 쓰리카드 포지션 세트 key
  useReversed: boolean; // 역방향 사용 여부(상담사 토글)
  phase: TarotPhase;
  seed: string | null; // 서버가 섞은 시드 → 양쪽 동일 순서
  deckOrder: number[]; // DECK 인덱스의 섞인 순서
  reversed: boolean[]; // deckPos별 역방향 여부
  picks: TarotPick[];
}

// 동기화 단위 = 이벤트. LocalTransport/LiveTransport 모두 이 이벤트를 reduce에 흘린다.
export type TarotEvent =
  | { t: 'spread.set'; key: string }
  | { t: 'three.set'; set: string }
  | { t: 'reversed.toggle'; on: boolean }
  | { t: 'shuffle'; seed: string }
  | { t: 'spread.lay' } // 부채로 펼침
  | { t: 'picking.start' }
  | { t: 'card.pick'; deckPos: number }
  | { t: 'card.reveal'; slot: number }
  | { t: 'card.revealAll' }
  | { t: 'reset' }
  | { t: 'sync'; state: TarotState }; // 전체 스냅샷(재접속 복구)

// 보드 ↔ 외부(로컬/네트워크) 사이의 유일한 결합 지점.
//  - 독립 마케팅: LocalTransport (내 화면에서만 dispatch)
//  - 라이브 상담: LiveTransport (WebSocket으로 broadcast)
export interface TarotTransport {
  send(ev: TarotEvent): void;
  subscribe(handler: (ev: TarotEvent) => void): () => void;
}
