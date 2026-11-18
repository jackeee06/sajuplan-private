import { useEffect, useState } from 'react';

// 카드를 뽑는 순간 화면 중앙에 숫자가 팡! 하고 나타났다 사라짐
// count: 방금 뽑은 카드 번호 (1, 2, 3...), total: 전체 장수
export default function PickFlash({ count, total }: { count: number; total: number }) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (count > 0) setKey((k) => k + 1); // 같은 count라도 재트리거
  }, [count]);

  if (count <= 0) return null;

  const isDone = count >= total;
  return (
    <div
      key={key}
      className="pick-flash select-none text-center"
    >
      {isDone ? (
        <>
          <div className="text-[340px] font-black leading-none text-accent-500 drop-shadow-2xl">✓</div>
          <div className="text-[80px] font-extrabold text-accent-600">완료!</div>
        </>
      ) : (
        <>
          <div className="text-[400px] font-black leading-none text-accent-500 drop-shadow-2xl">{count}</div>
          <div className="text-[60px] font-bold text-accent-400">{total}장 중</div>
        </>
      )}
    </div>
  );
}
