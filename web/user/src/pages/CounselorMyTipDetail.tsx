import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { MOCK_COUNSELOR_TIPS } from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_알짜 정보 상세
 * Figma node-id: 173:13694
 *
 * 헤더 / 제목 / 노출기간 / 풀폭 배너 이미지 / 목록으로 버튼
 */
export default function CounselorMyTipDetail() {
  const navigate = useNavigate()
  const { id = '1' } = useParams<{ id: string }>()
  const tip = MOCK_COUNSELOR_TIPS.find((t) => t.id === Number(id)) ?? MOCK_COUNSELOR_TIPS[0]

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">알짜 정보</h1>
      </header>

      <main className="flex-1 px-4">
        <h2 className="pt-2 text-[20px] font-bold leading-[140%] text-[#030712]">{tip.title}</h2>
        <p className="mt-1 text-[14px] leading-[140%] text-[#99A1AF]">{tip.period}</p>

        <div className="mt-4 w-full aspect-[16/9] rounded-[16px] overflow-hidden bg-[#F3F4F6]">
          <img src={tip.imgUrl} alt="" className="w-full h-full object-cover" />
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/counselor/mypage/tips')}
            className="h-10 px-6 rounded-full border border-[#8259F5] text-[14px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
      </main>

      <FloatingActions bottomOffset={24} />
      <BottomNav myHref="/counselor/mypage" />
      </div>
  )
}
