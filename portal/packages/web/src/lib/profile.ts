// 공유 프로필 — "한 번 입력 → 모든 운세 자동 적용". 생년월일 + 성별(+이름)만(시간·출생지 불필요).
// 저장은 localStorage(추후 로그인 SSO로 자동 채움 확장). 강제 아님.
import { zodiacOfYear, starOfDate, type Zodiac, type Star } from "@portal/engine";

export interface Profile {
  /** YYYY-MM-DD (양력) */
  birth: string;
  gender?: "M" | "F";
  name?: string;
  /** "HH:mm" (선택) — 만세력 연동·정밀용. 없으면 시간 모름 */
  time?: string;
  /** 출생지 경도(선택) — 만세력 진태양시 보정용 */
  lon?: number;
  /** 출생지 표시명(선택) */
  region?: string;
}

const KEY = "unse_profile_v1";

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (p && p.birth) return p;
    }
    // 옛 타일별 키 마이그레이션(로또·오늘의운세가 따로 쓰던 것)
    const legacyDestiny = localStorage.getItem("portal_destiny_v1");
    if (legacyDestiny) {
      const d = JSON.parse(legacyDestiny) as { birth: string; gender?: string };
      if (d?.birth) {
        const migrated: Profile = { birth: d.birth, gender: d.gender === "M" || d.gender === "F" ? d.gender : undefined };
        saveProfile(migrated);
        return migrated;
      }
    }
    const legacyBirth = localStorage.getItem("portal_birth_v1");
    if (legacyBirth) {
      const migrated: Profile = { birth: legacyBirth };
      saveProfile(migrated);
      return migrated;
    }
  } catch {
    /* 무시 */
  }
  return null;
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new Event("unse-profile-change"));
  } catch {
    /* 무시 */
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem("portal_destiny_v1");
    localStorage.removeItem("portal_birth_v1");
    window.dispatchEvent(new Event("unse-profile-change"));
  } catch {
    /* 무시 */
  }
}

export function zodiacOfProfile(p: Profile): Zodiac {
  return zodiacOfYear(Number(p.birth.slice(0, 4)));
}

export function starOfProfile(p: Profile): Star {
  const m = Number(p.birth.slice(5, 7));
  const d = Number(p.birth.slice(8, 10));
  return starOfDate(m, d);
}

function timeLabel(t?: string): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
}

/** "1990.06.15 오전 7:20 · 여성 · 말띠 · 쌍둥이자리" 식 요약(만세력 접힌 카드용) */
export function profileSummary(p: Profile): string {
  const date = p.birth.replace(/-/g, ".");
  const t = timeLabel(p.time);
  const g = p.gender === "M" ? "남성" : p.gender === "F" ? "여성" : null;
  const head = t ? `${date} ${t}` : date;
  const parts = [head];
  if (g) parts.push(g);
  parts.push(zodiacOfProfile(p).name);
  parts.push(starOfProfile(p).name);
  return parts.join(" · ");
}

// 출생지(진태양시 보정용 경도) — 만세력과 동일 목록
export const REGIONS: { name: string; lon: number }[] = [
  { name: "서울·인천·경기", lon: 127.0 },
  { name: "대전·충청", lon: 127.4 },
  { name: "전북", lon: 127.1 },
  { name: "광주·전남", lon: 126.9 },
  { name: "대구·경북", lon: 128.6 },
  { name: "부산·경남", lon: 129.0 },
  { name: "강원 영서", lon: 127.7 },
  { name: "강원 영동", lon: 128.9 },
  { name: "제주", lon: 126.5 },
  { name: "잘 모름", lon: 127.5 },
];
