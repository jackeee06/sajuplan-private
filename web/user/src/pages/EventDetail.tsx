import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { MOCK_EVENTS } from '../data/myPageMockData'

/**
 * 이벤트 상세 — Figma 06마이페이지(비회원) > 이벤트 상세 (진행중/종료)
 *
 * 진행중 칩: bg #F3EEFE / text #8259F5
 * 종료   칩: bg #F3F4F6 / text #6A7282
 */
export default function EventDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const ev = MOCK_EVENTS.find((e) => String(e.id) === id)

  if (!ev) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px]">
        <header className="h-[60px] px-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
          </button>
          <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
            이벤트
          </h1>
        </header>
        <p className="text-center text-[14px] text-[#99A1AF] py-10">
          존재하지 않는 이벤트입니다.
        </p>
        <BottomNav />
      </div>
    )
  }

  const ended = ev.status === '종료'

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          이벤트
        </h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        <div className="flex items-center gap-2">
          <span
            className={
              ended
                ? 'inline-flex items-center h-[26px] px-2.5 rounded-[6px] text-[13px] leading-none font-medium bg-[#F3F4F6] text-[#6A7282]'
                : 'inline-flex items-center h-[26px] px-2.5 rounded-[6px] text-[13px] leading-none font-medium bg-[#F3EEFE] text-[#8259F5]'
            }
          >
            {ev.status}
          </span>
        </div>
        <h2 className="mt-2 text-[18px] leading-[140%] font-bold text-[#030712]">
          {ev.title}
        </h2>
        <p className="mt-1 text-[14px] leading-[140%] text-[#99A1AF]">{ev.period}</p>

        <div className="mt-4 w-full aspect-[335/160] rounded-[16px] overflow-hidden bg-[#F3F4F6]">
          <img
            src={ev.imgUrl}
            alt={ev.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/mypage/events')}
            className="h-[44px] px-7 rounded-full border border-[#9B7AF7] text-[15px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
