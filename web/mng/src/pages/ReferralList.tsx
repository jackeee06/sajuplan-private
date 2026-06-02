import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Badge, BadgeColor, inputCls } from '../components/table'

/**
 * 어드민 — 상담사 추천 수당 관리 (2026-05-17).
 *
 * 정책 (수동 운영):
 *   - 추천자(A) → 피추천자(B) 가입 후 6개월 한정
 *   - 1~3개월: B 매출의 2% → A 포인트 적립
 *   - 4~6개월: B 매출의 1% → A 포인트 적립
 *   - 매월 1~5일 운영자가 "이번 달 지급" 버튼 클릭 → 추천자 포인트 자동 적립
 *   - 디폴트 month = 전월 (정산 cron 이 매월 1일 04:00 에 전월 정산하므로)
 */

interface Item {
  id: number
  referrer_id: number
  referrer_mb_id: string | null
  referrer_nickname: string | null
  referee_id: number
  referee_mb_id: string | null
  referee_nickname: string | null
  registered_at: string
  expires_at: string
  status: 'active' | 'expired' | 'disabled'
  months_since: number
  rate_pct: number
  referee_sales: number
  expected_payment: number
  paid_this_month: boolean
  paid_amount: number | null
  memo: string | null
}

interface CounselorOpt {
  id: number
  mb_id: string | null
  nickname: string | null
  name: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  active: '활성',
  expired: '만료',
  disabled: '비활성',
}

const STATUS_COLOR: Record<string, BadgeColor> = {
  active: 'emerald',
  expired: 'gray',
  disabled: 'rose',
}

function defaultMonth(): string {
  // 전월 (cron 이 매월 1일 04:00 에 전월 정산 → 1~5일에 그 결과 지급)
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0~11
  const prevY = m === 0 ? y - 1 : y
  const prevM = m === 0 ? 12 : m
  return `${prevY}-${String(prevM).padStart(2, '0')}`
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10)
}

