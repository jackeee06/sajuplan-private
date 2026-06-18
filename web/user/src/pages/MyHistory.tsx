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
  타로: '#ec4899',
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
  // [2026-05-24] 동시 역할자(회원+상담사) 안내용 — 반대 시점에서 데이터가 있는 건수.
  // total === 0 + 이 값 > 0 일 때만 안내 노출 (일반 사용자에겐 안 보임).
  const [otherRoleCount, setOtherRoleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    historyApi
      // [BUG FIX 2026-06-10] role:'member' 명시 필수.
      //   미지정 시 백엔드가 토큰 role 로 폴백하는데, 듀얼역할자(상담사)는 'counselor' 시점으로
      //   조회되어 "본인이 상담해준 건"이 회원 상담내역에 노출 + 상대(회원)를 상담사로 착각하는
      //   "해당 회원은 상담사가 아닙니다" 후기 작성 버그가 발생했음. MyCalls/MyChats 와 동일하게 명시.
      .list({ role: 'member', page, limit: PAGE_SIZE, type: filter })
      .then((r) => {
        if (!mounted) return
        setItems(r.items)
        setTotal(r.total)
        setOtherRoleCount((r as { other_role_count?: number }).other_role_count ?? 0)
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
                on ? 'text-[#ec4899] font-bold' : 'text-[#99A1AF] font-medium'
              }`}
            >
              {label}
              {on && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#ec4899]" />}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-3 border-b border-[#F3F4F6]">
        <span className="text-[14px] text-[#4A5565]">
          전체 <span className="text-[#ec4899] font-medium">{total.toLocaleString()}</span>건
        </span>
      </div>

      {/* [2026-05-24] 동시 역할자(other_role_count > 0)에게만 항상 노출.
          데이터 있든 없든 상관없이 보임 — 본인 시점이 회원/상담사 어느 쪽인지 헷갈리는 경우 가이드.
          일반 회원은 other_role_count = 0 이라 절대 안 보임 (상담사 브랜드 신뢰 보호). */}
      {otherRoleCount > 0 && (
        <div className="px-4 py-2.5 bg-[#FFF7FA] border-b border-[#fce7f3]">
          <p className="text-[12.5px] leading-[160%] text-[#9d174d]">
            ※ 회원·상담사 두 역할을 모두 사용하신다면 마이페이지 상단의 <span className="font-medium">[회원 ⇄ 상담사]</span> 모드 전환을 확인해 주세요.
          </p>
        </div>
      )}

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

        {items.map((it) => {
          const startedAt = formatDateTime(it.started_at)
          const endedAt = it.ended_at ? formatDateTime(it.ended_at) : ''
          const timeRange = `${startedAt}${endedAt ? ` ~ ${shortEnd(startedAt, endedAt)}` : ''}`
          const typeShort = it.consult_type === 'chat' ? '채팅' : '전화'
          return (
            <article key={it.id} className="py-2.5 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#F3F4F6] overflow-hidden shrink-0">
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
                  {/* 1줄: (뱃지) 이름(번호) [상담중] · 채팅 3분35초 …… 코인 + 후기 */}
                  <div className="flex items-center gap-1.5">
                    {it.counselor_badge !== '기타' && (
                      <span
                        className="px-1.5 h-[18px] inline-flex items-center text-[11px] font-medium text-white rounded shrink-0"
                        style={{ background: BADGE_BG[it.counselor_badge] }}
                      >
                        {it.counselor_badge}
                      </span>
                    )}
                    <span className="text-[15px] font-bold text-[#030712] shrink-0">{it.counselor_name}</span>
                    {it.counselor_code && (
                      <span className="text-[13px] font-medium text-[#ec4899] shrink-0">{it.counselor_code}</span>
                    )}
                    {it.is_active_chat && (
                      <span className="px-2 h-[20px] inline-flex items-center text-[11px] font-semibold text-[#ec4899] bg-[#fdf2f8] rounded-full shrink-0">상담중</span>
                    )}
                    {it.is_failed ? (
                      <span className="text-[#FB2C36] text-[12px] font-medium truncate">· 연결 실패 · 상담사와 연결 전 종료</span>
                    ) : (
                      <span className="text-[12px] text-[#6A7282] truncate">
                        · {typeShort}{!it.is_active_chat && ` ${briefDur(Number(it.usetm_seconds) || 0)}`}
                      </span>
                    )}
                    {!it.is_failed && (
                      <span className="ml-auto shrink-0 flex items-center gap-2">
                        {!it.is_active_chat && (
                          <span className="font-bold text-[#1E2939] text-[13px]">{it.amt.toLocaleString()}코인</span>
                        )}
                        {renderHistoryAction(it)}
                      </span>
                    )}
                  </div>
                  {/* 2줄: 시각 시작~끝 통째로 (안 잘림) */}
                  <p className="mt-0.5 text-[12.5px] text-[#99A1AF] truncate">
                    {it.is_active_chat ? `시작 ${startedAt}` : `시간 ${timeRange}`}
                  </p>
                </div>
              </div>
            </article>
          )
        })}

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
  return `${dt.getFullYear()}.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}

/** 종료시각: 시작과 같은 날이면 시·분만, 다른 날이면 전체. */
function shortEnd(start: string, end: string): string {
  const sd = start.split(' ')[0]
  const [ed, et] = end.split(' ')
  return ed === sd ? (et ?? end) : end
}

/** 카드 2번째 줄 오른쪽 액션 — 기존 기능(재입장/후기보기/5분안내/후기작성) 전부 보존, 작은 링크로. */
function renderHistoryAction(it: ConsultHistoryItem) {
  if (it.is_failed) return null
  // 진행 중 채팅 → 재입장 (후기는 종료 후)
  if (
    (it.is_active_chat && it.chat_room_id) ||
    ((it.chat_status === 'STAY' || it.chat_status === 'CNCH') && it.chat_room_id)
  ) {
    return (
      <Link to={`/chat/${it.chat_room_id}`} className="text-[13px] font-semibold text-[#ec4899]">
        채팅방 재입장
      </Link>
    )
  }
  if (it.review_id) {
    return (
      <Link to={`/mypage/my-reviews/${it.review_id}`} className="text-[13px] font-medium text-[#6A7282]">
        후기 보기
      </Link>
    )
  }
  // [2026-05-27 후기 5분 정책] 5분 미만은 작성 불가 — 짧은 안내.
  if ((Number(it.usetm_seconds) || 0) < 300) {
    return <span className="text-[12px] text-[#99A1AF] whitespace-nowrap">후기 가능(5분↑)</span>
  }
  return (
    <Link
      to={`/mypage/my-reviews/new?consultation_id=${it.id}&counselor_id=${it.counselor_id ?? ''}`}
      className="text-[13px] font-semibold text-[#ec4899] whitespace-nowrap"
    >
      후기 작성
    </Link>
  )
}

/** 간략 통화시간: "3분35초" / "36초" / "1시간2분". */
function briefDur(sec: number): string {
  const n = Number(sec) || 0
  const h = Math.floor(n / 3600)
  const m = Math.floor((n % 3600) / 60)
  const s = n % 60
  if (h) return `${h}시간${m}분`
  if (m) return `${m}분${s}초`
  return `${s}초`
}
