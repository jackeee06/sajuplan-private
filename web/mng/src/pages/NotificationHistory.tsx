import { useEffect, useState } from 'react'
import { Search, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Chip, PaginationBar } from '../components/table'

/**
 * 알림 이력 — 인앱·푸시로 보낸 기록(notification_log). "알림 보내기(수동)" 화면에서 분리(2026-06-19).
 *   알림톡 발송 이력은 별도(알림톡 이력 = /alert-logs).
 */
interface HistoryRow {
  id: number
  member_id: number | null
  mb_id: string | null
  member_name: string | null
  member_nickname: string | null
  member_role: string | null
  actor_mb_id: string | null
  actor_name: string | null
  actor_nickname: string | null
  actor_role: string | null
  title: string
  content: string
  link_url: string | null
  category: string | null
  code: string | null
  viewed_by: string[] | null
  via_inapp?: boolean
  via_push?: boolean
  created_at: string
}

type CategoryFilter = '' | '전체공지' | '일반회원' | '상담사'
type ChannelFilter = '' | 'inapp' | 'push'

const PAGE_SIZE = 200

export default function NotificationHistory() {
  const [filter, setFilter] = useState<{ q: string; sfl: 'title' | 'content' | 'mb_id'; category: CategoryFilter; channel: ChannelFilter; page: number }>({
    q: '', sfl: 'title', category: '', channel: '', page: 1,
  })
  const [pending, setPending] = useState({ q: '', sfl: 'title' as 'title' | 'content' | 'mb_id' })
  const [data, setData] = useState<{ items: HistoryRow[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [reload, setReload] = useState(0)
  const [detail, setDetail] = useState<HistoryRow | null>(null)

  const onDeleteRow = async (h: HistoryRow) => {
    if (!window.confirm(`이 알림을 삭제하시겠습니까?\n\n[${h.category ?? ''}] ${h.title}\n\n삭제 후 복구할 수 없습니다.`)) return
    try {
      await api(`/admin/notifications/push-history/${h.id}`, { method: 'DELETE' })
      setDetail((d) => (d && d.id === h.id ? null : d))
      setData((prev) =>
        prev ? { items: prev.items.filter((x) => x.id !== h.id), total: Math.max(0, prev.total - 1) } : prev,
      )
      setReload((x) => x + 1)
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : ''}`)
    }
  }

  useEffect(() => {
    const p = new URLSearchParams()
    if (filter.q) p.set('q', filter.q)
    if (filter.category) p.set('category', filter.category)
    if (filter.channel) p.set('channel', filter.channel)
    p.set('page', String(filter.page))
    p.set('limit', String(PAGE_SIZE))
    setLoading(true)
    api<{ items: HistoryRow[]; total: number }>(`/admin/notifications/push-history?${p}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [filter, reload])

  return (
    <div className="space-y-2 max-w-[1100px]">
      {/* 타이틀 — 한 줄, 부제·카운트 인라인 (상담후기 관리 표준) */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">알림 이력</h1>
        <span className="text-xs text-gray-500 dark:text-gray-400">인앱·푸시 보낸 기록</span>
        {data && <span className="text-xs text-gray-500 dark:text-gray-400">· 전체 <span className="text-brand-600 font-semibold tabular-nums">{data.total.toLocaleString()}</span>건</span>}
        <span className="text-xs text-gray-400">— 보내기는 <a href="/mng/push-notifications" className="text-brand-600 underline">알림 보내기(수동)</a></span>
      </div>

      <section className="space-y-2">
        {/* 툴바 — 검색 + 내역 비우기 한 줄(좌측 정렬, 카드·여백 제거) — 상담후기 관리 표준 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={pending.sfl} onChange={(e) => setPending({ ...pending, sfl: e.target.value as 'title' | 'content' | 'mb_id' })} className={cls}>
            <option value="title">제목</option>
            <option value="content">본문</option>
            <option value="mb_id">아이디</option>
          </select>
          <input
            type="text"
            value={pending.q}
            onChange={(e) => setPending({ ...pending, q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && setFilter({ ...filter, q: pending.q, sfl: pending.sfl, page: 1 })}
            placeholder="검색어"
            className={`w-44 ${cls}`}
          />
          <button
            onClick={() => setFilter({ ...filter, q: pending.q, sfl: pending.sfl, page: 1 })}
            className="px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1 font-medium"
          >
            <Search className="w-4 h-4" /> 검색
          </button>
          <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={async () => {
              if (!data || data.total === 0) return
              if (!window.confirm(`알림 발송 내역 ${data.total.toLocaleString()}건을 모두 삭제하시겠습니까?\n\n삭제 후 복구할 수 없습니다.`)) return
              try {
                const r = await api<{ ok: true; deleted: number }>('/admin/notifications/push-history', { method: 'DELETE' })
                alert(`${r.deleted.toLocaleString()}건 삭제되었습니다.`)
                setReload((x) => x + 1)
              } catch (e) {
                alert(`삭제 실패: ${e instanceof Error ? e.message : ''}`)
              }
            }}
            disabled={!data || data.total === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-rose-200 dark:border-rose-700 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-40"
          >
            <Trash2 className="w-3 h-3" /> 내역 비우기
          </button>
        </div>

        {/* 필터칩 — 분류 + 채널 한 줄 */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { v: '', label: '전체목록' },
            { v: '전체공지', label: '전체공지' },
            { v: '일반회원', label: '일반회원' },
            { v: '상담사', label: '상담사' },
          ] as const).map((c) => (
            <Chip
              key={c.v}
              label={c.label}
              active={filter.category === c.v}
              onClick={() => setFilter((f) => ({ ...f, category: c.v as CategoryFilter, page: 1 }))}
            />
          ))}
          <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
          <span className="text-[11px] text-gray-400">채널</span>
          {([
            { v: '', label: '전체' },
            { v: 'inapp', label: '🔔 인앱' },
            { v: 'push', label: '📲 푸시' },
          ] as const).map((c) => (
            <Chip
              key={c.v}
              label={c.label}
              active={filter.channel === c.v}
              onClick={() => setFilter((f) => ({ ...f, channel: c.v as ChannelFilter, page: 1 }))}
            />
          ))}
        </div>

        {/* 표 — 조밀 행(셀 상하 패딩 축소로 한 화면에 더 많이) */}
        <div className="[&_td]:!py-0.5">
        <TableShell>
          <THead>
            <Th align="left">일시</Th>
            <Th align="left">종류</Th>
            <Th align="left">분류</Th>
            <Th align="left">채널</Th>
            <Th align="left">제목</Th>
            <Th align="left">보낸 → 받는</Th>
            <Th align="left">아이디</Th>
            <Th align="center">읽음</Th>
            <Th align="center">관리</Th>
          </THead>
          <TBody>
            {loading && !data ? (
              <EmptyRow colSpan={9} loading />
            ) : !data || data.items.length === 0 ? (
              <EmptyRow colSpan={9} />
            ) : data.items.map((h) => (
              <Tr key={h.id} onClick={() => setDetail(h)}>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{formatDT(h.created_at)}</Td>
                <Td align="left">{codeLabel(h.code)}</Td>
                <Td align="left" className="text-xs text-gray-600">{h.category ?? <span className="text-gray-300">—</span>}</Td>
                <Td align="left"><ChannelBadges inapp={h.via_inapp} push={h.via_push} /></Td>
                <Td align="left" className="text-xs font-medium">{h.title}</Td>
                <Td align="left">{directionCell(h)}</Td>
                <Td align="left" className="text-xs text-gray-400"><span className="inline-block max-w-[84px] truncate align-bottom" title={String(h.mb_id ?? '')}>{h.mb_id ?? <span className="text-gray-300">—</span>}</span></Td>
                <Td align="center">{readCell(h)}</Td>
                <Td align="center">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDeleteRow(h) }}
                    title="이 알림 삭제"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </TableShell>
        </div>

        <PaginationBar
          page={filter.page}
          totalPages={data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1}
          total={data?.total ?? 0}
          pageSize={PAGE_SIZE}
          onChange={(p) => setFilter((f) => ({ ...f, page: p }))}
        />
      </section>

      {/* 행 클릭 시 상세 */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">알림 상세</h3>
              <button type="button" onClick={() => setDetail(null)} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-[11px] font-medium text-gray-500 pt-0.5">분류</span>
                <span className="text-sm text-gray-800 dark:text-gray-200">{detail.category ?? '—'}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-[11px] font-medium text-gray-500 pt-0.5">채널</span>
                <span className="text-sm"><ChannelBadges inapp={detail.via_inapp} push={detail.via_push} /></span>
              </div>
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-[11px] font-medium text-gray-500 pt-0.5">발송시각</span>
                <span className="text-sm text-gray-800 dark:text-gray-200 tabular-nums">{formatDT(detail.created_at)}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-[11px] font-medium text-gray-500 pt-0.5">대상</span>
                <span className="inline-block max-w-[150px] truncate align-bottom text-sm text-gray-800 dark:text-gray-200" title={String(detail.mb_id ?? '')}>{detail.mb_id ?? '(브로드캐스트)'}</span>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 mb-0.5">제목</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{detail.title}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 mb-0.5">본문</div>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap rounded-md bg-gray-50 dark:bg-gray-800 p-2.5 min-h-[56px]">
                  {detail.content || <span className="text-gray-400">(본문 없음)</span>}
                </div>
              </div>
              {detail.link_url && (
                <div>
                  <div className="text-[11px] font-medium text-gray-500 mb-0.5">URL</div>
                  <a href={detail.link_url} target="_blank" rel="noreferrer" className="text-sm text-brand-600 break-all hover:underline">{detail.link_url}</a>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => onDeleteRow(detail)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-rose-200 dark:border-rose-700 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30">
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
              <button type="button" onClick={() => setDetail(null)} className="px-4 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelBadges({ inapp, push }: { inapp?: boolean; push?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {inapp && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300 whitespace-nowrap">🔔 인앱</span>}
      {push && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300 whitespace-nowrap">📲 푸시</span>}
      {!inapp && !push && <span className="text-gray-300">—</span>}
    </span>
  )
}

/** 알림 코드 → 종류 라벨(아이콘). 미매핑 코드는 원본 표시. */
const CODE_META: Record<string, string> = {
  alim_notice: '📢 공지',
  chat_request: '💬 채팅요청',
  call_request: '📞 전화요청',
  qna_ask: '❓ 문의',
  qna_answer: '💡 답변',
  qna_reported: '🚨 신고',
  review: '⭐ 후기',
  grade: '🎉 등급',
  absent: '🌙 부재',
  chat_cancelled: '⏱️ 취소',
  settlement: '💰 정산',
  payout: '💸 선지급',
  coupon: '🎁 쿠폰',
}
function codeLabel(code: string | null) {
  if (!code) return <span className="text-gray-300">—</span>
  const m = CODE_META[code]
  return <span className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-nowrap">{m ?? code}</span>
}

/** 읽음 여부 — 개별 발송만 판별(브로드캐스트는 사람마다 달라 —). viewed_by 에 수신자 mb_id 포함 시 읽음. */
function readCell(h: HistoryRow) {
  if (h.member_id == null) return <span className="text-gray-300">—</span>
  const read = Array.isArray(h.viewed_by) && h.mb_id != null && h.viewed_by.includes(h.mb_id)
  return read
    ? <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-300">읽음</span>
    : <span className="text-[11px] text-gray-400">안읽음</span>
}

/**
 * 방향(보낸 → 받는). notification_log 엔 받는 사람만 저장됨 → 보낸 사람은 알림 종류(code)로 추론.
 * 수동 공지(alim_notice)·미매핑 코드는 운영 발신으로 보고, 받는 쪽은 역할/카테고리로 판별.
 */
const FLOW: Record<string, [string, string]> = {
  review: ['회원', '상담사'],
  qna_ask: ['회원', '상담사'],
  call_request: ['회원', '상담사'],
  chat_request: ['회원', '상담사'],
  qna_answer: ['상담사', '회원'],
  qna_reported: ['운영', '회원'],
  chat_cancelled: ['시스템', '회원'],
  grade: ['시스템', '상담사'],
  absent: ['시스템', '상담사'],
  settlement: ['운영', '상담사'],
  payout: ['운영', '상담사'],
  coupon: ['운영', '회원'],
}
const PARTY_CLS: Record<string, string> = {
  회원: 'text-blue-600 dark:text-blue-300',
  상담사: 'text-teal-600 dark:text-teal-300',
  운영: 'text-violet-600 dark:text-violet-300',
  시스템: 'text-gray-500',
  전체: 'text-gray-600 dark:text-gray-300',
}
function recipientParty(h: HistoryRow): string {
  if (h.member_role === 'counselor') return '상담사'
  if (h.member_role === 'user') return '회원'
  if (h.category === '상담사') return '상담사'
  if (h.category === '일반회원') return '회원'
  if (h.category === '전체공지') return '전체'
  return '—'
}
function colorByRole(role: string | null): string {
  if (role === 'counselor') return PARTY_CLS['상담사']
  if (role === 'user') return PARTY_CLS['회원']
  if (role === 'admin') return PARTY_CLS['운영']
  return 'text-gray-500'
}
/**
 * 보낸 → 받는. 보낸 사람(actor)이 기록된 신규 알림은 실명으로, 과거/시스템 알림은 역할 단어로.
 * 받는 사람은 개별이면 실명, 브로드캐스트면 그룹 단어.
 */
function directionCell(h: HistoryRow) {
  // 보낸 사람
  let fromText: string, fromCls: string
  if (h.actor_mb_id) {
    fromText = h.actor_nickname || h.actor_name || h.actor_mb_id
    fromCls = colorByRole(h.actor_role)
  } else {
    const w = (h.code && FLOW[h.code]?.[0]) || '운영'
    fromText = w; fromCls = PARTY_CLS[w] ?? 'text-gray-500'
  }
  // 받는 사람
  let toText: string, toCls: string
  if (h.member_id != null) {
    toText = h.member_nickname || h.member_name || h.mb_id || '—'
    toCls = colorByRole(h.member_role)
  } else {
    const w = recipientParty(h); toText = w; toCls = PARTY_CLS[w] ?? 'text-gray-500'
  }
  const P = (t: string, cls: string) => (
    <span className={`font-medium ${cls} max-w-[88px] truncate inline-block align-bottom`} title={t}>{t}</span>
  )
  return (
    <span className="text-[11px] whitespace-nowrap inline-flex items-center gap-1">
      {P(fromText, fromCls)}<span className="text-gray-600 dark:text-gray-300 font-bold">→</span>{P(toText, toCls)}
    </span>
  )
}

const cls = 'px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function formatDT(s: string): string {
  if (!s) return '-'
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
