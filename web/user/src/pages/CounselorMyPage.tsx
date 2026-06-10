import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import ConfirmModal from '../components/ConfirmModal'
import UploadedImage from '../components/UploadedImage'
import {
  MOCK_COUNSELOR_MY_PROFILE,
  COUNSELOR_MAIN_MENU,
} from '../data/counselorMyPage'
import { useAuth } from '../lib/auth-context'
import {
  counselorMypageApi,
  counselorGradeApi,
  counselorPayoutApi,
  counselorCustomerQnaApi,
  consultApi,
  settlementApi,
  type SettlementSummary,
  type MyGradeInfo,
  type MyPayoutInfo,
  type ConsultMyStats,
  type GradeProgressInfo,
} from '../lib/api'
import { GRADE_UPGRADE_STORAGE_KEY } from '../components/GradeUpgradeToast'
import { FILE_BASE } from '../lib/runtime-env'
import UnitCostChangeModal from '../components/UnitCostChangeModal'

function resolveImageUrl(u: string | null): string | null {
  if (!u) return null
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

/** 오늘부터 이번달 말일까지 남은 일수 (정산 D-day용) */
function daysUntilMonthEnd(): number {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return Math.max(0, Math.ceil((last.getTime() - now.getTime()) / 86_400_000))
}

/** 초 단위를 "Nh Nm" 형태로. 1시간 미만이면 "N분" */
function formatHoursMinutes(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`
  return `${m}분`
}

/** 정산 카드 안의 전화/채팅 채널 토글 (작은 사이즈) */
function ChannelToggle({
  label, iconSrc, on, disabled, onChange,
}: {
  label: string
  iconSrc: string
  on: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg bg-[#F9FAFB] ${disabled ? 'opacity-60' : ''}`}>
      <span className="text-[13px] text-[#364153] inline-flex items-center gap-1.5">
        <img src={iconSrc} alt="" className="w-4 h-4" />
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!on)}
        aria-label={`${label} 토글`}
        className={`relative w-[44px] h-[26px] rounded-full transition-colors ${
          disabled ? 'cursor-not-allowed ' : ''
        }${on ? 'bg-[#8259F5]' : 'bg-[#D1D5DB]'}`}
      >
        <span
          className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all ${
            on ? 'left-[21px]' : 'left-[3px]'
          }`}
        />
      </button>
    </div>
  )
}

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
  const { member, loading, logout } = useAuth()
  const [available, setAvailable] = useState(MOCK_COUNSELOR_MY_PROFILE.available)
  const [callOn, setCallOn] = useState(MOCK_COUNSELOR_MY_PROFILE.callEnabled)
  const [chatOn, setChatOn] = useState(MOCK_COUNSELOR_MY_PROFILE.chatEnabled)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [toggleBusy, setToggleBusy] = useState(false)
  const [settlement, setSettlement] = useState<SettlementSummary | null>(null)
  const [grade, setGrade] = useState<MyGradeInfo | null>(null)
  const [gradeProgress, setGradeProgress] = useState<GradeProgressInfo | null>(null)
  const [payout, setPayout] = useState<MyPayoutInfo | null>(null)
  const [pendingCounts, setPendingCounts] = useState<{ pending_qna: number; pending_review: number } | null>(null)
  const [costModalOpen, setCostModalOpen] = useState(false)
  const [extraOpen, setExtraOpen] = useState(false)
  const [monthlyStats, setMonthlyStats] = useState<ConsultMyStats | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // ?action=change-unit-cost — 승급 토스트 "단가 변경하기" 버튼에서 진입 시 모달 자동 오픈
  useEffect(() => {
    if (searchParams.get('action') === 'change-unit-cost') {
      setCostModalOpen(true)
      setSearchParams((prev) => { prev.delete('action'); return prev }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // 진입 시 실제 토글 값 + 정산 요약을 동시에 로드.
  //  - 토글: member.use_phone/use_chat
  //  - 정산 요약: 상담 금액 / 전월·당월 누적 / 정산 예정 금액
  //
  // 실시간 반영:
  //  - 30초 폴링 — 마이페이지를 열어둔 채 채팅이 종료돼도 자동 갱신.
  //  - visibilitychange('visible') / focus — 다른 탭/앱에서 돌아오는 즉시 갱신.
  useEffect(() => {
    if (!member || member.role !== 'counselor') return
    let cancelled = false

    counselorMypageApi.getAvailability()
      .then((r) => {
        if (cancelled) return
        setAvailable(r.available)
        setCallOn(r.use_phone)
        setChatOn(r.use_chat)
      })
      .catch(() => {
        /* 로드 실패 — mock 값 유지 */
      })

    const refreshSettlement = () => {
      settlementApi.summary()
        .then((s) => { if (!cancelled) setSettlement(s) })
        .catch(() => { /* 정산 요약 실패해도 페이지는 동작 */ })
    }
    refreshSettlement()

    counselorCustomerQnaApi.pendingCounts()
      .then((r) => { if (!cancelled) setPendingCounts(r) })
      .catch(() => { /* 미답변 카운트 실패해도 페이지는 동작 */ })

    const refreshGrade = () => {
      counselorGradeApi.getMine()
        .then((g) => { if (!cancelled) setGrade(g) })
        .catch(() => { /* 등급 정보 실패해도 페이지는 동작 */ })
      // 당월 실시간 진행상황 (프로그레스 바 + 승급 이력)
      counselorGradeApi.getProgress()
        .then((p) => { if (!cancelled) setGradeProgress(p) })
        .catch(() => { /* 진행상황 실패해도 페이지는 동작 */ })
      // [2026-06-07] 미확인 실시간 승급 체크 — 있으면 sessionStorage 저장 → 다음 화면 이동 시 토스트 표시
      counselorGradeApi.pendingUpgrade()
        .then((r) => {
          if (!cancelled && r?.upgrade) {
            sessionStorage.setItem(GRADE_UPGRADE_STORAGE_KEY, JSON.stringify({
              grade_label: r.upgrade.grade_label,
              hours: r.upgrade.hours,
            }))
          }
        })
        .catch(() => { /* 실패해도 페이지는 동작 */ })
    }
    refreshGrade()

    const refreshPayout = () => {
      counselorPayoutApi.available()
        .then((p) => { if (!cancelled) setPayout(p) })
        .catch(() => { /* 선지급 정보 실패해도 페이지는 동작 */ })
    }
    refreshPayout()

    // 이번달 상담 통계 — 1일 ~ 오늘. 0건이어도 표시 (신규 상담사 동기부여)
    const refreshMonthly = () => {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const from = `${yyyy}-${mm}-01`
      const to = `${yyyy}-${mm}-${dd}`
      consultApi.myStats({ from, to, type: 'all', limit: 1 })
        .then((s) => { if (!cancelled) setMonthlyStats(s) })
        .catch(() => { /* 통계 실패해도 페이지는 동작 — 0건 fallback */ })
    }
    refreshMonthly()
    const pollId = window.setInterval(refreshSettlement, 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshSettlement()
    }
    const onFocus = () => refreshSettlement()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [member])

  /**
   * 토글 변경 → 즉시 API 반영. 낙관적 UI 후 실패 시 롤백.
   *  - available=false 면 use_phone/use_chat 값과 무관하게 휴식(ABSE) 처리
   *  - 한 번에 하나만 변경됨 (다른 두 값은 현재 state 그대로 유지)
   */
  const updateAvailability = async (next: { available?: boolean; use_phone?: boolean; use_chat?: boolean }) => {
    const prev = { available, callOn, chatOn }
    // 낙관적 UI
    if (next.available !== undefined) setAvailable(next.available)
    if (next.use_phone !== undefined) setCallOn(next.use_phone)
    if (next.use_chat !== undefined) setChatOn(next.use_chat)
    setToggleBusy(true)
    try {
      const r = await counselorMypageApi.setAvailability(next)
      setAvailable(r.available)
      setCallOn(r.use_phone)
      setChatOn(r.use_chat)
    } catch (e) {
      // 롤백
      setAvailable(prev.available)
      setCallOn(prev.callOn)
      setChatOn(prev.chatOn)
      alert(`상태 변경 실패: ${e instanceof Error ? e.message : ''}`)
    } finally {
      setToggleBusy(false)
    }
  }

  const handleLogout = async () => {
    setLogoutOpen(false)
    await logout()
    navigate('/mypage', { replace: true })
  }

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="h-[60px] px-4 flex items-center bg-white">
          <h1 className="text-[18px] font-semibold text-[#030712]">마이페이지</h1>
        </div>
        <main className="flex-1 px-4 py-6 flex flex-col gap-3">
          <div className="h-16 rounded-2xl bg-[#F3F4F6] animate-pulse" />
          <div className="h-32 rounded-2xl bg-[#F3F4F6] animate-pulse" />
        </main>
      </div>
    )
  }

  if (!member) {
    return <Navigate to="/login?redirect=/mypage" replace />
  }

  // 프로필 이미지 — me() 응답의 profile_image 사용. 없으면 placeholder.
  const profileImage = resolveImageUrl(member.profile_image)
  const profileImageWebp = resolveImageUrl(member.profile_image_webp)
  const displayName = member.nickname || member.name || member.mb_id

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

      <main className="flex-1 px-4 space-y-3">
        {/* 헤더 — 프로필 한 줄 압축 (이름·등급칩·정보수정) */}
        <section className="pt-2 flex items-center gap-3">
          <Link
            to="/mypage/member/edit"
            aria-label="프로필 수정"
            className="relative w-[48px] h-[48px] shrink-0 rounded-full bg-[#F3F4F6] flex items-center justify-center overflow-hidden"
          >
            {profileImage ? (
              <UploadedImage src={profileImage} srcWebp={profileImageWebp} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" aria-hidden>
                <circle cx="12" cy="9" r="3.5" stroke="#99A1AF" strokeWidth="1.5" />
                <path d="M5 19.5C5 16.4624 8.13401 14 12 14C15.866 14 19 16.4624 19 19.5" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[16px] font-semibold text-[#030712] truncate">{displayName}</p>
              {grade && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f3f0ff] text-[#8259F5] font-medium whitespace-nowrap">
                  {grade.grade_label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#99A1AF] mt-0.5 truncate">{member.mb_id}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Link
              to="/mypage"
              className="h-7 px-2.5 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] inline-flex items-center gap-1 text-[11px] font-medium text-[#4A5565]"
            >
              회원 메뉴
              <svg viewBox="0 0 20 20" className="w-3 h-3" fill="none">
                <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link to="/mypage/member/edit" className="text-[12px] text-[#6A7282] inline-flex items-center gap-0.5">
              <img src="/img/ic_edit.svg" alt="" className="w-3.5 h-3.5 opacity-60" /> 정보수정
            </Link>
          </div>
        </section>

        {/* ① 🟢 상담 상태 토글 카드 — 최상단 강조 */}
        <section className="rounded-[16px] border border-[#F3F4F6] bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${available ? 'bg-emerald-500 animate-pulse' : 'bg-[#9CA3AF]'}`} />
              <span className={`text-[16px] font-semibold ${available ? 'text-emerald-600' : 'text-[#6A7282]'}`}>
                {available ? '지금 상담 가능' : '부재중 (자리비움)'}
              </span>
            </div>
            <button
              type="button"
              disabled={toggleBusy}
              onClick={() => void updateAvailability({ available: !available })}
              aria-label="상담 가능 여부 토글"
              className={`relative w-[52px] h-[30px] rounded-full transition-colors ${
                toggleBusy ? 'opacity-50 ' : ''
              }${available ? 'bg-emerald-500' : 'bg-[#D1D5DB]'}`}
            >
              <span
                className={`absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all ${
                  available ? 'left-[25px]' : 'left-[3px]'
                }`}
              />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ChannelToggle
              label="전화상담"
              iconSrc="/img/ic_phone_p.svg?v=v2"
              on={callOn}
              disabled={toggleBusy || !available}
              onChange={(v) => void updateAvailability({ use_phone: v })}
            />
            <ChannelToggle
              label="채팅상담"
              iconSrc="/img/ic_message_p.svg?v=v2"
              on={chatOn}
              disabled={toggleBusy || !available}
              onChange={(v) => void updateAvailability({ use_chat: v })}
            />
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-2.5 leading-relaxed">
            잠시 자리 비울 때는 위 큰 토글로 한 번에 꺼주세요.
          </p>
        </section>

        {/* ② 💰 정산금액 카드 — 큰 폰트, 선지급 미니, D-day */}
        <section className="rounded-[16px] p-4" style={{ background: 'linear-gradient(135deg, #f3f0ff 0%, #fce7f3 100%)', border: '1px solid #fbcfe8' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-[#be185d] font-medium">💰 이번달 정산금액</span>
            <span className="text-[11px] text-[#6A7282]">정산까지 <span className="font-semibold text-[#8259F5]">D-{daysUntilMonthEnd()}</span></span>
          </div>
          <div className="text-[28px] font-bold text-[#1E2939] tabular-nums leading-tight">
            {(settlement?.estimated_payout ?? settlement?.this_month ?? 0).toLocaleString()}
            <span className="text-[15px] font-medium text-[#6A7282] ml-0.5">원</span>
          </div>
          <div className="text-[11px] text-[#6A7282] mt-0.5">원천세(3.3%) 공제 후 예상 실수령액</div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            <Link to="/mypage/calls" className="h-9 rounded-lg bg-white border border-[#fbcfe8] text-[12px] text-[#8259F5] font-medium flex items-center justify-center hover:bg-[#f3f0ff]">통화 내역</Link>
            <Link to="/mypage/chats" className="h-9 rounded-lg bg-white border border-[#fbcfe8] text-[12px] text-[#8259F5] font-medium flex items-center justify-center hover:bg-[#f3f0ff]">채팅 내역</Link>
            <Link to="/counselor/mypage/settlement/history" className="h-9 rounded-lg bg-white border border-[#fbcfe8] text-[12px] text-[#8259F5] font-medium flex items-center justify-center hover:bg-[#f3f0ff]">정산 이력</Link>
            <Link to="/counselor/mypage/referral" className="h-9 rounded-lg bg-white border border-[#fbcfe8] text-[12px] text-[#8259F5] font-medium flex items-center justify-center hover:bg-[#f3f0ff]">추천 현황</Link>
          </div>
          {/* 선지급 미니 */}
          {payout && (
            <Link to="/counselor/mypage/payout" className="mt-3 block p-2.5 rounded-lg bg-white/70 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-[#6A7282]">선지급 가능액</div>
                <div className="text-[15px] font-semibold text-[#1E2939] tabular-nums">
                  {payout.available_amount.toLocaleString()}원
                </div>
              </div>
              {payout.has_pending_request ? (
                <span className="text-[11px] px-2.5 h-8 rounded-full bg-[#FEF9C3] text-[#A16207] font-medium inline-flex items-center">처리 대기</span>
              ) : (
                <span className="px-3 h-8 rounded-full bg-[#8259F5] text-white text-[12px] font-medium inline-flex items-center">신청</span>
              )}
            </Link>
          )}
        </section>

        {/* ③ 🔔 처리 필요 알림 — 미답변 후기/문의 카운트 실시간 표시 */}
        {(() => {
          const total = (pendingCounts?.pending_qna ?? 0) + (pendingCounts?.pending_review ?? 0)
          const hasPending = total > 0
          return (
            <Link
              to="/counselor/mypage/customer-qnas"
              className={`block rounded-[16px] border p-4 ${hasPending ? 'border-rose-300 bg-rose-50/60' : 'border-amber-200 bg-amber-50/40'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[13px] font-semibold inline-flex items-center gap-1.5 ${hasPending ? 'text-rose-700' : 'text-amber-900'}`}>
                  {hasPending ? '🔔 답변 대기 중' : '✅ 처리할 일 없어요'}
                </span>
                <span className={`text-[11px] font-medium ${hasPending ? 'text-rose-600' : 'text-amber-700'}`}>
                  새 후기·문의 답변 대기 {total}건
                </span>
              </div>
              {hasPending && (
                <p className="mt-1 text-[12px] text-rose-500">
                  {pendingCounts!.pending_qna > 0 && `문의 ${pendingCounts!.pending_qna}건`}
                  {pendingCounts!.pending_qna > 0 && pendingCounts!.pending_review > 0 && ' · '}
                  {pendingCounts!.pending_review > 0 && `후기 ${pendingCounts!.pending_review}건`}
                  {' '}답변을 기다리고 있습니다.
                </p>
              )}
            </Link>
          )
        })()}

        {/* ④ 📊 이번달 상담 현황 — 0건이어도 표시 (신규 상담사 동기부여) */}
        <section className="rounded-[16px] border border-[#F3F4F6] bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-[#364153]">
              📊 {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 상담 현황
            </span>
            <Link to="/counselor/mypage/consult-stats" className="text-[11px] text-[#6A7282]">자세히 →</Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2.5 bg-[#F9FAFB] rounded-lg">
              <div className="text-[10px] text-[#6A7282] mb-1">상담</div>
              <div className="text-[18px] font-bold text-[#1E2939] tabular-nums">
                {(monthlyStats?.total_count ?? 0).toLocaleString()}
                <span className="text-[11px] font-medium text-[#6A7282] ml-0.5">건</span>
              </div>
            </div>
            <div className="text-center p-2.5 bg-[#F9FAFB] rounded-lg">
              <div className="text-[10px] text-[#6A7282] mb-1">부재</div>
              <div className="text-[18px] font-bold text-rose-500 tabular-nums">
                {(monthlyStats?.missed_count ?? 0).toLocaleString()}
                <span className="text-[11px] font-medium text-[#6A7282] ml-0.5">건</span>
              </div>
            </div>
            <div className="text-center p-2.5 bg-[#F9FAFB] rounded-lg">
              <div className="text-[10px] text-[#6A7282] mb-1">시간</div>
              <div className="text-[16px] font-bold text-[#1E2939] tabular-nums leading-tight pt-0.5">
                {formatHoursMinutes(monthlyStats?.total_seconds ?? 0)}
              </div>
            </div>
          </div>
          {monthlyStats && monthlyStats.total_count === 0 && (
            <p className="mt-2 text-[11px] text-[#9CA3AF] text-center">
              이번달 첫 상담을 기다리고 있어요 — 화이팅! ✨
            </p>
          )}
        </section>

        {/* ⑤ 📊 등급/단가 — 당월 실시간 진척바 + 승급 이력 */}
        {grade && (
          <section className="rounded-[16px] border border-[#F3F4F6] bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold text-[#364153]">📊 등급 / 단가</span>
              <span className="text-[11px] text-[#9CA3AF]">{grade.grade_label}</span>
            </div>
            {/* 당월 실시간 프로그레스 바 */}
            {gradeProgress
              ? <RealtimeGradeProgress progress={gradeProgress} />
              : <NextGradeProgress grade={grade.grade} seconds={grade.last_month_seconds} />
            }

            {/* 신규 가입자 단가 안내 (2026-05-22) — 기본값 1000원일 때 노출.
                상담사가 본인 단가로 수정하도록 안내. */}
            {grade.current_unit_cost === 1000 && grade.can_change_now && (
              <div className="mt-3 px-3 py-2.5 rounded-[10px] bg-[#FEF3C7] border border-[#FBBF24]">
                <p className="text-[12.5px] leading-[150%] text-[#92400E]">
                  💡 <strong>가입 시 자동 설정된 기본 단가(1,000원/30초)</strong> 입니다.
                  본인 단가로 변경하시려면 아래 <strong>변경</strong> 버튼을 눌러주세요.
                </p>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-[#F3F4F6] flex items-end justify-between">
              <div>
                <p className="text-[12px] text-[#6A7282]">현재 단가</p>
                <p className="mt-0.5 text-[20px] font-bold text-[#1E2939] tabular-nums">
                  {grade.current_unit_cost > 0 ? `${grade.current_unit_cost.toLocaleString()}원` : '미설정'}
                  <span className="ml-1 text-[12px] font-medium text-[#6A7282]">/ 30초</span>
                </p>
              </div>
              <button
                type="button"
                disabled={!grade.can_change_now}
                onClick={() => setCostModalOpen(true)}
                className="h-9 px-4 rounded-full bg-[#8259F5] text-[13px] font-semibold text-white disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
              >
                변경
              </button>
            </div>
            {!grade.can_change_now && grade.next_change_date_kst && (
              <p className="mt-2 text-[12px] text-[#9CA3AF]">다음 변경 가능: {grade.next_change_date_kst}</p>
            )}
          </section>
        )}

        {/* ④ 상담사 관리 메뉴 — 그리드 */}
        <section className="rounded-[16px] border border-[#F3F4F6] bg-white p-3">
          <div className="text-[12px] text-[#6A7282] px-1 mb-2">상담사 관리</div>
          <div className="grid grid-cols-4 gap-1">
            {COUNSELOR_MAIN_MENU.map((it) => (
              <Link
                key={it.key}
                to={it.to}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-[#F9FAFB] transition"
              >
                <div className="w-11 h-11 rounded-xl bg-[#f3f0ff] flex items-center justify-center">
                  <img src={it.icon} alt="" className="w-6 h-6" />
                </div>
                <span className="text-[11px] text-[#364153] text-center leading-tight">{it.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ⑥ 상담 통계 (기간 검색) — 자세한 기간 검색은 별도 페이지 */}
        <Link to="/counselor/mypage/consult-stats" className="rounded-[16px] border border-[#F3F4F6] bg-white px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-medium text-[#364153] inline-flex items-center gap-2">
            📈 상담 통계 (기간 검색)
          </span>
          <span className="text-[#D1D5DB] text-[16px]">›</span>
        </Link>

        {/* 상담 스타일 설정 */}
        <Link to="/counselor/mypage/style" className="rounded-[16px] border border-[#F3F4F6] bg-white px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-medium text-[#364153] inline-flex items-center gap-2">
            ✨ 상담 스타일 설정
          </span>
          <span className="text-[#D1D5DB] text-[16px]">›</span>
        </Link>

        {/* 내 공지사항 작성 — 프로필 페이지의 공지 영역에 표시 */}
        <Link to="/counselor/mypage/notice-edit" className="rounded-[16px] border border-[#F3F4F6] bg-white px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-medium text-[#364153] inline-flex items-center gap-2">
            📢 내 공지사항 작성
          </span>
          <span className="text-[#D1D5DB] text-[16px]">›</span>
        </Link>

        {/* [2026-05-31] 나만의 메모장 — 본인만 보기/쓰기 */}
        <Link to="/counselor/mypage/memo" className="rounded-[16px] border border-[#F3F4F6] bg-white px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-medium text-[#364153] inline-flex items-center gap-2">
            📝 나만의 메모장
          </span>
          <span className="text-[#D1D5DB] text-[16px]">›</span>
        </Link>

        {/* ⑦ 설정 / 기타 — 접힘 */}
        <section className="rounded-[16px] border border-[#F3F4F6] bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setExtraOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5"
          >
            <span className="text-[14px] font-medium text-[#364153] inline-flex items-center gap-2">
              ⚙️ 설정 및 기타
            </span>
            <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform ${extraOpen ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {extraOpen && (
            <ul className="border-t border-[#F3F4F6]">
              <li>
                <Link to="/mypage/app-settings" className="h-12 px-4 flex items-center justify-between text-[14px] text-[#1E2939]">
                  앱 알림 설정 <span className="text-[#D1D5DB]">›</span>
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLogoutOpen(true)}
                  className="w-full h-12 px-4 flex items-center justify-between text-[14px] text-[#FB2C36] border-t border-[#F3F4F6]"
                >
                  로그아웃 <img src="/img/ic_my_logout.svg" alt="" className="w-4 h-4 opacity-60" />
                </button>
              </li>
            </ul>
          )}
        </section>
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

      <UnitCostChangeModal
        open={costModalOpen}
        info={grade}
        onClose={() => setCostModalOpen(false)}
        onSuccess={() => {
          setCostModalOpen(false)
          counselorGradeApi.getMine().then(setGrade).catch(() => {})
        }}
      />
    </div>
  )
}

/**
 * 당월 실시간 상담시간 프로그레스 바 (2026-06-07 신설).
 * API /user/counselor-mypage/grade/progress 데이터 기반.
 */
function RealtimeGradeProgress({ progress }: { progress: GradeProgressInfo }) {
  const { total_hours, next_grade_label, next_threshold_hours, progress_pct, realtime_upgrades_this_month } = progress

  return (
    <div className="mt-1">
      {/* 진척바 */}
      {next_grade_label && next_threshold_hours ? (
        <>
          <div className="flex items-center justify-between text-[12px] text-[#6A7282]">
            <span>
              이번달{' '}
              <span className="font-semibold text-[#8259F5] tabular-nums">{total_hours.toFixed(1)}h</span>
            </span>
            <span>
              {next_grade_label}까지{' '}
              <span className="font-semibold tabular-nums">
                {Math.max(0, next_threshold_hours - total_hours).toFixed(1)}h
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8259F5] to-[#9b7af7] transition-all"
              style={{ width: `${progress_pct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">이번 달 누적 (매월 1일 초기화)</p>
        </>
      ) : (
        <div className="mt-1">
          <p className="text-[12px] text-[#6A7282]">
            최고 등급 · 이번달 누적{' '}
            <span className="font-semibold text-[#8259F5] tabular-nums">{total_hours.toFixed(1)}시간</span>
          </p>
        </div>
      )}

      {/* 이번 달 실시간 승급 이력 */}
      {realtime_upgrades_this_month.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
          <p className="text-[11px] font-medium text-[#6A7282] mb-2">🎉 이번 달 승급 이력</p>
          <div className="flex flex-col gap-1.5">
            {realtime_upgrades_this_month.map((u, i) => {
              const LABEL: Record<string, string> = {
                preliminary: '예비파트너', partner1: '파트너1', partner2: '파트너2',
                partner3: '파트너3', partner4: '파트너4', partner5: '파트너5',
              }
              const d = new Date(u.changed_at)
              const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
              return (
                <div key={i} className="flex items-center gap-2 text-[11.5px]">
                  <span className="text-[#9CA3AF]">{dateStr}</span>
                  <span className="text-[#6A7282]">{LABEL[u.grade_before] ?? u.grade_before}</span>
                  <span className="text-[#D1D5DB]">→</span>
                  <span className="font-semibold text-[#8259F5]">{LABEL[u.grade_after] ?? u.grade_after}</span>
                  <span className="text-[#9CA3AF]">({u.hours_at_upgrade}h 달성)</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 다음 등급까지 진척바 (폴백용 — API 로드 전 표시).
 * 임계값 하드코딩 (시드 정책과 동일):
 *   partner1=20h, partner2=40h, partner3=70h, partner4=90h, partner5=120h
 * 어드민에서 임계값 바뀌면 이 컴포넌트도 같이 수정 필요 (서버에서 받아오는 방식 고려).
 */
function NextGradeProgress({
  grade,
  seconds,
}: {
  grade: string
  seconds: number
}) {
  const thresholds: Record<string, { next: string | null; nextHours: number | null; baseHours: number }> = {
    preliminary: { next: '파트너1', nextHours: 20, baseHours: 0 },
    partner1:    { next: '파트너2', nextHours: 40, baseHours: 20 },
    partner2:    { next: '파트너3', nextHours: 70, baseHours: 40 },
    partner3:    { next: '파트너4', nextHours: 90, baseHours: 70 },
    partner4:    { next: '파트너5', nextHours: 120, baseHours: 90 },
    partner5:    { next: null, nextHours: null, baseHours: 120 },
  }
  const info = thresholds[grade] ?? thresholds.preliminary
  const hours = seconds / 3600

  if (!info.next || info.nextHours == null) {
    return (
      <div className="mt-3">
        <p className="text-[12px] text-[#6A7282] leading-[140%]">
          최고 등급 · 직전 1개월 누적{' '}
          <span className="font-semibold text-[#8259F5] tabular-nums">
            {hours.toFixed(1)}시간
          </span>
        </p>
      </div>
    )
  }

  const pct = Math.min(
    100,
    Math.max(0, ((hours - info.baseHours) / (info.nextHours - info.baseHours)) * 100),
  )
  const remaining = Math.max(0, info.nextHours - hours)

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[12px] text-[#6A7282] leading-[140%]">
        <span>
          직전 1개월{' '}
          <span className="font-semibold text-[#8259F5] tabular-nums">
            {hours.toFixed(1)}h
          </span>
        </span>
        <span>
          {info.next}까지{' '}
          <span className="font-semibold tabular-nums">{remaining.toFixed(1)}h</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
        <div
          className="h-full bg-[#8259F5] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  on,
  onChange,
  disabled,
}: {
  label: string
  on: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <li className="h-14 flex items-center justify-between">
      <span className={`text-[17px] leading-[140%] font-semibold ${disabled ? 'text-[#9CA3AF]' : 'text-[#030712]'}`}>{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!on)}
        aria-label={`${label} 토글`}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed ' : ''
        }${on ? 'bg-[#8259F5]' : 'bg-[#D1D5DB]'}`}
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
                stroke="#8259F5"
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
