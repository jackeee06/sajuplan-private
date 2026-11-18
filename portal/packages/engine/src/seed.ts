// 결정론적 시드/난수 — 같은 입력은 항상 같은 결과(운명번호의 핵심).
// 외부 의존 0. Math.random 미사용(결정성 보장).

/** 문자열 → 32bit 정수 해시 (FNV-1a 변형) */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // 부호 제거
  return h >>> 0;
}

/** mulberry32 — 시드 1개로 0~1 난수 스트림 생성(결정론적) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 시드에서 1~max 범위의 서로 다른 정수 count개를 오름차순으로 뽑는다.
 * 로또(1~45 중 6개)의 결정론적 추출에 사용.
 */
export function pickUnique(seed: number, count: number, max: number): number[] {
  const rnd = mulberry32(seed);
  const pool: number[] = [];
  for (let i = 1; i <= max; i++) pool.push(i);
  // Fisher–Yates (시드 기반)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}
