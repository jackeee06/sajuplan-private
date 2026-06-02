import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { chargeApi, type ChargeStatusResult } from '../lib/api'

// PG가 redirect 시 query에 req_result/msg를 함께 보내면 즉시 결과 판단 가능 (폴링 없이)
function detectInstantStatus(req_result: string | null, msg: string | null): 'cancelled' | 'failed' | null {
  if (!req_result && !msg) return null
  if (req_result && req_result === '0000') return null // 성공은 백엔드 처리 결과 폴링
  if (msg && /취소|cancel|user/i.test(msg)) return 'cancelled'
  if (req_result && req_result !== '0000') return 'failed'
  return null
}

/**
 * 결제 완료 화면 (PG formurl).
 * sample/coin/coin_pay_result.php 와 일반 결제 완료 케이스를 통합.
 *
 * URL: /charge/complete?oid=...
 *
 * 동작:
 *  - mount 시 chargeApi.status(oid) 폴링 (최대 30초, 1초 간격)
 *  - status='completed' → 성공 화면 + 보유 포인트 갱신 안내
 *  - status='pending' && vbank → 가상계좌 안내로 redirect
 *  - status='failed' → 실패 화면
 */
export default function ChargeComplete() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const oid = search.get('oid') ?? ''

  const [data, setData] = useState<ChargeStatusResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [polled, setPolled] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!oid) {
      setError('주문번호가 없습니다.')
      return
    }

    // PG가 redirect 시 query에 req_result/msg를 보냈고 그게 cancelled/failed로 판정 가능하면
    // 폴링 없이 즉시 화면에 결과 표시 (백엔드 처리는 비동기로 별도 진행됨)
    const instant = detectInstantStatus(search.get('req_result'), search.get('msg'))
    if (instant) {
      setData({
        status: instant,
        amount: 0,
        coinAmount: 0,
        resultMessage: search.get('msg') ?? null,
        m2netStatus: null,
        vbank: null,
      })
      return
    }

    let mounted = true
    let timer: number | null = null
    let attempts = 0
    let consecutiveErrors = 0
    const MAX = 30
    const MAX_CONSECUTIVE_ERRORS = 5  // 일시적 단절(PM2 재기동/네트워크 지터) 흡수

    const tick = async () => {
      attempts += 1
      try {
        const r = await chargeApi.status(oid)
        if (!mounted) return
        consecutiveErrors = 0
        setData(r)
        setPolled(attempts)
        // 종료 조건: 결제 완료 / 실패 / 취소 모두 더 이상 폴링 불필요
        if (r.status === 'completed' || r.status === 'failed' || r.status === 'cancelled') return
        if (r.status === 'pending' && r.vbank?.account) {
          navigate(`/charge/vbank-info?oid=${encodeURIComponent(oid)}`, { replace: true })
          return
        }
        if (attempts < MAX) {
          timer = window.setTimeout(tick, 1000)
        } else {
          // 30초 폴링해도 status='pending'이면 PG 콜백이 늦어지거나 결제가 완료되지 않은 상태
          setTimedOut(true)
        }
      } catch (e) {
        if (!mounted) return
        consecutiveErrors += 1
        // 5회 연속 실패 전까지는 재시도 (PG 콜백 도착 직전 한두 번의 fetch 에러 흡수)
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setError((e as Error).message)
          return
        }
        if (attempts < MAX) {
          timer = window.setTimeout(tick, 2000)  // 재시도 backoff
        } else {
          setTimedOut(true)
        }
      }
    }
    tick()

    return () => {
      mounted = false
      if (timer) window.clearTimeout(timer)
    }
  }, [oid, navigate, search])

  return (
    <div className="mobile-frame flex flex-col min-h-[100vh] items-center justify-center px-6 text-center">
      {error ? (
        <Failure message={error} onBack={() => navigate('/mypage/charge', { replace: true })} />
      ) : !data ? (
        <Pending elapsed={polled} />
      ) : data.status === 'completed' ? (
        <Success data={data} onHome={() => navigate('/', { replace: true })} onPoints={() => navigate('/mypage/points')} />
      ) : data.status === 'cancelled' ? (
        <Cancelled onBack={() => navigate('/mypage/charge', { replace: true })} />
      ) : data.status === 'failed' ? (
        <Failure
          message={data.resultMessage ?? '결제에 실패했습니다.'}
          onBack={() => navigate('/mypage/charge', { replace: true })}
        />
      ) : timedOut ? (
        <Timeout onBack={() => navigate('/mypage/charge', { replace: true })} onPayments={() => navigate('/mypage/payments')} />
      ) : (
        <Pending elapsed={polled} />
      )}
    </div>
  )
}

function Pending({ elapsed }: { elapsed: number }) {
  // 10초 이상 폴링되면 백키 옵션 노출 (사용자가 무한처럼 느끼지 않도록)
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-full border-4 border-[#f472b6] border-t-transparent animate-spin" />
      <p className="mt-6 text-[16px] font-semibold text-[#1E2939]">결제 결과를 확인 중입니다</p>
      <p className="mt-2 text-[13px] text-[#6A7282]">잠시만 기다려주세요... ({elapsed}s)</p>
      {elapsed >= 10 && (
        <a
          href="/mypage/charge"
          className="mt-6 text-[13px] text-[#ec4899] underline"
        >
          충전 페이지로 돌아가기
        </a>
      )}
    </div>
  )
}

