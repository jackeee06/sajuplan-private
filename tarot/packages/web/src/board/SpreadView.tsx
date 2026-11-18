import { cardAt, type Spread, type TarotPick } from '@tarot/engine';
import Card3D from './Card3D';

export interface SpreadViewProps {
  spread: Spread;
  labels?: string[]; // 쓰리카드 등 포지션 라벨 오버라이드
  picks: TarotPick[];
  deckOrder: number[];
  reversed: boolean[];
  revealing: boolean; // true면 탭으로 공개 가능
  onReveal: (slot: number) => void;
}

export default function SpreadView({
  spread,
  labels,
  picks,
  deckOrder,
  reversed,
  revealing,
  onReveal,
}: SpreadViewProps) {
  const n = spread.count;
  const cardW = n <= 1 ? 140 : n <= 3 ? 94 : n === 5 ? 78 : n <= 6 ? 72 : 54;
  const height =
    spread.layout === 'single'
      ? 240
      : spread.layout === 'row'
        ? 210
        : spread.layout === 'arc'
          ? 250
          : spread.layout === 'celtic'
            ? 380
            : 340; // relationship · choice

  return (
    <div className="relative mx-auto w-full max-w-[560px]" style={{ height }}>
      {spread.positions.map((pos) => {
        const pick = picks.find((p) => p.slot === pos.idx);
        const { card, reversed: isRev } = pick
          ? cardAt(deckOrder, reversed, pick.deckPos)
          : { card: undefined, reversed: false };
        const label = labels?.[pos.idx] ?? pos.nameKo;
        const canTap = revealing && pick && !pick.revealed;
        return (
          <div
            key={pos.idx}
            className="absolute flex flex-col items-center gap-1"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: cardW,
              transform: `translate(-50%, -50%) rotate(${pos.rot ?? 0}deg)`,
            }}
          >
            <div style={{ width: cardW }}>
              <Card3D
                card={card}
                reversed={isRev}
                revealed={!!pick?.revealed}
                glow={!!canTap}
                onClick={canTap ? () => onReveal(pos.idx) : undefined}
              />
            </div>
            <span
              className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200"
              style={{ transform: pos.rot ? `rotate(${-(pos.rot ?? 0)}deg)` : undefined }}
            >
              {pos.idx + 1}. {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
