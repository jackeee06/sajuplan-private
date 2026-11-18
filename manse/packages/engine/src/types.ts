/**
 * 명식 출력 스키마 (단일 데이터 계약 — 스펙 §5)
 * ──────────────────────────────────────────────────────────────
 * 엔진·API·화면·AI분석·외부임베드가 모두 이 구조를 공유한다.
 * 버전드(version) — 구조 변경 시 올린다.
 */

export type Calendar = "solar" | "lunar";
export type Gender = "M" | "F";

export interface ManseOptions {
  /** 진태양시(경도+균시차) 보정. 기본 true */
  trueSolarTime?: boolean;
  /** 일주/시주 경계 학파. 기본 "midnight" */
  hourBoundary?: "midnight" | "ziShi";
}

export interface ManseInput {
  calendar?: Calendar; // 기본 solar
  /** 이름(선택, 표시용 — 계산에 미사용) */
  name?: string;
  /** "YYYY-MM-DDTHH:mm" 현지 민간시(태어난 시계 시각) */
  birth: string;
  gender: Gender;
  /** 출생지 경도(°E). 기본 한국 평균 127.5 */
  longitude?: number;
  /** 표준시 오프셋(시간). 기본 +9 (역사적 표준시/서머타임 자동 적용 예정) */
  tzOffsetHours?: number;
  /** 시간 모름 — 시주 제외 */
  unknownHour?: boolean;
  options?: ManseOptions;
}

/** 천간/지지 라벨 1글자 */
export interface StemLabel {
  index: number;
  hanja: string;
  ko: string;
  element: string;
  polarity: string;
}
export interface BranchLabel {
  index: number;
  hanja: string;
  ko: string;
  element: string;
  polarity: string;
  animal: string;
}

export interface PillarOut {
  stem: StemLabel;
  branch: BranchLabel;
  ganzhi: string; // "庚午"
  ganzhiKo: string; // "경오"
  /** 천간 십성 (일주는 "일원") */
  stemTenGod: string;
  /** 지지 십성 (지장간 정기) */
  branchTenGod: string;
  hiddenStems: { hanja: string; ko: string; tenGod: string }[];
  twelveStage: string; // 12운성 (일간 기준)
  selfStage: string; // 자좌운성 (그 기둥 천간이 자기 지지에서 갖는 12운성)
  nayin: string; // 납음오행 (예: "해중금")
}

export interface DaewoonOut {
  direction: "forward" | "reverse";
  directionKo: string; // "순행" | "역행"
  startAge: number;
  list: { age: number; ganzhi: string; ganzhiKo: string; element: string; stemTenGod: string; branchTenGod: string }[];
}

export interface ManseChart {
  version: string;
  /** 연운/월운 재계산용 일간 인덱스(0~9) */
  dayStemIndex: number;
  /** 양력 출생 연도 */
  birthYear: number;
  input: {
    calendar: Calendar;
    name?: string;
    birth: string;
    gender: Gender;
    longitude: number;
    tzOffsetHours: number;
    unknownHour: boolean;
    options: Required<ManseOptions>;
  };
  corrected: {
    sajuYear: number;
    trueSolarLocal: string; // 보정된 현지시 "YYYY-MM-DDTHH:mm"
    longitudeMinutes: number;
    equationOfTimeMinutes: number;
    trueSolarApplied: boolean; // 진태양시 보정 적용 여부(기본 true)
    monthTerm: { name: string; deg: number; at: string }; // 월주 입절 절기명 + KST 입절시각
  };
  pillars: {
    year: PillarOut;
    month: PillarOut;
    day: PillarOut;
    hour: PillarOut | null; // unknownHour 시 null
  };
  /** 공망 지지(한자) */
  gongmang: string[];
  daewoon: DaewoonOut;
  /** 심화 분석 — 오행/십성 분포 · 신살 · 세운 · 월운 · 신강약/용신 · 합충 · 12신살 */
  analysis: {
    elements: { element: string; count: number; percent: number; level: string; role: string }[];
    tenGods: { tenGod: string; count: number; percent: number }[];
    sinsal: { name: string; pillar: string }[];
    sewoon: { year: number; ganzhi: string; ganzhiKo: string; stemTenGod: string; branchTenGod: string; element: string }[];
    woon: { monthLabel: string; ganzhi: string; ganzhiKo: string; stemTenGod: string; branchTenGod: string; element: string }[];
    strength: { ratio: number; label: string; yongsin: string; yongsinReason: string; deukRyeong: boolean; deukJi: boolean; deukSe: boolean; bandPercent: number };
    gyeokguk: string;
    hapchung: { type: string; detail: string; pillars: string[]; row: "stem" | "branch" }[];
    sinsal12: { pillar: string; name: string }[]; // 년지 기준
    sinsal12Day: { pillar: string; name: string }[]; // 일지 기준
    cheoneul: string[]; // 천을귀인 지지(한자) — 요약 라벨용
  };
  meta: {
    engineVersion: string;
    /** 🔴 정확도 핀 통과 여부. false = 일주 앵커/절기 미검증 */
    accuracyPinned: boolean;
    validatedAgainst: string[];
  };
}
