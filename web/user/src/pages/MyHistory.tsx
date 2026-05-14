import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import UploadedImage from '../components/UploadedImage'
import { ApiError, historyApi, type ConsultHistoryItem } from '../lib/api'

/**
 * 마이페이지 — 통합 상담내역.
 * sample/my/history.php 동등 — 본인 회원의 종료된(DISCONNECT/END_CHAT) 상담을 통화/채팅 통합 노출.
 *
 * 카드별로:
 *  - 후기 미작성: "후기 작성하기" → /mypage/my-reviews/new?consultation_id=N&counselor_id=M
 *  - 후기 작성됨: "후기 보러가기" → /mypage/my-reviews/:review_id
 */

const PAGE_SIZE = 10

const BADGE_BG: Record<ConsultHistoryItem['counselor_badge'], string> = {
  타로: '#8259F5',
  신점: '#00BBA7',
  사주: '#FF6467',
  기타: '#6A7282',
}

type FilterType = 'all' | 'call' | 'chat'

export default function MyHistory() {
  const navigate = useNavigate()
  // 탭/페이지는 URL 쿼리에 저장 — 후기 상세에서 뒤로가기로 돌아왔을 때 동일 상태 복원.
  const [searchParams, setSearchParams] = useSearchParams()
  const filter: FilterType = (() => {
    const t = searchParams.get('tab')
    return t === 'call' || t === 'chat' ? t : 'all'
  })()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const setFilter = (next: FilterType) => {
    const sp = new URLSearchParams(searchParams)
    if (next === 'all') sp.delete('tab')
    else sp.set('tab', next)
    sp.delete('page') // 탭 바뀌면 1페이지로
    setSearchParams(sp, { replace: true })
  }
  const setPage = (next: number) => {
    const sp = new URLSearchParams(searchParams)
    if (next <= 1) sp.delete('page')
    else sp.set('page', String(next))
    setSearchParams(sp, { replace: true })
  }
  const [items, setItems] = useState<ConsultHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    historyApi
      .list({ page, limit: PAGE_SIZE, type: filter })
      .then((r) => {
        if (!mounted) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e) => {
        if (!mounted) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login', { replace: true, state: { from: '/mypage/history' } })
          return
        }
        setError(e instanceof Error ? e.message : '상담내역을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [filter, page, navigate])

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          상담내역
        </h1>
      </header>

      <div className="grid grid-cols-3 border-b border-[#F3F4F6]">
        {(['all', 'call', 'chat'] as FilterType[]).map((t) => {
          const on = filter === t
          const label = t === 'all' ? '전체' : t === 'call' ? '전화상담' : '채팅상담'
          return (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`relative h-[44px] flex items-center justify-center text-[15px] ${
                on ? 'text-[#8259F5] font-bold' : 'text-[#99A1AF] font-medium'
              }`}
            >
              {label}
              {on && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#8259F5]" />}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-3 border-b border-[#F3F4F6]">
        <span className="text-[14px] text-[#4A5565]">
          전체 <span className="text-[#8259F5] font-medium">{total.toLocaleString()}</span>건
        </span>
      </div>

      <main className="flex-1 px-4">
        {loading && (
          <p className="py-20 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
        )}
        {!loading && error && (
          <p className="py-20 text-center text-[14px] text-[#FB2C36]">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="py-20 text-center text-[14px] text-[#99A1AF]">
            상담 내역이 없습니다.
          </p>
        )}

        {items.map((it) => (
          <article key={it.id} className="py-4 border-b border-[#F3F4F6]">
            <p className="text-[12px] text-[#99A1AF]">
              {formatDateTime(it.started_at)}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-[56px] h-[56px] rounded-full bg-[#F3F4F6] overflow-hidden shrink-0">
                {it.counselor_avatar && (
                  <UploadedImage
                    src={it.counselor_avatar}
                    srcWebp={it.counselor_avatar_webp}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* "기타" 는 추론 실패 폴백이라 의미가 없으므로 표시 생략. 사주/타로/신점만 노출. */}
                  {it.counselor_badge !== '기타' && (
                    <span
                      className="px-2 h-[22px] inline-flex items-center text-[12px] font-medium text-white rounded"
                      style={{ background: BADGE_BG[it.counselor_badge] }}
                    >
                      {it.counselor_badge}
                    </span>
                  )}
                  <span className="text-[15px] font-bold text-[#030712] truncate">
                    {it.counselor_name}
                  </span>
                  {it.counselor_code && (
                    <span className="text-[13px] font-medium text-[#8259F5] shrink-0">
                      {it.counselor_code}
                    </span>
                  )}
                  {it.is_active_chat && (
                    <span className="px-2 h-[20px] inline-flex items-center text-[11px] font-semibold text-[#8259F5] bg-[#F3EEFE] rounded-full shrink-0">
                      상담중
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-[#4A5565]">
                  {it.consult_type_label}
                  {!it.is_active_chat && (
                    <>
                      {' '}· <span className="font-semibold">{it.usetm_label}</span>
                    </>
                  )}
                </p>
                {!it.is_active_chat && (
                  <p className="text-[12px] text-[#99A1AF]">
                    사용 코인 <span className="font-semibold text-[#1E2939]">{it.amt.toLocaleString()}</span>P
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              {/* 채팅방이 아직 진행 중(STAY/CNCH) 이면 무조건 "재입장하기" 만 노출 — 후기 작성은 종료 후. */}
              {((it.is_active_chat && it.chat_room_id) ||
                ((it.chat_status === 'STAY' || it.chat_status === 'CNCH') && it.chat_room_id)) ? (
                <Link
                  to={`/chat/${it.chat_room_id}`}
                  className="h-9 px-4 inline-flex items-center gap-1 rounded-full bg-[#9B7AF7] text-[13px] font-medium text-white"
                >
                  채팅방 재입장하기
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" aria-hidden>
                    <path d="M6 3.5L10.5 8L6 12.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ) : it.review_id ? (
                <Link
                  to={`/mypage/my-reviews/${it.review_id}`}
                  className="h-9 px-4 inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] text-[13px] text-[#6A7282]"
                >
                  후기 보러가기
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" aria-hidden>
                    <path d="M6 3.5L10.5 8L6 12.5" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ) : (
                <Link
                  to={`/mypage/my-reviews/new?consultation_id=${it.id}&counselor_id=${it.counselor_id ?? ''}`}
                  className="h-9 px-4 inline-flex items-center gap-1 rounded-full bg-[#9B7AF7] text-[13px] font-medium text-white"
                >
                  후기 작성하기
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" aria-hidden>
                    <path d="M6 3.5L10.5 8L6 12.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
            </div>
          </article>
        ))}

        {!loading && total > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}

function formatDateTime(s: string | null): string {
  if (!s) return ''
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
