import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { ApiError, historyApi, type ConsultHistoryItem } from '../lib/api'

const PAGE_SIZE = 10

/**
 * 08마이페이지_상담사_전화상담내역
 * Figma node-id: 152:9892
 *
 * 데이터 소스: GET /user/consult/history?role=counselor&type=call
 *  - 본인이 상담사로 진행/종료한 전화 상담 + 회원이 작성한 후기(review_id)
 *
 * 기존 구현은 MOCK_COUNSELOR_CALLS(더미 데이터)를 사용해 누구에게나 동일한
 * "김고객 / 2026.04.23" 가 보였음. 실제 API 연결로 수정(2026-06-04).
 */
export default function CounselorMyCalls() {
  const navigate = useNavigate()
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<ConsultHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    historyApi
      .list({ role: 'counselor', type: 'call', page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login')
          return
        }
        setError(e instanceof Error ? e.message : '전화상담 내역을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [navigate, page, location.key])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">전화상담내역</h1>
      </header>

      <main className="flex-1">
        {loading && <p className="py-10 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>}
        {error && !loading && (
          <p className="py-10 text-center text-[14px] text-[#FB2C36]">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="py-10 text-center text-[14px] text-[#99A1AF]">
            아직 진행한 전화상담 내역이 없습니다.
          </p>
        )}
        <ul className="flex flex-col">
          {items.map((it) => (
            <li key={it.id} className="border-b border-[#F3F4F6]">
              <CallCard
                item={it}
                onMemo={() => navigate(`/counselor/mypage/calls/${it.id}/memo`)}
                onWriteReply={() => {
                  if (it.review_id) navigate(`/counselor/mypage/reviews/${it.review_id}`)
                }}
              />
            </li>
          ))}
        </ul>

        {!loading && total > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}

function formatKDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function CallCard({
  item,
  onMemo,
  onWriteReply,
}: {
  item: ConsultHistoryItem
  onMemo: () => void
  onWriteReply: () => void
}) {
  // role=counselor 응답에서 counselor_* 필드는 "회원(peer)" 정보를 담는다
  const customerName = item.counselor_name || '회원'
  const startedAt = formatKDateTime(item.started_at)
  const endedAt = formatKDateTime(item.ended_at)
  const reviewDone = item.review_id != null
  const replyDone = item.reply_id != null

  return (
    <article className="px-4 py-4">
      <div className="flex items-start">
        <div className="flex-1">
          <p className="text-[16px] font-bold text-[#030712]">{customerName}</p>
          <p className="mt-1 text-[13px] text-[#99A1AF]">
            {startedAt.split(' ')[0]} · {item.usetm_label}
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
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
        <li className="flex items-center justify-between">
          <span className="font-semibold text-[#1E2939]">시작시간</span>
          <span className="text-[#4A5565]">{startedAt}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="font-semibold text-[#1E2939]">완료시간</span>
          <span className="text-[#4A5565]">{endedAt}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="font-semibold text-[#1E2939]">후기작성</span>
          <span className={reviewDone ? 'text-[#1E2939]' : 'text-[#99A1AF]'}>
            {reviewDone ? '완료' : '대기'}
          </span>
        </li>
      </ul>
      {reviewDone && (
        <button
          type="button"
          onClick={onWriteReply}
          className={
            replyDone
              ? 'mt-3 w-full h-[44px] rounded-full border border-[#8259F5] text-[14px] font-medium text-[#8259F5]'
              : 'mt-3 w-full h-[44px] rounded-full bg-[#8259F5] text-white text-[14px] font-semibold'
          }
        >
          {replyDone ? '작성한 후기 답변 보기' : '후기 답변 작성하기'}
        </button>
      )}
    </article>
  )
}
