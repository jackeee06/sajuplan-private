import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

/**
 * 상담사 수익금 타임라인 — 상담사 상세화면 상단 요약줄 아래 접이식 섹션.
 *   문의 대응 증빙용: 건별 날짜·상담형태·시간·대상고객(이름)·고객지출·m2net 실과금·실제 적립.
 *   월별로 묶어 소계를 보여줘 "이번 정산예정 N원이 어떤 상담들의 합인지" 한눈에 증명.
 *   CSV 다운로드로 상담사에게 파일 전달 가능.
 *
 * ⚠️ 데이터는 point_history(earning) 기준 = 실제 적립액. 선결제 채팅(consultation.amt=0)도
 *    m2net 실과금×정산률로 적립된 값이 정확히 보인다.
 * API: GET /admin/members/counselors/:id/earning-history
 */

interface Row {
  id: number
  created_at: string
  content: string | null
  earn_point: number
  use_point: number
  balance_after: number | null
  rel_table: string | null
  consult_id: number | null
  reason: string | null
  usetm: number | null
  customer_mb_id: string | null
  customer_nickname: string | null
  customer_name: string | null
  m2net_amt: number | null
  counselor_revenue_rate?: number | null
  customer_paid?: number
  m2net_deduction?: number
  sajuplan_revenue?: number
  counselor_earning?: number
}
interface Resp { items: Row[]; total: number; page: number; limit: number; earning_balance: number }

function fmtDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const kst = new Date(d.getTime() + 9 * 3600 * 1000)
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kst.getUTCDate()).padStart(2, '0')
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mi = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${kst.getUTCFullYear()}-${mm}-${dd} ${hh}:${mi}`
}
function monthKey(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return '?'
  const kst = new Date(d.getTime() + 9 * 3600 * 1000)
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`
}
function fmtDur(sec: number | null): string {
  if (sec == null || sec <= 0) return '-'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}
function typeLabel(r: Row): { label: string; cls: string } {
  if (r.rel_table === 'counselor_referral') return { label: '추천수당', cls: 'bg-violet-50 text-violet-600' }
  if (r.reason === 'DISCONNECT') return { label: '전화', cls: 'bg-blue-50 text-blue-600' }
  if (r.reason === 'END_CHAT' || r.reason === 'END_CHAT_LOCAL') return { label: '채팅', cls: 'bg-pink-50 text-pink-600' }
  if (r.use_point > 0) return { label: '정산차감', cls: 'bg-gray-100 text-gray-500' }
  return { label: '기타', cls: 'bg-gray-50 text-gray-500' }
}
function custLabel(r: Row): string {
  if (r.rel_table === 'settlement_monthly') return r.content || '정산'
  return r.customer_name || r.customer_nickname || r.customer_mb_id || '-'
}
function netOf(r: Row): number {
  return r.counselor_earning ?? (r.earn_point - r.use_point)
}

