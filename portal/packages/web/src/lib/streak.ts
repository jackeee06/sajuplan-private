// 방문 스트릭 — 연속 방문일을 localStorage로 추적(매일 다시 오게 하는 데일리 루프).
import { todayKey } from "./dateKey.js";

const KEY = "visit_streak_v1";
interface StreakData { last: string; count: number; best: number }

/** 오늘 방문 기록 후 {연속일, 최고기록} 반환. 같은 날 재방문은 그대로. */
export function recordVisit(): { count: number; best: number } {
  const today = todayKey();
  let s: StreakData = { last: "", count: 0, best: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...JSON.parse(raw) };
  } catch { /* ignore */ }

  if (s.last !== today) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = todayKey(y);
    s.count = s.last === yesterday ? s.count + 1 : 1; // 어제 방문했으면 연속, 아니면 리셋
    s.last = today;
    s.best = Math.max(s.best || 0, s.count);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }
  return { count: s.count, best: s.best };
}
