import { useEffect, useMemo, useState } from 'react'
import { Download, Check, AlertTriangle, ChevronDown, ChevronRight, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { defaultLast7Days } from '../lib/dateRange'
import { DateRangeChips } from '../components/DateRangeChips'
import {
  Th, Td, Tr, TableShell, THead, TBody, EmptyRow,
  Badge, BadgeColor, Chip, PaginationBar, inputCls, num,
} from '../components/table'
import { API_BASE } from '../lib/runtime-env'

/**
 * 어드민 — 선지급 일괄 처리 (Phase 3, 2026-05-21).
 *
 * 운영 흐름:
 *   1) 일과 종료 시 이 페이지 열기 → 상단 카드에서 대기 N건/금액 확인
 *   2) "CSV 다운로드" → 은행 일괄이체용 엑셀
 *   3) 은행 앱에서 송금 후 → 체크박스 선택 → "선택 송금완료" 일괄 마킹
 *   4) 자동으로 카톡 알림 발송 + 다음달 정산에서 차감 마킹
 */

interface PayoutRow {
  id: number
  counselor_id: number
  counselor_mb_id: string | null
  counselor_name: string | null
  counselor_nickname: string | null
  counselor_phone: string | null
  grade_at_request: string
  requested_amount: number
  fee_amount: number
  withholding_amount: number
  actual_payout: number
  fee_rate_snapshot: string
  status: 'pending' | 'paid' | 'rejected' | 'cancelled'
  request_memo: string | null
  admin_memo: string | null
  reject_reason: string | null
  bank_name_snapshot: string
  bank_holder_snapshot: string
  bank_account_snapshot: string
  requested_at: string
  decided_at: string | null
  paid_at: string | null
  settlement_month: string | null
}

interface ListResp {
  items: PayoutRow[]
  total: number
  limit: number
  offset: number
}

interface Stats {
  pending_count: number
  pending_amount: number
  today_paid_count: number
  today_paid_amount: number
  month_paid_count: number
  month_paid_amount: number
  stale_pending_count: number
}

type StatusKey = '' | 'pending' | 'paid' | 'rejected' | 'cancelled'

const STATUS_LABEL: Record<PayoutRow['status'], { label: string; color: BadgeColor }> = {
  pending: { label: '대기', color: 'amber' },
  paid: { label: '지급', color: 'emerald' },
  rejected: { label: '반려', color: 'rose' },
  cancelled: { label: '취소', color: 'gray' },
}

const GRADE_LABEL: Record<string, string> = {
  preliminary: '예비',
  partner1: '파트너1',
  partner2: '파트너2',
  partner3: '파트너3',
  partner4: '파트너4',
  partner5: '파트너5',
}

const PAGE_SIZE = 50

const DEFAULT_POLICY = `▶ 선지급(가불) 이란?
상담사가 다음 정산일(매월 말 정산)을 기다리지 않고, 이미 발생한 수익 중 일부를 미리 받아가는 제도입니다.
지급된 금액은 다음달 정산에서 자동으로 차감되며, 상담사 입장에서는 "월급일 전에 받는 가불"과 같습니다.

▶ 처리 흐름 (4단계)
1) [대기]  상담사가 앱에서 신청 → 상단 "처리 대기" 카드 +1
2) 운영자가 [📥 대기 CSV] 다운로드 → 은행 인터넷뱅킹의 "일괄이체" 메뉴에 그대로 업로드
3) 송금 완료 후 → 대기 행 체크박스 선택 → 하단 sticky 바의 [송금완료 처리] 클릭
4) [지급] 상태로 변경 + 상담사에게 카카오 알림톡 자동 발송 + 다음달 정산 차감 마킹

▶ 금액 계산
실지급액 = 신청금 − 수수료 − 원천세

  예시) 신청 100,000원 / 수수료율 5% / 원천세 3.3%
        수수료   -5,000원   (서비스 수수료)
        원천세   -3,300원   (사업소득 원천징수)
        ────────────────
        실지급  91,700원   ← 실제 통장으로 입금되는 금액

· 수수료율 / 원천세율은 [설정 > 선지급] 에서 변경할 수 있습니다 (슈퍼어드민 권한 필요).
· 원천세 3.3% 는 한국 세법(소득세 3% + 지방세 0.3%) 기준이며, 세법 개정이 없는 한 유지합니다.
· 이미 신청된 건은 신청 시점의 비율을 그대로 사용합니다 (수수료율 변경의 소급 적용 없음).

▶ 24시간+ 미처리 경고
선지급 신청은 24시간 안에 처리하는 것을 원칙으로 합니다.
24시간이 지난 대기 건이 있으면 상단 "24h+ 미처리" 카드가 빨간색으로 강조됩니다.
이는 상담사 신뢰도·이탈률과 직결되므로 발견 즉시 처리하세요.

▶ 반려 처리
계좌 정보 오류·부정 신청 의심·등급 미달 등 처리 불가 사유가 있으면 [반려] 버튼을 사용합니다.
반려 사유는 카카오 알림톡으로 상담사에게 그대로 전달되므로, 명확하고 정중하게 작성하세요.

  ✓ 좋은 예: "계좌 정보가 일치하지 않습니다. 마이페이지에서 재등록 후 다시 신청해주세요."
  ✗ 나쁜 예: "확인 필요" / "불가"

▶ 안전장치 (실수 방지)
· 송금완료 처리 전: 하단 sticky 바에 "선택 N건 · 실지급합 ###,###원" 실시간 표시
· [송금완료 처리] 클릭 시: 확인 다이얼로그에 신청합/실지급합 재고지
· CSV 다운로드는 "대기" 상태인 신청만 포함 (이미 처리된 건은 제외)
· 한 번 [지급] 처리된 건은 시스템에서 자동 취소 불가 → 환수가 필요하면 슈퍼어드민에게 별도 요청

▶ 송금 후 자동으로 처리되는 일
1) 상담사 휴대폰으로 카카오 알림톡 발송 (입금 완료 안내 + 실지급액)
2) 다음달 정산에서 actual_payout 만큼 자동 차감 마킹
3) 상담사 누적 선지급 현황 갱신

▶ 자주 묻는 질문
Q. 신청금과 실지급액이 다른 이유?
A. 수수료와 원천세가 미리 공제되기 때문입니다. 신청금 전액이 상담사 수익에서 차감되고, 실지급액만 통장으로 입금됩니다.

Q. CSV 파일은 어떤 형식인가요?
A. 은행 일괄이체 표준 양식(예금주명·계좌번호·금액)입니다. 인터넷뱅킹의 일괄이체 메뉴에 그대로 업로드할 수 있습니다.

Q. 송금완료 처리를 깜빡하면?
A. 상담사에게 알림톡이 가지 않고, 다음달 정산에서 차감되지 않습니다(= 중복 지급 위험). 송금 후 반드시 같은 날 안에 처리하세요.

Q. 토·일·공휴일에도 처리해야 하나요?
A. 은행 영업일 기준으로 운영합니다. 영업일이 아닌 신청은 다음 영업일에 처리합니다(이 경우 24h+ 카운트는 자연스럽게 늘 수 있으나, 영업일 시간이라면 즉시 처리).
`


export default function PayoutList() {
  const _init = defaultLast7Days()
  const [data, setData] = useState<ListResp | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [counselorMbId, setCounselorMbId] = useState('')
  const [status, setStatus] = useState<StatusKey>('pending')
  const [frDate, setFrDate] = useState(_init.from)
  const [toDate, setToDate] = useState(_init.to)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [rejectModalId, setRejectModalId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [policyOpen, setPolicyOpen] = useState(false)
  const [policyText, setPolicyText] = useState<string>(DEFAULT_POLICY)

  useEffect(() => {
    let alive = true
    api<{ data: Record<string, string> }>('/admin/settings/payout')
      .then((res) => {
        if (!alive) return
        const t = (res.data?.policy_text ?? '').trim()
        setPolicyText(t || DEFAULT_POLICY)
      })
      .catch(() => { /* 설정 호출 실패 시 기본 정책 유지 */ })
    return () => { alive = false }
  }, [])

  const refresh = () => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    })
    if (counselorMbId) params.set('counselor_mb_id', counselorMbId)
    if (status) params.set('status', status)
    if (frDate) params.set('from', frDate)
    if (toDate) params.set('to', toDate)
    Promise.all([
      api<ListResp>(`/admin/payouts?${params.toString()}`),
      api<Stats>('/admin/payouts/stats'),
    ])
      .then(([d, s]) => {
        setData(d)
        setStats(s)
        setSelectedIds(new Set())
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, counselorMbId, frDate, toDate])

  const visiblePending = useMemo(
    () => (data?.items ?? []).filter((r) => r.status === 'pending'),
    [data],
  )
  const selectedRows = useMemo(
    () => (data?.items ?? []).filter((r) => selectedIds.has(r.id)),
    [data, selectedIds],
  )
  const selectedSum = selectedRows.reduce((s, r) => s + r.requested_amount, 0)
  const selectedActualSum = selectedRows.reduce((s, r) => s + r.actual_payout, 0)
  const allChecked = visiblePending.length > 0 && visiblePending.every((r) => selectedIds.has(r.id))

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visiblePending.map((r) => r.id)))
    }
  }
  const toggleOne = (id: number) => {
    setSelectedIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkPay = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(
      `선택한 ${selectedIds.size}건을 송금 완료 처리합니다.\n` +
      `신청합: ${selectedSum.toLocaleString()}원\n` +
      `실지급합: ${selectedActualSum.toLocaleString()}원\n\n` +
      `상담사들에게 카톡 알림이 발송됩니다. 진행할까요?`,
    )) return
    setBusy(true)
    try {
      const r = await api<{ ok: number; failed: number; errors: Array<{ id: number; error: string }> }>(
        '/admin/payouts/bulk-pay',
        { method: 'POST', body: JSON.stringify({ ids: Array.from(selectedIds) }) },
      )
      if (r.failed > 0) {
        alert(`완료: ${r.ok}건 / 실패: ${r.failed}건\n실패 사유:\n${r.errors.map(e => `#${e.id}: ${e.error}`).join('\n')}`)
      } else {
        alert(`${r.ok}건 처리 완료`)
      }
      refresh()
    } catch (e) {
      alert(`처리 실패: ${e instanceof Error ? e.message : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const handlePayOne = async (id: number) => {
    if (!window.confirm(`#${id} 송금 완료 처리하시겠습니까?\n상담사에게 카톡이 발송됩니다.`)) return
    setBusy(true)
    try {
      await api(`/admin/payouts/${id}/pay`, { method: 'POST', body: JSON.stringify({}) })
      refresh()
    } catch (e) {
      alert(`실패: ${e instanceof Error ? e.message : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!rejectModalId || !rejectReason.trim()) return
    setBusy(true)
    try {
      await api(`/admin/payouts/${rejectModalId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      setRejectModalId(null)
      setRejectReason('')
      refresh()
    } catch (e) {
      alert(`반려 실패: ${e instanceof Error ? e.message : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const pending = stats?.pending_count ?? 0
  const pendingAmt = stats?.pending_amount ?? 0
  const todayCnt = stats?.today_paid_count ?? 0
  const todayAmt = stats?.today_paid_amount ?? 0
  const monthCnt = stats?.month_paid_count ?? 0
  const monthAmt = stats?.month_paid_amount ?? 0
  const stale = stats?.stale_pending_count ?? 0

  return (
    <div className="space-y-3">
      {/* 페이지 타이틀 + 정책 토글 — 같은 줄에 가로 응집 */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">선지급 관리</h1>
          <button
            type="button"
            onClick={() => setPolicyOpen((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium border transition ${
              policyOpen
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'
            }`}
            title="선지급 운영 정책 — 헷갈리면 펼쳐서 읽어보세요"
          >
            <BookOpen className="w-3.5 h-3.5" />
            정책
            {policyOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">상담사 선지급 신청 처리 · CSV 다운 → 은행 송금 → 일괄 완료</p>
      </div>

      {/* 정책 본문 — 펼친 상태일 때만 노출. 편집 링크도 본문 안에. */}
      {policyOpen && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-2 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 text-[12px]">
            <span className="text-blue-800 dark:text-blue-300 font-medium">📖 선지급 운영 정책</span>
            <Link
              to="/settings"
              className="text-blue-600 dark:text-blue-300 hover:underline"
              title="설정 > 선지급 탭에서 정책 본문 편집"
            >
              정책 편집 →
            </Link>
          </div>
          <div className="px-5 py-4">
            <pre className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-sans">{policyText}</pre>
          </div>
        </div>
      )}

      {/* 통계 카드 + 검색 + CSV 한 줄 — 와이드 모니터 가로 활용 */}
      <div className="flex flex-wrap gap-2 items-end">
        <StatCard
          title="처리 대기"
          value={pending}
          unit="건"
          sub={`${pendingAmt.toLocaleString()}원`}
          color={pending > 0 ? 'amber' : 'gray'}
        />
        <StatCard
          title="오늘 지급"
          value={todayCnt}
          unit="건"
          sub={`${todayAmt.toLocaleString()}원`}
          color="emerald"
        />
        <StatCard
          title="이번달 누적"
          value={monthCnt}
          unit="건"
          sub={`${monthAmt.toLocaleString()}원`}
          color="blue"
        />
        <StatCard
          title="24h+ 미처리"
          value={stale}
          unit="건"
          sub={stale > 0 ? '빨리 처리' : '없음'}
          color={stale > 0 ? 'red' : 'gray'}
          warn={stale > 0}
        />

        {/* 검색 + CSV — 통계카드 바로 옆 좌측 응집 (왼쪽 정렬 + 조밀 원칙) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="w-[200px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">상담사 ID</label>
              <input
                type="text"
                value={counselorMbId}
                onChange={(e) => setCounselorMbId(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); refresh() } }}
                placeholder="mb_id 검색"
                className={inputCls}
              />
            </div>
            <div className="w-[140px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">기간 시작</label>
              <input type="date" value={frDate} onChange={(e) => { setFrDate(e.target.value); setPage(1) }} className={inputCls} />
            </div>
            <div className="w-[140px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">기간 종료</label>
              <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1) }} className={inputCls} />
            </div>
          </div>
          <DateRangeChips
            from={frDate}
            to={toDate}
            onPick={(r) => { setFrDate(r.from); setToDate(r.to); setPage(1) }}
          />
          <a
            href={`${API_BASE}/admin/payouts/csv-pending`}
            className="inline-flex items-center gap-1.5 h-[42px] px-3 rounded-md border border-brand-300 text-brand-700 bg-white hover:bg-brand-50 dark:bg-gray-900 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-500/10 text-sm font-medium whitespace-nowrap self-end"
            target="_blank"
            rel="noopener noreferrer"
            title="대기 상태인 신청만 CSV 다운로드 — 은행 일괄이체용"
          >
            <Download className="w-4 h-4" /> 대기 CSV
          </a>
        </div>
      </div>

      {/* 상태 칩 — 표준 패턴 (active=brand, dot으로 의미 분리) */}
      <div className="flex flex-wrap gap-2">
        <Chip label="전체" active={status === ''} onClick={() => { setStatus(''); setPage(1) }} />
        <Chip
          label="대기"
          value={pending}
          dotColor="amber"
          active={status === 'pending'}
          onClick={() => { setStatus('pending'); setPage(1) }}
        />
        <Chip label="지급" dotColor="emerald" active={status === 'paid'} onClick={() => { setStatus('paid'); setPage(1) }} />
        <Chip label="반려" dotColor="rose" active={status === 'rejected'} onClick={() => { setStatus('rejected'); setPage(1) }} />
        <Chip label="취소" dotColor="gray" active={status === 'cancelled'} onClick={() => { setStatus('cancelled'); setPage(1) }} />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
      )}

      {/* 결과 카운트 */}
      {data && !loading && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-500">
            전체 <span className="text-brand-600 font-semibold">{num(data.total)}</span>건
          </p>
        </div>
      )}

      {/* 테이블 — 표준 컴포넌트 + 컬럼 통합 (계좌정보 = 은행+예금주+계좌) */}
      <TableShell>
        <THead>
          <Th align="center">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              disabled={visiblePending.length === 0}
              className="align-middle"
            />
          </Th>
          <Th align="center">상태</Th>
          <Th align="left">신청시각</Th>
          <Th align="left">상담사</Th>
          <Th align="center">등급</Th>
          <Th align="right">신청금</Th>
          <Th align="right">수수료</Th>
          <Th align="right">원천</Th>
          <Th align="right">실지급</Th>
          <Th align="left">계좌정보</Th>
          <Th align="left">메모</Th>
          <Th align="center">액션</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={12} loading />
          ) : !data?.items?.length ? (
            <EmptyRow colSpan={12} />
          ) : (
            data.items.map((r) => {
              const isPending = r.status === 'pending'
              return (
                <Tr key={r.id}>
                  <Td align="center">
                    {isPending && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="align-middle"
                      />
                    )}
                  </Td>
                  <Td align="center">
                    <Badge color={STATUS_LABEL[r.status].color}>
                      {STATUS_LABEL[r.status].label}
                    </Badge>
                  </Td>
                  <Td align="left" className="text-[11px] text-gray-500 tabular-nums">
                    {r.requested_at.slice(0, 16).replace('T', ' ')}
                  </Td>
                  <Td align="left">
                    <div className="text-[12px] leading-tight">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {r.counselor_nickname || r.counselor_name || '-'}
                      </div>
                      <div className="text-[10px] text-gray-500">{r.counselor_mb_id}</div>
                    </div>
                  </Td>
                  <Td align="center" className="text-[11px] text-gray-600">
                    {GRADE_LABEL[r.grade_at_request] || r.grade_at_request}
                  </Td>
                  <Td align="right" className="tabular-nums text-gray-700">
                    {r.requested_amount.toLocaleString()}
                  </Td>
                  <Td align="right" className="tabular-nums text-[11px] text-rose-600">
                    -{r.fee_amount.toLocaleString()}
                  </Td>
                  <Td align="right" className="tabular-nums text-[11px] text-rose-600">
                    -{r.withholding_amount.toLocaleString()}
                  </Td>
                  <Td align="right" className="tabular-nums text-[14px] font-bold text-brand-600">
                    {r.actual_payout.toLocaleString()}
                  </Td>
                  <Td align="left">
                    <div className="text-[11px] leading-tight">
                      <div className="text-gray-700 dark:text-gray-200">
                        <span className="font-medium">{r.bank_name_snapshot}</span>
                        <span className="text-gray-400 mx-1">·</span>
                        <span>{r.bank_holder_snapshot}</span>
                      </div>
                      <div className="text-gray-500 tabular-nums">{r.bank_account_snapshot}</div>
                    </div>
                  </Td>
                  <Td
                    align="left"
                    className="text-[11px] text-gray-600 max-w-[180px] truncate"
                    title={[r.request_memo, r.reject_reason && `반려: ${r.reject_reason}`, r.admin_memo].filter(Boolean).join(' / ')}
                  >
                    {r.reject_reason ? (
                      <span className="text-rose-600">반려: {r.reject_reason}</span>
                    ) : (
                      r.request_memo || r.admin_memo || '-'
                    )}
                  </Td>
                  <Td align="center">
                    {isPending && (
                      <div className="flex gap-1 justify-center">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handlePayOne(r.id)}
                          className="h-7 px-2.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-medium disabled:bg-gray-200 disabled:text-gray-400"
                        >
                          지급
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => { setRejectModalId(r.id); setRejectReason('') }}
                          className="h-7 px-2.5 rounded-md border border-gray-200 text-[11px] text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                        >
                          반려
                        </button>
                      </div>
                    )}
                  </Td>
                </Tr>
              )
            })
          )}
        </TBody>
      </TableShell>

      {/* 페이지네이션 — 표준 PaginationBar */}
      {data && data.total > PAGE_SIZE && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={data.total}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      )}

      {/* 선택 sticky bar — 송금 전 검증용. 선택이 있을 때만 노출 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-white dark:bg-gray-900 border border-brand-300 dark:border-brand-500/40 rounded-full shadow-lg pl-5 pr-2 py-2">
          <div className="text-sm">
            <span className="text-gray-500">선택</span>
            <span className="mx-1 font-semibold text-brand-600 tabular-nums">{selectedIds.size}</span>
            <span className="text-gray-500">건 · 실지급합</span>
            <span className="mx-1 font-semibold text-brand-600 tabular-nums">{selectedActualSum.toLocaleString()}</span>
            <span className="text-gray-500">원</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-[12px] text-gray-500 hover:text-gray-700"
          >
            해제
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleBulkPay()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:bg-gray-300"
          >
            <Check className="w-4 h-4" /> 송금완료 처리
          </button>
        </div>
      )}

      {/* 반려 모달 */}
      {rejectModalId !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
          onClick={() => setRejectModalId(null)}
        >
          <div
            className="w-[400px] bg-white dark:bg-gray-800 rounded-xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">신청 #{rejectModalId} 반려</h2>
            <p className="text-[12px] text-gray-500 mb-3">
              반려 사유는 상담사에게 카톡으로 전달됩니다.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 계좌 정보 오류 — 재등록 후 다시 신청해주세요"
              rows={3}
              maxLength={300}
              className="w-full p-2 border border-gray-200 rounded-md text-[13px] mb-3 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRejectModalId(null)}
                disabled={busy}
                className="h-9 rounded-md border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy || !rejectReason.trim()}
                onClick={() => void handleReject()}
                className="h-9 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-medium disabled:bg-gray-200 disabled:text-gray-400"
              >
                반려 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  title, value, unit, sub, color, warn,
}: {
  title: string
  value: number
  unit: string
  sub: string
  color: 'amber' | 'emerald' | 'blue' | 'red' | 'gray'
  warn?: boolean
}) {
  const colorMap = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200',
    blue: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-200',
    red: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200',
    gray: 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-300',
  }
  return (
    <div className={`px-4 py-2.5 rounded-xl border min-w-[160px] ${colorMap[color]}`}>
      <div className="text-[11px] opacity-80 flex items-center gap-1">
        {warn && <AlertTriangle className="w-3 h-3" />}
        {title}
      </div>
      <div className="text-[20px] font-bold tabular-nums leading-tight">
        {value.toLocaleString()}
        <span className="text-[12px] font-medium ml-0.5 opacity-80">{unit}</span>
      </div>
      <div className="text-[11px] opacity-80 tabular-nums">{sub}</div>
    </div>
  )
}
