import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { MOCK_EVENTS } from '../data/myPageMockData'

/**
 * 이벤트 리스트 — Figma 06마이페이지(비회원) > 이벤트 (118:7272)
 *
 * 카드는 풀폭 배너 이미지(라운드 16px). 종료 카드는 어두운 오버레이 + "종료된 이벤트입니다" 텍스트 노출.
 */
export default function Events() {
  const navigate = useNavigate()

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
        <ul className="flex flex-col gap-3">
          {MOCK_EVENTS.map((ev) => {
            const ended = ev.status === '종료'
            return (
              <li key={ev.id}>
                <Link
                  to={`/mypage/events/${ev.id}`}
                  className="block relative w-full aspect-[335/160] rounded-[16px] overflow-hidden bg-[#F3F4F6]"
                >
                  <img
                    src={ev.imgUrl}
                    alt={ev.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {ended && (
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                      <span className="text-[16px] leading-[140%] font-semibold text-white">
                        종료된 이벤트입니다
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
