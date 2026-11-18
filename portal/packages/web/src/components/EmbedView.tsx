import { loadProfile } from "../lib/profile.js";

interface EmbedViewProps {
  title: string;
  src: string;
  onBack: () => void;
}

// 포털 안 iframe — 기존 만세·타로를 "그대로"(복사 X) 띄운다. 뒤로가기로 포털 복귀.
// 만세력엔 공유 프로필을 만세 네이티브 파라미터(b/g/nm/lon/uh)로 넘겨 입력 없이 결과 바로.
export default function EmbedView({ title, src, onBack }: EmbedViewProps) {
  const p = loadProfile();
  let url = src;
  if (p?.birth && src.includes("manse")) {
    // 만세력 형식: b=YYYY-MM-DDTHH:mm, uh=시간모름(1/0). 시각 없으면 정오+시간모름.
    const t = p.time || "12:00";
    const params = new URLSearchParams({
      b: `${p.birth}T${t}`,
      g: p.gender || "M",
      lon: String(p.lon ?? 127),
      uh: p.time ? "0" : "1",
    });
    if (p.name) params.set("nm", p.name);
    url = `${src}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* 포털 뒤로가기 바 (만세·타로 위에 얇게) */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="포털로"
          className="flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-[14px] font-semibold text-accent-500 active:bg-accent-50"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          운세 포털
        </button>
        <span className="text-[14px] font-bold text-ink/88">· {title}</span>
      </div>
      {/* 실제 만세·타로 (라이브, 복사 아님) */}
      <iframe
        title={title}
        src={url}
        className="w-full flex-1 border-0"
        allow="clipboard-write; web-share"
      />
    </div>
  );
}
