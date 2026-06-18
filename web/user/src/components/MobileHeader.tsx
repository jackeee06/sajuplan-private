import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  /** 뒤로가기 클릭 시 처리. 미지정 시 navigate(-1) */
  onBack?: () => void
  /** 뒤로가기 버튼 숨김 (진입점 화면 — 예: 모집인 대시보드는 뒤로 갈 곳이 없음) */
  hideBack?: boolean
}

/**
 * 모바일 공통 헤더 — Figma `header` (h60, 좌측 ←(30) + 타이틀 18/600 #030712)
 */
export default function MobileHeader({ title, onBack, hideBack }: Props) {
  const navigate = useNavigate()
  const handleBack = onBack ?? (() => navigate(-1))
  return (
    <header className="h-[60px] px-4 flex items-center">
      {!hideBack && (
        <button
          type="button"
          aria-label="뒤로"
          onClick={handleBack}
          className="w-[30px] h-[30px] flex items-center justify-center -ml-1.5"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
      )}
      <h1 className={`text-[18px] font-semibold text-[#030712] leading-none ${hideBack ? '' : 'ml-1'}`}>
        {title}
      </h1>
    </header>
  )
}
