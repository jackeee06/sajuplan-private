import { describe, it, expect } from 'vitest';
import { DECK, MAJOR, shuffleDeck, reduce, initialState, SPREAD_BY_KEY } from '../src/index';

describe('덱 무결성', () => {
  it('정통 78장이다', () => {
    expect(DECK.length).toBe(78);
  });
  it('메이저 22 + 마이너 56', () => {
    expect(MAJOR.length).toBe(22);
    expect(DECK.filter((c) => c.arcana === 'minor').length).toBe(56);
  });
  it('id 중복이 없다', () => {
    expect(new Set(DECK.map((c) => c.id)).size).toBe(78);
  });
  it('모든 카드가 정/역방향 의미와 이미지 경로를 갖는다', () => {
    for (const c of DECK) {
      expect(c.upright.keywords.length).toBeGreaterThan(0);
      expect(c.reversed.keywords.length).toBeGreaterThan(0);
      expect(c.img).toMatch(/^\/tarot\/.+\.webp$/);
    }
  });
});

describe('셔플 결정론(동기화 보장)', () => {
  it('같은 시드 → 같은 덱 순서·역방향', () => {
    const a = shuffleDeck('room-1234:7', true);
    const b = shuffleDeck('room-1234:7', true);
    expect(a.deckOrder).toEqual(b.deckOrder);
    expect(a.reversed).toEqual(b.reversed);
  });
  it('다른 시드 → 다른 순서', () => {
    const a = shuffleDeck('seed-A', true);
    const b = shuffleDeck('seed-B', true);
    expect(a.deckOrder).not.toEqual(b.deckOrder);
  });
  it('useReversed=false 면 역방향 없음', () => {
    const { reversed } = shuffleDeck('x', false);
    expect(reversed.every((r) => r === false)).toBe(true);
  });
  it('셔플 후에도 78장이 빠짐없이 들어있다', () => {
    const { deckOrder } = shuffleDeck('z', true);
    expect(new Set(deckOrder).size).toBe(78);
  });
});

describe('세션 상태머신', () => {
  it('스프레드 선택 → 셔플 → 픽 → 공개 흐름', () => {
    let s = initialState;
    s = reduce(s, { t: 'spread.set', key: 'three' });
    expect(s.spreadKey).toBe('three');
    s = reduce(s, { t: 'shuffle', seed: 'abc' });
    expect(s.phase).toBe('shuffle');
    expect(s.deckOrder.length).toBe(78);
    s = reduce(s, { t: 'spread.lay' });
    expect(s.phase).toBe('spread');
    s = reduce(s, { t: 'picking.start' });
    s = reduce(s, { t: 'card.pick', deckPos: 0 });
    s = reduce(s, { t: 'card.pick', deckPos: 5 });
    expect(s.phase).toBe('picking');
    s = reduce(s, { t: 'card.pick', deckPos: 9 });
    expect(s.picks.length).toBe(3);
    expect(s.phase).toBe('revealing'); // 3장 다 뽑으면 공개 단계
  });

  it('스프레드 카드 수를 넘겨 뽑히지 않는다', () => {
    let s = reduce(initialState, { t: 'spread.set', key: 'one' });
    s = reduce(s, { t: 'shuffle', seed: 'q' });
    s = reduce(s, { t: 'card.pick', deckPos: 1 });
    s = reduce(s, { t: 'card.pick', deckPos: 2 }); // 무시돼야 함(원카드)
    expect(s.picks.length).toBe(1);
  });

  it('같은 카드를 두 번 못 뽑는다', () => {
    let s = reduce(initialState, { t: 'spread.set', key: 'three' });
    s = reduce(s, { t: 'shuffle', seed: 'q' });
    s = reduce(s, { t: 'card.pick', deckPos: 3 });
    s = reduce(s, { t: 'card.pick', deckPos: 3 });
    expect(s.picks.length).toBe(1);
  });

  it('슬롯이 다 차기 전에 한 장 공개해도 done이 아니다(즉시 뒤집기)', () => {
    let s = reduce(initialState, { t: 'spread.set', key: 'three' });
    s = reduce(s, { t: 'shuffle', seed: 'q' });
    s = reduce(s, { t: 'card.pick', deckPos: 1 });
    s = reduce(s, { t: 'card.reveal', slot: 0 }); // 1/3만 공개
    expect(s.phase).not.toBe('done');
    expect(s.picks[0]!.revealed).toBe(true);
  });

  it('모두 공개하면 done', () => {
    let s = reduce(initialState, { t: 'spread.set', key: 'one' });
    s = reduce(s, { t: 'shuffle', seed: 'q' });
    s = reduce(s, { t: 'card.pick', deckPos: 0 });
    s = reduce(s, { t: 'card.reveal', slot: 0 });
    expect(s.phase).toBe('done');
  });

  it('모든 스프레드 6종이 정의돼 있다', () => {
    for (const key of ['one', 'three', 'five', 'celtic', 'relationship', 'choice']) {
      const sp = SPREAD_BY_KEY[key];
      expect(sp).toBeTruthy();
      expect(sp!.positions.length).toBe(sp!.count);
    }
  });
});
