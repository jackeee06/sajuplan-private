import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Wallet, Lock } from 'lucide-react'
import { api } from '../lib/api'
import { SuperOnlySection } from '../components/SuperOnlySection'
import {
  TableShell, THead, TBody, Tr, Th, Td, EmptyRow, Badge, NumCell, num, fmtDate, fmtPhone,
} from '../components/table'

// ─── 타입 ─────────────────────────────────────
interface PromoterDetail {
  id: number
  name: string
  phone: string | null
  code: string
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
  rrn_masked: string | null
  has_rrn: boolean
  member_id: number | null
  reward_rate: number | null
  is_active: boolean
  status: PromoterStatus
  memo: string | null
  created_at: string
}

type PromoterStatus = 'pending' | 'active' | 'rejected'

interface Reward {
  id: number
  source_table: string | null
  base_paid: number | string
  reward_amount: number | string
  status: string
  usage_label: string | null
  created_at: string
  member_name: string | null
  settlement_id: number | null
}

interface Settlement {
  id: number
  total_reward: number | string
  withholding: number | string
  paid_amount: number | string
  status: string
  paid_at: string | null
  created_at: string
  memo: string | null
}

interface DetailResp {
  promoter: PromoterDetail
  rewards: Reward[]
  settlements: Settlement[]
}

interface FormState {
  name: string
  phone: string
  code: string
  bank_name: string
  bank_account: string
  account_holder: string
  reward_rate: string // 빈칸 = 글로벌 3%
  is_active: boolean
  memo: string
  rrn: string // 입력했을 때만 전송
}

const emptyForm = (): FormState => ({
  name: '', phone: '', code: '',
  bank_name: '', bank_account: '', account_holder: '',
  reward_rate: '', is_active: true, memo: '', rrn: '',
})

