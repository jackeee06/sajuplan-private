import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadedImage from './UploadedImage'
import { ApiError, consultApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useLoginPrompt } from '../lib/login-prompt-context'
import { useDismissOnBack } from '../lib/use-dismiss-on-back'

/**
 * 상담 시작 모달 — Figma 92:6790 (전화 선불) / 92:6949 (전화 후불) / 92:7190 (채팅)
 *
 * 트리거: 어디서든 ConsultModalContext 의 openConsult() 호출.
 *  - 메인/리스트의 CounselorCard 의 전화/채팅 버튼
 *  - 상세 페이지(CounselorDetailLayout) 하단 고정 CTA
 *
 * 구조 (공통):
 *  - backdrop rgba(0,0,0,0.5) 전체화면
 *  - modal box: bg white, rounded 16, padding 20
 *  - 헤더 row: title (18px semibold) + X close
 *  - divider line
 *  - 상담사 정보 row: 64×64 아바타 + (뱃지 + 이름 + 번호) / 가격(30초당)
 *  - [전화 모달만] 토글 탭: 선불상담 / 후불상담
 *  - [선불·채팅] 보유 포인트 box (#F9FAFB radius 12)
 *  - 안내 텍스트 row: 보라 원형 + 아이콘 + 텍스트 (전화/채팅 다름)
 *  - CTA 버튼: 전화는 "070-... 상담하기" / 채팅은 "채팅 상담하기"
 */

export type ConsultModalVariant = 'phone' | 'chat'

/** 통합 모달이 노출하는 데 필요한 최소 정보 — 메인 카드/상세 페이지 모두 이 모양으로 변환해 전달 */
export interface ConsultCounselor {
  id: number | string
  name: string
  badge?: string
  code: string
  /** 30초당 가격 (원) */
  pricePerHalfMin: number
  /** 아바타 이미지 — 없으면 placeholder */
  avatarUrl?: string | null
  avatarUrlWebp?: string | null
}

/** 뱃지 종류별 배경색 — Figma BADGE_BG 와 동일. 불일치 시 기본 보라 사용 */
const BADGE_BG_MAP: Record<string, string> = {
  타로: '#ec4899',
  신점: '#00BBA7',
  사주: '#FF6467',
}

interface Props {
  open: boolean
  onClose: () => void
  variant: ConsultModalVariant
  counselor: ConsultCounselor | null
}

/** [2026-05-24] 채팅 사전 시간 선택 옵션 — 시간 카드에는 코인 미표시 (인지 부담 ↓) */
const CHAT_MINUTE_OPTIONS_PUBLIC: Array<{ min: number; tag?: string }> = [
  { min: 15 },
  { min: 30, tag: '베스트' },
  { min: 45 },
  { min: 60 },
]

/** [2026-05-29] 1분 테스트 옵션 노출 정책.
 *  현재: 모든 사용자에게 노출 (다수가 테스트 진행 중 — 사장님 결정 2026-05-29 v2).
 *  운영 시작 시: SHOW_TEST_MINUTE_TO_ALL = false 로 + 옵션 자체 제거.
 *  _PREPAID_CHAT_POLICY.md §1.1 참조. */
const SHOW_TEST_MINUTE_TO_ALL = true
const CHAT_TEST_MB_IDS = new Set<string>([])