export default function ReferralList() {
  const [month, setMonth] = useState<string>(defaultMonth())
  const [status, setStatus] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = () => {
    const params = new URLSearchParams()
    if (month) params.set('month', month)
    if (status) params.set('status', status)
    setLoading(true)
    setError(null)
    api<{ items: Item[] }>(`/admin/referrals?${params}`)
      .then((r) => setItems(r.items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, status])

  const summary = useMemo(() => {
    const active = items.filter((x) => x.status === 'active')
    const eligible = active.filter((x) => x.rate_pct > 0 && x.expected_payment > 0)
    const paid = active.filter((x) => x.paid_this_month)
    const pending = eligible.filter((x) => !x.paid_this_month)
    const totalExpected = pending.reduce((s, x) => s + x.expected_payment, 0)
    return { active: active.length, eligible: eligible.length, paid: paid.length, pending: pending.length, totalExpected }
  }, [items])

  const onPay = async (it: Item) => {
    const a = it.referrer_nickname ?? it.referrer_mb_id ?? `#${it.referrer_id}`
    if (!confirm(`${a} 에게 ${fmt(it.expected_payment)}원 (${month}, ${it.rate_pct}%) 지급?\n\n* 추천자 포인트가 즉시 적립됩니다.`)) return
    try {
      const r = await api<{ paid_amount: number; rate_pct: number; referee_sales: number }>(
        `/admin/referrals/${it.id}/pay`,
        { method: 'POST', body: JSON.stringify({ month }) },
      )
      alert(`지급 완료: ${fmt(r.paid_amount)}원 (${r.rate_pct}% × ${fmt(r.referee_sales)}원)`)
      load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      alert(`지급 실패: ${msg}`)
    }
  }

  const onDisable = async (it: Item) => {
    const reason = prompt(`추천 관계 비활성 사유를 입력하세요.\n(예: 허위 가입 / 본인 셀프 추천 등)\n\n대상: ${it.referrer_nickname ?? '#'+it.referrer_id} → ${it.referee_nickname ?? '#'+it.referee_id}`)
    if (reason == null) return
    try {
      await api(`/admin/referrals/${it.id}/disable`, {
        method: 'POST',
        body: JSON.stringify({ memo: reason || null }),
      })
      load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      alert(`비활성 실패: ${msg}`)
    }
  }

  return (
    <div className="space-y-4 text-sm max-w-[1100px]">
      {/* 타이틀 + 등록 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">상담사 추천 수당 (프로모션)</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            가입 후 6개월 한정 · 1~3개월 2% · 4~6개월 1% · 매월 1~5일 수동 지급 (전월 매출 기준)
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium"
        >
          <Plus className="w-4 h-4" /> 새 추천 등록
        </button>
      </div>

      {/* 필터 */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="w-[140px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">대상 월</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="w-[120px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="">전체</option>
            <option value="active">활성</option>
            <option value="expired">만료</option>
            <option value="disabled">비활성</option>
          </select>
        </div>
      </div>

      {/* 요약 카드 — 콘텐츠 기반 폭으로 좌측 응집 */}
      <div className="flex flex-wrap gap-2">
        <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-700 min-w-[140px]">
          <div className="text-[11px] text-gray-500">활성 관계</div>
          <div className="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">{summary.active}</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 min-w-[140px]">
          <div className="text-[11px] text-blue-700 dark:text-blue-300">이번 달 지급대상</div>
          <div className="text-lg font-semibold tabular-nums text-blue-700 dark:text-blue-300">{summary.eligible}</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 min-w-[140px]">
          <div className="text-[11px] text-emerald-700 dark:text-emerald-300">지급 완료</div>
          <div className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{summary.paid}</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 min-w-[140px]">
          <div className="text-[11px] text-amber-700 dark:text-amber-300">미지급</div>
          <div className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-300">{summary.pending}</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-brand-50 border border-brand-200 dark:bg-brand-900/20 dark:border-brand-800 min-w-[160px]">
          <div className="text-[11px] text-brand-700 dark:text-brand-300">미지급 합계</div>
          <div className="text-lg font-semibold tabular-nums text-brand-700 dark:text-brand-300">{fmt(summary.totalExpected)}원</div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="right">ID</Th>
          <Th align="left">추천자 (A)</Th>
          <Th align="left">피추천자 (B)</Th>
          <Th align="left">가입일</Th>
          <Th align="left">만료일</Th>
          <Th align="center">개월차</Th>
          <Th align="center">비율</Th>
          <Th align="right">B 매출</Th>
          <Th align="right">예상 지급</Th>
          <Th align="center">상태</Th>
          <Th align="left">메모</Th>
          <Th align="center">액션</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={12} loading />
          ) : items.length === 0 ? (
            <EmptyRow colSpan={12} />
          ) : (
            items.map((it) => (
              <Tr key={it.id}>
                <Td align="right" className="text-gray-400 tabular-nums">{it.id}</Td>
                <Td align="left">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{it.referrer_nickname ?? '-'}</div>
                  <div className="text-[10px] text-gray-400">{it.referrer_mb_id ?? `#${it.referrer_id}`}</div>
                </Td>
                <Td align="left">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{it.referee_nickname ?? '-'}</div>
                  <div className="text-[10px] text-gray-400">{it.referee_mb_id ?? `#${it.referee_id}`}</div>
                </Td>
                <Td align="left" className="text-xs text-gray-600 tabular-nums">{fmtDate(it.registered_at)}</Td>
                <Td align="left" className="text-xs text-gray-600 tabular-nums">{fmtDate(it.expires_at)}</Td>
                <Td align="center" className="text-xs">{it.months_since}개월</Td>
                <Td align="center">
                  {it.rate_pct > 0 ? (
                    <span className="font-medium text-brand-700">{it.rate_pct}%</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </Td>
                <Td align="right" className="tabular-nums text-gray-700">
                  {it.referee_sales === 0 ? <span className="text-gray-300">0</span> : fmt(it.referee_sales)}
                </Td>
                <Td align="right" className="tabular-nums font-semibold">
                  {it.expected_payment > 0 ? fmt(it.expected_payment) : <span className="text-gray-300">—</span>}
                </Td>
                <Td align="center">
                  <Badge color={STATUS_COLOR[it.status]}>{STATUS_LABEL[it.status]}</Badge>
                </Td>
                <Td align="left" className="text-gray-500 text-[10px] max-w-[180px] truncate" >
                  <span title={it.memo ?? ''}>{it.memo ?? ''}</span>
                </Td>
                <Td align="center">
                  <div className="flex items-center justify-center gap-1">
                    {it.status === 'active' && it.expected_payment > 0 && !it.paid_this_month && (
                      <button
                        onClick={() => onPay(it)}
                        className="px-2 py-1 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-medium"
                      >
                        이번 달 지급
                      </button>
                    )}
                    {it.paid_this_month && (
                      <Badge color="emerald">지급 완료 ({fmt(it.paid_amount ?? 0)})</Badge>
                    )}
                    {it.status === 'active' && (
                      <button
                        onClick={() => onDisable(it)}
                        className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-[11px] text-gray-500"
                      >
                        비활성
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [referrer, setReferrer] = useState<CounselorOpt | null>(null)
  const [referee, setReferee] = useState<CounselorOpt | null>(null)
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    if (!referrer || !referee) {
      setError('추천자(A)와 피추천자(B) 둘 다 선택해야 합니다.')
      return
    }
    if (referrer.id === referee.id) {
      setError('자기 자신을 추천할 수 없습니다.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api('/admin/referrals', {
        method: 'POST',
        body: JSON.stringify({
          referrer_id: referrer.id,
          referee_id: referee.id,
          memo: memo.trim() || null,
        }),
      })
      onCreated()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg p-5 w-[min(520px,92vw)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">새 추천 관계 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3 text-sm">
          <CounselorPicker label="추천자 (A) — 수당을 받는 사람" value={referrer} onChange={setReferrer} />
          <CounselorPicker label="피추천자 (B) — 매출 기준이 되는 신규 가입자" value={referee} onChange={setReferee} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 2026-05 컨퍼런스 추천"
              className="w-full h-9 px-3 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          {error && <div className="p-2 rounded bg-rose-50 text-rose-700 text-xs">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onClose} className="h-9 px-3 rounded border border-gray-300 text-sm">취소</button>
          <button
            onClick={onSubmit}
            disabled={submitting || !referrer || !referee}
            className="h-9 px-4 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm"
          >
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>

        <div className="mt-3 text-[11px] text-gray-400 leading-relaxed">
          * 가입일은 피추천자의 회원가입일이 자동 적용되며, 만료일은 가입 +6개월입니다.<br />
          * 1~3개월: 2%, 4~6개월: 1% (피추천자의 그달 정산 매출 기준).
        </div>
      </div>
    </div>
  )
}

function CounselorPicker({ label, value, onChange }: {
  label: string
  value: CounselorOpt | null
  onChange: (v: CounselorOpt | null) => void
}) {
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState<CounselorOpt[]>([])
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (q.trim().length < 1) {
      setOpts([])
      return
    }
    const t = setTimeout(() => {
      api<{ items: CounselorOpt[] }>(`/admin/referrals/counselor-search?q=${encodeURIComponent(q)}`)
        .then((r) => setOpts(r.items))
        .catch(() => setOpts([]))
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  if (value) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-brand-50 dark:bg-brand-900/20">
          <div className="flex-1">
            <div className="font-medium">{value.nickname ?? value.name}</div>
            <div className="text-[10px] text-gray-500">{value.mb_id ?? `#${value.id}`} · 가입 {value.created_at.slice(0, 10)}</div>
          </div>
          <button onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
          placeholder="닉네임/아이디/실명 검색..."
          className="w-full h-9 pl-8 pr-3 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        />
      </div>
      {show && opts.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {opts.map((o) => (
            <li
              key={o.id}
              onMouseDown={() => {
                onChange(o)
                setQ('')
              }}
              className="px-3 py-2 hover:bg-brand-50 dark:hover:bg-brand-900/20 cursor-pointer text-sm"
            >
              <div className="font-medium">{o.nickname ?? o.name}</div>
              <div className="text-[10px] text-gray-500">{o.mb_id ?? `#${o.id}`} · 가입 {o.created_at.slice(0, 10)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
