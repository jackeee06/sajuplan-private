/**
 * 정확도 검증 하베스트
 * ──────────────────────────────────────────────────────────────
 * A. 확정 로직(외부 데이터 불필요) — 지금 통과해야 함
 * B. 🔴 정확도 핀(PIN) — 원광/KASI 골든 명식 필요. 데이터 확보 전까지 skip.
 */
import { describe, it, expect } from "vitest";
import { computeManse } from "../src/index.js";
import {
  tenGodOf, twelveStageOf, gongmangOf, ganzhi,
} from "../src/constants.js";

// ── A. 확정 로직 ────────────────────────────────────────────────
describe("A. 확정 명리 로직 (외부 데이터 불필요)", () => {
  it("년주: 1984년은 입춘 이후 甲子년 (index 0)", () => {
    const c = computeManse({ birth: "1984-06-01T12:00", gender: "M" });
    expect(c.pillars.year.ganzhi).toBe("甲子");
    expect(c.corrected.sajuYear).toBe(1984);
  });

  it("년주: 1984년 입춘 이전(1월)은 직전해 癸亥년", () => {
    const c = computeManse({ birth: "1984-01-10T12:00", gender: "M" });
    expect(c.corrected.sajuYear).toBe(1983);
    expect(c.pillars.year.ganzhi).toBe("癸亥"); // (1983-4)%60=59 → 癸亥
  });

  it("월주 오호둔: 甲년 寅월의 월간은 丙 (丙寅)", () => {
    // 1984(甲子년) 2월 하순 = 寅월
    const c = computeManse({ birth: "1984-02-20T12:00", gender: "M" });
    expect(c.pillars.month.branch.hanja).toBe("寅");
    expect(c.pillars.month.stem.hanja).toBe("丙");
  });

  it("십성: 일간 기준 같은 천간 = 비견, 같은오행 다른음양 = 겁재", () => {
    expect(tenGodOf(0, 0)).toBe("비견"); // 甲-甲
    expect(tenGodOf(0, 1)).toBe("겁재"); // 甲-乙 (둘다 목, 음양 다름)
    expect(tenGodOf(0, 2)).toBe("식신"); // 甲(목)→丙(화) 생, 같은 양
    expect(tenGodOf(0, 4)).toBe("편재"); // 甲(목)克戊(토), 같은 양
    expect(tenGodOf(0, 6)).toBe("편관"); // 庚(금)克甲, 같은 양
    expect(tenGodOf(0, 8)).toBe("편인"); // 壬(수)→甲 생, 같은 양
  });

  it("12운성: 甲은 亥에서 장생", () => {
    expect(twelveStageOf(0, 11)).toBe("장생"); // 甲 장생 = 亥
    expect(twelveStageOf(0, 0)).toBe("목욕");  // 다음 子
  });

  it("공망: 甲子순(일주 index 0)의 공망은 戌亥", () => {
    const [a, b] = gongmangOf(0);
    expect([a, b]).toEqual([10, 11]); // 戌, 亥
  });

  it("60갑자 매핑 일관성: index→{stem,branch}→index 왕복", () => {
    for (let i = 0; i < 60; i++) {
      const { stem, branch } = ganzhi(i);
      expect(stem).toBe(i % 10);
      expect(branch).toBe(i % 12);
    }
  });

  it("스모크: computeManse 가 명식 전체를 정상 반환 (시주 포함)", () => {
    const c = computeManse({ birth: "1990-06-15T07:20", gender: "F", longitude: 127.0 });
    expect(c.pillars.year.ganzhi).toHaveLength(2);
    expect(c.pillars.month.ganzhi).toHaveLength(2);
    expect(c.pillars.day.ganzhi).toHaveLength(2);
    expect(c.pillars.hour?.ganzhi).toHaveLength(2);
    expect(c.daewoon.list).toHaveLength(10);
    expect(c.gongmang).toHaveLength(2);
    // 진태양시 보정 적용됨(경도 127 < 135 → 음수 분)
    expect(c.corrected.longitudeMinutes).toBeCloseTo((127 - 135) * 4, 1);
  });

  it("시간 모름: 시주 null", () => {
    const c = computeManse({ birth: "1990-06-15T00:00", gender: "M", unknownHour: true });
    expect(c.pillars.hour).toBeNull();
  });

  it("일주 앵커 핀 완료: accuracyPinned=true", () => {
    const c = computeManse({ birth: "1990-06-15T07:20", gender: "M" });
    expect(c.meta.accuracyPinned).toBe(true);
  });
});

