import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PrimaryButton from '../components/PrimaryButton'
import { CheckCircleIcon, CloseIcon, InfoIcon } from '../components/icons'

interface LocState {
  method?: 'phone' | 'email'
  mbId?: string
  tempPw?: string
}

/**
 * 아이디/비밀번호 찾기 완료 — Figma node 69:2609 (휴대폰), 71:2700 (이메일)
 * 휴대폰: 아이디 + 임시비밀번호를 화면에 바로 표시(C안) + 카카오톡 발송.
 */
export default function FindComplete() {
  const navigate = useNavigate()
  const loc = useLocation()
  // 임시비번 평문이 브라우저 history.state(세션복원 시 디스크 잔류)에 남지 않도록
  //   mount 시 1회 스냅샷으로만 읽고, history.state 는 즉시 비운다.
  const [snap] = useState(() => {
    const s = loc.state as LocState | null
    return { method: s?.method ?? 'phone', mbId: s?.mbId, tempPw: s?.tempPw }
  })
  useEffect(() => {
    // react-router 내부 state(key/idx)는 보존하고 usr(=평문 임시비번 담긴 loc.state)만 제거.
    window.history.replaceState({ ...window.history.state, usr: null }, '')
  }, [])
  const method = snap.method
  const mbId = snap.mbId
  const tempPw = snap.tempPw
  const hasResult = Boolean(mbId && tempPw)

  const description = hasResult
    ? '아래 아이디와 임시 비밀번호로 로그인해주세요.\n카카오톡으로도 함께 보내드렸습니다.'
    : method === 'phone'
      ? '입력하신 번호로 아이디와\n임시 비밀번호를 보내드렸습니다.'
      : '입력하신 이메일로 아이디와\n임시 비밀번호를 보내드렸습니다.'

  return (
    <div className="mobile-frame flex flex-col">
      <header className="h-[60px] flex items-center justify-end px-4">
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          aria-label="닫기"
          className="w-8 h-8 flex items-center justify-center"
        >
          <CloseIcon />
        </button>
      </header>

      <main className="flex-1 px-6 flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-[#fdf2f8] flex items-center justify-center mb-7">
          <CheckCircleIcon className="w-10 h-10" />
        </div>
        <h1 className="text-[20px] font-bold text-[#1E2939]">아이디/비밀번호 찾기 완료</h1>
        <p className="text-[15px] text-[#4a5565] mt-2.5 text-center whitespace-pre-line leading-relaxed">
          {description}
        </p>

        {hasResult && (
          <div className="w-full max-w-[320px] mt-7 rounded-xl border border-[#f3f4f6] bg-[#f9fafb] px-4 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#6a7282]">아이디</span>
              <span className="text-[15px] font-semibold text-[#1E2939]">{mbId}</span>
            </div>
            <div className="h-px bg-[#f3f4f6]" />
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#6a7282]">임시 비밀번호</span>
              <span className="text-[15px] font-semibold text-[#8259F5] tracking-wide">{tempPw}</span>
            </div>
          </div>
        )}
      </main>

      <footer className="px-4 pb-8">
        <div className="bg-[#f3f4f6] rounded-xl px-3 py-3 flex items-start gap-2 mb-4">
          <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-[13px] text-[#4a5565] leading-relaxed">
            임시 비밀번호로 로그인한 뒤, 안전한 이용을 위해 비밀번호를 변경해주세요.
          </p>
        </div>
        <PrimaryButton type="button" onClick={() => navigate('/login', { replace: true })}>
          로그인하기
        </PrimaryButton>
      </footer>
    </div>
  )
}