export default function CounselorEarningTimeline({ counselorId }: { counselorId: number }) {
  const { admin } = useAuth()
  const isSuper = !!admin?.is_super
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
  const [limit, setLimit] = useState(100)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api<Resp>(`/admin/members/counselors/${counselorId}/earning-history?limit=${limit}`)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1, limit, earning_balance: 0 }))
      .finally(() => setLoading(false))
  }, [open, counselorId, limit])

  // 월별 그룹 + 소계 (items 는 날짜 DESC)
  const groups = useMemo(() => {
    const out: { month: string; rows: Row[]; cnt: number; paid: number; earn: number }[] = []
    for (const r of data?.items ?? []) {
      const mk = monthKey(r.created_at)
      let g = out.find((x) => x.month === mk)
      if (!g) { g = { month: mk, rows: [], cnt: 0, paid: 0, earn: 0 }; out.push(g) }
      g.rows.push(r)
      g.earn += netOf(r)
      if ((r.customer_paid ?? 0) > 0) { g.cnt += 1; g.paid += r.customer_paid! }
    }
    return out
  }, [data])

  const downloadCsv = () => {
    if (!data) return
    const head = ['날짜', '유형', '상담시간(초)', '대상고객', '고객지출', 'm2net차감', '상담사수익금', ...(isSuper ? ['사주플랜매출'] : [])]
    const lines = [head.join(',')]
    for (const g of groups) {
      for (const r of g.rows) {
        const cols = [
          fmtDate(r.created_at), typeLabel(r).label, String(r.usetm ?? 0),
          `"${custLabel(r).replace(/"/g, '""')}"`,
          String(r.customer_paid ?? ''), String(r.m2net_deduction ?? ''), String(netOf(r)),
          ...(isSuper ? [String(r.sajuplan_revenue ?? '')] : []),
        ]
        lines.push(cols.join(','))
      }
      lines.push([`${g.month} 소계 (${g.cnt}건)`, '', '', '', String(g.paid), '', String(g.earn), ...(isSuper ? [''] : [])].join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `상담사_${counselorId}_수익금내역.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const colCount = isSuper ? 8 : 7

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-800/40 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          💰 수익금 타임라인
          <span className="text-[11px] font-normal text-amber-600/70">월별 소계·건별 날짜·형태·시간·대상고객·고객지출·실제 적립 (정산 증빙)</span>
        </span>
        <span className="text-amber-600 text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-amber-200 dark:border-amber-800/40 pt-3">
          {loading ? (
            <div className="py-6 text-center text-sm text-gray-400">불러오는 중…</div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">수익금 내역이 없습니다.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                <span className="text-sm font-semibold text-amber-800">
                  현재 받을 수 있는 총 수익금{' '}
                  <span className="text-amber-700 text-base">{data.earning_balance.toLocaleString()}원</span>
                </span>
                <span className="text-[11px] text-gray-400">(라이브 잔액 · 정산 시 차감 반영) · 총 {data.total.toLocaleString()}건</span>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="ml-auto text-[11px] px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-100/60"
                >
                  ⬇ CSV 다운로드 (증빙)
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-amber-100/60 dark:bg-amber-900/30 text-left text-amber-800 dark:text-amber-300">
                      <th className="px-2 py-1.5 font-semibold">날짜</th>
                      <th className="px-2 py-1.5 font-semibold">유형</th>
                      <th className="px-2 py-1.5 font-semibold text-right">상담시간</th>
                      <th className="px-2 py-1.5 font-semibold">대상 고객</th>
                      <th className="px-2 py-1.5 font-semibold text-right">고객지출</th>
                      <th className="px-2 py-1.5 font-semibold text-right">m2net차감</th>
                      <th className="px-2 py-1.5 font-semibold text-right">상담사수익금</th>
                      {isSuper && (
                        <th className="px-2 py-1.5 font-semibold text-right border-l-2 border-r-2 border-t-2 border-rose-400 bg-rose-100/70 dark:bg-rose-900/30 dark:border-rose-700">
                          🔒 사주플랜매출
                          <div className="text-[9px] font-normal text-rose-500">슈퍼 전용 · 일반 안 보임</div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <GroupBlock key={g.month} g={g} isSuper={isSuper} colCount={colCount} />
                    ))}
                  </tbody>
                </table>
              </div>
              {data.total > data.items.length && (
                <button type="button" onClick={() => setLimit((l) => l + 100)} className="mt-2 w-full py-1.5 text-xs text-amber-700 hover:bg-amber-100/60 rounded border border-amber-200">
                  더 보기 (+100)
                </button>
              )}
              <p className="mt-2 text-[11px] text-gray-400">
                ※ 월별 소계 = 그 달의 상담사 실적립 합 (= 정산 대상). 선결제 채팅은 상담금액 0이어도 m2net 실시간 과금 기준으로 정확히 계산됩니다.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function GroupBlock({ g, isSuper, colCount }: { g: { month: string; rows: Row[]; cnt: number; paid: number; earn: number }; isSuper: boolean; colCount: number }) {
  return (
    <>
      <tr className="bg-amber-200/40 dark:bg-amber-800/20 font-semibold text-amber-900 dark:text-amber-200">
        <td colSpan={colCount} className="px-2 py-1.5">
          ▸ {g.month} · {g.cnt}건 · 고객지출 합 {g.paid.toLocaleString()} → 적립 합{' '}
          <span className="text-amber-700">{g.earn.toLocaleString()}원</span>
        </td>
      </tr>
      {g.rows.map((r) => {
        const t = typeLabel(r)
        const net = netOf(r)
        const isConsult = r.rel_table === 'consultation' && (r.customer_paid ?? 0) > 0
        const isPrepaidChat = isConsult && (r.reason === 'END_CHAT' || r.reason === 'END_CHAT_LOCAL') && r.m2net_amt != null
        return (
          <tr key={r.id} className="border-b border-amber-100 dark:border-amber-800/30 hover:bg-amber-50/60">
            <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">{fmtDate(r.created_at)}</td>
            <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[11px] ${t.cls}`}>{t.label}</span></td>
            <td className="px-2 py-1.5 text-right tabular-nums">{fmtDur(r.usetm)}</td>
            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{custLabel(r)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {isConsult ? r.customer_paid!.toLocaleString() : '-'}
              {isPrepaidChat && <span className="ml-1 text-[10px] text-pink-500" title="선결제: m2net 실시간 실과금 기준">선</span>}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums text-orange-500">{r.m2net_deduction != null ? r.m2net_deduction.toLocaleString() : '-'}</td>
            <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${net >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{net.toLocaleString()}</td>
            {isSuper && (
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700 border-l-2 border-r-2 border-rose-400 bg-rose-100/40 dark:bg-rose-900/20 dark:border-rose-700">
                {r.sajuplan_revenue != null ? r.sajuplan_revenue.toLocaleString() : '-'}
              </td>
            )}
          </tr>
        )
      })}
    </>
  )
}
