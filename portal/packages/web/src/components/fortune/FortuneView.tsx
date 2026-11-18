import RichFortuneView from "./RichFortuneView.js";
import PeriodFortuneView from "./PeriodFortuneView.js";

export type FortuneMode = "today" | "zodiac" | "star" | "newyear" | "monthly";

interface FortuneViewProps {
  mode: FortuneMode;
}

// 디스패처: 오늘·띠별·별자리는 만세 엔진 결합 일진 리치, 신년·월간은 세운/월운 기간 리치.
export default function FortuneView({ mode }: FortuneViewProps) {
  if (mode === "today" || mode === "zodiac" || mode === "star") return <RichFortuneView mode={mode} />;
  return <PeriodFortuneView mode={mode} />;
}
