// 시드 기반 결정론적 난수 — 같은 시드 → 같은 셔플(상담사·고객 화면 일치 보장).
// 서버가 시드 문자열을 생성해 양쪽에 내려주면 둘 다 동일한 덱 순서를 얻는다.

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시드 문자열 → [0,1) 난수 생성기 */
export function makeRng(seed: string): () => number {
  return mulberry32(xmur3(seed)());
}

/** 페어링/셔플용 짧은 시드 생성(호출부에서 시각·랜덤을 주입). 엔진은 순수성 유지. */
export function seedFrom(parts: (string | number)[]): string {
  return parts.join(':');
}
