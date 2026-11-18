import { useState } from "react";
import { lunarToSolar, type ManseInput } from "@manse/engine";

const REGIONS = [
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

const SIGAN = [
  ["자시(子)", "23:30~01:30"], ["축시(丑)", "01:30~03:30"], ["인시(寅)", "03:30~05:30"],
  ["묘시(卯)", "05:30~07:30"], ["진시(辰)", "07:30~09:30"], ["사시(巳)", "09:30~11:30"],
  ["오시(午)", "11:30~13:30"], ["미시(未)", "13:30~15:30"], ["신시(申)", "15:30~17:30"],
  ["유시(酉)", "17:30~19:30"], ["술시(戌)", "19:30~21:30"], ["해시(亥)", "21:30~23:30"],
];

const onlyD = (s: string) => s.replace(/\D/g, "");
const pad = (n: number | string) => String(n).padStart(2, "0");

function fmtDate(raw: string): string {
  const d = raw.slice(0, 8);
  let out = d.slice(0, 4);
  if (d.length > 4) out += "/" + d.slice(4, 6);
  if (d.length > 6) out += "/" + d.slice(6, 8);
  return out;
}
function fmtTime(raw: string): string {
  const d = raw.slice(0, 4);
  let out = d.slice(0, 2);
  if (d.length > 2) out += ":" + d.slice(2, 4);
  return out;
}

interface Props {
  onCompute: (input: ManseInput) => void;
  onError?: (msg: string) => void;
  buttonLabel?: string;
}

export default function InputPanel({ onCompute, onError, buttonLabel }: Props) {
  const [name, setName] = useState("");
  const [cal, setCal] = useState<"solar" | "lunar" | "lunarLeap">("solar");
  const [dateRaw, setDateRaw] = useState(""); // 실사용: 빈칸 시작 (사용자가 직접 입력)
  const [timeRaw, setTimeRaw] = useState(""); // 실사용: 빈칸 시작
  const [unknownHour, setUnknownHour] = useState(false);
  const [yaja, setYaja] = useState(false);
  const [showSigan, setShowSigan] = useState(false);
  const [gender, setGender] = useState<"M" | "F">("F");
  const [lon, setLon] = useState(127.0);
  const [trueSolar, setTrueSolar] = useState(true);

  function submit() {
    if (dateRaw.length < 8) {
      onError?.("생년월일 8자리를 입력해 주세요 (예: 1990/06/15)");
      return;
    }
    if (!unknownHour && timeRaw.length < 4) {
      onError?.("태어난 시각을 입력하거나 '시간 모름'을 선택해 주세요");
      return;
    }
    const d = dateRaw.padEnd(8, "0").slice(0, 8);
    let y = +d.slice(0, 4), mo = +d.slice(4, 6) || 1, da = +d.slice(6, 8) || 1;
    try {
      if (cal !== "solar") {
        const s = lunarToSolar(y, mo, da, cal === "lunarLeap");
        y = s.year; mo = s.month; da = s.day;
      }
    } catch {
      onError?.("음력 날짜를 양력으로 바꾸지 못했습니다. 날짜를 확인해 주세요.");
      return;
    }
    let H = 12, M = "00";
    if (!unknownHour) {
      const t = timeRaw.padEnd(4, "0").slice(0, 4);
      H = Math.min(23, +t.slice(0, 2));
      M = pad(Math.min(59, +t.slice(2, 4)));
    }
    onCompute({
      calendar: "solar",
      name: name.trim() || undefined,
      birth: `${y}-${pad(mo)}-${pad(da)}T${pad(H)}:${M}`,
      gender,
      longitude: lon,
      unknownHour,
      options: { trueSolarTime: trueSolar, hourBoundary: yaja ? "ziShi" : "midnight" },
    });
  }

  const fieldCls = "rounded-lg border border-gray-200 px-3 py-2 text-base tabular-nums outline-none focus:border-primary-400";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      {/* 이름 + 성별 — 한 줄 */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[140px] flex-1">
          <span className="mb-1 block text-sm font-medium text-gray-600">이름 <span className="text-gray-400">(선택)</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="이름" className={`${fieldCls} w-full`} />
        </div>
        <div className="min-w-[160px] flex-1">
          <span className="mb-1 block text-sm font-medium text-gray-600">성별</span>
          <div className="flex gap-2">
            {(["F", "M"] as const).map((g) => (
              <button key={g} onClick={() => setGender(g)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ring-1 transition ${
                  gender === g ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-gray-600 ring-gray-200"
                }`}>
                {g === "F" ? "여성" : "남성"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 생년월일시 */}
      <div className="relative">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">생년월일시</span>
          <button type="button" onClick={() => setShowSigan((s) => !s)} className="text-xs font-medium text-accent-500">
            12간지 시간표 🔍
          </button>
        </div>
        {/* 양력/음력/윤달 + 날짜 + 시간 — 한 줄(모바일은 자동 줄바꿈) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {([["solar", "양력"], ["lunar", "음력"], ["lunarLeap", "음력 윤달"]] as const).map(([v, label]) => (
              <button
                key={v} type="button" onClick={() => setCal(v)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  cal === v ? "bg-white text-accent-500 shadow-sm" : "text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            inputMode="numeric" value={fmtDate(dateRaw)} placeholder="1990/06/15"
            onChange={(e) => setDateRaw(onlyD(e.target.value).slice(0, 8))}
            className={`${fieldCls} w-36 text-center placeholder:text-gray-300`} aria-label="생년월일"
          />
          <input
            inputMode="numeric" value={fmtTime(timeRaw)} placeholder="07:20" disabled={unknownHour}
            onChange={(e) => setTimeRaw(onlyD(e.target.value).slice(0, 4))}
            className={`${fieldCls} w-24 text-center placeholder:text-gray-300 disabled:bg-gray-100`} aria-label="태어난 시각"
          />
        </div>

        {/* 시간 모름 / 야자시 */}
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="accent-accent-500" checked={unknownHour} onChange={(e) => setUnknownHour(e.target.checked)} />
            시간 모름
          </label>
          <label className={`flex items-center gap-1.5 ${unknownHour ? "opacity-40" : ""}`}>
            <input type="checkbox" className="accent-accent-500" checked={yaja} disabled={unknownHour} onChange={(e) => setYaja(e.target.checked)} />
            야자시/조자시
          </label>
        </div>

        {showSigan && (
          <div className="absolute right-0 top-7 z-10 w-64 rounded-xl bg-white p-3 shadow-lg ring-1 ring-gray-200">
            <div className="mb-1 text-xs font-semibold text-gray-700">12간지 시간표 (진태양시 기준)</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {SIGAN.map(([n, r]) => (
                <div key={n} className="flex justify-between text-[11px] text-gray-500">
                  <span className="font-medium text-gray-700">{n}</span><span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 출생지 — 택일 */}
      <div className="mt-4">
        <span className="mb-1 block text-sm font-medium text-gray-600">출생지 <span className="text-gray-400">(진태양시 보정)</span></span>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button key={r.name} onClick={() => setLon(r.lon)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition ${
                lon === r.lon ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-gray-600 ring-gray-200"
              }`}>
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <input type="checkbox" className="accent-accent-500" checked={trueSolar} onChange={(e) => setTrueSolar(e.target.checked)} />
          진태양시 보정 (경도 + 균시차)
        </label>
        <button onClick={submit} className="w-full whitespace-nowrap rounded-full bg-accent-500 px-7 py-2.5 font-semibold text-white shadow-sm transition hover:bg-accent-600 sm:w-auto">
          {buttonLabel ?? "만세력 보기"}
        </button>
      </div>
    </div>
  );
}
