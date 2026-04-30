import { useLocation, useNavigate } from 'react-router-dom'
import PrimaryButton from '../components/PrimaryButton'
import { CheckCircleIcon, CloseIcon, InfoIcon } from '../components/icons'

interface LocState {
  method?: 'phone' | 'email'
}

/**
 * 아이디/비밀번호 찾기 완료 — Figma node 69:2609 (휴대폰), 71:2700 (이메일)
 * 가운데 체크 아이콘 + 메시지 / 하단 안내 노티스 + 로그인하기 버튼
 */
export default function FindComplete() {
  const navigate = useNavigate()
  const loc = useLocation()
  const method = (loc.state as LocState | null)?.method ?? 'phone'

  const description =
    method === 'phone'
      ? '입력하신 번호로 아이디와\n변경된 비밀번호 정보가 발송되었습니다.'
      : '입력하신 이메일로 아이디와\n변경된 비밀번호 정보가 발송되었습니다.'

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
        <div className="w-20 h-20 rounded-full bg-[#f1ecfe] flex items-center justify-center mb-7">
          <CheckCircleIcon className="w-10 h-10" />
        </div>
        <h1 className="text-[20px] font-bold text-[#1E2939]">아이디/비밀번호 찾기 완료</h1>
        <p className="text-[15px] text-[#4a5565] mt-2.5 text-center whitespace-pre-line leading-relaxed">
          {description}
        </p>
      </main>

      <footer className="px-4 pb-8">
        <div className="bg-[#f3f4f6] rounded-xl px-3 py-3 flex items-start gap-2 mb-4">
          <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-[13px] text-[#4a5565] leading-relaxed">
            안전한 서비스 이용을 위해 로그인 후 비밀번호를 변경해주세요.
          </p>
        </div>
        <PrimaryButton type="button" onClick={() => navigate('/login', { replace: true })}>
          로그인하기
        </PrimaryButton>
      </footer>
    </div>
  )
}
