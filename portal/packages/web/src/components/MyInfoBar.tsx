import { useMemo, useState } from "react";
import { computeManse } from "@manse/engine";
import { loadProfile, saveProfile, clearProfile, profileSummary, REGIONS, type Profile } from "../lib/profile.js";
import { lunarToSolarDate } from "../lib/dailyEngine.js";
import DateField from "./DateField.js";
import TimeField from "./TimeField.js";

// 공통 "내 정보 바" — 모든 생년월일 입력 화면이 공유. 만세력식 접힘 카드 + 편집폼.
//   상태: ① 미입력 → 가벼운 권유 버튼 / ② 입력됨 → 접힌 요약 카드(+사주 한 줄) / ③ 편집 → 폼(성별·양음력·생일·시각·이름·출생지)
//   저장 시 saveProfile → unse-profile-change 디스패치 → 페이지가 결과 재계산(useProfile).
//   ⚠️ 한 부품으로 전 화면 일치 보장(복붙 금지 = 드리프트 0).
interface Props {
  /** 접힌 카드에 사주 한 줄(일간·격국·강약) 표시 — 명식 계산(가벼움) */
  showSaju?: boolean;
  /** 미입력 권유 문구 */
  ctaLabel?: string;
}

function sajuLine(p: Profile): string | null {
  try {
    const time = p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : null;
    const c = computeManse({
      birth: `${p.birth}T${time ?? "12:00"}`,
      gender: p.gender ?? "M",
      unknownHour: !time,
      longitude: p.lon ?? 127.5,
      calendar: "solar",
    });
    const d = c.pillars.day.stem;
    return `일간 ${d.ko}(${d.element}) · ${c.analysis.gyeokguk} · ${c.analysis.strength.label}`;
  } catch {
    return null;
  }
}

