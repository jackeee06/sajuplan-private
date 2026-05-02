import { useEffect, useState } from 'react'
import { BADGE_BG, type CounselorDetailData } from '../data/counselorDetails'

/**
 * 상담 시작 모달 — Figma 92:6790 (전화 선불) / 92:6949 (전화 후불) / 92:7190 (채팅)
 *
 * 트리거: CounselorDetailLayout 하단 고정 CTA의 전화/채팅 버튼
 *
 * 구조 (공통):
 *  - backdrop rgba(0,0,0,0.5) 전체화면, padding 16/36
 *  - modal box: bg white, rounded 16, padding 20, 하단 정렬
 *  - 헤더 row: title (18px semibold) + X close
 *  - divider line
 *  - 상담사 정보 row: 64×64 아바타 + (뱃지 + 이름 + 번호) / 가격(30초당)
 *  - [전화 모달만] 토글 탭: 선불상담 / 후불상담 (active=#9B7AF7 underline + #8259F5 text)
 *  - [선불·채팅] 보유 포인트 box (#F9FAFB radius 12)
 *  - 안내 텍스트 row: 보라 원형 + 아이콘 + 텍스트 (전화/채팅 다름)
 *  - CTA 버튼: 전화는 "070-... 상담하기" / 채팅은 "채팅 상담하기"
 */

export type ConsultModalVariant = 'phone' | 'chat'

interface Props {
  open: boolean
  onClose: () => void
  variant: ConsultModalVariant
  counselor: CounselorDetailData
}

/** mock 상담 정보 — 추후 백엔드에서 받아올 값 */
const MOCK_USER_POINTS = 1000
const MOCK_PHONE_PREPAID = '070-0000-1234'
const MOCK_PHONE_POSTPAID = '070-0000-1235'

