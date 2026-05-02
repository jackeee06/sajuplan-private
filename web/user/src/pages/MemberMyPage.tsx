import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import ConfirmModal from '../components/ConfirmModal'
import { MOCK_MEMBER, MEMBER_MAIN_MENU, MEMBER_EXTRA_MENU } from '../data/memberProfile'

/**
 * 마이페이지 (회원) — Figma 07마이페이지(회원) > 회원 메인 (128:16774)
 *
 * 비회원 메인(/mypage)과 짝. 로그인 상태 사용자에게 노출.
 *  - 프로필(아바타+닉네임+인증뱃지+userid+앱설정 칩)
 *  - 보유 포인트 박스 (포인트충전 / 결제내역 2분할)
 *  - 마이페이지 메뉴 6개
 *  - 추가메뉴 5개 (비회원과 동일)
 *  - 로그아웃 (빨간 텍스트, ConfirmModal)
 */

export default function MemberMyPage() {
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = useState(false)

  const handleLogout = () => {
    setLogoutOpen(false)
    navigate('/mypage')
  }

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
        <section className="pt-2 pb-5 flex items-center gap-3">
          <Link
            to="/mypage/member/edit"
            aria-label="회원 정보 수정"
            className="relative w-[60px] h-[60px] shrink-0 rounded-full bg-[#F3F4F6] flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" aria-hidden>
              <circle cx="12" cy="9" r="3.5" stroke="#99A1AF" strokeWidth="1.5" />
              <path d="M5 19.5C5 16.4624 8.13401 14 12 14C15.866 14 19 16.4624 19 19.5" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white border border-[#F3F4F6] flex items-center justify-center">
              <img src="/img/ic_edit.svg" alt="" className="w-3 h-3" />
            </span>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[18px] leading-[140%] font-bold text-[#030712] truncate">
                {MOCK_MEMBER.nickname}
              </span>
              {MOCK_MEMBER.verified && (
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-label="인증">
                  <path d="M12 1.5L14.5 3.7L17.8 3.4L19 6.5L21.8 8.2L21 11.5L21.8 14.8L19 16.5L17.8 19.6L14.5 19.3L12 21.5L9.5 19.3L6.2 19.6L5 16.5L2.2 14.8L3 11.5L2.2 8.2L5 6.5L6.2 3.4L9.5 3.7L12 1.5Z" fill="#9B7AF7" />
                  <path d="M8 12L11 15L16 9.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </div>
            <p className="mt-0.5 text-[14px] leading-[140%] text-[#99A1AF] truncate">
              {MOCK_MEMBER.userId}
            </p>
          </div>
          <Link
            to="/mypage/app-settings"
            className="h-8 px-4 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[13px] font-medium text-[#4A5565]"
          >
            앱 설정
          </Link>
        </section>

        <section className="rounded-[16px] bg-[#F9FAFB] px-5 pt-5 pb-2">
          <p className="text-[14px] leading-[140%] text-[#6A7282]">보유 포인트</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[26px] leading-[130%] font-bold text-[#9B7AF7]">
              {MOCK_MEMBER.point.toLocaleString()}
            </span>
            <span className="w-7 h-7 rounded-full border-[1.5px] border-[#9B7AF7] flex items-center justify-center text-[13px] font-bold text-[#9B7AF7]">
              P
            </span>
          </div>
          <div className="mt-3 -mx-1 grid grid-cols-2 border-t border-[#E5E7EB]">
            <Link to="/point" className="h-12 flex items-center justify-center gap-2 text-[14px] font-medium text-[#4A5565] border-r border-[#E5E7EB]">
              <img src="/img/ic_my_card.svg" alt="" className="w-5 h-5" />
              포인트충전
            </Link>
            <Link to="/mypage/payments" className="h-12 flex items-center justify-center gap-2 text-[14px] font-medium text-[#4A5565]">
              <img src="/img/ic_my_receipt.svg" alt="" className="w-5 h-5" />
              결제내역
            </Link>
          </div>
        </section>

        <section className="pt-6">
          <h3 className="text-[14px] leading-[140%] text-[#99A1AF] mb-1">마이페이지</h3>
          <ul className="flex flex-col">
            {MEMBER_MAIN_MENU.map((it) => (
              <li key={it.to}>
                <Link to={it.to} className="h-14 flex items-center gap-3">
                  <img src={it.icon} alt="" className="w-7 h-7" />
                  <span className="text-[17px] leading-[140%] font-semibold text-[#030712]">
                    {it.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="pt-6">
          <h3 className="text-[14px] leading-[140%] text-[#99A1AF] mb-1">추가메뉴</h3>
          <ul className="flex flex-col">
            {MEMBER_EXTRA_MENU.map((it) => (
              <li key={it.to}>
                <Link to={it.to} className="h-14 flex items-center gap-3">
                  <img src={it.icon} alt="" className="w-7 h-7" />
                  <span className="text-[17px] leading-[140%] font-semibold text-[#030712]">
                    {it.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="mt-2 h-14 flex items-center gap-3 text-[#FB2C36]"
        >
          <img src="/img/ic_my_logout.svg" alt="" className="w-7 h-7" />
          <span className="text-[17px] leading-[140%] font-semibold">로그아웃</span>
        </button>
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />

      <ConfirmModal
        open={logoutOpen}
        message="로그아웃 하시겠습니까?"
        actionLabel="로그아웃"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  )
}
