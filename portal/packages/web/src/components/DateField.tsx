import { useState } from "react";
import { isValidDate } from "../lib/dateKey.js";

// 만세력식 생년월일 입력 — native 달력(휠) 대신 숫자 타이핑 → "1990/06/15" 자동 포맷.
// 모바일 숫자 키패드(inputMode=numeric). 값은 "YYYY-MM-DD"로 부모에 전달.
// ⚠️ 8자리를 채워도 실제 없는 날짜(예 6/86)면 무효 → 빈값 전달(부모가 결과 안 냄) + 빨간 표시.

const onlyDigits = (s: string) => s.replace(/\D/g, "");

function format(d: string): string {
  let out = d.slice(0, 4);
  if (d.length > 4) out += "/" + d.slice(4, 6);
  if (d.length > 6) out += "/" + d.slice(6, 8);
  return out;
}

function toISO(d: string): string {
  if (d.length < 8) return "";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

interface DateFieldProps {
  /** "YYYY-MM-DD" 또는 "" */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
}

export default function DateField({ value, onChange, className, placeholder, ...rest }: DateFieldProps) {
  const [raw, setRaw] = useState(value ? value.replace(/-/g, "").slice(0, 8) : "");

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const d = onlyDigits(e.target.value).slice(0, 8);
    setRaw(d);
    const iso = toISO(d);
    // 유효한 날짜만 부모에 전달, 미완성·없는날짜(6/86 등)는 빈값 → 결과/버튼 막힘
    onChange(iso && isValidDate(iso) ? iso : "");
  }

  const invalid = raw.length === 8 && !isValidDate(toISO(raw));

  return (
    <input
      type="text"
      inputMode="numeric"
      value={format(raw)}
      onChange={handle}
      placeholder={placeholder ?? "1990/06/15"}
      title={invalid ? "올바른 날짜를 입력하세요" : undefined}
      className={[className ?? "", invalid ? "!border-[#dc2626] !ring-2 !ring-[#dc2626]/25" : ""].join(" ")}
      aria-label={rest["aria-label"] ?? "생년월일"}
      aria-invalid={invalid}
    />
  );
}
