import { useNavigate } from 'react-router-dom'
import PrimaryButton from '../components/PrimaryButton'
import { CloseIcon, PartyIcon } from '../components/icons'

/**
 * 회원가입 완료 — Figma node 13:41250
 * 우상단 X 닫기 → 로그인으로
 * 가운데 폭죽 + 메시지 / 하단 로그인하기 버튼
 */
export default function SignupComplete() {
  const navigate = useNavigate()
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
          <PartyIcon className="w-10 h-10" />
        </div>
        <h1 className="text-[20px] font-bold text-[#1E2939]">회원가입이 완료되었습니다.</h1>
        <p className="text-[15px] text-[#4a5565] mt-2.5 text-center">
          로그인하고 사주문 서비스를 이용해보세요.
        </p>
      </main>

      <footer className="px-4 pb-8">
        <PrimaryButton type="button" onClick={() => navigate('/login', { replace: true })}>
          로그인하기
        </PrimaryButton>
      </footer>
    </div>
  )
}
