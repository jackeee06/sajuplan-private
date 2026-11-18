import { useState } from "react";

// 만세력식 시각 입력 — 숫자 타이핑 → "07:20" 자동 포맷. 값은 "HH:mm" 또는 "".
const onlyDigits = (s: string) => s.replace(/\D/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

function format(d: string): string {
  let out = d.slice(0, 2);
  if (d.length > 2) out += ":" + d.slice(2, 4);
  return out;
}
function toHHmm(d: string): string {
  if (d.length < 4) return "";
  const H = Math.min(23, Number(d.slice(0, 2)));
  const M = Math.min(59, Number(d.slice(2, 4)));
  return `${pad(H)}:${pad(M)}`;
}

interface TimeFieldProps {
  value: string;
  onChange: (hhmm: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function TimeField({ value, onChange, disabled, className }: TimeFieldProps) {
  const [raw, setRaw] = useState(value ? value.replace(/\D/g, "").slice(0, 4) : "");

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const d = onlyDigits(e.target.value).slice(0, 4);
    setRaw(d);
    onChange(toHHmm(d));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={format(raw)}
      onChange={handle}
      disabled={disabled}
      placeholder="07:20"
      aria-label="태어난 시각"
      className={className}
    />
  );
}
