import { test } from "node:test";
import assert from "node:assert/strict";
import { destinyNumbers, weeklyLucky, checkWinning, LOTTO_PICK, LOTTO_MAX } from "../src/lotto.js";

test("운명번호는 결정론적 — 같은 입력은 항상 같은 6개", () => {
  const a = destinyNumbers("1990-03-15T09:30", "M");
  const b = destinyNumbers("1990-03-15T09:30", "M");
  assert.deepEqual(a.numbers, b.numbers);
});

test("운명번호 = 1~45 범위의 서로 다른 6개, 오름차순", () => {
  const { numbers } = destinyNumbers("1985-11-02", "F");
  assert.equal(numbers.length, LOTTO_PICK);
  assert.equal(new Set(numbers).size, LOTTO_PICK);
  for (const n of numbers) {
    assert.ok(n >= 1 && n <= LOTTO_MAX);
  }
  assert.deepEqual(numbers, [...numbers].sort((x, y) => x - y));
});

test("이번주 행운번호는 회차마다 달라진다", () => {
  const r1 = weeklyLucky("1990-03-15", 1100).numbers;
  const r2 = weeklyLucky("1990-03-15", 1101).numbers;
  assert.notDeepEqual(r1, r2);
});

test("당첨 판정 — 등수 규칙 정확", () => {
  const win = [1, 2, 3, 4, 5, 6];
  const bonus = 7;
  assert.equal(checkWinning([1, 2, 3, 4, 5, 6], win, bonus).rank, 1);
  assert.equal(checkWinning([1, 2, 3, 4, 5, 7], win, bonus).rank, 2); // 5개+보너스
  assert.equal(checkWinning([1, 2, 3, 4, 5, 45], win, bonus).rank, 3); // 5개
  assert.equal(checkWinning([1, 2, 3, 4, 44, 45], win, bonus).rank, 4); // 4개
  assert.equal(checkWinning([1, 2, 3, 43, 44, 45], win, bonus).rank, 5); // 3개
  assert.equal(checkWinning([1, 2, 42, 43, 44, 45], win, bonus).rank, 0); // 미당첨
});