// ── B. 🔴 정확도 핀 (원광/KASI 골든 명식 필요) ────────────────────
// 사용법: 신뢰 만세력에서 정답 명식을 받아 아래 GOLDEN 채우고 describe.skip → describe.
// 일주 앵커(DAY_PILLAR_OFFSET)와 절기 시각을 이걸로 고정한다.
const GOLDEN: { birth: string; gender: "M" | "F"; year: string; month: string; day: string; hour: string }[] = [
  // 예: { birth: "1990-06-15T07:20", gender: "M", year: "庚午", month: "壬午", day: "??", hour: "??" },
];

describe.skip("B. 정확도 핀 — 원광/KASI 전체 명식 골든 대조 (데이터 확보 후 활성화)", () => {
  for (const g of GOLDEN) {
    it(`${g.birth} 명식 일치`, () => {
      const c = computeManse({ birth: g.birth, gender: g.gender });
      expect(c.pillars.year.ganzhi).toBe(g.year);
      expect(c.pillars.month.ganzhi).toBe(g.month);
      expect(c.pillars.day.ganzhi).toBe(g.day);   // ← 일주 앵커 핀
      expect(c.pillars.hour?.ganzhi).toBe(g.hour);
    });
  }
});

// ── A2. ✅ 월주 절기(節) 경계 — "달력 월 아님" 회귀 (2026-07 제보 대응) ──
// 사주의 달은 절기로 바뀐다: 소서(~7/7) 전=午, 후=未 / 입추(~8/7) 후=申.
// 7월에 申(병신)이 나오면 버그. 이 블록이 경계를 못박는다.
describe("A2. 월주 절기 경계", () => {
  const mp = (birth: string) => computeManse({ birth, gender: "M", longitude: 127 }).pillars.month.ganzhi;
  it("2026 소서 前(7/6) → 甲午(오월)", () => expect(mp("2026-07-06T12:00")).toBe("甲午"));
  it("2026 소서 後(7/15) → 乙未(미월), 병신 아님", () => {
    expect(mp("2026-07-15T12:00")).toBe("乙未");
    expect(mp("2026-07-15T12:00")).not.toBe("丙申");
  });
  it("2026 입추 前(8/6) → 乙未(미월)", () => expect(mp("2026-08-06T12:00")).toBe("乙未"));
  it("2026 입추 後(8/15) → 丙申(신월)", () => expect(mp("2026-08-15T12:00")).toBe("丙申"));

  it("월주 근거(monthTerm) 노출: 7/15는 소서 입절 → 未월", () => {
    const c = computeManse({ birth: "2026-07-15T12:00", gender: "M", longitude: 127 });
    expect(c.corrected.monthTerm.name).toBe("소서");
    expect(c.corrected.monthTerm.deg).toBe(105);
    expect(c.corrected.monthTerm.at.startsWith("2026-07-07")).toBe(true); // 소서 입절일
    expect(c.pillars.month.branch.hanja).toBe("未");
    expect(c.corrected.trueSolarApplied).toBe(true);
  });

  it("모든 해(1970~2030) 7/15는 未월 — 신월(申) 절대 없음", () => {
    for (let y = 1970; y <= 2030; y++) {
      const gz = mp(`${y}-07-15T12:00`);
      expect(gz[1]).toBe("未");
    }
  });
});

