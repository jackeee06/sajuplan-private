import { useState } from 'react';
import { DECK } from '@tarot/engine';

export interface CardGridProps {
  count?: number;
  pickedPositions: Set<number>;
  onPick: (deckPos: number) => void;
  disabled?: boolean;
}

export default function CardGrid({ count = DECK.length, pickedPositions, onPick, disabled }: CardGridProps) {
  const [vanishing, setVanishing] = useState<Set<number>>(new Set());
  const items = Array.from({ length: count }, (_, i) => i);

  const handlePick = (i: number) => {
    setVanishing((prev) => new Set([...prev, i]));
    // 애니메이션(0.3s) 후에 실제 pick 이벤트 전달
    setTimeout(() => onPick(i), 150);
  };

  return (
    <div className="grid grid-cols-9 gap-1.5">
      {items.map((i) => {
        const picked = pickedPositions.has(i);
        const isVanishing = vanishing.has(i);
        if (picked && !isVanishing) return <div key={i} className="aspect-[2/3]" />;
        return (
          <button
            key={i}
            type="button"
            aria-label={`카드 ${i + 1}`}
            disabled={disabled || picked || isVanishing}
            onClick={() => handlePick(i)}
            className={`card-back aspect-[2/3] rounded-[5px] ${isVanishing ? 'card-vanish' : 'transition active:scale-95'}`}
          />
        );
      })}
    </div>
  );
}
