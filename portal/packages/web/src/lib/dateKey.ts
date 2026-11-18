// 날짜키 — 엔진은 순수(Date 미사용)라 UI가 오늘 날짜를 만들어 넘긴다.

export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO 주차 키 (별자리=주간 운세용) — 같은 주는 같은 값 */
export function weekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function todayLabel(d: Date = new Date()): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export function yearKey(d: Date = new Date()): string {
  return String(d.getFullYear());
}

export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function yearLabel(d: Date = new Date()): string {
  return `${d.getFullYear()}년`;
}

export function monthLabel(d: Date = new Date()): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/** "YYYY-MM-DD"가 실제로 존재하는 날짜인지(월 1~12·일 1~말일·윤년·연도 1900~올해). */
export function isValidDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = +m[1]!, mo = +m[2]!, d = +m[3]!;
  if (y < 1900 || y > new Date().getFullYear()) return false;
  if (mo < 1 || mo > 12) return false;
  const last = new Date(y, mo, 0).getDate(); // 그 달 말일(윤년 자동 반영)
  return d >= 1 && d <= last;
}
