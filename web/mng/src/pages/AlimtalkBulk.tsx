import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody } from '../components/table'

/**
 * 어드민 — 일괄 알림톡 발송 + 발송 이력 (Phase 13).
 *
 * 두 탭:
 *  1) 발송 — 템플릿 선택 → 대상 선택 → 변수 입력 → 전송
 *  2) 이력 — 일괄 작업 그룹 + 개별 발송 결과 (성공/실패)
 */

interface Template {
  template_code: string
  message: string
  is_active: boolean
}

interface JobRow {
  bulk_job_id: number
  template_code: string
  initiated_by: string | null
  total: string
  sent: string
  failed: string
  created_at: string
}

const TARGET_LABEL: Record<string, string> = {
  all_members: '회원 전원',
  all_counselors: '상담사 전원',
  phones: '직접 입력',
}

export default function AlimtalkBulk() {
  // 발송 폼
  const [templates, setTemplates] = useState<Template[]>([])
  const [tplCode, setTplCode] = useState('')
  const [target, setTarget] = useState<'all_members' | 'all_counselors' | 'phones'>('all_members')
  const [phones, setPhones] = useState('')
  const [varsText, setVarsText] = useState('{}')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ job_id: number; total: number; sent: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 이력 — 일괄 작업 요약만. 건별 결과는 전용 "알림톡 발송 이력" 메뉴(alimtalk_log, 자동 포함 전체).
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    api<Template[]>('/admin/alimtalk-bulk/templates').then(setTemplates).catch(() => {})
  }, [])

  useEffect(() => {
    setLogsLoading(true)
    api<JobRow[]>('/admin/alimtalk-bulk/jobs?limit=50')
      .then(setJobs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLogsLoading(false))
  }, [result])

  const selectedTpl = templates.find((t) => t.template_code === tplCode)

  const handleSend = async () => {
    if (!tplCode) return
    setError(null)
    setResult(null)
    let vars: Record<string, string> = {}
    try {
      if (varsText.trim()) vars = JSON.parse(varsText)
    } catch {
      setError('변수 JSON 형식 오류')
      return
    }
    const confirmMsg = target === 'phones'
      ? `직접 입력한 번호들에게 발송합니다.\n계속하시겠습니까?`
      : `${TARGET_LABEL[target]} (수십~수백 명) 에게 발송됩니다.\n취소할 수 없습니다. 계속하시겠습니까?`
    if (!confirm(confirmMsg)) return
    setSending(true)
    try {
      const r = await api<{ job_id: number; total: number; sent: number; failed: number }>(
        '/admin/alimtalk-bulk/send',
        {
          method: 'POST',
          body: JSON.stringify({
            template_code: tplCode,
            target,
            phones: target === 'phones' ? phones : undefined,
            vars,
          }),
        },
      )
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : '발송 실패')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">알림톡 발송 (수동)</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          관리자가 직접 회원/상담사에게 알림톡을 일괄 발송하는 화면입니다.
        </p>
      </div>

      {/* 안내: 수동 vs 자동, 템플릿 출처 */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1 max-w-[760px]">
        <div className="font-semibold">📌 알아두세요</div>
        <div>• <b>이 화면 = 수동 일괄발송</b>이고, 아래 "발송 이력"도 <b>수동으로 보낸 건만</b> 보여줍니다.</div>
        <div>• <b>자동 알림톡</b>(가입 인증·후기 도착·가상계좌 안내·정산·일일요약 등)은 <b>시스템이 이벤트마다 자동으로 발송</b>합니다. 자동 발송분을 포함한 전체 발송 기록은 <Link to="/alert-logs" className="underline font-medium">알림톡 이력</Link> 메뉴에서 확인하세요.</div>
        <div>• <b>알림톡 템플릿(양식)</b>의 등록·검수·승인은 <b>카카오 비즈(BizM) 콘솔</b>에서 관리됩니다. 이 화면에선 이미 등록된 템플릿을 골라 보낼 뿐입니다.</div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm w-fit max-w-full">{error}</div>}

      {/* ── 수동 발송 폼 ── */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1">템플릿</label>
            <select
              value={tplCode}
              onChange={(e) => setTplCode(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800"
            >
              <option value="">템플릿 선택</option>
              {templates.map((t) => (
                <option key={t.template_code} value={t.template_code}>
                  {t.template_code}
                </option>
              ))}
            </select>
            {selectedTpl && (
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-md text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto max-w-md">
                {selectedTpl.message}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1">대상</label>
            <div className="flex gap-2 flex-wrap">
              {(['all_members', 'all_counselors', 'phones'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className={`px-3 py-1.5 text-xs rounded-md border ${
                    target === t
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {TARGET_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {target === 'phones' && (
            <div>
              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1">전화번호 (콤마 또는 줄바꿈 구분)</label>
              <textarea
                value={phones}
                onChange={(e) => setPhones(e.target.value)}
                rows={4}
                placeholder="01012345678, 01087654321&#10;01099998888"
                className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-mono bg-white dark:bg-gray-800"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1">변수 (JSON)</label>
            <textarea
              value={varsText}
              onChange={(e) => setVarsText(e.target.value)}
              rows={3}
              placeholder='{"이름": "홍길동"}'
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-mono bg-white dark:bg-gray-800"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              템플릿 본문의 #&#123;변수명&#125; 을 치환. 회원별 변동 변수가 있으면 일괄 발송 부적합 (별도 흐름 필요).
            </p>
          </div>

          {result && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm w-fit max-w-full">
              <div className="font-medium text-emerald-800 dark:text-emerald-200">발송 완료 — Job #{result.job_id}</div>
              <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                전체 {result.total} · 성공 {result.sent} · 실패 {result.failed}
              </div>
            </div>
          )}

          <button
            disabled={!tplCode || sending}
            onClick={() => void handleSend()}
            className="px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {sending ? '발송 중... (최대 수분)' : '일괄 발송'}
          </button>
        </div>

      {/* ── 일괄 발송 이력 (수동 발송분만) ── */}
        <div className="space-y-3">
          {/* 일괄 작업 요약 */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">최근 일괄 발송 작업</h2>
            {logsLoading ? (
              <div className="text-xs text-gray-500">로딩...</div>
            ) : jobs.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-fit">아직 발송 없음</div>
            ) : (
              <TableShell>
                <THead>
                  <Th align="left">시각</Th>
                  <Th align="left">Job ID</Th>
                  <Th align="left">템플릿</Th>
                  <Th align="right">전체</Th>
                  <Th align="right">성공</Th>
                  <Th align="right">실패</Th>
                  <Th align="left">발송자</Th>
                </THead>
                <TBody>
                  {jobs.map((j) => (
                    <Tr key={j.bulk_job_id}>
                      <Td align="left" className="text-xs text-gray-500 tabular-nums">{j.created_at.slice(0, 16).replace('T', ' ')}</Td>
                      <Td align="left" className="text-xs">#{j.bulk_job_id}</Td>
                      <Td align="left" className="text-xs font-mono">{j.template_code}</Td>
                      <Td align="right" className="tabular-nums">{Number(j.total)}</Td>
                      <Td align="right" className="tabular-nums text-emerald-700 font-medium">{Number(j.sent)}</Td>
                      <Td align="right" className={`tabular-nums ${Number(j.failed) > 0 ? 'text-rose-600 font-medium' : 'text-gray-300'}`}>
                        {Number(j.failed)}
                      </Td>
                      <Td align="left" className="text-xs text-gray-500">{j.initiated_by ?? '—'}</Td>
                    </Tr>
                  ))}
                </TBody>
              </TableShell>
            )}
          </section>

          {/* 건별 결과는 전용 메뉴로 안내 (중복 제거) */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            건별 발송 결과(성공·실패·사유)는 <Link to="/alert-logs" className="text-brand-600 underline">알림톡 발송 이력</Link> 메뉴에서 확인하세요. (수동·자동 발송 전체 기록)
          </p>
        </div>
    </div>
  )
}