export default function MyInfoBar({ showSaju = false, ctaLabel = "생년월일 넣고 내 운세 받기" }: Props) {
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [editing, setEditing] = useState(false);

  const [birth, setBirth] = useState(profile?.birth ?? "");
  const [cal, setCal] = useState<"solar" | "lunar">("solar");
  const [gender, setGender] = useState<"M" | "F" | "">(profile?.gender ?? "");
  const [name, setName] = useState(profile?.name ?? "");
  const [time, setTime] = useState(profile?.time ?? "");
  const [unknownHour, setUnknownHour] = useState(profile ? !profile.time : false);
  const [region, setRegion] = useState(profile?.region ?? "");

  const saju = useMemo(() => (showSaju && profile?.birth ? sajuLine(profile) : null), [showSaju, profile]);

  function openEdit() {
    setBirth(profile?.birth ?? "");
    setCal("solar");
    setGender(profile?.gender ?? "");
    setName(profile?.name ?? "");
    setTime(profile?.time ?? "");
    setUnknownHour(profile ? !profile.time : false);
    setRegion(profile?.region ?? "");
    setEditing(true);
  }

  function save() {
    if (!birth) return;
    let solar = birth;
    if (cal === "lunar") {
      try {
        solar = lunarToSolarDate(+birth.slice(0, 4), +birth.slice(5, 7), +birth.slice(8, 10));
      } catch {
        /* 변환 실패 시 입력값 유지 */
      }
    }
    const p: Profile = {
      birth: solar,
      gender: gender || undefined,
      name: name.trim() || undefined,
      time: !unknownHour && time ? time : undefined,
      region: region || undefined,
      lon: region ? REGIONS.find((r) => r.name === region)?.lon : undefined,
    };
    saveProfile(p);
    setProfile(p);
    setEditing(false);
  }

  function reset() {
    clearProfile();
    setProfile(null);
    setEditing(false);
  }

  // ③ 편집 폼
  if (editing) {
    return (
      <section className="mb-4 rounded-card bg-white p-4 shadow-card ring-1 ring-accent-400/30">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent-50 px-3 py-2">
          <span aria-hidden>🔒</span>
          <p className="text-[12.5px] font-semibold text-accent-600">한 번만 입력하면 모든 운세에서 계속 써요 (만세력까지 자동 연결)</p>
        </div>
        <div className="space-y-2.5">
          {/* 이름 + 성별 */}
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-[11.5px] font-medium text-ink/66">이름 <span className="text-ink/35">(선택)</span></span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" maxLength={20} className={`${fieldCls} w-full`} />
            </label>
            <div className="shrink-0">
              <span className="mb-1 block text-[11.5px] font-medium text-ink/66">성별</span>
              <div className="flex gap-1.5">
                {(["F", "M"] as const).map((g) => (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    className={["rounded-xl px-4 py-2.5 text-[14px] font-medium ring-1 transition", gender === g ? "bg-accent-500 text-white ring-accent-500" : "bg-canvas text-ink/66 ring-black/10"].join(" ")}>
                    {g === "F" ? "여성" : "남성"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* 양/음력 */}
          <div>
            <span className="mb-1 block text-[11.5px] font-medium text-ink/66">달력</span>
            <div className="inline-flex overflow-hidden rounded-xl ring-1 ring-black/10">
              {(["solar", "lunar"] as const).map((c, i) => (
                <button key={c} type="button" onClick={() => setCal(c)}
                  className={["px-4 py-2.5 text-[13px] font-medium transition", i > 0 ? "border-l border-black/10" : "", cal === c ? "bg-accent-500 text-white" : "bg-canvas text-ink/70"].join(" ")}>
                  {c === "solar" ? "양력" : "음력"}
                </button>
              ))}
            </div>
          </div>
          {/* 생년월일 + 시각 */}
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-[11.5px] font-medium text-ink/66">생년월일 <span className="text-ink/35">({cal === "lunar" ? "음력" : "양력"})</span></span>
              <DateField value={birth} onChange={setBirth} className={`${fieldCls} w-full text-center`} />
            </label>
            <label className="w-24">
              <span className="mb-1 block text-[11.5px] font-medium text-ink/66">시각</span>
              <TimeField value={time} onChange={setTime} disabled={unknownHour} className={`${fieldCls} w-full text-center disabled:bg-black/[0.04] disabled:text-ink/30`} />
            </label>
          </div>
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink/70">
            <input type="checkbox" className="accent-accent-500" checked={unknownHour} onChange={(e) => { setUnknownHour(e.target.checked); if (e.target.checked) setTime(""); }} />
            태어난 시각 모름 (몰라도 괜찮아요)
          </label>
          {/* 출생지 */}
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-ink/66">출생지 (선택 · 만세력 정밀 보정)</p>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map((r) => (
                <button key={r.name} type="button" onClick={() => setRegion(region === r.name ? "" : r.name)}
                  className={["rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 transition", region === r.name ? "bg-accent-500 text-white ring-accent-500" : "bg-canvas text-ink/70 ring-black/10"].join(" ")}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={save} disabled={!birth} className="flex-1 rounded-xl bg-accent-500 py-2.5 text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-40">
            저장하고 모든 운세 받기
          </button>
          {profile && (
            <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-4 py-2.5 text-[14px] font-medium text-ink/66 ring-1 ring-black/10">취소</button>
          )}
        </div>
      </section>
    );
  }

  // ① 미입력 — 가벼운 권유
  if (!profile) {
    return (
      <button type="button" onClick={openEdit} className="mb-4 w-full rounded-card bg-accent-50 px-4 py-4 text-left ring-1 ring-accent-400/30 active:scale-[0.99]">
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="text-[24px]" aria-hidden>🎂</span>
            <span className="text-[16px] font-bold text-accent-600">{ctaLabel}</span>
          </span>
          <span className="text-[18px] text-accent-500" aria-hidden>›</span>
        </span>
        <span className="mt-1.5 block pl-8 text-[13.5px] font-medium text-accent-600/90">한 번만 입력하면 모든 운세에서 계속 써요</span>
      </button>
    );
  }

  // ② 입력됨 — 만세력식 접힌 요약 카드(+사주 한 줄)
  return (
    <section className="mb-4 rounded-card bg-white p-4 shadow-card ring-1 ring-black/[0.06]">
      {profile.name && <p className="text-[15px] font-bold text-primary-600">{profile.name}</p>}
      <p className={["text-[14px] font-bold text-ink", profile.name ? "mt-0.5" : ""].join(" ")}>{profileSummary(profile)}</p>
      {saju && <p className="mt-0.5 text-[12px] font-medium text-ink/62">{saju}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={openEdit} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-accent-500 ring-1 ring-accent-400">✎ 정보 수정하기</button>
        <button type="button" onClick={reset} className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink/62 ring-1 ring-black/10">초기화</button>
      </div>
    </section>
  );
}

const fieldCls = "rounded-xl border border-black/10 bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/30";