export default function ConsultModal({ open, onClose, variant, counselor }: Props) {
  const [phoneTab, setPhoneTab] = useState<'prepaid' | 'postpaid'>('prepaid')

  // ESC 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const isPhone = variant === 'phone'
  const isPrepaid = isPhone && phoneTab === 'prepaid'
  const showPointsBox = !isPhone || isPrepaid // 채팅은 항상, 전화는 선불일 때만

  const phoneNumber = phoneTab === 'prepaid' ? MOCK_PHONE_PREPAID : MOCK_PHONE_POSTPAID
  const ctaText = isPhone ? `${phoneNumber} 상담하기` : '채팅 상담하기'
  const headerTitle = isPhone ? '전화상담 가능' : '채팅상담 가능'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[600px] mx-auto px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-[16px] p-5 flex flex-col gap-5">
          {/* 헤더 */}
          <div className="flex items-center gap-3">
            <h2 className="flex-1 text-[18px] leading-[120%] font-semibold text-[#030712]">
              {headerTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="w-6 h-6 flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
                <path d="M6 6L18 18M18 6L6 18" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="h-px bg-[#F3F4F6]" aria-hidden />

          {/* 상담사 정보 */}
          <div className="flex items-center gap-3">
            <img
              src={counselor.heroImg}
              alt=""
              className="w-16 h-16 rounded-full object-cover shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-1 flex-wrap">
                <span
                  className="text-white text-[12px] font-medium leading-[110%] px-[5px] py-[3px] rounded-full inline-flex items-center justify-center"
                  style={{ backgroundColor: BADGE_BG[counselor.badge] }}
                >
                  {counselor.badge}
                </span>
                <span className="text-[16px] leading-[120%] font-semibold text-[#030712]">
                  {counselor.name}
                </span>
                <span className="text-[16px] leading-[120%] font-semibold text-[#8259F5]">
                  {counselor.code}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[16px] leading-[110%] font-semibold text-[#030712]">
                  {counselor.pricePerHalfMin.toLocaleString()}원
                </span>
                <span className="text-[14px] leading-[110%] text-[#99A1AF]">(30초당)</span>
              </div>
            </div>
          </div>

          {/* 전화 모달 토글 */}
          {isPhone && (
            <div className="flex">
              {(['prepaid', 'postpaid'] as const).map((t) => {
                const active = t === phoneTab
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPhoneTab(t)}
                    className={`flex-1 h-11 flex items-center justify-center text-[14px] font-medium ${
                      active ? 'text-[#8259F5]' : 'text-[#6A7282] border-b border-[#E5E7EB]'
                    }`}
                    style={active ? { boxShadow: 'inset 0 -2px 0 0 #9B7AF7' } : undefined}
                  >
                    {t === 'prepaid' ? '선불 상담' : '후불 상담'}
                  </button>
                )
              })}
            </div>
          )}

          {/* 보유 포인트 box (선불 또는 채팅) */}
          {showPointsBox && (
            <div className="bg-[#F9FAFB] rounded-[12px] p-4 flex items-center gap-2">
              <div className="flex-1 flex flex-col gap-0.5">
                <p className="text-[14px] leading-[110%] text-[#6A7282]">보유 포인트</p>
                <p className="text-[22px] leading-[120%] font-semibold text-[#8259F5]">
                  {MOCK_USER_POINTS.toLocaleString()}P
                </p>
                <p className="text-[13px] leading-[120%] text-[#6A7282]">
                  (약 <span className="font-medium text-[#1E2939]">{Math.floor(MOCK_USER_POINTS / counselor.pricePerHalfMin / 2)}</span>분 상담가능)
                </p>
              </div>
              <button
                type="button"
                className="h-9 px-4 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[13px] font-medium shrink-0"
              >
                포인트 충전
              </button>
            </div>
          )}

          {/* 안내 텍스트 row */}
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F3EEFE] flex items-center justify-center shrink-0">
              {isPhone ? <PhoneIcon /> : <ChatIcon />}
            </div>
            <p className="flex-1 text-[14px] leading-[140%] text-[#4A5565] pt-1">
              {isPhone ? (
                <>
                  통화 연결 후, 상담사{' '}
                  <span className="font-medium text-[#8259F5]">{counselor.code}번</span>을 입력하여
                  통화하세요.
                </>
              ) : (
                <>
                  상담사 <span className="font-medium text-[#8259F5]">{counselor.code}번</span>과
                  채팅을 시작합니다.
                </>
              )}
            </p>
          </div>

          {/* CTA 버튼 */}
          <button
            type="button"
            className="w-full h-12 rounded-full bg-[#9B7AF7] text-white text-[16px] font-medium flex items-center justify-center"
          >
            {ctaText}
          </button>
        </div>
      </div>
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <path
        d="M9.22125 11.045C9.35894 11.108 9.51405 11.123 9.66105 11.086C9.80804 11.049 9.93814 10.964 10.0299 10.843L10.2666 10.533C10.3908 10.367 10.5518 10.233 10.737 10.140C10.9221 10.048 11.1263 10 11.3333 10H13.3333C13.6869 10 14.026 10.140 14.2761 10.390C14.5261 10.640 14.6666 10.979 14.6666 11.333V13.333C14.6666 13.687 14.5261 14.026 14.2761 14.276C14.026 14.526 13.6869 14.666 13.3333 14.666C10.1507 14.666 7.09841 13.402 4.84797 11.152C2.59753 8.901 1.33325 5.849 1.33325 2.666C1.33325 2.313 1.47373 1.974 1.72378 1.724C1.97382 1.474 2.31296 1.333 2.66659 1.333H4.66658C5.02021 1.333 5.35935 1.474 5.60939 1.724C5.85944 1.974 5.99992 2.313 5.99992 2.666V4.666C5.99992 4.873 5.95173 5.077 5.85915 5.262C5.76658 5.448 5.63218 5.609 5.46658 5.733L5.15458 5.967C5.0322 6.060 4.94593 6.193 4.91045 6.343C4.87496 6.493 4.89244 6.651 4.95992 6.789C5.87104 8.640 7.36953 10.136 9.22125 11.045Z"
        fill="#8259F5"
      />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <path
        d="M0.79335 11.473C0.91098 11.770 0.93717 12.095 0.86855 12.407L0.01655 15.039C-0.01089 15.172 -0.00380 15.311 0.03717 15.441C0.07815 15.571 0.15164 15.688 0.25068 15.781C0.34973 15.875 0.47104 15.942 0.60311 15.975C0.73518 16.009 0.87364 16.008 1.00535 15.973L3.73575 15.175C4.02992 15.117 4.33457 15.142 4.61494 15.249C6.32325 16.046 8.25840 16.215 10.0790 15.725C11.8997 15.235 13.4887 14.118 14.5659 12.570C15.6431 11.023 16.139 9.145 15.9664 7.267C15.7937 5.390 14.9635 3.634 13.6222 2.309C12.2809 0.984 10.5147 0.175 8.63534 0.025C6.75591 -0.124 4.88386 0.395 3.34971 1.490C1.81555 2.586 0.717777 4.189 0.250067 6.015C-0.217643 7.842 -0.025260 9.775 0.79335 11.478Z"
        fill="#8259F5"
      />
    </svg>
  )
}
