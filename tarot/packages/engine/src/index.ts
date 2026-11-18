// 🔮 @tarot/engine — 공개 진입점.
// 순수 함수/데이터만. 사주플랜·React·네트워크 의존성 0 (독립 제품의 왕관 보석).

export * from './types.js';
export {
  DECK,
  MAJOR,
  WANDS,
  CUPS,
  SWORDS,
  PENTACLES,
  CARD_BY_ID,
  CARD_BACK,
  SUIT_KO,
  SUIT_ELEMENT,
} from './deck.js';
export { SPREADS, SPREAD_BY_KEY, THREE_CARD_SETS } from './spreads.js';
export { makeRng, seedFrom } from './rng.js';
export { shuffleDeck, cardAt } from './draw.js';
export type { ShuffleResult } from './draw.js';
export { reduce, initialState, spreadCount } from './session.js';
