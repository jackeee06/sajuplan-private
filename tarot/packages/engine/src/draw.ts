// 셔플·정/역방향 결정 — 모두 시드 결정론. (DECK 78장 기준)
import { DECK } from './deck.js';
import { makeRng } from './rng.js';

export interface ShuffleResult {
  deckOrder: number[]; // DECK 인덱스의 섞인 순서 (deckPos → DECK index)
  reversed: boolean[]; // deckPos별 역방향 여부
}

/**
 * 시드로 78장을 섞고 각 위치의 정/역방향을 정한다.
 * 같은 (seed, useReversed) → 항상 같은 결과 → 두 화면 일치.
 */
export function shuffleDeck(seed: string, useReversed = true): ShuffleResult {
  const rng = makeRng(seed);
  const order = DECK.map((_, i) => i);
  // Fisher–Yates
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  const reversed = order.map(() => (useReversed ? rng() < 0.5 : false));
  return { deckOrder: order, reversed };
}

/** deckPos(펼쳐진 덱 위치) → 실제 카드 + 역방향 여부 */
export function cardAt(deckOrder: number[], reversed: boolean[], deckPos: number) {
  const deckIndex = deckOrder[deckPos];
  return {
    card: deckIndex === undefined ? undefined : DECK[deckIndex],
    reversed: reversed[deckPos] ?? false,
  };
}
