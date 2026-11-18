/**
 * 율리우스일(Julian Day) 변환 + ΔT
 * ──────────────────────────────────────────────────────────────
 * - JD: 천문 계산의 공통 시간축. .0 = 정오(UT), .5 = 자정.
 * - 사주 엔진은 모든 시각을 JD 로 환산해 일관 비교한다.
 * - 절기를 분 단위로 맞추려면 ΔT(TT−UT) 보정이 필요(수십 초~1분 영향).
 * 참고: Jean Meeus, "Astronomical Algorithms" / Espenak-Meeus ΔT 다항식.
 */

/** 한국 표준시 기본 오프셋(시간). 역사적 변경/서머타임은 pillars 단계에서 별도 보정. */
export const KST_OFFSET_HOURS = 9;

/**
 * 그레고리력 → JD (UT 기준).
 * @param dayFrac 일(소수 포함, UT). 예: 15.5 = 15일 12:00 UT
 */
export function julianDayUT(year: number, month: number, dayFrac: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4); // 그레고리력 보정
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    dayFrac +
    B -
    1524.5
  );
}

/**
 * 현지 민간시(연·월·일·시·분) → JD(UT).
 * @param tzOffsetHours 현지 표준시 오프셋(기본 KST +9)
 */
export function localToJD(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tzOffsetHours: number = KST_OFFSET_HOURS,
): number {
  const utHour = hour + minute / 60 - tzOffsetHours; // UT 시 = 현지시 − 오프셋
  const dayFrac = day + utHour / 24;
  return julianDayUT(year, month, dayFrac);
}

/** JD(UT) → 그레고리력 (UT). Meeus 역변환. */
export function jdToGregorianUT(jd: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let A = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    A = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayFrac = B - D - Math.floor(30.6001 * E) + f;
  const day = Math.floor(dayFrac);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const hourFrac = (dayFrac - day) * 24;
  const hour = Math.floor(hourFrac);
  const minute = Math.round((hourFrac - hour) * 60);
  return { year, month, day, hour, minute };
}

/**
 * ΔT (TT − UT), 초 단위. Espenak & Meeus(2006) 다항식 근사.
 * 1900~2050 구간을 분 단위 정밀도로 커버.
 */
export function deltaTSeconds(year: number): number {
  if (year >= 2005 && year <= 2050) {
    const t = year - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  if (year >= 1986 && year < 2005) {
    const t = year - 2000;
    return (
      63.86 +
      0.3345 * t -
      0.060374 * t * t +
      0.0017275 * t ** 3 +
      0.000651814 * t ** 4 +
      0.00002373599 * t ** 5
    );
  }
  if (year >= 1961 && year < 1986) {
    const t = year - 1975;
    return 45.45 + 1.067 * t - (t * t) / 260 - (t ** 3) / 718;
  }
  if (year >= 1941 && year < 1961) {
    const t = year - 1950;
    return 29.07 + 0.407 * t - (t * t) / 233 + (t ** 3) / 2547;
  }
  if (year >= 1920 && year < 1941) {
    const t = year - 1920;
    return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3;
  }
  if (year >= 1900 && year < 1920) {
    const t = year - 1900;
    return (
      -2.79 +
      1.494119 * t -
      0.0598939 * t * t +
      0.0061966 * t ** 3 -
      0.000197 * t ** 4
    );
  }
  // 범위 밖: 2050+ 외삽 (대략)
  if (year > 2050) {
    const t = year - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  // 1900 이전: 보수적 상수
  const t = year - 1900;
  return -2.79 + 1.494119 * t;
}

/** JD(UT) → JDE(TT). 천문 위치 계산은 TT 기준이어야 정확. */
export function jdUTtoTT(jdUT: number, year: number): number {
  return jdUT + deltaTSeconds(year) / 86400;
}
