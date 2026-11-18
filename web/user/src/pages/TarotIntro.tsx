import { useNavigate } from 'react-router-dom'
import { openExternalUrl } from '../lib/native-bridge'

/**
 * 🔮 전화 타로 상담 안내 페이지 (앱 내).
 *  홈 "타로상담" 버튼을 평소(진행 중 상담 없음)에 누르면 여기로 온다.
 *  - 전화 타로가 "서로 같은 화면을 보며" 진행된다는 걸 이미지+텍스트로 친절히 설명.
 *  - 진행 중인 타로 상담이 있으면 홈 버튼이 곧장 보드로 보내므로 여기로 오지 않는다.
 */

// 카드 뒷면 미니 목업 (이미지 의존 없이 CSS로)
function MiniCardBack({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[6px] text-[14px] ${className}`}
      style={{
        background: 'linear-gradient(160deg,#efe7d4 0%,#e3d3ad 100%)',
        boxShadow: '0 2px 6px rgba(124,58,237,0.18)',
        border: '1px solid #d9c69a',
      }}
    >
      ✦
    </span>
  )
}

function StepCard({ n, icon, title, desc }: { n: number; icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3.5 ring-1 ring-[#F3F4F6] shadow-sm">
      <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#fdf2f8] text-[18px]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-[#1E2939]">
          <span className="mr-1 text-[#ec4899]">{n}.</span>
          {title}
        </p>
        <p className="mt-0.5 text-[13px] leading-[150%] text-[#6A7282]">{desc}</p>
      </div>
    </div>
  )
}

export default function TarotIntro() {
  const navigate = useNavigate()
  return (
    <div className="mobile-frame flex flex-col bg-[#fafafa]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">전화 타로 상담</h1>
      </header>

      <main className="flex-1 px-4 pt-3 pb-28">
        {/* 히어로 — 같은 화면을 함께 보는 모습 */}
        <section className="rounded-3xl bg-gradient-to-b from-[#fdf2f8] to-white px-5 py-7 text-center ring-1 ring-[#fbcfe8]">
          <div className="mx-auto mb-3 flex items-center justify-center gap-3">
            {/* 상담사 폰 */}
            <div className="flex h-[92px] w-[58px] flex-col items-center justify-center gap-1 rounded-[14px] bg-white shadow-md ring-1 ring-[#f3d9e7]">
              <span className="text-[11px]">🧑‍🏫</span>
              <div className="flex gap-0.5">
                <MiniCardBack className="h-7 w-5" />
                <MiniCardBack className="h-7 w-5" />
              </div>
            </div>
            {/* 연결 */}
            <div className="flex flex-col items-center text-[#ec4899]">
              <span className="text-[18px]">🔗</span>
              <span className="text-[10px] font-bold">실시간</span>
            </div>
            {/* 고객 폰 */}
            <div className="flex h-[92px] w-[58px] flex-col items-center justify-center gap-1 rounded-[14px] bg-white shadow-md ring-1 ring-[#f3d9e7]">
              <span className="text-[11px]">🙋</span>
              <div className="flex gap-0.5">
                <MiniCardBack className="h-7 w-5" />
                <MiniCardBack className="h-7 w-5" />
              </div>
            </div>
          </div>
          <p className="text-[20px] font-extrabold leading-[130%] text-[#1E2939]">
            전화하면서 <span className="text-[#ec4899]">같은 카드 화면</span>을
            <br />
            함께 보는 타로 상담
          </p>
          <p className="mt-2 text-[13px] leading-[160%] text-[#6A7282]">
            상담사와 통화하며, 내 폰에서 직접 카드를 뽑고
            <br />
            상담사가 한 장씩 펼치며 풀이해 드려요.
          </p>
        </section>

        {/* 진행 방식 */}
        <section className="mt-6">
          <p className="mb-2.5 px-1 text-[15px] font-bold text-[#1E2939]">이렇게 진행돼요</p>
          <div className="flex flex-col gap-2">
            <StepCard n={1} icon="📞" title="전화로 상담 시작" desc="타로 상담사에게 전화상담을 걸면 통화가 연결돼요." />
            <StepCard n={2} icon="🔮" title="홈에서 '타로상담' 누르기" desc="통화 중 앱으로 돌아와 홈의 타로상담 버튼을 누르면 카드 화면이 바로 열려요." />
            <StepCard n={3} icon="🃏" title="카드 뽑고 함께 보기" desc="내가 직접 카드를 뽑으면, 상담사가 한 장씩 펼치며 전화로 풀이해 드려요." />
          </div>
        </section>

        {/* 포인트 */}
        <section className="mt-6 rounded-2xl bg-white px-4 py-4 ring-1 ring-[#F3F4F6] shadow-sm">
          <p className="mb-2 text-[15px] font-bold text-[#1E2939]">이런 점이 좋아요</p>
          <ul className="flex flex-col gap-2">
            {[
              ['👀', '말로만 듣던 타로를 눈으로 같이 확인'],
              ['✨', '내가 직접 뽑는 카드라 더 몰입돼요'],
              ['💬', '카드를 보며 궁금한 걸 바로바로 질문'],
            ].map(([ic, t]) => (
              <li key={t} className="flex items-center gap-2.5 text-[14px] text-[#374151]">
                <span className="text-[16px]">{ic}</span>
                {t}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-5 px-1 text-center text-[11px] leading-[160%] text-[#9CA3AF]">
          타로 상담사와 전화상담을 시작하면, 통화 중 이 화면이 자동으로 카드 보드로 연결됩니다.
        </p>
      </main>

      {/* 하단 고정 CTA — 상담 유도(주) + 무료 체험(부, 외부 무료타로 웹) */}
      <div className="sticky bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-white via-white to-white/70 px-4 pb-5 pt-3">
        <button
          type="button"
          onClick={() => navigate('/counselors?category=타로')}
          className="flex h-[52px] w-full items-center justify-center rounded-full bg-[#ec4899] text-[16px] font-semibold text-white shadow-sm transition active:scale-[0.99]"
        >
          🔮 타로 상담사 보러가기
        </button>
        <button
          type="button"
          onClick={() => openExternalUrl('https://tarot.sajuplan.com/')}
          className="flex h-[50px] w-full items-center justify-center rounded-full border border-[#f472b6] bg-[#fdf2f8] text-[15px] font-semibold text-[#ec4899] transition active:scale-[0.99]"
        >
          ✨ 무료 타로 체험하러가기
        </button>
      </div>
    </div>
  )
}
