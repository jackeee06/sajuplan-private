import type { Topic } from "../data/topics.js";

interface TopicTileProps {
  topic: Topic;
  onOpen: (topic: Topic) => void;
}

// 아이콘 배지 톤 — 이모지를 "디자인된 앱 아이콘"처럼 보이게 감싼다(날것 방지).
const badgeTone: Record<NonNullable<Topic["tone"]>, string> = {
  accent: "bg-white/25 text-white",
  primary: "bg-primary-500/12 text-primary-600",
  plain: "bg-accent-50 text-accent-500",
};

export default function TopicTile({ topic, onOpen }: TopicTileProps) {
  const tone = topic.tone ?? "plain";
  const isSoon = topic.kind === "soon";

  // 강조 타일(로또) — 가로 한 줄(아이콘+글자+화살표). 컴팩트.
  if (topic.featured) {
    return (
      <button
        type="button"
        data-testid="topic-tile"
        onClick={() => onOpen(topic)}
        className="col-span-2 flex items-center gap-3 rounded-card bg-accent-500 px-4 py-2.5 text-left text-white shadow-card transition active:scale-[0.98]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/25 text-[20px]" aria-hidden>
          {topic.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-bold leading-tight">{topic.name}</span>
          <span className="block text-[12px] leading-tight text-white/85">{topic.teaser}</span>
        </span>
        <span className="shrink-0 text-white/80" aria-hidden>›</span>
      </button>
    );
  }

  // 일반 타일 — 가로 한 줄(아이콘 + 제목·설명). 컴팩트.
  return (
    <button
      type="button"
      data-testid="topic-tile"
      onClick={() => onOpen(topic)}
      disabled={isSoon}
      className={[
        "flex items-center gap-2.5 rounded-card bg-white p-3 text-left ring-1 ring-black/[0.06] shadow-card transition",
        isSoon ? "opacity-70" : "active:scale-[0.98]",
      ].join(" ")}
    >
      <span
        className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[20px]", badgeTone[tone]].join(" ")}
        aria-hidden
      >
        {topic.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold leading-tight text-ink">{topic.name}</span>
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-ink/66">{topic.teaser}</span>
      </span>
      {topic.kind === "embed" && (
        <span className="shrink-0 text-[15px] font-bold text-primary-400" aria-label="전체 보기">↗</span>
      )}
      {isSoon && (
        <span className="shrink-0 self-start rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold text-ink/62">
          준비중
        </span>
      )}
    </button>
  );
}
