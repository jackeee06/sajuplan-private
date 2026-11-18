// 🔮 고객(member) 전용 — 단계별 작업지시/대기를 공용 StatusBanner(비콘 한 줄)로 표시.
//   대기(wait): 상담사가 진행하는 동안 기다림 / 행동(do): 카드 뽑기 차례.
import StatusBanner from './StatusBanner';
import { spreadCount, type TarotState } from '@tarot/engine';

interface Banner { tone: 'wait' | 'do'; icon: string; head: string; sub: string }

function bannerFor(state: TarotState): Banner {
  const need = spreadCount(state);
  const picked = state.picks.length;
  switch (state.phase) {
    case 'lobby':
      return { tone: 'wait', icon: '🔮', head: '잠시만 기다려 주세요', sub: '상담사가 배열을 고르고 있어요' };
    case 'shuffle':
      return { tone: 'wait', icon: '🔮', head: '잠시만 기다려 주세요', sub: '카드에 질문을 떠올리며 · 준비되면 말씀해 주세요' };
    case 'spread':
    case 'picking':
      return { tone: 'do', icon: '👆', head: '카드를 골라 주세요', sub: `원하는 카드 ${need}장 · ${picked}/${need} 선택` };
    case 'revealing':
      return { tone: 'wait', icon: '✨', head: '잠시만 기다려 주세요', sub: '상담사가 카드를 펼치고 있어요' };
    case 'done':
      return { tone: 'wait', icon: '🎴', head: '잠시만 기다려 주세요', sub: '상담사가 전화로 해설하고 있어요' };
    default:
      return { tone: 'wait', icon: '🔮', head: '잠시만 기다려 주세요', sub: '상담을 준비하고 있어요' };
  }
}

export default function MemberStatusBanner({ state }: { state: TarotState }) {
  const b = bannerFor(state);
  return <StatusBanner tone={b.tone} icon={b.icon} head={b.head} sub={b.sub} />;
}