// ── C. ✅ 일주 앵커 핀 (권위 기준일 — Wikipedia "Sexagenary cycle") ──
// 일주는 천문(절기)과 무관한 60갑자 연속 카운트 → 이 두 점이 오프셋을 완전 고정한다.
describe("C. 일주 앵커 검증 (권위 기준일)", () => {
  it("1949-10-01 은 甲子일 (중화인민공화국 수립일)", () => {
    const c = computeManse({ birth: "1949-10-01T12:00", gender: "M" });
    expect(c.pillars.day.ganzhi).toBe("甲子");
  });
  it("1592-12-31 은 甲申일 (그레고리력 교차검증)", () => {
    const c = computeManse({ birth: "1592-12-31T12:00", gender: "M" });
    expect(c.pillars.day.ganzhi).toBe("甲申");
  });
  it("정확도 핀 완료: accuracyPinned=true", () => {
    const c = computeManse({ birth: "1990-06-15T07:20", gender: "M" });
    expect(c.meta.accuracyPinned).toBe(true);
  });
});

// ── D. 심화 분석 (오행/십성 분포·신살·세운) ──────────────────────
describe("D. 심화 분석", () => {
  const c = computeManse({ birth: "1969-10-12T10:00", gender: "M", longitude: 129.0 });

  it("오행 분포: 5오행 합 ~100%, 금 과다(4개)", () => {
    const sum = c.analysis.elements.reduce((a, e) => a + e.percent, 0);
    expect(Math.round(sum)).toBe(100);
    const geum = c.analysis.elements.find((e) => e.element === "금")!;
    expect(geum.count).toBe(4); // 庚辛申酉
    expect(geum.level).toBe("과다");
    const su = c.analysis.elements.find((e) => e.element === "수")!;
    expect(su.count).toBe(0);
    expect(su.level).toBe("부족");
  });

  it("십성 분포: 일간 제외 7글자 합", () => {
    const total = c.analysis.tenGods.reduce((a, t) => a + t.count, 0);
    expect(total).toBe(7); // 천간3 + 지지정기4
  });

  it("신살: 庚일간·申일지 → 양인살(酉)·도화살(酉) 검출", () => {
    const names = c.analysis.sinsal.map((s) => s.name);
    expect(names).toContain("양인살");
    expect(names).toContain("도화살");
  });

  it("세운: 10년, 출생년 1969=己酉부터", () => {
    expect(c.analysis.sewoon).toHaveLength(10);
    expect(c.analysis.sewoon[0]!.year).toBe(1969);
    expect(c.analysis.sewoon[0]!.ganzhi).toBe("己酉");
  });

  it("신강/신약: 금 과다 사주 → 태강, 용신 수(설기)", () => {
    const s = c.analysis.strength;
    expect(s.ratio).toBeCloseTo(0.8, 2);
    expect(s.label).toBe("태강");
    expect(s.yongsin).toBe("수");
  });

  it("득령·득지·득세: 금 강한 사주 → 모두 true", () => {
    const s = c.analysis.strength;
    expect(s.deukRyeong).toBe(true); // 월지 戌 토生금
    expect(s.deukJi).toBe(true);     // 일지 申 금
    expect(s.deukSe).toBe(true);
  });

  it("월운: 12개월, 己酉년 寅월=丙寅부터", () => {
    expect(c.analysis.woon).toHaveLength(12);
    expect(c.analysis.woon[0]!.ganzhi).toBe("丙寅");
    expect(c.analysis.woon[0]!.monthLabel).toBe("인월");
  });

  it("격국: 庚일간·월지 戌(정기 戊) → 편인격", () => {
    expect(c.analysis.gyeokguk).toBe("편인격");
  });

  it("신살 확대: 건록(申)·암록(巳)·학당귀인(巳) 검출", () => {
    const names = c.analysis.sinsal.map((s) => s.name);
    expect(names).toContain("건록");
    expect(names).toContain("암록");
    expect(names).toContain("학당귀인");
  });

  it("오행 십성역할: 금=비겁·토=인성·화=관성 (일간 庚)", () => {
    const role = (el: string) => c.analysis.elements.find((e) => e.element === el)!.role;
    expect(role("금")).toBe("비겁");
    expect(role("토")).toBe("인성");
    expect(role("화")).toBe("관성");
  });

  it("합·충: 천간합·천간충·육합 검출", () => {
    const types = c.analysis.hapchung.map((r) => r.type);
    expect(types).toContain("천간합"); // 己甲
    expect(types).toContain("천간충"); // 甲庚
    expect(types).toContain("육합");   // 巳申
  });

  it("지지 관계: 형·파·해·원진 검출 (酉戌申巳)", () => {
    const types = c.analysis.hapchung.map((r) => r.type);
    expect(types).toContain("형");     // 申巳
    expect(types).toContain("파");     // 申巳
    expect(types).toContain("해");     // 酉戌
    expect(types).toContain("원진");   // 巳戌
  });

  it("12신살(년지 酉 金국): 년=장성살 · 시=지살", () => {
    const byPillar = (p: string) => c.analysis.sinsal12.find((s) => s.pillar === p)!.name;
    expect(byPillar("year")).toBe("장성살");
    expect(byPillar("hour")).toBe("지살");
  });
});

