import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ReferenceLine, ComposedChart, LabelList,
} from 'recharts'

/**
 * [2026-05-24] 슈퍼관리자 순이익 시뮬레이터 — 트레이딩 대시보드 컨셉.
 *
 * 1920px 기준 한 화면 압축 레이아웃:
 *  - 상단 입력 (압축 2~3줄)
 *  - 결과 그리드 (3 컬럼 × 3 행) — 한 화면에 모두 노출
 *
 * 정책:
 *  - 등급률은 시뮬에 저장 X (DB 원본 fresh 로드 + 리셋만)
 *  - 다른 변수는 사장님이 저장 가능
 *  - 모든 입력 옆 (초기: XXX) — 변경 폭 즉시 인지
 */

const GRADES = ['preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5'] as const
const GRADE_LABEL: Record<string, string> = {
  preliminary: '예비', partner1: 'P1', partner2: 'P2', partner3: 'P3', partner4: 'P4', partner5: 'P5',
}

const DEFAULT_M2NET = {
  monthly_fee: 700000,
  telecom_rate: 10,
  phone_call_rate: 5,
  counselor_free_count: 10,
  counselor_extra_fee: 20000,
}

interface OperatingCost { id: string; name: string; amount: number }

interface ApiResp {
  config: {
    m2net?: Partial<typeof DEFAULT_M2NET>
    scenario?: { counselor_count?: number }
    grade_dist?: Record<string, number>
    grade_hours?: Record<string, number>
    operating_costs?: OperatingCost[]
    ltv?: { avg_charge_per_member?: number; avg_recharge_count?: number; avg_active_months?: number }
    ad_roi?: { monthly_budget?: number; cost_per_acquisition?: number }
    monthly_revenues?: number[]
    growth_rate?: number
    scenarios?: Record<'conservative' | 'normal' | 'optimistic', ScenarioSlot | null>
  }
  db_grade_rates: Record<string, number>
  db_grade_unit_costs: Record<string, number>
  db_grade_dist: Record<string, number>
  stats: {
    total_members: number
    active_counselors: number
    last_month_revenue: number
    last_month_profit_est: number
  }
}

interface InsightsResp {
  ltv: { avg_charge_per_member: number; avg_recharge_count: number; avg_active_months: number; ltv_estimate: number }
  risk: { top_counselor_share_pct: number; top_counselor_count_at_risk: number; new_member_delta_pct: number; dormant_rate_pct: number }
  monthly_history: Array<{ month: string; revenue: number }>
  kpi?: { this_month_revenue: number; last_month_revenue: number; revenue_change_pct: number; active_members_30d: number; new_members_this_month: number }
  season?: { by_dow: Array<{ dow: number; label: string; revenue: number; count: number }>; best_dow: { label: string; revenue: number }; worst_dow: { label: string; revenue: number } }
}

interface ScenarioSlot {
  name: string; revenue: number; counselor_count: number; avg_grade_rate: number; op_total: number; saved_at?: string
}

const fmt = (n: number) => Math.round(n).toLocaleString()
const fmtM = (n: number) => Math.round(n / 10000).toLocaleString() + '만'  // 만원 단위

