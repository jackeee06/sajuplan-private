import { useEffect, useMemo } from 'react';
import { createLocalTransport } from './transport-local';
import { useTarot } from './useTarot';
import TarotBoard from './board/TarotBoard';
import LiveApp from './LiveApp';

// 첫 화면 히어로 — 밝은 배경 위 브랜드 보라 카드 한 줌(부채). 이미지 없이 CSS만.
function HeroFan() {
  const cards = [-2, -1, 0, 1, 2];
  return (
    <div className="relative mx-auto mb-1 h-[92px] w-[180px]">
      {cards.map((i) => (
        <div
          key={i}
          className="card-back absolute left-1/2 top-2 h-[74px] w-[50px] rounded-[9px]"
          style={{
            transformOrigin: '50% 120%',
            transform: `translateX(-50%) rotate(${i * 13}deg)`,
            zIndex: 10 - Math.abs(i),
          }}
        />
      ))}
    </div>
  );
}

// (A) 독립 마케팅 모드 — 누구나 혼자 카드를 뽑는 무료 타로.
function SoloBoard() {
  const transport = useMemo(() => createLocalTransport(), []);
  const { state, send } = useTarot(transport);
  // 진입 시 기본 배열 선택 → "카드 섞기" 버튼이 처음부터 활성(진한 핑크)
  useEffect(() => {
    send({ t: 'spread.set', key: 'three' });
  }, [send]);
  return (
    <TarotBoard
      state={state}
      send={send}
      role="solo"
      revealOnPick
    />
  );
}

export default function App() {
  // 모드 분기:
  //   - tarotroom.sajuplan.com → 라이브 상담(비공개, 상담사↔회원 동기화)
  //   - tarot.sajuplan.com      → 마케팅(공개, 혼자 뽑기)
  //   - ?role= / ?live=1        → 어느 도메인에서나 라이브 강제(테스트용)
  const params = new URLSearchParams(window.location.search);
  const isRoomHost = window.location.hostname.startsWith('tarotroom');
  const live = isRoomHost || params.get('live') === '1' || params.has('role');

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto flex min-h-[100dvh] max-w-[600px] flex-col px-4 pb-10 pt-6">
        <header className="mb-5 text-center">
          {!live && <HeroFan />}
          {!live && (
            <>
              <h1 className="text-[22px] font-extrabold tracking-tight text-gray-900">🔮 무료 타로</h1>
              <p className="mt-1 text-[12px] text-gray-400">정통 라이더웨이트 78장 · 사주플랜</p>
            </>
          )}
        </header>

        <main className="flex-1">{live ? <LiveApp /> : <SoloBoard />}</main>

        {!live && (
          <footer className="mt-8 text-center text-[10px] leading-relaxed text-gray-400">
            본 타로는 재미와 영감을 위한 무료 맛보기입니다.
            <br />
            깊은 풀이는 전화타로 상담사와 함께하세요.
          </footer>
        )}
      </div>
    </div>
  );
}
