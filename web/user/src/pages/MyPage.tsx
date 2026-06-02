import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'

/**
 * 마이페이지 (비회원) — Figma 06마이페이지(비회원)
 *
 * 비회원 상태:
 *  - 환영 영역: "사주플랜에 오신걸 환영합니다 :)" + 로그인 버튼
 *  - 추가메뉴: 이벤트 / 이용안내 / 공지사항 / 신규상담사 / 상담사 신청
 */

interface MenuItem {
  to: string
  label: string
  icon: string
}

const MENU_ITEMS: MenuItem[] = [
  { to: '/mypage/events', label: '이벤트', icon: '/img/ic_my_event.svg' },
  { to: '/mypage/help', label: '이용안내', icon: '/img/ic_my_book.svg' },
  { to: '/mypage/notices', label: '공지사항', icon: '/img/ic_my_notice.svg' },
  { to: '/mypage/new-counselors', label: '신규상담사', icon: '/img/ic_my_headset.svg' },
  { to: '/mypage/counselor-apply', label: '상담사 신청 및 기타 문의', icon: '/img/ic_my_user_plus.svg' },
]

export default function MyPage() {
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
          마이페이지
        </h1>
        <div className="flex items-center gap-3">
          <Link to="/search" aria-label="검색" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_search.svg" alt="" className="w-7 h-7" />
          </Link>
          <Link to="/notifications" aria-label="알림" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_push.svg" alt="" className="w-7 h-7" />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4">
        <section className="pt-2 pb-6">
          <h2 className="text-[20px] leading-[140%] font-bold text-[#030712]">
            사주플랜에 오신 걸 환영합니다.
          </h2>
          <p className="mt-2 text-[14px] leading-[150%] text-[#99A1AF] break-keep">
            로그인하시면 상담, 후기, 단골 등 다양한 서비스를 이용하실 수 있습니다.
          </p>
          <Link
            to="/login"
            className="mt-4 w-full h-[52px] rounded-full border border-[#f472b6] flex items-center justify-center text-[15px] font-medium text-[#ec4899]"
          >
            로그인
          </Link>
        </section>

        <section className="pt-2">
          <h3 className="text-[14px] leading-[140%] text-[#99A1AF] mb-1">추가메뉴</h3>
          <ul className="flex flex-col">
            {MENU_ITEMS.map((it) => (
              <li key={it.to}>
                <Link
                  to={it.to}
                  className="h-14 flex items-center gap-3"
                >
                  <img src={it.icon} alt="" className="w-7 h-7" />
                  <span className="text-[17px] leading-[140%] font-semibold text-[#030712]">
                    {it.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