export default function ProfitSimulator() {
  const { admin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const [dbRates, setDbRates] = useState<Record<string, number>>({})
  const [dbDist, setDbDist] = useState<Record<string, number>>({})
  const [stats, setStats] = useState<ApiResp['stats']>({
    total_members: 0, active_counselors: 0, last_month_revenue: 0, last_month_profit_est: 0,
  })

  const [m2net, setM2net] = useState({ ...DEFAULT_M2NET })
  const [gradeDist, setGradeDist] = useState<Record<string, number>>({})
  const [gradeHours, setGradeHours] = useState<Record<string, number>>({})  // 등급별 월평균 상담시간(h)
  const [gradeUnitCosts, setGradeUnitCosts] = useState<Record<string, number>>({})  // DB 자동 단가
  const [operatingCosts, setOperatingCosts] = useState<OperatingCost[]>([])
  const [simRates, setSimRates] = useState<Record<string, number>>({})
  const [insights, setInsights] = useState<InsightsResp | null>(null)
  const [ltvInput, setLtvInput] = useState({ avg_charge_per_member: 0, avg_recharge_count: 0, avg_active_months: 0 })
  const [adInput, setAdInput] = useState({ monthly_budget: 0, cost_per_acquisition: 0 })
  const [monthlyRevenues, setMonthlyRevenues] = useState<number[]>(Array(12).fill(0))
  const [scenarios, setScenarios] = useState<Record<'conservative' | 'normal' | 'optimistic', ScenarioSlot | null>>({
    conservative: null, normal: null, optimistic: null,
  })

  // 상담사 수 = 등급별 인원의 자동 합산
  const counselorCount = useMemo(
    () => GRADES.reduce((s, g) => s + (gradeDist[g] ?? 0), 0),
    [gradeDist]
  )

  // 총 매출 자동 계산 = Σ (인원 × 시간(h) × 120 × 단가) — 사장님 입력 X
  const revenue = useMemo(() => {
    let r = 0
    for (const g of GRADES) {
      r += (gradeDist[g] ?? 0) * (gradeHours[g] ?? 0) * 120 * (gradeUnitCosts[g] ?? 0)
    }
    return r
  }, [gradeDist, gradeHours, gradeUnitCosts])

  // 등급별 매출 비중 = (인원 × 시간) / Σ(인원 × 시간) — 시간 가중치
  const gradeShare = useMemo(() => {
    const out: Record<string, number> = {}
    const workSum = GRADES.reduce((s, g) => s + (gradeDist[g] ?? 0) * (gradeHours[g] ?? 0), 0)
    for (const g of GRADES) {
      out[g] = workSum > 0 ? ((gradeDist[g] ?? 0) * (gradeHours[g] ?? 0)) / workSum * 100 : 0
    }
    return out
  }, [gradeDist, gradeHours])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    api<ApiResp>('/admin/profit-sim')
      .then((r) => {
        if (!mounted) return
        setDbRates(r.db_grade_rates); setDbDist(r.db_grade_dist); setStats(r.stats)
        setSimRates({ ...r.db_grade_rates })
        setGradeUnitCosts({ ...r.db_grade_unit_costs })  // DB 자동 단가 (수정 X)
        const c = r.config ?? {}
        setM2net({ ...DEFAULT_M2NET, ...(c.m2net ?? {}) })
        setGradeDist(c.grade_dist ?? { ...r.db_grade_dist })
        // 등급별 월평균 시간 — 사주나루 평균 60~80h 참고, 기본 70h
        const defaultHours: Record<string, number> = {}
        for (const g of GRADES) defaultHours[g] = 70
        setGradeHours(c.grade_hours ?? defaultHours)
        setOperatingCosts(c.operating_costs ?? [
          { id: 'human', name: '인건비', amount: 25_000_000 },
          { id: 'rent', name: '임대료', amount: 3_000_000 },
          { id: 'marketing', name: '영업/마케팅', amount: 5_000_000 },
          { id: 'server', name: '서버/호스팅', amount: 500_000 },
        ])
        setLtvInput({
          avg_charge_per_member: c.ltv?.avg_charge_per_member ?? 0,
          avg_recharge_count: c.ltv?.avg_recharge_count ?? 0,
          avg_active_months: c.ltv?.avg_active_months ?? 0,
        })
        setAdInput({ monthly_budget: c.ad_roi?.monthly_budget ?? 5_000_000, cost_per_acquisition: c.ad_roi?.cost_per_acquisition ?? 50_000 })
        setMonthlyRevenues(c.monthly_revenues ?? Array(12).fill(c.scenario?.revenue ?? 400_000_000))
        if (c.scenarios) setScenarios(c.scenarios)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '로드 실패'))
      .finally(() => mounted && setLoading(false))

    api<InsightsResp>('/admin/profit-sim/insights')
      .then((r) => mounted && setInsights(r))
      .catch(() => {})

    return () => { mounted = false }
  }, [])

  const calc = useMemo(() => {
    // 등급별 매출 + 시간 가중평균 정산률
    const gradeRevenues: Record<string, number> = {}
    let workSum = 0
    let weightedRateSum = 0
    for (const g of GRADES) {
      const cnt = gradeDist[g] ?? 0
      const hrs = gradeHours[g] ?? 0
      const unit = gradeUnitCosts[g] ?? 0
      gradeRevenues[g] = cnt * hrs * 120 * unit
      const work = cnt * hrs
      workSum += work
      weightedRateSum += work * (simRates[g] ?? 0)
    }
    const avgRate = workSum > 0 ? weightedRateSum / workSum : 0

    const telecomCost = revenue * (m2net.telecom_rate / 100)
    const phoneCallCost = revenue * (m2net.phone_call_rate / 100)
    const counselorExtra = Math.max(0, counselorCount - m2net.counselor_free_count) * m2net.counselor_extra_fee
    const m2netTotal = telecomCost + m2net.monthly_fee + phoneCallCost + counselorExtra
    const m2netRefund = revenue - m2netTotal

    // 상담사 분배 = Σ (등급별 매출 × 등급별 정산률)
    let counselorPay = 0
    for (const g of GRADES) counselorPay += (gradeRevenues[g] ?? 0) * ((simRates[g] ?? 0) / 100)

    const operatingTotal = operatingCosts.reduce((a, b) => a + (Number(b.amount) || 0), 0)
    const profit = m2netRefund - counselorPay - operatingTotal
    const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0

    // BEP — 변동/고정 분리
    const fixed = m2net.monthly_fee + counselorExtra + operatingTotal
    const variableShare = revenue > 0
      ? (telecomCost + phoneCallCost + counselorPay) / revenue
      : 0
    const bep = (1 - variableShare) > 0.001 ? fixed / (1 - variableShare) : null

    return { gradeRevenues, telecomCost, phoneCallCost, counselorExtra, m2netTotal, m2netRefund, counselorPay, operatingTotal, profit, profitRate, bep, avgRate }
  }, [revenue, counselorCount, m2net, gradeDist, gradeHours, gradeUnitCosts, simRates, operatingCosts])

  // ⑨ 나의 목표 — 시작인원 → 목표인원 선형 증가, 매월 매출/영업이익 자동 계산
  const [goalStart, setGoalStart] = useState(50)
  const [goalEnd, setGoalEnd] = useState(500)
  const [goalStartMonth, setGoalStartMonth] = useState(new Date().getMonth() + 1)
  const [goalEndMonth, setGoalEndMonth] = useState(12)

  const goalRoadmap = useMemo(() => {
    const data: Array<{ month: string; count: number; revenue: number; profit: number; cumProfit: number }> = []
    const sM = Math.max(1, Math.min(12, goalStartMonth))
    const eM = Math.max(sM, Math.min(12, goalEndMonth))
    const numMonths = eM - sM + 1
    let cumProfit = 0
    for (let i = 0; i < numMonths; i++) {
      const N = numMonths > 1
        ? goalStart + ((goalEnd - goalStart) * i) / (numMonths - 1)
        : goalStart
      let scaledRev = 0
      let scaledPay = 0
      if (counselorCount > 0) {
        const scale = N / counselorCount
        for (const g of GRADES) {
          const scaledCount = (gradeDist[g] ?? 0) * scale
          const r = scaledCount * (gradeHours[g] ?? 0) * 120 * (gradeUnitCosts[g] ?? 0)
          scaledRev += r
          scaledPay += r * ((simRates[g] ?? 0) / 100)
        }
      }
      const tel = scaledRev * (m2net.telecom_rate / 100)
      const pho = scaledRev * (m2net.phone_call_rate / 100)
      const extra = Math.max(0, N - m2net.counselor_free_count) * m2net.counselor_extra_fee
      const profit = scaledRev - tel - pho - m2net.monthly_fee - extra - scaledPay - calc.operatingTotal
      cumProfit += profit
      data.push({
        month: `${sM + i}월`,
        count: Math.round(N),
        revenue: Number((scaledRev / 100_000_000).toFixed(2)),
        profit: Number((profit / 100_000_000).toFixed(2)),
        cumProfit: Number((cumProfit / 100_000_000).toFixed(2)),
      })
    }
    return data
  }, [goalStart, goalEnd, goalStartMonth, goalEndMonth, counselorCount, gradeDist, gradeHours, gradeUnitCosts, simRates, m2net, calc.operatingTotal])

  // ⑤ 규모 확장 시나리오 — 현재 등급 비율 유지하며 인원만 50~500 스케일
  const scaleScenarios = useMemo(() => {
    const COUNTS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]
    return COUNTS.map((N) => {
      if (counselorCount === 0) return { n: N, revenue: 0, profit: 0, profitRate: 0 }
      const scale = N / counselorCount
      let scaledRev = 0
      let scaledPay = 0
      for (const g of GRADES) {
        const scaledCount = (gradeDist[g] ?? 0) * scale
        const r = scaledCount * (gradeHours[g] ?? 0) * 120 * (gradeUnitCosts[g] ?? 0)
        scaledRev += r
        scaledPay += r * ((simRates[g] ?? 0) / 100)
      }
      const tel = scaledRev * (m2net.telecom_rate / 100)
      const pho = scaledRev * (m2net.phone_call_rate / 100)
      const extra = Math.max(0, N - m2net.counselor_free_count) * m2net.counselor_extra_fee
      const profit = scaledRev - tel - pho - m2net.monthly_fee - extra - scaledPay - calc.operatingTotal
      const profitRate = scaledRev > 0 ? (profit / scaledRev) * 100 : 0
      return { n: N, revenue: scaledRev, profit, profitRate }
    })
  }, [counselorCount, gradeDist, gradeHours, gradeUnitCosts, simRates, m2net, calc.operatingTotal])

  const sensitivity = useMemo(() => {
    const calcProfit = (override: { telecom?: number; phone?: number; m2net_fee?: number; share_rate?: number; op_delta?: number }) => {
      const telecomR = override.telecom ?? m2net.telecom_rate
      const phoneR = override.phone ?? m2net.phone_call_rate
      const fee = override.m2net_fee ?? m2net.monthly_fee
      const shareR = override.share_rate ?? 0
      const op = calc.operatingTotal + (override.op_delta ?? 0)
      const refund = revenue - (revenue * telecomR / 100) - fee - (revenue * phoneR / 100) - calc.counselorExtra
      let csrPay = 0
      for (const g of GRADES) csrPay += revenue * ((gradeShare[g] ?? 0) / 100) * ((simRates[g] ?? 0) + shareR) / 100
      return refund - csrPay - op
    }
    const base = calc.profit
    return [
      { label: '통신사 -1%P', delta: calcProfit({ telecom: m2net.telecom_rate - 1 }) - base },
      { label: '통신료 -1%P', delta: calcProfit({ phone: m2net.phone_call_rate - 1 }) - base },
      { label: 'm2net월 -10만', delta: calcProfit({ m2net_fee: m2net.monthly_fee - 100_000 }) - base },
      { label: '정산률 -1%P', delta: calcProfit({ share_rate: -1 }) - base },
      { label: '운영비 -100만', delta: calcProfit({ op_delta: -1_000_000 }) - base },
    ].sort((a, b) => b.delta - a.delta)
  }, [calc, revenue, m2net, gradeShare, simRates])

  const monthlyResults = useMemo(() => {
    return monthlyRevenues.map((mRev, i) => {
      const tel = mRev * (m2net.telecom_rate / 100); const pho = mRev * (m2net.phone_call_rate / 100)
      const extra = Math.max(0, counselorCount - m2net.counselor_free_count) * m2net.counselor_extra_fee
      const refund = mRev - tel - m2net.monthly_fee - pho - extra
      let csrPay = 0
      for (const g of GRADES) csrPay += mRev * ((gradeShare[g] ?? 0) / 100) * ((simRates[g] ?? 0) / 100)
      const profit = refund - csrPay - calc.operatingTotal
      return { month: `${i + 1}월`, 매출: Math.round(mRev / 10000), 순이익: Math.round(profit / 10000) }
    })
  }, [monthlyRevenues, m2net, counselorCount, gradeShare, simRates, calc.operatingTotal])

  const ltvCalc = useMemo(() => {
    const charge = ltvInput.avg_charge_per_member > 0 ? ltvInput.avg_charge_per_member : (insights?.ltv.avg_charge_per_member ?? 0)
    const recharge = ltvInput.avg_recharge_count > 0 ? ltvInput.avg_recharge_count : (insights?.ltv.avg_recharge_count ?? 1)
    const ltv = charge * recharge
    const newMembers = adInput.cost_per_acquisition > 0 ? Math.floor(adInput.monthly_budget / adInput.cost_per_acquisition) : 0
    const revenueGain = newMembers * ltv
    const roi = adInput.monthly_budget > 0 ? ((revenueGain - adInput.monthly_budget) / adInput.monthly_budget) * 100 : 0
    return { charge, recharge, ltv, newMembers, revenueGain, roi }
  }, [ltvInput, adInput, insights])

  const handleSave = async () => {
    setSaving(true); setError(null); setOkMsg(null)
    try {
      await api('/admin/profit-sim', {
        method: 'PUT',
        body: JSON.stringify({
          data: {
            m2net,
            scenario: { counselor_count: counselorCount },
            grade_dist: gradeDist, grade_hours: gradeHours, operating_costs: operatingCosts,
            ltv: ltvInput, ad_roi: adInput, monthly_revenues: monthlyRevenues, scenarios,
          },
        }),
      })
      setOkMsg('저장 ✅'); setTimeout(() => setOkMsg(null), 2000)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '저장 실패')
    } finally { setSaving(false) }
  }

  const resetAllRates = () => setSimRates({ ...dbRates })
  const addOpCost = () => setOperatingCosts([...operatingCosts, { id: `c_${Date.now()}`, name: '', amount: 0 }])
  const removeOpCost = (id: string) => setOperatingCosts(operatingCosts.filter((c) => c.id !== id))
  const updateOpCost = (id: string, patch: Partial<OperatingCost>) =>
    setOperatingCosts(operatingCosts.map((c) => c.id === id ? { ...c, ...patch } : c))

  const saveScenario = (key: 'conservative' | 'normal' | 'optimistic', label: string) => {
    setScenarios({ ...scenarios, [key]: { name: label, revenue, counselor_count: counselorCount, avg_grade_rate: Math.round(calc.avgRate * 10) / 10, op_total: calc.operatingTotal, saved_at: new Date().toISOString() } })
  }

  const scenarioResults = useMemo(() => {
    const calcFromSnap = (s: ScenarioSlot) => {
      const tel = s.revenue * (m2net.telecom_rate / 100); const pho = s.revenue * (m2net.phone_call_rate / 100)
      const extra = Math.max(0, s.counselor_count - m2net.counselor_free_count) * m2net.counselor_extra_fee
      const refund = s.revenue - tel - m2net.monthly_fee - pho - extra
      const csrPay = s.revenue * (s.avg_grade_rate / 100)
      const profit = refund - csrPay - s.op_total
      const rate = s.revenue > 0 ? (profit / s.revenue) * 100 : 0
      return { profit, rate }
    }
    return {
      conservative: scenarios.conservative ? calcFromSnap(scenarios.conservative) : null,
      normal: scenarios.normal ? calcFromSnap(scenarios.normal) : null,
      optimistic: scenarios.optimistic ? calcFromSnap(scenarios.optimistic) : null,
    }
  }, [scenarios, m2net])

  if (admin && !admin.is_super) {
    return <div className="p-8"><p className="text-[13px] text-[#FB2C36]">🔒 슈퍼관리자 전용</p></div>
  }
  if (loading) return <div className="p-6 text-[12px] text-[#6A7282]">불러오는 중...</div>

  return (
    <div className="max-w-[1860px] p-3 space-y-2 text-[13px] text-[#1E2939]">
      {/* ─── 헤더 (1줄, 전부 좌측 정렬) ─── */}
      <header className="flex items-center gap-3 py-1 flex-wrap">
        <h1 className="text-[16px] font-bold text-[#030712]">💰 영업이익 시뮬레이터</h1>
        <button onClick={handleSave} disabled={saving}
          className="h-7 px-3 rounded bg-[#ec4899] text-white text-[13px] font-medium disabled:opacity-60">
          {saving ? '저장중' : '💾 저장'}
        </button>
        {okMsg && <span className="text-[12.5px] text-[#10B981] font-medium">{okMsg}</span>}
        {error && <span className="text-[12.5px] text-[#FB2C36]">{error}</span>}
      </header>

      {/* ─── 상단 입력 영역 + ④ 결과 카드 (나란히 배치) ─── */}
      <div className="flex flex-wrap gap-2 items-start">
      <div className="border border-[#FDE68A] rounded-md p-2 bg-[#FFFBEB] space-y-1.5 w-fit">
        {/* 1줄: 시나리오 입력 (매출/인원/성장률) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <div className="flex items-center gap-1">
            <span className="text-[12px] text-[#6A7282]">월 매출</span>
            <span className="text-[14px] font-bold text-[#ec4899] tabular-nums">{Math.round(revenue / 10000).toLocaleString()}</span>
            <span className="text-[10.5px] text-[#99A1AF]">만 (자동)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[12px] text-[#6A7282]">상담사</span>
            <span className="text-[13px] font-semibold text-[#030712] tabular-nums">{counselorCount}</span>
            <span className="text-[10.5px] text-[#99A1AF]">명 (등급합)</span>
          </div>
          <Divider />
          <FieldInline label="m2net 월료" value={m2net.monthly_fee} initial={DEFAULT_M2NET.monthly_fee} onChange={(v) => setM2net({ ...m2net, monthly_fee: v })} muted manUnit />
          <FieldInline label="통신사" value={m2net.telecom_rate} initial={DEFAULT_M2NET.telecom_rate} onChange={(v) => setM2net({ ...m2net, telecom_rate: v })} unit="%" small muted />
          <FieldInline label="통신료" value={m2net.phone_call_rate} initial={DEFAULT_M2NET.phone_call_rate} onChange={(v) => setM2net({ ...m2net, phone_call_rate: v })} unit="%" small muted />
          <FieldInline label="무료인원" value={m2net.counselor_free_count} initial={DEFAULT_M2NET.counselor_free_count} onChange={(v) => setM2net({ ...m2net, counselor_free_count: v })} unit="명" small muted />
          <FieldInline label="추가료" value={m2net.counselor_extra_fee} initial={DEFAULT_M2NET.counselor_extra_fee} onChange={(v) => setM2net({ ...m2net, counselor_extra_fee: v })} muted manUnit />
        </div>

        {/* 등급별 입력 — 세로 정렬 표 (등급 = 컬럼, 정산률/인원/매출% = 행)
            각 등급의 정보가 한 컬럼에 모여 기여도 한눈에 비교 가능. */}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[12px] font-semibold text-[#4A5565]">③ 등급별 입력 (월 기준)</span>
          <span className="text-[10.5px] text-[#99A1AF]">※ 월시간 = 1인당 월평균 상담시간</span>
        </div>
        <div className="inline-grid grid-cols-[64px_repeat(6,68px)_auto] gap-x-2 gap-y-1 items-center text-[12.5px] w-fit">
          {/* 헤더 행 — 등급 라벨 */}
          <span></span>
          {GRADES.map((g) => (
            <span key={g} className="text-[11.5px] font-semibold text-[#4A5565] text-center">{GRADE_LABEL[g]}</span>
          ))}
          <span></span>

          {/* 인원 행 — 핑크 테두리로 강조 (영업이익 박스와 동일 스타일, 사장님이 가장 자주 만지는 핵심 변수) */}
          <span className="text-[12.5px] font-bold text-[#ec4899]">인원(명)</span>
          {GRADES.map((g) => (
            <input key={g} type="number" value={gradeDist[g] ?? 0}
              onChange={(e) => setGradeDist({ ...gradeDist, [g]: Number(e.target.value) || 0 })}
              title={`DB: ${dbDist[g] ?? 0}명`}
              className="w-[60px] h-7 px-1 border-2 border-[#ec4899] bg-white rounded text-[13px] font-bold text-right tabular-nums focus:outline-none shadow-sm mx-auto" />
          ))}
          <div className="flex items-center gap-2 pl-2 text-[11px] text-[#4A5565]">
            합 <span className="text-[14px] font-bold text-[#ec4899] tabular-nums">{counselorCount}</span>명
          </div>

          {/* 정산률 행 */}
          <span className="text-[12px] font-medium text-[#4A5565]">정산률(%)</span>
          {GRADES.map((g) => (
            <div key={g} className="flex flex-col items-center">
              <input type="number" step="0.1"
                value={parseFloat((simRates[g] ?? 0).toFixed(2))}
                onChange={(e) => setSimRates({ ...simRates, [g]: Number(e.target.value) || 0 })}
                className={[
                  'w-[60px] h-6 px-1 border rounded text-[12.5px] text-right tabular-nums focus:outline-none focus:border-[#ec4899]',
                  (simRates[g] ?? 0) !== (dbRates[g] ?? 0)
                    ? 'border-[#ec4899] bg-[#fdf2f8]'
                    : 'border-[#E5E7EB] bg-white',
                ].join(' ')}
              />
              <span className="text-[9px] text-[#99A1AF]">DB:{(dbRates[g] ?? 0).toFixed(0)}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pl-2">
            <button onClick={resetAllRates}
              className="h-6 px-2 rounded border border-[#E5E7EB] text-[11px] text-[#6A7282] hover:border-[#ec4899] hover:text-[#ec4899]">
              🔄 DB원본
            </button>
            <span className="text-[11px] text-[#4A5565]">평균</span>
            <span className="text-[12.5px] font-bold text-[#ec4899] tabular-nums">{calc.avgRate.toFixed(2)}%</span>
          </div>

          {/* 월평균시간 행 — 사주나루 기준 60~80h, 기본 70h */}
          <span className="text-[12px] font-medium text-[#4A5565]" title="등급별 1인당 월평균 상담시간 (시간)">
            월시간(h/인)
          </span>
          {GRADES.map((g) => (
            <input key={g} type="number" value={gradeHours[g] ?? 0}
              onChange={(e) => setGradeHours({ ...gradeHours, [g]: Number(e.target.value) || 0 })}
              title={`${GRADE_LABEL[g]} 1인당 월평균 상담시간 (h) · 단가: ${gradeUnitCosts[g] ?? 0}원`}
              className="w-[60px] h-6 px-1 border border-[#E5E7EB] bg-white rounded text-[12.5px] text-right tabular-nums focus:outline-none focus:border-[#ec4899] mx-auto" />
          ))}
          <div className="flex items-center gap-2 pl-2 text-[11px] text-[#4A5565]">
            <span className="text-[10px] text-[#99A1AF]" title="등급별 단가 평균 (원/30초)">단가: DB자동</span>
          </div>

          {/* 매출 행 — 자동 계산, 수정 불가 */}
          <span className="text-[12px] font-medium text-[#4A5565]">매출(만)</span>
          {GRADES.map((g) => (
            <div key={g} className="flex flex-col items-center">
              <span className="text-[12px] font-medium text-[#ec4899] tabular-nums">
                {Math.round((calc.gradeRevenues[g] ?? 0) / 10000).toLocaleString()}
              </span>
              <span className="text-[9px] text-[#99A1AF]">{(gradeShare[g] ?? 0).toFixed(1)}%</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pl-2 text-[11px] text-[#4A5565]">
            합 <span className="text-[12.5px] font-bold text-[#ec4899] tabular-nums">{Math.round(revenue / 10000).toLocaleString()}</span>만
          </div>

          {/* 회사몫 행 — 매출 × (1 − 통신사% − 통신료% − 정산률). % 가 메인(등급별 수익성), 액수는 보조 */}
          <span className="text-[12px] font-medium text-[#4A5565]" title="매출 × (1 − 통신사% − 통신료% − 정산률)">회사몫</span>
          {GRADES.map((g) => {
            const rev = calc.gradeRevenues[g] ?? 0
            const marginRate = 1 - (m2net.telecom_rate + m2net.phone_call_rate + (simRates[g] ?? 0)) / 100
            const margin = rev * marginRate
            return (
              <div key={g} className="flex flex-col items-center">
                <span className="text-[13px] font-bold text-[#8259F5] tabular-nums">{(marginRate * 100).toFixed(0)}%</span>
                <span className="text-[10px] text-[#99A1AF] tabular-nums">{Math.round(margin / 10000).toLocaleString()}만</span>
              </div>
            )
          })}
          <div className="flex items-center gap-2 pl-2 text-[#4A5565] whitespace-nowrap">
            <span className="text-[11.5px]">합 <span className="text-[15px] font-bold text-[#8259F5] tabular-nums">
              {Math.round(GRADES.reduce((s, g) => {
                const rev = calc.gradeRevenues[g] ?? 0
                const mr = 1 - (m2net.telecom_rate + m2net.phone_call_rate + (simRates[g] ?? 0)) / 100
                return s + rev * mr
              }, 0) / 10000).toLocaleString()}</span><span className="text-[12px] font-medium text-[#8259F5]">만</span></span>
            <span className="text-[#D1D5DB]">│</span>
            <span className="text-[11.5px]">상담마진</span>
            {(() => {
              const consultMargin = calc.profit + calc.operatingTotal
              const consultMarginRate = revenue > 0 ? (consultMargin / revenue) * 100 : 0
              return (
                <span className={['text-[18px] font-extrabold tabular-nums leading-none', consultMargin >= 0 ? 'text-[#ec4899]' : 'text-[#FB2C36]'].join(' ')} title={`상담마진 ${Math.round(consultMargin / 10000).toLocaleString()}만원 / 매출 ${Math.round(revenue / 10000).toLocaleString()}만원 (운영비 차감 전, 매출총이익 개념)`}>
                  {consultMarginRate.toFixed(1)}%
                </span>
              )
            })()}
          </div>
        </div>

        {/* 4줄: 운영비 (인라인 리스트) — 거의 안 바뀌는 값이라 흰색 톤다운, 만원 단위, 박스 폭 최소화 */}
        <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
          <span className="text-[12px] font-medium text-[#4A5565]">운영비(만)</span>
          {operatingCosts.map((c) => (
            <div key={c.id} className="inline-flex items-center bg-white border border-[#E5E7EB] rounded px-1 h-6">
              <input type="text" placeholder="항목"
                value={c.name}
                onChange={(e) => updateOpCost(c.id, { name: e.target.value })}
                className="w-[60px] h-5 px-0.5 text-[12px] bg-transparent border-none focus:outline-none" />
              <input type="text" inputMode="numeric"
                value={Math.round(c.amount / 10000).toLocaleString()}
                onChange={(e) => updateOpCost(c.id, { amount: (Number(e.target.value.replace(/,/g, '')) || 0) * 10000 })}
                className="w-[40px] h-5 px-0.5 text-[12px] bg-transparent border-none focus:outline-none text-right tabular-nums" />
              <button onClick={() => removeOpCost(c.id)} className="text-[10px] text-[#FB2C36] hover:text-[#991B1B] ml-0.5">✕</button>
            </div>
          ))}
          <button onClick={addOpCost}
            className="h-6 px-2 rounded bg-[#fdf2f8] text-[#ec4899] text-[12px] border border-[#fbcfe8]">
            + 추가
          </button>
          <div className="text-[12px] text-[#6A7282]">
            합계 <span className="font-bold text-[#030712] text-[13px]">{Math.round(calc.operatingTotal / 10000).toLocaleString()}만원</span>
          </div>
        </div>

        {/* 5줄: 영업이익 — 운영비 차감 후 (회계 표준, m2net사장과 같은 정의). 화면 최종 결론 — 핑크 테두리로 강조. */}
        <div className="inline-flex items-center gap-2 mt-1 px-3 py-2 bg-white border-2 border-[#ec4899] rounded-md shadow-sm w-fit">
          <span className="text-[12.5px] text-[#4A5565]">
            상담사 <span className="font-bold text-[#030712]">{counselorCount}</span>명일 경우 예상 월매출 <span className="font-bold text-[#8259F5]">{(revenue / 100_000_000).toFixed(2)}억원</span>이며 <span className="font-bold">영업이익</span>
          </span>
          <span className={['text-[22px] font-extrabold tabular-nums leading-none', calc.profit >= 0 ? 'text-[#ec4899]' : 'text-[#FB2C36]'].join(' ')}>
            {calc.profitRate.toFixed(1)}%
          </span>
          <span className={['text-[22px] font-extrabold tabular-nums leading-none', calc.profit >= 0 ? 'text-[#ec4899]' : 'text-[#FB2C36]'].join(' ')}>
            ({(calc.profit / 100_000_000).toFixed(2)}억원)
          </span>
          <span className="text-[10.5px] text-[#99A1AF] ml-1">= 매출 − m2net비용 − 상담사정산 − 운영비</span>
        </div>
      </div>

      {/* ④ 결과 카드 — 입력 영역 우측에 나란히 배치 */}
      <Card title="④ 결과 (만원)" w="w-fit">
        <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 items-baseline">
          <Row v={revenue} label="매출" bold />
          <Row v={-calc.telecomCost} label="└ 통신사" sub />
          <Row v={-m2net.monthly_fee} label="└ m2net월" sub />
          <Row v={-calc.phoneCallCost} label="└ 통신료" sub />
          <Row v={-calc.counselorExtra} label="└ 추가료" sub />
          <div className="col-span-2 h-px bg-[#F3F4F6] my-1" />
          <Row v={calc.m2netRefund} label="m2net정산" bold />
          <Row v={-calc.counselorPay} label="└ 상담사" sub />
          <Row v={-calc.operatingTotal} label="└ 운영비" sub />
          <div className="col-span-2 h-px bg-[#f472b6] my-1" />
          <span className="text-[13px] font-semibold text-[#030712]">영업이익</span>
          <span className={['text-[17px] font-bold tabular-nums text-right', calc.profit >= 0 ? 'text-[#ec4899]' : 'text-[#FB2C36]'].join(' ')}>
            {Math.round(calc.profit / 10000).toLocaleString()}
          </span>
          <span className="col-span-2 text-[11px] text-[#6A7282] text-right">{calc.profitRate.toFixed(1)}% · BEP {calc.bep ? fmtM(calc.bep) : '-'}</span>
        </div>
      </Card>

      {/* 📋 사주나루 벤치마크 — 경쟁사 정산률 정책 (의사결정 참고용) */}
      <Card title="📋 사주나루 벤치마크 (경쟁사 정책)" w="w-[460px]">
        <div className="space-y-2">
          {/* 정산률 비교 표 */}
          <table className="w-full text-[11.5px] tabular-nums">
            <thead className="bg-[#F9FAFB] text-[#4A5565]">
              <tr>
                <th className="text-left px-1.5 py-1 font-medium">등급</th>
                <th className="text-right px-1.5 py-1 font-medium">사주나루</th>
                <th className="text-right px-1.5 py-1 font-medium">우리</th>
                <th className="text-right px-1.5 py-1 font-medium">차이</th>
                <th className="text-right px-1.5 py-1 font-medium">단가옵션(원/30s)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { g: 'preliminary', label: '일반/예비', sajunaru: 33, options: '800·1000' },
                { g: 'partner1', label: 'P1', sajunaru: 51, options: '800·1000' },
                { g: 'partner2', label: 'P2', sajunaru: 57, options: '1000·1200' },
                { g: 'partner3', label: 'P3', sajunaru: 63, options: '1000~1300' },
                { g: 'partner4', label: 'P4', sajunaru: 67, options: '1000~1500' },
                { g: 'partner5', label: 'P5', sajunaru: 70, options: '1000~1500' },
              ].map((r) => {
                const ours = simRates[r.g] ?? 0
                const diff = ours - r.sajunaru
                const diffColor = diff > 0 ? 'text-[#ec4899]' : diff < 0 ? 'text-[#10B981]' : 'text-[#99A1AF]'
                return (
                  <tr key={r.g} className="border-t border-[#F3F4F6]">
                    <td className="text-left px-1.5 py-0.5 font-medium">{r.label}</td>
                    <td className="text-right px-1.5 py-0.5">{r.sajunaru}%</td>
                    <td className="text-right px-1.5 py-0.5">{ours.toFixed(0)}%</td>
                    <td className={['text-right px-1.5 py-0.5 font-medium', diffColor].join(' ')}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(0)}%p
                    </td>
                    <td className="text-right px-1.5 py-0.5 text-[#6A7282]">{r.options}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* 핵심 인사이트 */}
          <div className="bg-[#fdf2f8] rounded p-2 text-[11.5px] leading-relaxed">
            <div className="font-semibold text-[#831843] mb-0.5">💡 핵심 인사이트</div>
            <div className="text-[#4A5565]">
              사주나루 정산률 적용 시 우리 영업이익률 <span className="font-bold">21.4% → ~25%</span> 상승 예상.<br />
              m2net사장 언급 <span className="font-bold">"약 23%"</span> = 사주나루 기준일 가능성 ↑<br />
              우리가 일반(+7%p), P3·P4(-3~4%p) 등급에서 사주나루와 다름.
            </div>
          </div>

          {/* 활용 우선순위 */}
          <div className="text-[11.5px] leading-relaxed">
            <div className="font-semibold text-[#030712] mb-0.5">🎯 활용 우선순위</div>
            <ol className="text-[#4A5565] space-y-0.5 list-decimal list-inside">
              <li><span className="font-semibold">정산률 재조정</span> → 영업이익 +3~4%p (특히 P3·P4)</li>
              <li><span className="font-semibold">다단계 단가 옵션</span> → 상담사가 자기 단가 선택 (P5 1,000~1,500원 6단계)</li>
              <li><span className="font-semibold">20시간 미만 = 일반등급 폴백</span> → 활동 인센티브 + 회사 마진 보호</li>
              <li><span className="font-semibold">등급 승격 기준</span>: 20/40/80/120/180h 누적 자동 승격</li>
            </ol>
          </div>
        </div>
      </Card>
      </div>

      {/* ─── 결과 영역 — flex flex-wrap, 카드 콘텐츠 폭에 맞춤, 좌측 정렬 ─── */}
      <div className="flex flex-wrap gap-2 items-start">

        {/* [중상] 민감도 — [2026-05-24] -1%P 같은 미세 변화는 사장님이 통제 불가(m2net협상 불가). 인원 확장 시나리오로 대체. */}
        {false && <Card title="⑤ 민감도" w="w-fit">
          <div className="space-y-1">
            {sensitivity.map((s, idx) => (
              <div key={s.label} className={[
                'flex items-center gap-4 px-2 py-1 rounded text-[12.5px]',
                idx === 0 ? 'bg-[#fdf2f8] border border-[#f472b6]' : 'bg-[#F9FAFB]',
              ].join(' ')}>
                <span className="text-[12px] whitespace-nowrap">{idx === 0 && '⭐'} {s.label}</span>
                <span className={['font-bold tabular-nums ml-auto', s.delta >= 0 ? 'text-[#ec4899]' : 'text-[#FB2C36]'].join(' ')}>
                  {s.delta >= 0 ? '+' : ''}{fmtM(s.delta)}
                </span>
              </div>
            ))}
          </div>
        </Card>}

        {/* [우상] 위험 신호 — [2026-05-24] 테스트 단계라 임시 숨김. 1년쯤 운영 후 표본 누적되면 의미 있음. */}
        {false && <Card title="⑧ 위험" w="w-fit" red={!!insights?.risk}>
          {insights?.risk ? (
            <div className="space-y-1">
              <RiskRow label="상위3 점유율" value={`${insights.risk.top_counselor_share_pct.toFixed(1)}%`} warn={insights.risk.top_counselor_share_pct >= 50} />
              <RiskRow label="신규회원 추이" value={`${insights.risk.new_member_delta_pct >= 0 ? '+' : ''}${insights.risk.new_member_delta_pct.toFixed(1)}%`} warn={insights.risk.new_member_delta_pct < -10} />
              <RiskRow label="휴면율" value={`${insights.risk.dormant_rate_pct.toFixed(1)}%`} warn={insights.risk.dormant_rate_pct >= 60} />
              <RiskRow label="의존 상담사" value={`${insights.risk.top_counselor_count_at_risk}명`} warn={insights.risk.top_counselor_count_at_risk <= 3} />
            </div>
          ) : <p className="text-[12px] text-[#99A1AF]">집계 중</p>}
        </Card>}

        {/* [좌중하] LTV / 광고 ROI — [2026-05-24] 테스트 단계라 임시 숨김. 정식 운영 시작 시 false 제거. */}
        {false && <Card title="⑦ LTV / 광고 ROI" w="w-fit">
          <div className="space-y-1 text-[12.5px]">
            <FieldRow label="1회 충전액" value={ltvInput.avg_charge_per_member} initial={insights?.ltv.avg_charge_per_member ?? 0} onChange={(v) => setLtvInput({ ...ltvInput, avg_charge_per_member: v })} unit="원" money />
            <FieldRow label="재충전 횟수" value={ltvInput.avg_recharge_count} initial={insights?.ltv.avg_recharge_count ?? 1} onChange={(v) => setLtvInput({ ...ltvInput, avg_recharge_count: v })} unit="회" />
            <div className="bg-[#fdf2f8] rounded p-1.5 text-center">
              <span className="text-[10px] text-[#6A7282]">LTV </span>
              <span className="text-[14px] font-bold text-[#ec4899]">{fmt(ltvCalc.ltv)}원</span>
              <p className="text-[9.5px] text-[#6A7282] mt-0.5 leading-tight">
                회원 1명이 평생 결제하는 총 금액<br />(1회 충전액 × 평균 재충전 횟수)
              </p>
            </div>
            <Divider2 />
            <FieldRow label="광고비/월" value={adInput.monthly_budget} initial={5_000_000} onChange={(v) => setAdInput({ ...adInput, monthly_budget: v })} unit="원" money />
            <FieldRow label="CAC" value={adInput.cost_per_acquisition} initial={50_000} onChange={(v) => setAdInput({ ...adInput, cost_per_acquisition: v })} unit="원" money />
            <p className="text-[9.5px] text-[#6A7282] text-center -mt-1">CAC = 신규 회원 1명 영입 비용</p>
            <div className="bg-[#F9FAFB] rounded p-1.5 space-y-0.5">
              <div className="flex justify-between text-[12px]"><span>신규</span><span className="font-medium">{ltvCalc.newMembers}명</span></div>
              <div className="flex justify-between text-[12px]"><span>증가매출</span><span className="font-medium">{fmt(ltvCalc.revenueGain)}원</span></div>
              <div className="flex justify-between text-[12.5px]"><span className="font-medium">ROI</span>
                <span className={['font-bold', ltvCalc.roi >= 0 ? 'text-[#ec4899]' : 'text-[#FB2C36]'].join(' ')}>{ltvCalc.roi.toFixed(1)}%</span></div>
              <p className="text-[9.5px] text-[#6A7282] leading-tight">
                ROI = 광고 투자 대비 수익률<br />(증가매출 - 광고비) ÷ 광고비 × 100
              </p>
            </div>
          </div>
        </Card>}

        {/* [중] 월별 시뮬레이션 — [2026-05-24] 테스트 단계라 임시 숨김. 1년치 계절 패턴 누적되면 의미 있음. */}
        {false && <Card title="⑥ 월별 매출/순이익" w="w-[600px]">
          <div className="grid grid-cols-6 gap-1 mb-1.5">
            {monthlyRevenues.map((v, i) => (
              <input key={i} type="text" inputMode="numeric"
                value={Math.round(v / 10000).toLocaleString()}
                onChange={(e) => { const next = [...monthlyRevenues]; next[i] = (Number(e.target.value.replace(/,/g, '')) || 0) * 10000; setMonthlyRevenues(next) }}
                placeholder={`${i + 1}월`}
                title={`${i + 1}월 (만원)`}
                className="h-6 px-1 border border-[#F59E0B] bg-[#FEF3C7] rounded text-[12px] text-right tabular-nums focus:outline-none focus:border-[#ec4899]" />
            ))}
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer>
              <BarChart data={monthlyResults} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString()}만원`} />
                <Bar dataKey="매출" fill="#a78bfa" />
                <Bar dataKey="순이익" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>}

        {/* [좌] ⑤ 규모 확장 시나리오 — 인원 50~500명까지 매출/영업이익 비교 (조밀화 + w-fit) */}
        <Card title="⑤ 규모 확장 시나리오 (등급 비율 유지)" w="w-fit">
          <p className="text-[10px] text-[#99A1AF] mb-1 whitespace-nowrap">
            등급 비율 유지하며 인원만 스케일 · 운영비({(calc.operatingTotal / 100_000_000).toFixed(2)}억/월) 고정 → 규모의 경제 · 금액 단위: 억원
          </p>
          <table className="text-[11.5px] tabular-nums">
            <thead className="bg-[#F9FAFB] text-[#4A5565]">
              <tr>
                <th className="text-left px-1.5 py-1 font-medium">인원</th>
                <th className="text-right px-1.5 py-1 font-medium">매출</th>
                <th className="text-right px-1.5 py-1 font-medium">상담사</th>
                <th className="text-right px-1.5 py-1 font-medium">m2net</th>
                <th className="text-right px-1.5 py-1 font-medium text-[#ec4899]">영업이익</th>
                <th className="text-right px-1.5 py-1 font-medium text-[#ec4899]">영업%</th>
                <th className="text-right px-1.5 py-1 font-medium text-[#8259F5]">상담마진</th>
                <th className="text-right px-1.5 py-1 font-medium text-[#8259F5]">마진%</th>
              </tr>
            </thead>
            <tbody>
              {scaleScenarios.map((s) => {
                const tel = s.revenue * (m2net.telecom_rate / 100)
                const pho = s.revenue * (m2net.phone_call_rate / 100)
                const extra = Math.max(0, s.n - m2net.counselor_free_count) * m2net.counselor_extra_fee
                const m2netCost = tel + pho + m2net.monthly_fee + extra
                const csrPay = s.revenue - m2netCost - calc.operatingTotal - s.profit
                const consultMargin = s.profit + calc.operatingTotal
                const consultMarginRate = s.revenue > 0 ? (consultMargin / s.revenue) * 100 : 0
                const isCurrent = s.n === counselorCount
                return (
                  <tr key={s.n} className={[
                    'border-t border-[#F3F4F6]',
                    isCurrent ? 'bg-[#fdf2f8] font-semibold' : '',
                  ].join(' ')}>
                    <td className="text-left px-1.5 py-0.5 whitespace-nowrap">{s.n}{isCurrent && <span className="text-[9px] text-[#ec4899] ml-0.5">●</span>}</td>
                    <td className="text-right px-1.5 py-0.5">{(s.revenue / 100_000_000).toFixed(2)}<span className="text-[10px] text-[#99A1AF] ml-0.5">억</span></td>
                    <td className="text-right px-1.5 py-0.5 text-[#6A7282]">{(csrPay / 100_000_000).toFixed(2)}<span className="text-[10px] text-[#99A1AF] ml-0.5">억</span></td>
                    <td className="text-right px-1.5 py-0.5 text-[#6A7282]">{(m2netCost / 100_000_000).toFixed(2)}<span className="text-[10px] text-[#99A1AF] ml-0.5">억</span></td>
                    <td className={['text-right px-1.5 py-0.5 font-bold', s.profit >= 0 ? 'text-[#ec4899]' : 'text-[#FB2C36]'].join(' ')}>
                      {(s.profit / 100_000_000).toFixed(2)}<span className="text-[10px] font-normal ml-0.5 opacity-70">억</span>
                    </td>
                    <td className={['text-right px-1.5 py-0.5 font-bold', s.profit >= 0 ? 'text-[#ec4899]' : 'text-[#FB2C36]'].join(' ')}>
                      {s.profitRate.toFixed(1)}%
                    </td>
                    <td className={['text-right px-1.5 py-0.5 font-bold', consultMargin >= 0 ? 'text-[#8259F5]' : 'text-[#FB2C36]'].join(' ')}>
                      {(consultMargin / 100_000_000).toFixed(2)}<span className="text-[10px] font-normal ml-0.5 opacity-70">억</span>
                    </td>
                    <td className={['text-right px-1.5 py-0.5 font-bold', consultMargin >= 0 ? 'text-[#8259F5]' : 'text-[#FB2C36]'].join(' ')}>
                      {consultMarginRate.toFixed(1)}%
                    </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        </Card>

        {/* [우] ⑨ 목표 — 시작 인원 → 목표 인원 선형 증가, 인원+영업이익 직접 표시 */}
        <Card title="⑨ 목표" w="w-fit">
          {/* 입력: 시작/목표 인원 + 시작/끝 월 */}
          <div className="flex flex-wrap items-center gap-2 mb-2 text-[12px]">
            <div className="flex items-center gap-1">
              <input type="number" value={goalStartMonth} onChange={(e) => setGoalStartMonth(Number(e.target.value) || 1)}
                className="w-[44px] h-6 px-1 border border-[#E5E7EB] rounded text-right tabular-nums focus:outline-none focus:border-[#ec4899]" />
              <span>월</span>
              <input type="number" value={goalStart} onChange={(e) => setGoalStart(Number(e.target.value) || 0)}
                className="w-[60px] h-6 px-1 border-2 border-[#ec4899] bg-white rounded text-right tabular-nums focus:outline-none" />
              <span>명</span>
            </div>
            <span className="text-[#99A1AF]">→</span>
            <div className="flex items-center gap-1">
              <input type="number" value={goalEndMonth} onChange={(e) => setGoalEndMonth(Number(e.target.value) || 12)}
                className="w-[44px] h-6 px-1 border border-[#E5E7EB] rounded text-right tabular-nums focus:outline-none focus:border-[#ec4899]" />
              <span>월</span>
              <input type="number" value={goalEnd} onChange={(e) => setGoalEnd(Number(e.target.value) || 0)}
                className="w-[60px] h-6 px-1 border-2 border-[#ec4899] bg-white rounded text-right tabular-nums focus:outline-none" />
              <span>명</span>
            </div>
            <span className="text-[10.5px] text-[#99A1AF] ml-2">선형 증가 · 단위: 억원</span>
          </div>

          <div className="h-[260px] w-[600px]">
            <ResponsiveContainer>
              <ComposedChart data={goalRoadmap} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={32} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={28} />
                <Bar yAxisId="left" dataKey="count" fill="#c4b5fd" name="인원">
                  <LabelList content={(props: any) => {
                    const { x, y, width, height, value, index } = props
                    const profit = goalRoadmap[index]?.profit ?? 0
                    const cx = x + width / 2
                    // 막대 높이가 충분하면 안쪽에 2줄, 짧으면 막대 위쪽에 2줄 (X축과 겹침 방지)
                    if (height >= 40) {
                      return (
                        <g>
                          <text x={cx} y={y + 16} textAnchor="middle" fill="#4A0EDB" fontSize={13} fontWeight="bold">{value}명</text>
                          <text x={cx} y={y + 32} textAnchor="middle" fill="#ec4899" fontSize={13} fontWeight="bold">{profit.toFixed(1)}억</text>
                        </g>
                      )
                    }
                    return (
                      <g>
                        <text x={cx} y={y - 22} textAnchor="middle" fill="#4A0EDB" fontSize={13} fontWeight="bold">{value}명</text>
                        <text x={cx} y={y - 6} textAnchor="middle" fill="#ec4899" fontSize={13} fontWeight="bold">{profit.toFixed(1)}억</text>
                      </g>
                    )
                  }} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#ec4899" strokeWidth={1.5} name="영업이익" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 목표 달성 KPI — 컴팩트 */}
          <div className="flex items-baseline gap-4 text-[12px] pt-1 mt-0.5 border-t border-[#F3F4F6]">
            <div className="flex items-baseline gap-1">
              <span className="text-[10.5px] text-[#6A7282]">목표월({goalRoadmap[goalRoadmap.length - 1]?.month}) 인원</span>
              <span className="text-[15px] font-bold text-[#8259F5] tabular-nums">{goalRoadmap[goalRoadmap.length - 1]?.count ?? 0}명</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[10.5px] text-[#6A7282]">영업이익</span>
              <span className="text-[15px] font-bold text-[#ec4899] tabular-nums">{goalRoadmap[goalRoadmap.length - 1]?.profit.toFixed(2) ?? '0'}억/월</span>
            </div>
          </div>
        </Card>

        {/* [좌하] 시나리오 비교 — [2026-05-24] 사장님 안 씀(3개 모두 미저장). 본질에서 분산되므로 숨김. */}
        {false && <Card title="⑩ 시나리오 비교" w="w-fit">
          <div className="grid grid-cols-3 gap-1.5">
            {(['conservative', 'normal', 'optimistic'] as const).map((key) => {
              const labels = { conservative: '🛡 보수', normal: '⚖ 평균', optimistic: '🚀 낙관' }
              const colors = { conservative: '#6A7282', normal: '#ec4899', optimistic: '#10B981' }
              const slot = scenarios[key]; const result = scenarioResults[key]
              return (
                <div key={key} className="border border-[#E5E7EB] rounded p-1.5 space-y-1 text-[12px]">
                  <div className="flex justify-between items-center">
                    <span className="text-[12.5px] font-semibold" style={{ color: colors[key] }}>{labels[key]}</span>
                    <button onClick={() => saveScenario(key, labels[key])}
                      className="text-[9.5px] px-1.5 py-0.5 rounded border border-[#E5E7EB] hover:border-[#ec4899] hover:text-[#ec4899]">
                      저장
                    </button>
                  </div>
                  {slot && result ? (
                    <>
                      <div className="flex justify-between"><span>매출</span><span className="tabular-nums">{fmtM(slot.revenue)}</span></div>
                      <div className="flex justify-between"><span>정산률</span><span className="tabular-nums">{slot.avg_grade_rate.toFixed(1)}%</span></div>
                      <div className="flex justify-between border-t border-[#F3F4F6] pt-0.5">
                        <span className="font-medium">순이익</span>
                        <span className="font-bold tabular-nums" style={{ color: result.profit >= 0 ? colors[key] : '#FB2C36' }}>{fmtM(result.profit)}</span>
                      </div>
                      <div className="flex justify-between"><span>이익률</span>
                        <span className="font-medium" style={{ color: result.profit >= 0 ? colors[key] : '#FB2C36' }}>{result.rate.toFixed(1)}%</span></div>
                    </>
                  ) : <p className="text-[10px] text-[#99A1AF] text-center py-3">미저장</p>}
                </div>
              )
            })}
          </div>
          {(scenarioResults.conservative || scenarioResults.normal || scenarioResults.optimistic) && (
            <div className="h-[100px] mt-2">
              <ResponsiveContainer>
                <BarChart data={[
                  scenarioResults.conservative && { name: '보수', 순이익: Math.round(scenarioResults.conservative.profit / 10000) },
                  scenarioResults.normal && { name: '평균', 순이익: Math.round(scenarioResults.normal.profit / 10000) },
                  scenarioResults.optimistic && { name: '낙관', 순이익: Math.round(scenarioResults.optimistic.profit / 10000) },
                ].filter(Boolean) as Array<{ name: string; 순이익: number }>} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()}만원`} />
                  <Bar dataKey="순이익" fill="#ec4899" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>}

        {/* [우하] 시즌 패턴 — [2026-05-24] DB 실측 통계는 별도 통계 페이지로. 시뮬레이터는 가정값 시뮬에 집중. */}
        {false && <Card title="⑪ 요일 패턴 (90일)" w="w-[400px]">
          {insights?.season && insights.season.by_dow.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-1.5 text-[12px]">
                <div className="bg-[#fdf2f8] rounded p-1.5">
                  <span className="text-[#6A7282]">최고: </span>
                  <span className="font-bold text-[#ec4899]">{insights.season.best_dow.label}요일 ({fmt(insights.season.best_dow.revenue)}원/건)</span>
                </div>
                <div className="bg-[#F9FAFB] rounded p-1.5">
                  <span className="text-[#6A7282]">최저: </span>
                  <span className="font-bold text-[#6A7282]">{insights.season.worst_dow.label}요일 ({fmt(insights.season.worst_dow.revenue)}원/건)</span>
                </div>
              </div>
              <div className="h-[150px]">
                <ResponsiveContainer>
                  <BarChart data={insights.season.by_dow} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => fmt(v) + '원'} />
                    <Bar dataKey="revenue" fill="#a78bfa" name="평균 매출/건" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : <p className="text-[12px] text-[#99A1AF] py-8 text-center">90일 데이터 부족</p>}
        </Card>}
      </div>

      {/* 하단 — 다음 사업 비전 (사주앱 이후 연관 사업). 좌측 정렬 (⑤ 표 아래) */}
      <div className="mt-6 py-4">
        <div className="text-[30px] font-extrabold text-[#ec4899]">다음은 목소리 보험입니다 !</div>
      </div>
    </div>
  )
}

/* ─── 작은 컴포넌트들 ─── */

function KpiInline({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="flex items-baseline gap-1 px-2 py-0.5 bg-[#F9FAFB] rounded border border-[#E5E7EB]">
      <span className="text-[10px] text-[#6A7282]">{label}</span>
      <span className="text-[13px] font-bold tabular-nums text-[#030712]">{value}</span>
      {delta != null && (
        <span className={['text-[10px] font-medium', delta >= 0 ? 'text-[#ec4899]' : 'text-[#FB2C36]'].join(' ')}>
          {delta >= 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}%
        </span>
      )}
    </div>
  )
}

function FieldInline({ label, value, initial, onChange, unit, wide, small, step, money, muted, manUnit }: {
  label: string; value: number; initial: number; onChange: (v: number) => void; unit?: string; wide?: boolean; small?: boolean; step?: string; money?: boolean; muted?: boolean; manUnit?: boolean
}) {
  const changed = value !== initial
  const baseBg = muted ? 'border-[#E5E7EB] bg-white' : 'border-[#F59E0B] bg-[#FEF3C7]'
  // manUnit=true: 내부 값은 원, 표시/입력은 만원 단위 (가로폭 축소)
  if (manUnit) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[12px] text-[#6A7282] whitespace-nowrap">{label}</span>
        <input type="number" value={Math.round(value / 10000)}
          onChange={(e) => onChange((Number(e.target.value) || 0) * 10000)}
          title={`초기: ${Math.round(initial / 10000).toLocaleString()}만`}
          className={[
            'h-6 px-1 border rounded text-[12.5px] text-right tabular-nums focus:outline-none focus:border-[#ec4899] w-[44px]',
            changed ? 'border-[#ec4899] bg-[#fdf2f8]' : baseBg,
          ].join(' ')} />
        <span className="text-[10px] text-[#99A1AF]">{unit ?? '만'}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <span className="text-[12px] text-[#6A7282] whitespace-nowrap">{label}</span>
      {money ? (
        <input type="text" inputMode="numeric"
          value={value.toLocaleString()}
          onChange={(e) => onChange(Number(e.target.value.replace(/,/g, '')) || 0)}
          title={`초기: ${initial.toLocaleString()}`}
          className={[
            'h-6 px-1 border rounded text-[12.5px] text-right tabular-nums focus:outline-none focus:border-[#ec4899]',
            wide ? 'w-[120px]' : small ? 'w-[60px]' : 'w-[90px]',
            changed ? 'border-[#ec4899] bg-[#fdf2f8]' : baseBg,
          ].join(' ')} />
      ) : (
        <input type="number" step={step ?? '1'} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
          title={`초기: ${initial.toLocaleString()}`}
          className={[
            'h-6 px-1 border rounded text-[12.5px] text-right tabular-nums focus:outline-none focus:border-[#ec4899]',
            wide ? 'w-[110px]' : small ? 'w-[50px]' : 'w-[80px]',
            changed ? 'border-[#ec4899] bg-[#fdf2f8]' : baseBg,
          ].join(' ')} />
      )}
      {unit && <span className="text-[10px] text-[#99A1AF]">{unit}</span>}
    </div>
  )
}

function FieldRow({ label, value, initial, onChange, unit, money }: { label: string; value: number; initial: number; onChange: (v: number) => void; unit: string; money?: boolean }) {
  const changed = value !== initial && value !== 0
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[12px] text-[#6A7282] flex-1">{label}</span>
      {money ? (
        <input type="text" inputMode="numeric"
          value={value.toLocaleString()}
          onChange={(e) => onChange(Number(e.target.value.replace(/,/g, '')) || 0)}
          title={`초기: ${initial.toLocaleString()}`}
          className={[
            'w-[110px] h-5 px-1 border rounded text-[12px] text-right tabular-nums focus:outline-none focus:border-[#ec4899]',
            changed ? 'border-[#ec4899] bg-[#fdf2f8]' : 'border-[#F59E0B] bg-[#FEF3C7]',
          ].join(' ')} />
      ) : (
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
          title={`초기: ${initial.toLocaleString()}`}
          className={[
            'w-[90px] h-5 px-1 border rounded text-[12px] text-right tabular-nums focus:outline-none focus:border-[#ec4899]',
            changed ? 'border-[#ec4899] bg-[#fdf2f8]' : 'border-[#F59E0B] bg-[#FEF3C7]',
          ].join(' ')} />
      )}
      <span className="text-[9.5px] text-[#99A1AF] w-[12px]">{unit}</span>
    </div>
  )
}

function Card({ title, w, red, children }: { title: string; w: string; red?: boolean; children: React.ReactNode }) {
  return (
    <section className={['border rounded-md bg-white', w, red ? 'border-[#FB2C36]' : 'border-[#E5E7EB]'].join(' ')}>
      <h3 className={['text-[13px] font-semibold px-2 py-1.5 border-b', red ? 'text-[#991B1B] border-[#FECACA]' : 'text-[#030712] border-[#F3F4F6]'].join(' ')}>{title}</h3>
      <div className="p-2">{children}</div>
    </section>
  )
}

function Row({ v, label, bold, sub }: { v: number; label: string; bold?: boolean; sub?: boolean }) {
  const m = Math.round(v / 10000)
  return (
    <>
      <span className={[
        'whitespace-nowrap',
        sub ? 'text-[12px] text-[#6A7282]' : 'text-[13px] text-[#1E2939]',
        bold ? 'font-semibold' : '',
      ].join(' ')}>{label}</span>
      <span className={[
        'tabular-nums text-right',
        sub ? 'text-[12px] text-[#6A7282]' : 'text-[13px] text-[#1E2939]',
        bold ? 'font-semibold' : '',
      ].join(' ')}>
        {m >= 0 ? '+' : ''}{m.toLocaleString()}
      </span>
    </>
  )
}

function RiskRow({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className={['flex justify-between items-center px-2 py-1 rounded text-[12.5px]', warn ? 'bg-[#FEF2F2]' : 'bg-[#F9FAFB]'].join(' ')}>
      <span className="text-[12px]">{warn && '⚠️ '}{label}</span>
      <span className={['font-bold tabular-nums', warn ? 'text-[#FB2C36]' : 'text-[#030712]'].join(' ')}>{value}</span>
    </div>
  )
}

function Divider() { return <span className="text-[#E5E7EB] mx-0.5">|</span> }
function Divider2() { return <div className="h-px bg-[#F3F4F6] my-1" /> }