// ── D2. 신살 정확도 핀 (길성/흉살 위치 회귀 잠금) ────────────────
// 1990-06-15T07:20(lon127) = 庚午년·壬午월·辛亥일·辛卯시 — 원광/경쟁사 만세력과 신살 9종 대조 일치
describe("D2. 신살 정확도 (신규 길성/흉살 위치 핀)", () => {
  const c = computeManse({ birth: "1990-06-15T07:20", gender: "M", longitude: 127.0 });
  const names = new Set(c.analysis.sinsal.map((s) => s.name));
  const on = (name: string) => c.analysis.sinsal.filter((s) => s.name === name).map((s) => s.pillar).sort();

  it("기준 사주 신살 9종 정확 (경쟁사/원광 대조)", () => {
    expect(names).toEqual(new Set([
      "천을귀인", "도화살", "역마살", "문곡귀인", "천덕귀인", "금여", "태극귀인", "현침살", "천문성",
    ]));
  });
  it("천덕귀인·금여·태극귀인·천문성 = 일주(辛亥)에 위치", () => {
    for (const n of ["천덕귀인", "금여", "태극귀인", "천문성"]) expect(on(n)).toContain("day");
  });
  it("천을귀인·문곡귀인 = 년·월(午午)에 위치", () => {
    expect(on("천을귀인")).toEqual(["month", "year"]);
    expect(on("문곡귀인")).toEqual(["month", "year"]);
  });
  it("역마살 = 사생지 亥(일지) / 도화살 = 卯(시지)", () => {
    expect(on("역마살")).toContain("day");
    expect(on("도화살")).toContain("hour");
  });
  it("납음: 辛亥 일주 = 차천금 / 庚午 년주 = 노방토", () => {
    expect(c.pillars.day.nayin).toBe("차천금");
    expect(c.pillars.year.nayin).toBe("노방토");
  });
  it("천을귀인 지지: 辛 일간 = 寅午 / 12신살 일지기준·자좌운성 존재", () => {
    expect(c.analysis.cheoneul).toEqual(["寅", "午"]);
    expect(c.analysis.sinsal12Day).toHaveLength(4);
    expect(c.pillars.day.selfStage).toBeTruthy();
  });
  it("귀문관살: 1969-10-12 사주(巳·戌 쌍) 검출", () => {
    const d = computeManse({ birth: "1969-10-12T10:00", gender: "M", longitude: 129.0 });
    expect(d.analysis.sinsal.map((s) => s.name)).toContain("귀문관살");
  });
});

