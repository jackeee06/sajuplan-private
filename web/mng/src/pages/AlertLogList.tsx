import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { TableShell, THead, TBody, Th, Td, Tr, Badge, EmptyRow } from '../components/table'

/**
 * 알림 이력 — 발송된 모든 알림(alimtalk_log) + 현재 시스템 점검 상세.
 * 사장님이 알림 숫자에 불안할 때 들어와서 "별거 아니구나" 확인하는 안심 화면.
 */

type HealthItem = { who: string; detail: string; test_suspect: boolean }
type HealthCheck = { code: string; label: string; severity: string; count: number; items: HealthItem[] }
type LogItem = {
  id: number
  template_code: string
  phone: string
  success: boolean
  error_reason: string | null
  response_message: string | null
  vars: Record<string, unknown> | string | null
  sent_at: string
  caller: string | null
}

const TEMPLATE_LABEL: Record<string, string> = {
  ops_admin_alert_v2: '운영 알림 / 일일요약',
  settlement_complete: '정산 완료',
  review_for_counselor_v2: '후기 도착',
  qa_ask_v2: '문의 도착',
  qa_answer_v2: '문의 답변',
  register_num_v2: '가입 인증번호',
  register_idpw_v2: '비밀번호 찾기',
  order_bankinfo_v2: '가상계좌 안내',
  payout_request_received: '선지급 접수',
  payout_request_paid: '선지급 지급',
  payout_request_rejected: '선지급 반려',
  counselor_request_v1: '전화 상담요청',
  chat_request_to_counselor: '채팅 상담요청',
}
const labelOf = (t: string) => TEMPLATE_LABEL[t] ?? t

function fmt(s: string) {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** vars 에서 사람이 읽을 요약 한 줄 뽑기 (운영알림은 detail 전문) */
function summaryOf(vars: LogItem['vars']): string {
  if (!vars) return ''
  let o: Record<string, unknown> | null = null
  if (typeof vars === 'string') { try { o = JSON.parse(vars) } catch { return vars.slice(0, 60) } }
  else o = vars
  if (!o) return ''
  if (typeof o.detail === 'string') return o.detail.replace(/\n/g, ' ').slice(0, 80)
  return Object.entries(o).map(([k, v]) => `${k}:${String(v)}`).join(' · ').slice(0, 80)
}

export default function AlertLogList() {
  const [health, setHealth] = useState<{ checks: HealthCheck[] } | null>(null)
  const [data, setData] = useState<{ items: LogItem[]; total: number } | null>(null)
  const [page, setPage] = useState(1)
  const [onlyFail, setOnlyFail] = useState(false)
  const [view, setView] = useState<LogItem | null>(null)

  useEffect(() => { api<{ checks: HealthCheck[] }>('/admin/alert-logs/health').then(setHealth).catch(() => {}) }, [])
  useEffect(() => {
    api<{ items: LogItem[]; total: number }>(`/admin/alert-logs?page=${page}${onlyFail ? '&only_fail=1' : ''}`)
      .then(setData).catch(() => {})
  }, [page, onlyFail])

  const violations = (health?.checks ?? []).filter((c) => c.count > 0)

  return (
    <div className="space-y-4 max-w-[1100px]">
      {/* 타이틀 — 한 줄, 부제 인라인 (조밀) */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">알림 이력</h1>
        <span className="text-xs text-gray-500 dark:text-gray-400">발송된 모든 알림과 현재 시스템 점검 상태 — 불안하면 여기서 상세를 확인하세요.</span>
      </div>

      {/* 현재 시스템 점검 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">🩺 현재 시스템 점검</h2>
        {!health ? (
          <p className="text-xs text-gray-400">불러오는 중…</p>
        ) : violations.length === 0 ? (
          <p className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-3 py-2">✅ 모두 정상입니다. 안심하셔도 됩니다.</p>
        ) : (
          <div className="space-y-3">
            {violations.map((c) => {
              const allTest = c.items.every((it) => it.test_suspect)
              return (
                <div key={c.code} className="border border-gray-100 dark:border-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge color={allTest ? 'gray' : c.severity === 'critical' ? 'rose' : 'amber'}>
                      {allTest ? '무해(테스트)' : c.severity === 'critical' ? '주의' : '경미'}
                    </Badge>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.label} <span className="text-gray-400">{c.count}건</span></span>
                  </div>
                  <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 pl-1">
                    {c.items.slice(0, 20).map((it, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="font-medium">{it.who}</span>
                        <span className="text-gray-400">— {it.detail}</span>
                        {it.test_suspect && <span className="text-[10px] text-gray-400">(테스트 추정)</span>}
                      </li>
                    ))}
                  </ul>
                  {allTest && <p className="text-[11px] text-gray-400 mt-1.5">→ 전부 테스트 계정/방으로 추정됩니다. 실사용자 영향 없음.</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 발송 이력 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">전체 <span className="text-brand-600 font-semibold">{data?.total?.toLocaleString() ?? 0}</span>건</span>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={onlyFail} onChange={(e) => { setOnlyFail(e.target.checked); setPage(1) }} />
          실패만 보기
        </label>
      </div>

      <TableShell>
        <THead>
          <Th align="left">발송시각</Th>
          <Th align="left">종류</Th>
          <Th align="left">수신</Th>
          <Th align="center">결과</Th>
          <Th align="left">내용</Th>
        </THead>
        <TBody>
          {!data ? (
            <EmptyRow colSpan={5} loading />
          ) : data.items.length === 0 ? (
            <EmptyRow colSpan={5} />
          ) : (
            data.items.map((it) => (
              <Tr key={it.id} onClick={() => setView(it)}>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{fmt(it.sent_at)}</Td>
                <Td align="left"><span className="text-xs font-medium text-gray-700 dark:text-gray-300">{labelOf(it.template_code)}</span></Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{it.phone}</Td>
                <Td align="center">
                  {it.success
                    ? <Badge color="emerald">성공</Badge>
                    : <Badge color="rose">{it.error_reason ?? '실패'}</Badge>}
                </Td>
                <Td align="left" className="max-w-[420px] truncate text-xs text-gray-500">{summaryOf(it.vars)}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>

      {/* 페이지네이션(간단) */}
      {data && data.total > (data.items.length) && (
        <div className="flex justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-md border border-gray-200 disabled:opacity-40">이전</button>
          <span className="px-2 py-1.5 text-gray-500">{page}페이지</span>
          <button disabled={page * 30 >= data.total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-md border border-gray-200 disabled:opacity-40">다음</button>
        </div>
      )}

      {/* 상세 모달 */}
      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setView(null)}>
          <div className="w-full max-w-[560px] max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{labelOf(view.template_code)}</h3>
              <button onClick={() => setView(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
              <span>{fmt(view.sent_at)}</span>
              <span>수신 {view.phone}</span>
              <span>{view.success ? '✅ 성공' : `❌ 실패(${view.error_reason ?? '?'})`}</span>
              {view.caller && <span>호출 {view.caller}</span>}
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {summaryOf(view.vars) || '(내용 없음)'}
            </div>
            {view.response_message && (
              <p className="text-[11px] text-gray-400">응답: {view.response_message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
