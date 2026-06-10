import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { API_BASE } from '../lib/runtime-env'

/**
 * [2026-05-27] 전역 실시간 알림 — 5분 잔여 알림 등 시스템 알림 polling 수신.
 *  - 로그인 후 30초 주기로 GET /api/user/notifications/pending 호출
 *  - 새 알림 도착 시 큰 모달 + 사운드 + TTS + 진동 (사장님 정책)
 *  - 사용자가 어느 페이지에 있든 표시 (App.tsx 에 마운트)
 *  - 채팅창 안에선 ChatRoom 자체 모달이 우선 (중복 표시 방지: link 가 현재 경로면 skip)
 *  - 백그라운드/잠금 화면 도달은 FCM 빌드 후 보완 (별도 작업)
 */

interface PendingAlert {
  id: string
  type: 'consult_5min_warning'
  title: string
  body: string
  link?: string
  data?: Record<string, string>
  created_at: number
}

const POLL_MS = 30_000

export default function GlobalAlerts() {
  const { isLoggedIn, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeAlert, setActiveAlert] = useState<PendingAlert | null>(null)
  const seenRef = useRef<Set<string>>(new Set())


  // 폴링 — 로그인 사용자만
  // [엄격검증 3차 fix 2026-05-27 T-4] 401 응답 시 polling 중단 + 5분 후 재시도 (토큰 갱신 대기)
  useEffect(() => {
    if (loading || !isLoggedIn) return
    let alive = true
    let timer: number | null = null
    let pausedUntil = 0

    const poll = async () => {
      if (Date.now() < pausedUntil) return
      try {
        const res = await fetch(`${API_BASE}/user/notifications/pending`, {
          credentials: 'include',
        })
        if (res.status === 401) {
          // 토큰 만료 추정 — 5분 백오프. auth-context 의 401 재시도와 별개 동작 방지.
          pausedUntil = Date.now() + 5 * 60_000
          return
        }
        if (!res.ok) return
        const json = (await res.json()) as { alerts?: PendingAlert[] }
        const list = json.alerts ?? []
        if (!alive) return
        for (const a of list) {
          if (seenRef.current.has(a.id)) continue
          seenRef.current.add(a.id)
          // ChatRoom 안에서 이미 자체 모달 표시 중이면 중복 X — link 가 현재 경로면 skip
          if (a.link && location.pathname === a.link) continue
          setActiveAlert(a)
          triggerSensoryAlert(a.body)
          break // 한 번에 하나만 표시
        }
      } catch {
        /* 네트워크 실패는 무시 — 다음 polling 에서 재시도 */
      }
    }

    void poll()
    timer = window.setInterval(poll, POLL_MS)

    return () => {
      alive = false
      if (timer != null) window.clearInterval(timer)
    }
  }, [isLoggedIn, loading, location.pathname])

  if (!activeAlert) return null

  const isCounselorAudience = activeAlert.data?.audience === 'counselor'

  const handleClose = () => setActiveAlert(null)
  const handleAction = () => {
    if (!activeAlert.link) { handleClose(); return }
    if (
      !isCounselorAudience &&
      activeAlert.data?.consult_type === 'chat' &&
      activeAlert.data?.chat_room_id
    ) {
      try {
        sessionStorage.setItem('chatReturnRoomId', activeAlert.data.chat_room_id)
        sessionStorage.setItem('chatReturnRoomIdAt', String(Date.now()))
      } catch { /* storage unsupported */ }
      navigate('/mypage/charge')
    } else {
      navigate(activeAlert.link)
    }
    setActiveAlert(null)
  }

  // ── 5분 잔여 알림 모달 ─────────────────────────────────────────────
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-0 z-[60] flex items-center justify-center px-6"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative w-full max-w-[340px] rounded-[24px] bg-white shadow-2xl p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#fdf2f8] flex items-center justify-center text-[36px]">
          ⏰
        </div>
        <h3 className="text-[20px] leading-[130%] font-bold text-[#030712]">
          {activeAlert.title.replace(/^⏰\s*/, '')}
        </h3>
        <p className="mt-2 text-[14px] leading-[150%] text-[#4A5565]">
          {activeAlert.body}
        </p>
        <div className="flex items-center gap-2 mt-5 w-full">
          {isCounselorAudience ? (
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 h-12 rounded-full bg-[#f472b6] text-white text-[15px] font-bold"
            >
              확인
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 h-12 rounded-full bg-white border border-[#E5E7EB] text-[#1E2939] text-[14px] font-medium"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleAction}
                className="flex-1 h-12 rounded-full bg-[#f472b6] text-white text-[15px] font-bold"
              >
                💳 충전하기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** 사운드(880Hz beep) + TTS(한국어) + 진동(200/100/200) — 사장님 정책
 *  [엄격검증 6차 fix 2026-05-27] iOS Safari: AudioContext.resume() fallback (suspended 상태 대응)
 */
function triggerSensoryAlert(message: string) {
  // 사운드
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    // iOS Safari: 사용자 인터랙션 없이 생성된 AudioContext 는 suspended 상태. resume() 시도.
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* iOS 사용자 인터랙션 전엔 resume 실패 — 시각 모달만 */ })
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    setTimeout(() => {
      osc.stop()
      ctx.close().catch(() => {})
    }, 350)
  } catch {
    /* AudioContext unsupported */
  }
  // TTS
  try {
    if ('speechSynthesis' in window) {
      const utt = new SpeechSynthesisUtterance(message)
      utt.lang = 'ko-KR'
      utt.rate = 1.0
      utt.pitch = 1.0
      window.speechSynthesis.speak(utt)
    }
  } catch {
    /* TTS unsupported */
  }
  // 진동
  try {
    if ('vibrate' in navigator) {
      ;(navigator as Navigator & { vibrate: (p: number[]) => boolean }).vibrate([200, 100, 200])
    }
  } catch {
    /* vibrate unsupported */
  }
}