// ── G. 음력 변환 ────────────────────────────────────────────────
import { solarToLunar, lunarToSolar } from "../src/index.js";
describe("G. 음력 변환 (천문 계산)", () => {
  it("설날: 2024-02-10 = 음력 2024.1.1", () => {
    const l = solarToLunar(2024, 2, 10);
    expect(l).toMatchObject({ year: 2024, month: 1, day: 1, leap: false });
  });
  it("설날: 2025-01-29 = 음력 2025.1.1", () => {
    const l = solarToLunar(2025, 1, 29);
    expect(l).toMatchObject({ month: 1, day: 1, leap: false });
  });
  it("설날: 2026-02-17 = 음력 2026.1.1", () => {
    const l = solarToLunar(2026, 2, 17);
    expect(l).toMatchObject({ month: 1, day: 1, leap: false });
  });
  it("2000-01-01 = 음력 1999.11.25", () => {
    const l = solarToLunar(2000, 1, 1);
    expect(l).toMatchObject({ year: 1999, month: 11, day: 25, leap: false });
  });
  it("역변환: 음력 2024.1.1 = 양력 2024-02-10 (설날)", () => {
    expect(lunarToSolar(2024, 1, 1)).toEqual({ year: 2024, month: 2, day: 10 });
  });
  it("역변환: 음력 1999.11.25 = 양력 2000-01-01", () => {
    expect(lunarToSolar(1999, 11, 25)).toEqual({ year: 2000, month: 1, day: 1 });
  });
  it("왕복: 양력→음력→양력 동일 (1990-06-15)", () => {
    const l = solarToLunar(1990, 6, 15);
    expect(lunarToSolar(l.year, l.month, l.day, l.leap)).toEqual({ year: 1990, month: 6, day: 15 });
  });
  it("윤달 구분: 2023 평2월/윤2월 1일", () => {
    expect(lunarToSolar(2023, 2, 1, false)).toEqual({ year: 2023, month: 2, day: 20 }); // 평2월
    expect(lunarToSolar(2023, 2, 1, true)).toEqual({ year: 2023, month: 3, day: 22 });  // 윤2월
  });
});

// ── F. 궁합 ─────────────────────────────────────────────────────
import { computeCompatibility } from "../src/index.js";
describe("F. 궁합", () => {
  const r = computeCompatibility(
    { birth: "1990-06-15T07:20", gender: "M" },
    { birth: "1992-03-03T14:00", gender: "F" },
  );
  it("두 명식 + 궁합 점수(0~100) + 등급 + 요인", () => {
    expect(r.a.pillars.day.ganzhi).toHaveLength(2);
    expect(r.b.pillars.day.ganzhi).toHaveLength(2);
    expect(r.compat.score).toBeGreaterThanOrEqual(0);
    expect(r.compat.score).toBeLessThanOrEqual(100);
    expect(["천생연분", "좋은 궁합", "무난한 궁합", "노력이 필요한 궁합"]).toContain(r.compat.level);
    expect(r.compat.factors.length).toBeGreaterThan(0);
  });
});

// ── E. 일진 달력 ────────────────────────────────────────────────
import { monthDayPillars, firstWeekday, monthSolarTerms } from "../src/index.js";
describe("E. 일진 달력", () => {
  it("월별 일주: 31일 + 간지 연속 증가", () => {
    const days = monthDayPillars(1969, 10);
    expect(days).toHaveLength(31);
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!.ganzhiIndex).toBe((days[i - 1]!.ganzhiIndex + 1) % 60);
    }
  });
  it("요일: 2000-01-01 = 토요일(6)", () => {
    expect(firstWeekday(2000, 1)).toBe(6);
  });
  it("절기: 1969년 10월 = 한로·상강", () => {
    const t = monthSolarTerms(1969, 10);
    const names = t.map((x) => x.name);
    expect(names).toContain("한로");
    expect(names).toContain("상강");
  });
});
