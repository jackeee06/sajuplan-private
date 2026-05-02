import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import ConfirmModal from '../components/ConfirmModal'
import {
  MOCK_COUNSELOR_MY_PROFILE,
  MOCK_COUNSELOR_BALANCE,
  COUNSELOR_MAIN_MENU,
} from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_마이페이지 메인(상담사)
 * Figma node-id: 109:10423
 *
 * 구조:
 *  - 헤더: ← + "마이페이지" + 검색/알림
 *  - 프로필: 아바타(편집 펜) + 닉네임 + userid + 앱 설정 칩
 *  - 보유 금액 카드: 큰 보라 금액 / 전월·당월 / 정산하기·정산내역 2분할
 *  - 내 상담 상태 설정: 토글 3종 (상담 가능 여부 / 전화 상담 / 채팅 상담)
 *  - 상담사 전용 메뉴 8개
 *  - 로그아웃 (빨강)
 *  - BottomNav (myHref=/counselor/mypage)
 */
export default function CounselorMyPage() {
  const navigate = useNavigate()
  const [available, setAvailable] = useState(MOCK_COUNSELOR_MY_PROFILE.available)
  const [callOn, setCallOn] = useState(MOCK_COUNSELOR_MY_PROFILE.callEnabled)
  const [chatOn, setChatOn] = useState(MOCK_COUNSELOR_MY_PROFILE.chatEnabled)
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
        {/* 프로필 */}
        <section className="pt-2 pb-5 flex items-center gap-3">
          <div className="relative w-[60px] h-[60px] shrink-0">
            <img
              src={MOCK_COUNSELOR_MY_PROFILE.profileImg}
              alt=""
              className="w-[60px] h-[60px] rounded-full object-cover"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white border border-[#F3F4F6] flex items-center justify-center">
              <img src="/img/ic_edit.svg" alt="" className="w-3 h-3" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[18px] leading-[140%] font-bold text-[#030712] truncate">
              {MOCK_COUNSELOR_MY_PROFILE.name}
            </p>
            <p className="mt-0.5 text-[14px] leading-[140%] text-[#99A1AF] truncate">
              {MOCK_COUNSELOR_MY_PROFILE.userid}
            </p>
          </div>
          <Link
            to="/mypage/app-settings"
            className="h-8 px-4 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[13px] font-medium text-[#4A5565]"
          >
            앱 설정
          </Link>
        </section>

        {/* 보유 금액 */}
        <section className="rounded-[16px] bg-[#F9FAFB] px-5 pt-5 pb-2">
          <p className="text-[14px] leading-[140%] text-[#6A7282]">보유 금액</p>
          <p className="mt-1 text-[26px] leading-[130%] font-bold text-[#9B7AF7]">
            {MOCK_COUNSELOR_BALANCE.current.toLocaleString()}원
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-[14px] leading-[140%]">
            <li className="flex items-center justify-between">
              <span className="text-[#6A7282]">전월</span>
              <span className="text-[#1E2939]">
                {MOCK_COUNSELOR_BALANCE.prevMonth.toLocaleString()}원
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[#6A7282]">당월</span>
              <span className="text-[#1E2939]">
                {MOCK_COUNSELOR_BALANCE.thisMonth.toLocaleString()}원
              </span>
            </li>
          </ul>
          <div className="mt-3 -mx-1 grid grid-cols-2 border-t border-[#E5E7EB]">
            <button
              type="button"
              className="h-12 flex items-center justify-center gap-2 text-[14px] font-medium text-[#4A5565] border-r border-[#E5E7EB]"
            >
              <img src="/img/ic_my_card.svg" alt="" className="w-5 h-5" />
              정산하기
            </button>
            <button
              type="button"
              className="h-12 flex items-center justify-center gap-2 text-[14px] font-medium text-[#4A5565]"
            >
              <img src="/img/ic_my_receipt.svg" alt="" className="w-5 h-5" />
              정산내역
            </button>
          </div>
        </section>

        {/* 상담 상태 */}
        <section className="pt-6">
          <h3 className="text-[14px] leading-[140%] text-[#99A1AF] mb-1">내 상담 상태 설정</h3>
          <ul className="flex flex-col">
            <ToggleRow label="상담 가능 여부" on={available} onChange={setAvailable} />
            <ToggleRow label="전화 상담" on={callOn} onChange={setCallOn} />
            <ToggleRow label="채팅 상담" on={chatOn} onChange={setChatOn} />
          </ul>
        </section>

        {/* 상담사 전용 메뉴 */}
        <section className="pt-6">
          <h3 className="text-[14px] leading-[140%] text-[#99A1AF] mb-1">상담사 전용</h3>
          <ul className="flex flex-col">
            {COUNSELOR_MAIN_MENU.map((it) => (
              <li key={it.key}>
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
      <BottomNav myHref="/counselor/mypage" />

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

function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <li className="h-14 flex items-center justify-between">
      <span className="text-[17px] leading-[140%] font-semibold text-[#030712]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        aria-label={`${label} 토글`}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          on ? 'bg-[#9B7AF7]' : 'bg-[#D1D5DB]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white flex items-center justify-center transition-all ${
            on ? 'left-[22px]' : 'left-0.5'
          }`}
        >
          {on && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7L6 10L11 4"
                stroke="#9B7AF7"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </button>
    </li>
  )
}
