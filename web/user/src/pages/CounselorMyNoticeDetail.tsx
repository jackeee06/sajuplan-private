import { useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { MOCK_COUNSELOR_NOTICES } from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_상담사 공지사항 상세
 * Figma node-id: 179:18181
 *
 * 헤더 / 제목 / 작성시각 / 본문 텍스트 / 본문 이미지 / 목록으로 버튼
 */
export default function CounselorMyNoticeDetail() {
  const navigate = useNavigate()
  const { id = '1' } = useParams<{ id: string }>()
  const notice =
    MOCK_COUNSELOR_NOTICES.find((n) => n.id === Number(id)) ?? MOCK_COUNSELOR_NOTICES[0]

  return (
    <div className="mobile-frame flex flex-col pb-6">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">상담사 공지사항</h1>
      </header>

      <main className="flex-1 px-4">
        <h2 className="pt-2 text-[20px] font-bold leading-[140%] text-[#030712]">{notice.title}</h2>
        <p className="mt-1 text-[14px] leading-[140%] text-[#99A1AF]">
          {notice.postedAt ?? notice.date}
        </p>

        {notice.description && (
          <p className="mt-4 text-[14px] leading-[160%] text-[#4A5565] whitespace-pre-line">
            {notice.description}
          </p>
        )}

        {notice.imgUrl && (
          <div className="mt-4 w-full rounded-[16px] overflow-hidden bg-[#F3F4F6]">
            <img src={notice.imgUrl} alt="" className="w-full h-auto object-cover" />
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/counselor/mypage/notices')}
            className="h-10 px-6 rounded-full border border-[#9B7AF7] text-[14px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}
