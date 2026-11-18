import type { Spread } from '@tarot/engine';

// 스프레드 "모양"을 진짜 카드(만다라 뒷면)로 큼직하게 보여준다. 점이 아니라 실제 카드라 예쁘고,
// 배열 모양도 그대로 보여 어떤 스프레드인지 한눈에. (positions 좌표 재사용)
export default function SpreadMini({ spread, active }: { spread: Spread; active?: boolean }) {
  const c = spread.count;
  const w = c <= 1 ? 50 : c <= 3 ? 40 : c <= 6 ? 32 : 24; // 카드가 적을수록 크게
  const h = Math.round(w * 1.5);
  return (
    <div
      className={`relative h-[124px] w-full overflow-hidden rounded-xl border ${
        active ? 'border-[#f9a8d4] bg-[#fff5fa]' : 'border-gray-100 bg-gray-50'
      }`}
    >
      {spread.positions.map((pos) => (
        <div
          key={pos.idx}
          className="card-back absolute rounded-[5px]"
          style={{
            left: `${8 + (pos.x / 100) * 84}%`,
            top: `${12 + (pos.y / 100) * 76}%`,
            width: w,
            height: h,
            transform: `translate(-50%, -50%) rotate(${pos.rot ?? 0}deg)`,
          }}
        />
      ))}
    </div>
  );
}
