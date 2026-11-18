// 🔮 공용 상태배너 — 타로 보드의 모든 "작업지시 / 대기 안내"를 한 줄로 통일.
//   반짝이는 핑(ping) 비콘 = "지금 할 일"을 가리키는 이정표. 상담사·솔로·고객 전부 이 한 줄을 쓴다.
//   - tone 'do'   : 지금 행동해라(연핑크 바탕 + 핑크 글자)
//   - tone 'wait' : 그냥 기다리거나 지켜봐라(회색 바탕 + 회색 글자)

type Tone = 'wait' | 'do';

// 반짝 핑 비콘 — 핑크 원이 퍼져나가는 파동. 모든 안내의 공통 포인트.
function PingBeacon({ icon }: { icon: string }) {
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      <span className="absolute h-full w-full animate-ping rounded-full bg-accent-300 opacity-60" />
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-[18px] shadow">
        {icon}
      </span>
    </div>
  );
}

export default function StatusBanner({
  tone = 'wait',
  icon,
  head,
  sub,
}: {
  tone?: Tone;
  icon: string;
  head: string;
  sub?: string;
}) {
  const isDo = tone === 'do';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ring-1 ${
        isDo ? 'bg-accent-50 ring-accent-300' : 'bg-gray-50 ring-gray-100'
      }`}
    >
      <PingBeacon icon={icon} />
      <div className="min-w-0 flex-1 text-left">
        <p className={`text-[16px] font-extrabold leading-tight ${isDo ? 'text-accent-600' : 'text-gray-900'}`}>
          {head}
        </p>
        {sub && (
          <p className={`mt-0.5 text-[12px] leading-snug ${isDo ? 'text-accent-500' : 'text-gray-500'}`}>{sub}</p>
        )}
      </div>
    </div>
  );
}
