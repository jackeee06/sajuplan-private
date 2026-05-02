import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { MOCK_NOTICES } from '../data/myPageMockData'

/**
 * 공지사항 상세 — Figma 06마이페이지(비회원) > 공지사항 상세
 */
export default function NoticeDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const notice = MOCK_NOTICES.find((n) => String(n.id) === id)

  if (!notice) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px]">
        <header className="h-[60px] px-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
          </button>
          <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
            공지사항
          </h1>
        </header>
        <p className="text-center text-[14px] text-[#99A1AF] py-10">
          존재하지 않는 공지사항입니다.
        </p>
        <BottomNav />
      </div>
    )
  }

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
          공지사항
        </h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        <h2 className="text-[18px] leading-[140%] font-bold text-[#030712]">
          {notice.title}
        </h2>
        <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
          {notice.postedAt}
        </p>

        <div className="mt-4 border-t border-[#F3F4F6] pt-4">
          <p className="text-[15px] leading-[160%] text-[#364153] whitespace-pre-line">
            {notice.content}
          </p>
          {notice.bodyImg && (
            <img
              src={notice.bodyImg}
              alt=""
              className="mt-4 w-full rounded-[12px]"
            />
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/mypage/notices')}
            className="h-[44px] px-7 rounded-full border border-[#9B7AF7] text-[15px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
