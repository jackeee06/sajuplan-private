import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { MOCK_COUNSELOR_CHATS, type ConsultLog } from '../data/counselorMyPage'

const PAGE_SIZE = 10

/**
 * 08마이페이지_상담사_채팅상담내역
 * Figma node-id: 152:10138
 *
 * 카드: 이름·일자·길이 + 메모/휴지통 / 시작·완료·과금포인트·후기작성
 *  - 채팅 내역 보기 (보라 아웃라인 풀폭)
 *  - 후기작성 완료 + 미답변: "후기 답변 작성하기" 보라 풀
 *  - 후기작성 완료 + 답변 있음: "작성한 후기 답변 보기" 보라 아웃라인
 */
export default function CounselorMyChats() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const items = MOCK_COUNSELOR_CHATS
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">채팅상담내역</h1>
      </header>

      <main className="flex-1">
        <ul className="flex flex-col">
          {pageItems.map((it) => (
            <li key={it.id} className="border-b border-[#F3F4F6]">
              <ChatCard log={it} onMemo={() => navigate(`/counselor/mypage/chats/${it.id}/memo`)} />
            </li>
          ))}
        </ul>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}

function ChatCard({ log, onMemo }: { log: ConsultLog; onMemo: () => void }) {
  const reviewDone = log.reviewStatus === '완료'
  return (
    <article className="px-4 py-4">
      <div className="flex items-start">
        <div className="flex-1">
          <p className="text-[16px] font-bold text-[#030712]">{log.customerName}</p>
          <p className="mt-1 text-[13px] text-[#99A1AF]">
            {log.date} · {log.duration}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMemo}
            aria-label="메모"
            className="w-7 h-7 flex items-center justify-center"
          >
            <img src="/img/ic_memo.svg" alt="" className="w-6 h-6" />
          </button>
          <button type="button" aria-label="삭제" className="w-7 h-7 flex items-center justify-center">
            <img src="/img/ic_trash_r.svg" alt="" className="w-6 h-6" />
          </button>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
        <li className="flex items-center justify-between">
          <span className="font-semibold text-[#1E2939]">시작시간</span>
          <span className="text-[#4A5565]">{log.startedAt}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="font-semibold text-[#1E2939]">완료시간</span>
          <span className="text-[#4A5565]">{log.endedAt}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="font-semibold text-[#1E2939]">과금 포인트</span>
          <span className="text-[#4A5565]">{(log.pointPaid ?? 0).toLocaleString()}P</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="font-semibold text-[#1E2939]">후기작성</span>
          <span className={reviewDone ? 'text-[#1E2939]' : 'text-[#99A1AF]'}>
            {log.reviewStatus}
          </span>
        </li>
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={
            reviewDone
              ? 'h-[44px] rounded-full border border-[#9B7AF7] text-[14px] font-medium text-[#8259F5]'
              : 'col-span-2 h-[44px] rounded-full border border-[#9B7AF7] text-[14px] font-medium text-[#8259F5]'
          }
        >
          채팅 내역 보기
        </button>
        {reviewDone &&
          (log.hasReply ? (
            <button
              type="button"
              className="h-[44px] rounded-full border border-[#9B7AF7] text-[14px] font-medium text-[#8259F5]"
            >
              작성한 후기 답변 보기
            </button>
          ) : (
            <button
              type="button"
              className="h-[44px] rounded-full bg-[#9B7AF7] text-[14px] font-semibold text-white"
            >
              후기 답변 작성하기
            </button>
          ))}
      </div>
    </article>
  )
}