function Success({
  data,
  onHome,
  onPoints,
}: {
  data: ChargeStatusResult
  onHome: () => void
  onPoints: () => void
}) {
  const navigate = useNavigate()
  // [2026-05-27] 5분 알림 → 충전 → 결제 완료 흐름. sessionStorage 에 chatReturnRoomId 가
  // 있으면 채팅 복귀 우선 표시 + 3초 후 자동 redirect.
  const [chatReturnRoomId, setChatReturnRoomId] = useState<string | null>(null)
  // [엄격검증 4차 fix 2026-05-27 Q-3] 30분 TTL — stale chatReturnRoomId 잘못된 redirect 방지
  useEffect(() => {
    try {
      const v = sessionStorage.getItem('chatReturnRoomId')
      const ts = sessionStorage.getItem('chatReturnRoomIdAt')
      if (v && ts) {
        const ageMs = Date.now() - Number(ts)
        if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 30 * 60_000) {
          setChatReturnRoomId(v)
        } else {
          // 30분 이상 stale — 무시하고 정리
          sessionStorage.removeItem('chatReturnRoomId')
          sessionStorage.removeItem('chatReturnRoomIdAt')
        }
      }
    } catch { /* storage unsupported */ }
  }, [])
  useEffect(() => {
    if (!chatReturnRoomId) return
    const t = window.setTimeout(() => {
      try { sessionStorage.removeItem('chatReturnRoomId') } catch { /* ignore */ }
      navigate(`/chat/${chatReturnRoomId}`, { replace: true })
    }, 3000)
    return () => window.clearTimeout(t)
  }, [chatReturnRoomId, navigate])

  const handleReturnToChat = () => {
    try { sessionStorage.removeItem('chatReturnRoomId') } catch { /* ignore */ }
    navigate(`/chat/${chatReturnRoomId}`, { replace: true })
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="w-16 h-16 mx-auto rounded-full bg-[#fdf2f8] flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M8 16L14 22L24 10" stroke="#f472b6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="mt-6 text-[20px] font-bold text-[#1E2939]">결제 완료</p>
      <p className="mt-2 text-[14px] text-[#6A7282]">
        {data.coinAmount.toLocaleString()} 코인이 적립되었습니다.
      </p>
      {chatReturnRoomId && (
        <p className="mt-2 text-[13px] text-[#ec4899] font-medium">
          ⏰ 3초 후 채팅으로 자동 이동합니다
        </p>
      )}
      <div className="mt-8 flex flex-col gap-2">
        {chatReturnRoomId ? (
          <>
            <button
              type="button"
              onClick={handleReturnToChat}
              className="w-full h-[52px] rounded-[16px] bg-[#f472b6] text-white text-[16px] font-bold"
            >
              💬 채팅으로 돌아가기
            </button>
            <button
              type="button"
              onClick={onPoints}
              className="w-full h-[52px] rounded-[16px] border border-[#E5E7EB] text-[14px] text-[#4A5565]"
            >
              코인 내역 보기
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onPoints}
              className="w-full h-[52px] rounded-[16px] bg-[#f472b6] text-white text-[16px] font-semibold"
            >
              코인 내역 보기
            </button>
            <button
              type="button"
              onClick={onHome}
              className="w-full h-[52px] rounded-[16px] border border-[#E5E7EB] text-[16px] text-[#4A5565]"
            >
              홈으로
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Timeout({ onBack, onPayments }: { onBack: () => void; onPayments: () => void }) {
  return (
    <div className="w-full max-w-[400px]">
      <div className="w-16 h-16 mx-auto rounded-full bg-[#FFF7E6] flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="13" stroke="#F5A623" strokeWidth="2.5" />
          <path d="M16 9V17L21 19" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="mt-6 text-[20px] font-bold text-[#1E2939]">결제 결과 확인이 지연되고 있습니다</p>
      <p className="mt-2 text-[14px] text-[#6A7282] leading-[150%]">
        PG사로부터 결과 통지가 도착하지 않았습니다.<br />
        결제가 정상 완료된 경우 잠시 후 결제 내역에서 확인하실 수 있습니다.
      </p>
      <div className="mt-8 flex flex-col gap-2">
        <button
          type="button"
          onClick={onPayments}
          className="w-full h-[52px] rounded-[16px] bg-[#f472b6] text-white text-[16px] font-semibold"
        >
          결제 내역 확인
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full h-[52px] rounded-[16px] border border-[#E5E7EB] text-[16px] text-[#4A5565]"
        >
          충전 페이지로
        </button>
      </div>
    </div>
  )
}

function Cancelled({ onBack }: { onBack: () => void }) {
  return (
    <div className="w-full max-w-[400px]">
      <div className="w-16 h-16 mx-auto rounded-full bg-[#F3F4F6] flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="13" stroke="#6A7282" strokeWidth="2.5" />
          <path d="M11 16H21" stroke="#6A7282" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mt-6 text-[20px] font-bold text-[#1E2939]">결제가 취소되었습니다</p>
      <p className="mt-2 text-[14px] text-[#6A7282]">
        결제 진행을 취소하셨습니다.<br />
        다시 시도하시려면 충전 페이지로 돌아가주세요.
      </p>
      <div className="mt-8">
        <button
          type="button"
          onClick={onBack}
          className="w-full h-[52px] rounded-[16px] bg-[#f472b6] text-white text-[16px] font-semibold"
        >
          충전 페이지로
        </button>
      </div>
    </div>
  )
}

function Failure({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="w-full max-w-[400px]">
      <div className="w-16 h-16 mx-auto rounded-full bg-[#FEEBEE] flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M10 10L22 22M22 10L10 22" stroke="#FF6467" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mt-6 text-[20px] font-bold text-[#1E2939]">결제 실패</p>
      <p className="mt-2 text-[14px] text-[#6A7282] break-keep">{message}</p>
      <div className="mt-8">
        <button
          type="button"
          onClick={onBack}
          className="w-full h-[52px] rounded-[16px] bg-[#f472b6] text-white text-[16px] font-semibold"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
