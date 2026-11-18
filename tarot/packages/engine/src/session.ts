// 🔮 세션 상태머신 — 보드의 심장. 순수 reducer.
// LocalTransport(독립)·LiveTransport(라이브) 모두 이 reduce()에 이벤트를 흘려 동일 상태를 만든다.
import type { TarotEvent, TarotState } from './types.js';
import { SPREAD_BY_KEY } from './spreads.js';
import { shuffleDeck } from './draw.js';

export const initialState: TarotState = {
  spreadKey: null,
  threeSet: 'ppf',
  useReversed: true,
  phase: 'lobby',
  seed: null,
  deckOrder: [],
  reversed: [],
  picks: [],
};

/** 현재 스프레드가 요구하는 카드 수(없으면 0) */
export function spreadCount(state: TarotState): number {
  return state.spreadKey ? SPREAD_BY_KEY[state.spreadKey]?.count ?? 0 : 0;
}

/** 순수 상태 전이. 같은 (state, event) → 같은 결과. */
export function reduce(state: TarotState, ev: TarotEvent): TarotState {
  switch (ev.t) {
    case 'spread.set':
      return {
        ...state,
        spreadKey: ev.key,
        phase: 'lobby',
        seed: null,
        deckOrder: [],
        reversed: [],
        picks: [],
      };

    case 'three.set':
      return { ...state, threeSet: ev.set };

    case 'reversed.toggle':
      return { ...state, useReversed: ev.on };

    case 'shuffle': {
      const { deckOrder, reversed } = shuffleDeck(ev.seed, state.useReversed);
      return { ...state, seed: ev.seed, deckOrder, reversed, picks: [], phase: 'shuffle' };
    }

    case 'spread.lay':
      return state.deckOrder.length ? { ...state, phase: 'spread' } : state;

    case 'picking.start':
      return { ...state, phase: 'picking' };

    case 'card.pick': {
      const count = spreadCount(state);
      if (state.picks.length >= count) return state;
      if (state.picks.some((p) => p.deckPos === ev.deckPos)) return state; // 같은 카드 중복 방지
      const picks = [...state.picks, { slot: state.picks.length, deckPos: ev.deckPos, revealed: false }];
      const full = picks.length >= count;
      return { ...state, picks, phase: full ? 'revealing' : 'picking' };
    }

    case 'card.reveal': {
      const picks = state.picks.map((p) => (p.slot === ev.slot ? { ...p, revealed: true } : p));
      // done은 "모든 슬롯이 다 차고 + 다 공개됐을 때"만 (한 장씩 즉시 뒤집어도 조기종료 금지)
      const full = picks.length === spreadCount(state);
      const allRevealed = full && picks.length > 0 && picks.every((p) => p.revealed);
      return { ...state, picks, phase: allRevealed ? 'done' : state.phase };
    }

    case 'card.revealAll': {
      const picks = state.picks.map((p) => ({ ...p, revealed: true }));
      const full = picks.length === spreadCount(state);
      return { ...state, picks, phase: full ? 'done' : state.phase };
    }

    case 'reset':
      return { ...initialState, spreadKey: state.spreadKey, useReversed: state.useReversed };

    case 'sync':
      return ev.state;

    default:
      return state;
  }
}
