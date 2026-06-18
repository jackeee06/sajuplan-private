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
  const timeRange = `${startedAt}${endedAt ? ` ~ ${shortEnd(startedAt, endedAt)}` : ''}`
  const reviewDone = item.review_id != null
  const replyDone = item.reply_id != null
  const earning = item.earning ?? 0
  const avatar = item.counselor_avatar || '/img/avatar_default.svg'

  // 2줄 압축 (2026-06-14). 회원 전화내역과 동일 형식.
  //  - 성공:   [사진] 고객명 …… 수익원  /  시간 시작 ~ 끝  (+ 후기답변/메모 작은 링크)
  //  - 놓친통화: [사진] 고객명 · 😢 놓친 수익 기회 · 연결 전 종료  /  시간 시작 ~ 끝
  //    (기분 나쁜 "실패"가 아니라 "놓친 수익 기회"로 — 아쉬움이 핵심)
  return (
    <article className="px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <img
          src={avatar}
          alt=""
          className="w-9 h-9 rounded-full object-cover bg-[#E5E7EB] shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).src = '/img/avatar_default.svg' }}
        />
        <div className="flex-1 min-w-0">
          {/* 1줄: 고객명 …… 수익 / 또는 놓친 수익 기회 */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#030712] text-[15px]">{customerName}</span>
            {item.is_failed ? (
              <span className="text-[#F59E0B] text-[13px] font-medium">· 😢 놓친 수익 기회 · 연결 전 종료</span>
            ) : (
              <span className="ml-auto font-bold text-[#8259F5] text-[15px]">{earning.toLocaleString()}원</span>
            )}
          </div>
          {/* 2줄: 시간 시작~끝 …… (후기답변/메모 작은 링크 — 성공만) */}
          <div className="mt-0.5 flex items-center gap-2.5">
            <p className="text-[12.5px] text-[#99A1AF] truncate">시간 {timeRange}</p>
            {!item.is_failed && (
              <span className="ml-auto shrink-0 flex items-center gap-2.5">
                {reviewDone && (
                  <button type="button" onClick={onWriteReply} className="text-[13px] font-semibold text-[#8259F5]">
                    {replyDone ? '답변 보기' : '후기 답변'}
                  </button>
                )}
                <button type="button" onClick={onMemo} className="text-[13px] font-medium text-[#6A7282]">메모</button>
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

/** 종료시각: 시작과 같은 날이면 시간만, 다른 날이면 전체. */
function shortEnd(start: string, end: string): string {
  const sd = start.split(' ')[0]
  const [ed, et] = end.split(' ')
  return ed === sd ? (et ?? end) : end
}