export default function PromoterForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(emptyForm())
  const [detail, setDetail] = useState<DetailResp | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [settling, setSettling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // 전역 보상요율(전체 서포터즈 공통) — 표시용. 환경설정에서 변경.
  const [globalRatePct, setGlobalRatePct] = useState<number | null>(null)

  useEffect(() => {
    api<{ reward_rate: number }>('/admin/promoters/settings')
      .then((s) => setGlobalRatePct(Math.round(s.reward_rate * 1000) / 10))
      .catch(() => undefined)
  }, [])

  const loadDetail = () => {
    if (isNew) return
    setLoading(true)
    api<DetailResp>(`/admin/promoters/${id}`)
      .then((r) => {
        setDetail(r)
        const p = r.promoter
        setForm({
          name: p.name ?? '',
          phone: p.phone ?? '',
          code: p.code ?? '',
          bank_name: p.bank_name ?? '',
          bank_account: p.bank_account ?? '',
          account_holder: p.account_holder ?? '',
          reward_rate: p.reward_rate === null || p.reward_rate === undefined ? '' : String(p.reward_rate),
          is_active: !!p.is_active,
          memo: p.memo ?? '',
          rrn: '',
        })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadDetail, [id, isNew])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const onSubmit = async () => {
    setError(null)
    setSuccess(null)
    if (!form.name.trim()) return setError('이름을 입력하세요.')
    if (!form.phone.trim()) return setError('전화번호를 입력하세요.')

    setSaving(true)
    try {
      if (isNew) {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          phone: form.phone.trim(),
          code: form.code.trim() || undefined,
          bank_name: form.bank_name.trim() || undefined,
          bank_account: form.bank_account.trim() || undefined,
          account_holder: form.account_holder.trim() || undefined,
          memo: form.memo.trim() || undefined,
        }
        if (form.rrn.trim()) payload.rrn = form.rrn.trim()
        const res = await api<{ id: number; code: string }>('/admin/promoters', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        navigate(`/promoters/${res.id}`, { replace: true })
      } else {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          bank_name: form.bank_name.trim(),
          bank_account: form.bank_account.trim(),
          account_holder: form.account_holder.trim(),
          is_active: form.is_active,
          memo: form.memo.trim(),
        }
        if (form.rrn.trim()) payload.rrn = form.rrn.trim()
        await api(`/admin/promoters/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setSuccess('저장되었습니다.')
        loadDetail()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const [actioning, setActioning] = useState(false)

  const onApprove = async () => {
    if (!id) return
    if (!window.confirm('이 모집인 신청을 승인하시겠습니까?')) return
    setActioning(true)
    setError(null)
    setSuccess(null)
    try {
      await api(`/admin/promoters/approve/${id}`, { method: 'PATCH', body: JSON.stringify({}) })
      alert('승인했습니다')
      loadDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : '승인 처리 실패')
    } finally {
      setActioning(false)
    }
  }

  const onReject = async () => {
    if (!id) return
    const reason = window.prompt('반려 사유를 입력하세요 (선택 — 빈값 가능)')
    if (reason === null) return // 취소
    setActioning(true)
    setError(null)
    setSuccess(null)
    try {
      await api(`/admin/promoters/reject/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      alert('반려했습니다')
      loadDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : '반려 처리 실패')
    } finally {
      setActioning(false)
    }
  }

  // 미정산 기대수익 — 적립(accrued)이고 아직 정산배치에 안 묶인(settlement_id 없는) 것의 합
  //   ⚠️ 실제 reward.status 도메인은 'accrued'|'voided' (옛 'pending' 아님). 정산되면 status 유지 + settlement_id 채워짐.
  const unsettledExpected = (detail?.rewards ?? [])
    .filter((r) => r.status === 'accrued' && !r.settlement_id)
    .reduce((acc, r) => acc + Number(r.reward_amount || 0), 0)

  const onSettle = async () => {
    if (!id) return
    if (unsettledExpected <= 0) {
      setError('정산할 미정산 적립이 없습니다.')
      return
    }
    if (!window.confirm('미정산 적립을 묶어 정산 배치를 생성하시겠습니까?')) return
    setSettling(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await api<{ id: number; total_reward: number; withholding: number; paid_amount: number; reward_count: number }>(
        `/admin/promoters/${id}/settle`,
        { method: 'POST' },
      )
      alert(
        `정산 배치 생성 완료\n` +
          `- 적립 건수: ${res.reward_count}건\n` +
          `- 총 적립: ${num(res.total_reward)}원\n` +
          `- 원천징수: ${num(res.withholding)}원\n` +
          `- 실지급액: ${num(res.paid_amount)}원`,
      )
      loadDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : '정산 배치 생성 실패')
    } finally {
      setSettling(false)
    }
  }

  const onMarkPaid = async (sid: number) => {
    if (!detail?.promoter.has_rrn) return
    if (!window.confirm('이 정산 건을 지급완료 처리하시겠습니까?')) return
    setError(null)
    setSuccess(null)
    try {
      await api(`/admin/promoters/settlements/${sid}/mark-paid`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      })
      setSuccess('지급완료 처리되었습니다.')
      loadDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : '지급완료 처리 실패')
    }
  }

  const onVoid = async (sid: number) => {
    const reason = window.prompt('무효화 사유를 입력하세요 (5자 이상)')
    if (reason === null) return
    if (reason.trim().length < 5) {
      setError('무효화 사유는 5자 이상 입력해야 합니다.')
      return
    }
    setError(null)
    setSuccess(null)
    try {
      await api(`/admin/promoters/settlements/${sid}/void`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason.trim() }),
      })
      setSuccess('무효화 처리되었습니다.')
      loadDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : '무효화 처리 실패')
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>

  const p = detail?.promoter

  return (
    <div className="space-y-4 max-w-[1100px]">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/promoters')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                {isNew ? '모집인 등록' : `모집인 수정 #${id}`}
              </h1>
              {p && <PromoterStatusBadge status={p.status} />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">모집인(서포터즈) 정보 관리</p>
          </div>
        </div>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
        >
          {saving ? '저장 중...' : isNew ? '등록' : '저장'}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm">{success}</div>}

      {/* ─── 자가 신청 승인/반려 (대기·반려 건) ─── */}
      {!isNew && p && p.status === 'pending' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-semibold">승인 대기중인 자가 신청입니다.</span>
            <span className="text-amber-700/80 dark:text-amber-300/80">정보를 확인한 뒤 승인 또는 반려하세요.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onApprove}
              disabled={actioning}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-50"
            >
              {actioning ? '처리 중...' : '승인'}
            </button>
            <button
              onClick={onReject}
              disabled={actioning}
              className="px-4 py-2 text-sm rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-900/30 font-medium disabled:opacity-50"
            >
              반려
            </button>
          </div>
        </div>
      )}

      {!isNew && p && p.status === 'rejected' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800/40 dark:border-gray-700 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold">반려된 신청입니다.</span>{' '}
            필요 시 다시 승인할 수 있습니다.
          </div>
          <button
            onClick={onApprove}
            disabled={actioning}
            className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-50"
          >
            {actioning ? '처리 중...' : '재승인'}
          </button>
        </div>
      )}

      {/* 기본 정보 */}
      <Section title="기본 정보">
        <Row label="이름" required>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
        </Row>
        <Row label="전화" required hint={!isNew ? undefined : '필수'}>
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set('phone', formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            maxLength={13}
            className={inputCls}
          />
        </Row>
        <Row label="코드" hint="빈칸이면 전화 뒷4자리 자동 생성">
          <input type="text" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="자동" className={inputCls} />
        </Row>
        <Row label="보상요율" hint="전체 서포터즈 공통 정책값 (개별 설정 불가)">
          <div className="pt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {globalRatePct !== null ? `${globalRatePct}%` : '…'}
            <span className="ml-2 text-xs font-normal text-gray-400">전체 공통 적용</span>
          </div>
        </Row>
        {!isNew && (
          <Row label="활성여부">
            <label className="inline-flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set('is_active', e.target.checked)}
                className="w-4 h-4 accent-brand-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">활성</span>
            </label>
          </Row>
        )}
      </Section>

      {/* 정산 계좌 */}
      <Section title="정산 계좌">
        <Row label="은행명">
          <input type="text" value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} className={inputCls} />
        </Row>
        <Row label="계좌번호">
          <input type="text" value={form.bank_account} onChange={(e) => set('bank_account', e.target.value)} className={inputLong} />
        </Row>
        <Row label="예금주">
          <input type="text" value={form.account_holder} onChange={(e) => set('account_holder', e.target.value)} className={inputCls} />
        </Row>
      </Section>

      {/* 주민번호 — 슈퍼관리자 전용 */}
      <SuperOnlySection
        title="🔒 주민등록번호 (슈퍼관리자 전용)"
        subtitle="원천징수·지급 증빙용. 일반관리자에게는 이 영역이 보이지 않습니다."
      >
        <div className="space-y-2">
          <div className="text-xs text-gray-600 dark:text-gray-300">
            현재 등록 상태:{' '}
            {p?.has_rrn ? (
              <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{p.rrn_masked ?? '등록됨'}</span>
            ) : (
              <span className="text-rose-600 font-medium">미등록</span>
            )}
            {p?.has_rrn && <span className="ml-2 text-[11px] text-amber-700">재입력 시 덮어씁니다.</span>}
          </div>
          <input
            type="text"
            value={form.rrn}
            onChange={(e) => set('rrn', e.target.value.replace(/[^0-9-]/g, ''))}
            placeholder={p?.has_rrn ? '변경 시에만 입력' : '주민번호 입력 (예: 9012311234567)'}
            maxLength={14}
            className={`${inputLong} font-mono`}
          />
          <div className="text-[11px] text-gray-400">입력하지 않으면 기존 값이 유지됩니다.</div>
        </div>
      </SuperOnlySection>

      {/* 메모 */}
      <Section title="메모" cols={1}>
        <textarea
          value={form.memo}
          onChange={(e) => set('memo', e.target.value)}
          rows={3}
          className={`${inputBase} w-full max-w-[600px]`}
          placeholder="내부 메모"
        />
      </Section>

      {/* ─── 정산 섹션 (수정 모드만) ─── */}
      {!isNew && detail && (
        <>
          {/* 미정산 기대수익 + 정산 배치 생성 */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-brand-600" />
              <div>
                <div className="text-xs text-gray-500">미정산 기대수익</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {num(unsettledExpected)}원
                </div>
              </div>
            </div>
            <button
              onClick={onSettle}
              disabled={settling || unsettledExpected <= 0}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
            >
              {settling ? '생성 중...' : '정산 배치 생성'}
            </button>
          </div>

          {!detail.promoter.has_rrn && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs inline-flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              주민번호 미등록 상태입니다. 지급완료 처리를 하려면 먼저 주민번호를 등록하세요.
            </div>
          )}

          {/* 정산 배치 목록 */}
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 px-1">정산 배치 내역</h2>
            <TableShell>
              <THead>
                <Th align="right">ID</Th>
                <Th align="right">총적립(원)</Th>
                <Th align="right">원천징수(원)</Th>
                <Th align="right">실지급액(원)</Th>
                <Th align="center">상태</Th>
                <Th align="left">생성일</Th>
                <Th align="left">지급일</Th>
                <Th align="center">작업</Th>
              </THead>
              <TBody>
                {detail.settlements.length === 0 ? (
                  <EmptyRow colSpan={8} />
                ) : (
                  detail.settlements.map((s) => (
                    <Tr key={s.id}>
                      <Td align="right" className="text-gray-400 tabular-nums">{s.id}</Td>
                      <Td align="right"><NumCell value={s.total_reward} /></Td>
                      <Td align="right"><NumCell value={s.withholding} /></Td>
                      <Td align="right"><NumCell value={s.paid_amount} bold /></Td>
                      <Td align="center"><SettlementStatus status={s.status} /></Td>
                      <Td align="left" className="text-xs text-gray-500 tabular-nums">{fmtDate(s.created_at)}</Td>
                      <Td align="left" className="text-xs text-gray-500 tabular-nums">{s.paid_at ? fmtDate(s.paid_at) : '-'}</Td>
                      <Td align="center">
                        {s.status === 'calculated' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => onMarkPaid(s.id)}
                              disabled={!detail.promoter.has_rrn}
                              title={detail.promoter.has_rrn ? undefined : '주민번호 등록 필요'}
                              className="px-2 py-1 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              지급완료
                            </button>
                            <button
                              onClick={() => onVoid(s.id)}
                              className="px-2 py-1 text-xs rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50"
                            >
                              무효화
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </TableShell>
          </div>

          {/* 최근 적립 내역 */}
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 px-1">최근 적립 내역</h2>
            <TableShell>
              <THead>
                <Th align="right">ID</Th>
                <Th align="left">회원</Th>
                <Th align="left">구분</Th>
                <Th align="right">사용액(원)</Th>
                <Th align="right">적립액(원)</Th>
                <Th align="center">상태</Th>
                <Th align="left">일시</Th>
              </THead>
              <TBody>
                {detail.rewards.length === 0 ? (
                  <EmptyRow colSpan={7} />
                ) : (
                  detail.rewards.map((r) => (
                    <Tr key={r.id}>
                      <Td align="right" className="text-gray-400 tabular-nums">{r.id}</Td>
                      <Td align="left" className="text-gray-700 dark:text-gray-200">{r.member_name ?? '-'}</Td>
                      <Td align="left" className="text-xs text-gray-500">{r.usage_label ?? r.source_table ?? '-'}</Td>
                      <Td align="right"><NumCell value={r.base_paid} /></Td>
                      <Td align="right"><NumCell value={r.reward_amount} bold /></Td>
                      <Td align="center"><RewardStatus reward={r} /></Td>
                      <Td align="left" className="text-xs text-gray-500 tabular-nums">{fmtDate(r.created_at)}</Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </TableShell>
          </div>

          {/* 연결 회원 / 등록일 */}
          {p && (
            <div className="text-xs text-gray-400 px-1">
              코드 <span className="font-mono text-gray-600">{p.code}</span>
              {' · '}전화 <span className="font-mono text-gray-600">{fmtPhone(p.phone)}</span>
              {p.member_id ? <> {' · '}연결 회원 #{p.member_id}</> : null}
              {' · '}등록일 {fmtDate(p.created_at)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── 모집인 상태 뱃지 (자가 신청 라이프사이클) ─────────────────────────────────────
function PromoterStatusBadge({ status }: { status: PromoterStatus }) {
  if (status === 'pending') return <Badge color="amber">승인 대기</Badge>
  if (status === 'rejected') return <Badge color="gray">반려</Badge>
  return <Badge color="emerald">활성</Badge>
}

// ─── 정산/적립 상태 뱃지 ─────────────────────────────────────
function SettlementStatus({ status }: { status: string }) {
  if (status === 'paid') return <Badge color="emerald">지급완료</Badge>
  if (status === 'calculated') return <Badge color="amber">정산대기</Badge>
  if (status === 'void') return <Badge color="gray">무효</Badge>
  return <Badge color="gray">{status}</Badge>
}

function RewardStatus({ reward }: { reward: Reward }) {
  // 실제 도메인: status 'accrued'|'voided' + settlement_id(정산배치에 묶이면 채워짐)
  if (reward.status === 'voided') return <Badge color="gray">무효</Badge>
  if (reward.settlement_id) return <Badge color="emerald">정산됨</Badge>
  if (reward.status === 'accrued') return <Badge color="amber">미정산</Badge>
  return <Badge color="gray">{reward.status}</Badge>
}

// ─── 폼 헬퍼 (CustomerForm 패턴) ─────────────────────────────────────
const inputBase =
  'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-gray-50 disabled:text-gray-500'
const inputCls = `w-full max-w-[200px] ${inputBase}`
const inputLong = `w-full max-w-[400px] ${inputBase}`

function formatPhone(s: string): string {
  const d = s.replace(/[^0-9]/g, '').slice(0, 11)
  if (!d) return ''
  if (d.startsWith('02')) {
    if (d.length <= 2) return d
    if (d.length <= 5) return `02-${d.slice(2)}`
    if (d.length <= 9) return `02-${d.slice(2, 5)}-${d.slice(5)}`
    return `02-${d.slice(2, 6)}-${d.slice(6)}`
  }
  if (d.startsWith('01') && d.length >= 4) {
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }
  if (d.startsWith('0') && d.length >= 4) {
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
    if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }
  return d
}

function Section({ title, children, cols = 4 }: { title: string; children: React.ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  const inner = cols === 1 ? 'p-4 space-y-3' : 'p-4 flex flex-wrap gap-x-5 gap-y-3'
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </div>
      <div className={inner}>{children}</div>
    </div>
  )
}

function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[90px_auto] gap-1.5 md:gap-2 items-start">
      <div className="md:pt-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}