export default function ConsultModal({ open, onClose, variant, counselor }: Props) {
  const navigate = useNavigate()
  const { member } = useAuth()
  const { showLoginPrompt } = useLoginPrompt()
  const [phoneTab, setPhoneTab] = useState<'prepaid' | 'postpaid'>('prepaid')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 채팅 사전 시간 선택값 (분). null 이면 미선택 → CTA 누를 때 막힘 */
  const [chatMinutes, setChatMinutes] = useState<number | null>(null)

  useDismissOnBack(open, onClose)

  // ESC 닫기 + 모달 열림마다 chatMinutes 리셋
  useEffect(() => {
    if (!open) return
    setError(null)
    setChatMinutes(null)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !counselor) return null

  const isPhone = variant === 'phone'
  const isPrepaid = isPhone && phoneTab === 'prepaid'
  const showPointsBox = !isPhone || isPrepaid // 채팅은 항상, 전화는 선불일 때만
  const userPoint = member?.point ?? 0
  const minutesAvailable = counselor.pricePerHalfMin > 0
    ? Math.floor((userPoint * 30) / counselor.pricePerHalfMin / 60)
    : 0

  // [2026-05-29] 1분 테스트 옵션 노출 — 현재는 전체 노출 (v2), 운영 시작 시 false 로. _PREPAID_CHAT_POLICY.md §1.1
  const memberMbId = member?.mb_id ?? ''
  const showTestOption = SHOW_TEST_MINUTE_TO_ALL || CHAT_TEST_MB_IDS.has(memberMbId)
  const chatMinuteOptions: Array<{ min: number; tag?: string }> = showTestOption
    ? [{ min: 1, tag: '테스트' }, ...CHAT_MINUTE_OPTIONS_PUBLIC]
    : CHAT_MINUTE_OPTIONS_PUBLIC

  // [2026-05-30] 시간 선택 후엔 선택값 반영한 라벨로 — 사용자 재확인 + 결제 의식 강화.
  //   미선택 시 별도 안내(아래 disabled 조건) — '상담 시간을 선택해주세요'.
  const ctaText = isPhone
    ? '전화 상담하기'
    : chatMinutes != null
      ? `${chatMinutes}분 채팅 시작`
      : '실시간 채팅 시작'
  const headerTitle = isPhone ? '전화상담 가능' : '채팅상담 가능'
  const badgeBg = (counselor.badge && BADGE_BG_MAP[counselor.badge]) || '#ec4899'

  // [2026-05-24] 채팅 시간 선택 → 최대 차감 코인 계산.
  //   사주플랜 단가 모델: 30초당 pricePerHalfMin 원. 선택 분수 × 2 × 단가 = 최대 차감.
  //   실제 차감은 사용한 시간 기반 (백엔드 chat_room.use_seconds × 단가/30초).
  const chatMaxCharge = chatMinutes != null
    ? Math.ceil((chatMinutes * 60) / 30) * counselor.pricePerHalfMin
    : 0
  const chatRemainAfter = chatMinutes != null ? userPoint - chatMaxCharge : userPoint
  const chatInsufficient = chatMinutes != null && chatMaxCharge > userPoint

  const handleStart = async () => {
    if (busy) return
    // 비로그인 선차단 — 통합 로그인 안내 모달 노출
    if (!member) {
      onClose()
      showLoginPrompt()
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (isPhone) {
        const res = await consultApi.phone(counselor.id, phoneTab)
        // 모달 닫고 dial — `tel:` 은 모바일에서 다이얼러, 데스크톱에선 일부 브라우저가 무시
        onClose()
        window.location.href = `tel:${res.phone_number.replace(/\D/g, '')}`
      } else {
        // [2026-05-29] 시간 단위 선결제 활성화 — _PREPAID_CHAT_POLICY.md §1
        //   chatMinutes 미선택 시 CTA 비활성으로 막혀 여기 안 옴 (안전망 차원에서 undefined fallback).
        const res = await consultApi.chat(counselor.id, chatMinutes ?? undefined)
        onClose()
        navigate(`/chat/${res.chat_room_id}`, {
          state: {
            roomid: res.roomid,
            memberToken: res.member_token,
            wssUrl: res.wss_url,
            isRejoin: res.is_rejoin,
            counselor: {
              id: counselor.id,
              name: counselor.name,
              avatarUrl: counselor.avatarUrl ?? null,
              avatarUrlWebp: counselor.avatarUrlWebp ?? null,
            },
          },
        })
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // 세션 만료 등 — 로그인 안내 모달
        onClose()
        showLoginPrompt()
        return
      }
      setError(e instanceof Error ? e.message : '상담 시작에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] mx-auto px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-[16px] p-5 flex flex-col gap-4">
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

          {/* 상담사 정보 — [2026-05-24] 사진 2배 + 사각 라운드(16px) */}
          <div className="flex items-center gap-3">
            {counselor.avatarUrl ? (
              <UploadedImage
                src={counselor.avatarUrl}
                srcWebp={counselor.avatarUrlWebp ?? null}
                alt=""
                className="w-[96px] h-[96px] rounded-[16px] object-cover shrink-0"
              />
            ) : (
              <div className="w-[96px] h-[96px] rounded-[16px] bg-[#F3F4F6] shrink-0" aria-hidden />
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-1 flex-wrap">
                {counselor.badge && (
                  <span
                    className="text-white text-[12px] font-medium leading-[110%] px-[5px] py-[3px] rounded-full inline-flex items-center justify-center"
                    style={{ backgroundColor: badgeBg }}
                  >
                    {counselor.badge}
                  </span>
                )}
                <span className="text-[16px] leading-[120%] font-semibold text-[#030712]">
                  {counselor.name}
                </span>
                <span className="text-[16px] leading-[120%] font-semibold text-[#ec4899]">
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
                      active ? 'text-[#ec4899]' : 'text-[#6A7282] border-b border-[#E5E7EB]'
                    }`}
                    style={active ? { boxShadow: 'inset 0 -2px 0 0 #f472b6' } : undefined}
                  >
                    {t === 'prepaid' ? '선불 상담' : '후불 상담'}
                  </button>
                )
              })}
            </div>
          )}

          {/* [2026-05-29] 시간 단위 선결제 활성화 — _PREPAID_CHAT_POLICY.md
              상담사 입장 시점에 선택 시간 × 단가 즉시 차감 (선결제). */}
          {!isPhone && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[14px] font-medium text-[#4A5565]">상담 시간 선택</p>
              <div className={`grid gap-1.5 ${showTestOption ? 'grid-cols-5' : 'grid-cols-4'}`}>
                {chatMinuteOptions.map((opt) => {
                  const active = chatMinutes === opt.min
                  return (
                    <button
                      key={opt.min}
                      type="button"
                      onClick={() => setChatMinutes(opt.min)}
                      className={`relative h-[56px] rounded-[12px] border-2 transition flex items-center justify-center ${
                        active
                          ? 'bg-[#fdf2f8] border-[#f472b6]'
                          : 'bg-white border-[#E5E7EB] hover:border-[#f472b6]'
                      }`}
                    >
                      {opt.tag && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-[1px] rounded-full bg-[#ec4899] text-white text-[10px] leading-[1.1] font-medium whitespace-nowrap">
                          {opt.tag}
                        </span>
                      )}
                      <span className={`text-[16px] leading-[110%] font-semibold ${
                        active ? 'text-[#ec4899]' : 'text-[#1E2939]'
                      }`}>
                        {opt.min}분
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* [2026-05-24] 2. 보유 코인 박스 (아래로 이동) — 시간 선택 시 변화액 통합 표시 */}
          {showPointsBox && (
            <div className="bg-[#F9FAFB] rounded-[12px] px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-[#6A7282] shrink-0">보유 코인</span>
                <span className="flex-1 text-[18px] leading-[120%] font-semibold text-[#ec4899] tabular-nums">
                  {userPoint.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate('/mypage/charge')
                  }}
                  className="h-8 px-3 rounded-full bg-white border border-[#f472b6] text-[#ec4899] text-[12.5px] font-medium shrink-0"
                >
                  충전
                </button>
              </div>
              {/* 시간 선택 시 변화액 표시 — 2026-05-30 차감액 폰트 강화 (사장님: 못 봤다는 불만 차단) */}
              {!isPhone && chatMinutes != null && (
                <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
                  <span className="text-[13px] text-[#6A7282] shrink-0">
                    <span className="font-medium text-[#1E2939]">{chatMinutes}분</span> 선택 시
                  </span>
                  <div className="flex items-baseline gap-1.5 tabular-nums">
                    <span className={`text-[18px] font-bold ${chatInsufficient ? 'text-[#FB2C36]' : 'text-[#ec4899]'}`}>
                      −{chatMaxCharge.toLocaleString()}
                    </span>
                    <span className="text-[13px] text-[#99A1AF]">→</span>
                    <span className={[
                      'text-[15px] font-semibold',
                      chatInsufficient ? 'text-[#FB2C36]' : 'text-[#1E2939]',
                    ].join(' ')}>
                      {chatRemainAfter.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {chatInsufficient && (
                <p className="text-[12px] text-[#FB2C36] text-center">
                  코인이 부족합니다. 충전 후 다시 시도해주세요.
                </p>
              )}
            </div>
          )}

          {/* [2026-05-29] 안내 — F 정책 반영 (상담사 입장 시 선결제). _PREPAID_CHAT_POLICY.md §2 */}
          <div className="bg-[#fdf2f8] rounded-[12px] p-3 flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5">
              {isPhone ? <PhoneIcon /> : <ChatIcon />}
            </div>
            <p className="flex-1 text-[13px] leading-[160%] text-[#9d174d]">
              <span className="font-medium text-[#ec4899]">{counselor.name}</span> 상담사
              {isPhone ? '에게 자동 연결됩니다' : '와 채팅이 시작됩니다'}.<br />
              <span className="font-bold">상담사가 입장하기 전까지는 코인이 차감되지 않습니다.</span>
              {!isPhone && (
                <>
                  <br />
                  상담사가 입장하면 선택하신 시간만큼 코인이 즉시 차감됩니다 (정상 종료 환불 X).
                </>
              )}
            </p>
          </div>

          {/* [2026-05-30] 에러 표시 강화 — 사장님 보고: 1분 시도 시 화면 깜빡임만 보고 에러 못 봄.
              빨간 배경 + 큰 폰트 + ⚠️ 아이콘으로 못 보고 지나치는 케이스 차단. */}
          {error && (
            <div className="bg-[#FEF2F2] border-2 border-[#FB2C36] rounded-[10px] p-3 -mt-1 flex items-start gap-2">
              <span className="text-[18px] leading-none mt-0.5" aria-hidden>⚠️</span>
              <p className="flex-1 text-[14px] leading-[150%] font-semibold text-[#B91C1C]">
                {error}
              </p>
            </div>
          )}

          {/* CTA 버튼 — 채팅은 시간 미선택 시 비활성 (2026-05-29 F 정책) */}
          <button
            type="button"
            onClick={handleStart}
            disabled={busy || (!isPhone && (chatMinutes == null || chatInsufficient))}
            className="w-full h-12 rounded-full bg-[#f472b6] text-white text-[16px] font-medium flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? '연결 중…' : (!isPhone && chatMinutes == null ? '상담 시간을 선택해주세요' : ctaText)}
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
        fill="#ec4899"
      />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <path
        d="M0.79335 11.473C0.91098 11.770 0.93717 12.095 0.86855 12.407L0.01655 15.039C-0.01089 15.172 -0.00380 15.311 0.03717 15.441C0.07815 15.571 0.15164 15.688 0.25068 15.781C0.34973 15.875 0.47104 15.942 0.60311 15.975C0.73518 16.009 0.87364 16.008 1.00535 15.973L3.73575 15.175C4.02992 15.117 4.33457 15.142 4.61494 15.249C6.32325 16.046 8.25840 16.215 10.0790 15.725C11.8997 15.235 13.4887 14.118 14.5659 12.570C15.6431 11.023 16.139 9.145 15.9664 7.267C15.7937 5.390 14.9635 3.634 13.6222 2.309C12.2809 0.984 10.5147 0.175 8.63534 0.025C6.75591 -0.124 4.88386 0.395 3.34971 1.490C1.81555 2.586 0.717777 4.189 0.250067 6.015C-0.217643 7.842 -0.025260 9.775 0.79335 11.478Z"
        fill="#ec4899"
      />
    </svg>
  )
}
