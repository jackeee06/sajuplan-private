import { useEffect, useState } from 'react'
import { promoterApi } from '../lib/api'

/**
 * 마이페이지 — 추천 코드 사후 입력.
 *
 * 앱 신규설치 경유로 가입하면 링크의 추천 코드가 앱으로 전달되지 않아(저장소 분리) 누락된다.
 * 가입 후 7일 이내 + 아직 미귀속인 회원에게만 "추천 코드 입력" 칸을 노출해 구제한다.
 * 그 외(이미 귀속/기간 지남)에는 아무것도 렌더하지 않는다(null).
 */
export default function PromoterReferralPrompt() {
  const [canInput, setCanInput] = useState(false)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    promoterApi.referralStatus().then(
      (s) => {
        if (alive) setCanInput(s.canInput && !s.hasReferral)
      },
      () => {
        /* 비로그인/오류 — 숨김 유지 */
      },
    )
    return () => {
      alive = false
    }
  }, [])

  if (!canInput) return null

  if (done) {
    return (
      <div className="mt-3 rounded-[16px] bg-[#fdf2f8] border border-[#fbcfe8] px-4 py-3.5 text-[14px] leading-[160%] text-[#1E2939]">
        {done}
      </div>
    )
  }

  const onSubmit = async () => {
    const c = code.trim()
    if (!c) {
      setErr('추천 코드를 입력해 주세요.')
      return
    }
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      const r = await promoterApi.applyReferral(c)
      if (r.ok) setDone(r.message)
      else setErr(r.message)
    } catch {
      setErr('잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-[16px] bg-white border border-[#F3F4F6] shadow-[0_2px_10px_rgba(0,0,0,0.03)] px-4 py-3.5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-[14px] font-medium text-[#1E2939]">추천 코드가 있으신가요?</span>
          <span className="text-[12px] font-medium text-[#ec4899]">입력하기</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2.5">
          <span className="text-[14px] font-semibold text-[#1E2939]">추천 코드 입력</span>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 32))}
              placeholder="받으신 추천 코드"
              inputMode="numeric"
              className="flex-1 min-w-0 rounded-[12px] bg-[#f9fafb] border border-[#f3f4f6] focus:border-[#f472b6] focus:bg-white px-3.5 py-2.5 text-[15px] text-[#1e2939] placeholder-[#99a1af] focus:outline-none transition"
            />
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy}
              className="shrink-0 px-4 rounded-[12px] bg-[#ec4899] text-white text-[14px] font-medium disabled:opacity-50"
            >
              {busy ? '...' : '등록'}
            </button>
          </div>
          {err && <span className="text-[12px] text-[#FF6467]">{err}</span>}
          <span className="text-[12px] text-[#99A1AF]">가입 후 7일 이내에 한 번만 입력할 수 있어요.</span>
        </div>
      )}
    </div>
  )
}
