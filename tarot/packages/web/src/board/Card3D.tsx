import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Suit, TarotCard } from '@tarot/engine';

const SUIT_GLYPH: Record<Suit, string> = {
  wands: '🔥',
  cups: '💧',
  swords: '⚔️',
  pentacles: '🪙',
};
const SUIT_COLOR: Record<Suit, string> = {
  wands: '#e8924a',
  cups: '#5aa9e6',
  swords: '#c2c8d2',
  pentacles: '#d4a93f',
};

// 이미지 파일이 아직 없을 때도 "진짜 카드처럼" 보이는 타이포그래픽 폴백.
function CardFaceFallback({ card }: { card: TarotCard }) {
  const isMajor = card.arcana === 'major';
  const glyph = isMajor ? '✦' : SUIT_GLYPH[card.suit as Suit];
  const color = isMajor ? '#b9a3f9' : SUIT_COLOR[card.suit as Suit];
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-between p-[8%] text-center"
      style={{
        background: 'linear-gradient(160deg, #faf7ff 0%, #efe9ff 60%, #e3d8ff 100%)',
        color: '#2a1a4d',
      }}
    >
      <div className="text-[10px] font-bold tracking-wide" style={{ color }}>
        {isMajor ? card.number : card.nameEn.split(' ')[0]?.toUpperCase()}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="text-[26px] leading-none" style={{ filter: 'saturate(1.1)' }}>
          {glyph}
        </div>
        <div className="text-[13px] font-extrabold leading-tight" style={{ color: '#1b1230' }}>
          {card.nameKo}
        </div>
      </div>
      <div className="text-[8px] font-medium opacity-60">{card.nameEn}</div>
    </div>
  );
}

// 카드 공개 순간의 "과한 액션" — 사방으로 튀는 스파클 + 금빛 글로우 링.
const SPARK_OFFSETS = [
  { dx: '-34px', dy: '-30px' },
  { dx: '34px', dy: '-32px' },
  { dx: '-42px', dy: '12px' },
  { dx: '40px', dy: '16px' },
  { dx: '-6px', dy: '-48px' },
  { dx: '8px', dy: '44px' },
];
function RevealBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <span className="reveal-ring absolute inset-0" />
      {SPARK_OFFSETS.map((s, i) => (
        <span
          key={i}
          className="reveal-spark absolute text-[15px]"
          style={{ '--dx': s.dx, '--dy': s.dy, animationDelay: `${i * 0.03}s` } as CSSProperties}
        >
          ✨
        </span>
      ))}
    </div>
  );
}

export interface Card3DProps {
  card?: TarotCard; // 없으면 뒷면만(빈 슬롯/대기)
  reversed?: boolean;
  revealed?: boolean;
  onClick?: () => void;
  dim?: boolean;
  glow?: boolean;
  className?: string;
}

export default function Card3D({ card, reversed, revealed, onClick, dim, glow, className }: Card3DProps) {
  const [imgError, setImgError] = useState(false);
  const flipped = !!(revealed && card);

  // 뒤집히는 "순간"(false→true)에만 버스트 연출 1회. 재접속 시 이미 공개된 카드엔 안 터짐.
  const [burst, setBurst] = useState(false);
  const prevFlipped = useRef(flipped);
  useEffect(() => {
    if (flipped && !prevFlipped.current) {
      setBurst(true);
      const t = window.setTimeout(() => setBurst(false), 850);
      prevFlipped.current = flipped;
      return () => window.clearTimeout(t);
    }
    prevFlipped.current = flipped;
  }, [flipped]);

  return (
    <div
      className={`card3d relative aspect-[2/3] select-none ${flipped ? 'is-flipped' : ''} ${
        burst ? 'reveal-pop' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${dim ? 'opacity-40' : ''} ${className ?? ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="card3d__inner">
        {/* 뒷면 */}
        <div className={`card3d__face card-back ${glow ? 'glow-pick' : ''}`} />
        {/* 앞면 */}
        <div className="card3d__face card3d__face--front bg-white">
          {card && !imgError ? (
            <img
              src={card.img}
              alt={card.nameKo}
              className={`h-full w-full object-cover ${reversed ? 'rotate-180' : ''}`}
              onError={() => setImgError(true)}
              draggable={false}
            />
          ) : card ? (
            <div className={reversed ? 'h-full w-full rotate-180' : 'h-full w-full'}>
              <CardFaceFallback card={card} />
            </div>
          ) : null}
          {reversed && card && (
            <span className="absolute right-1 top-1 rounded bg-accent-500/90 px-1 text-[8px] font-bold text-white">
              역
            </span>
          )}
        </div>
      </div>
      {burst && <RevealBurst />}
    </div>
  );
}
