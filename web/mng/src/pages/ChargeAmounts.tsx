import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/coin_pay_form.php (메뉴 350460 "충전금액 설정") 정확 매핑.
 *
 * 컬럼: 결제금액(VAT 별도) / 보너스 적립 / 총 지급 포인트 / 문구
 * 액션: 행 추가/삭제 → 일괄 저장 (PUT /admin/account-settings)
 */

interface Row {
  product_name: string
  amount: number | ''
  coin_amount: number | ''
  bonus: number | ''
  message: string
  is_active: boolean
}

interface ApiRow {
  id: number
  product_name: string | null
  amount: number | null
  coin_amount: number | null
  is_active: boolean
  extras: { bonus?: number; message?: string }
}

export default function ChargeAmounts() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api<{ items: ApiRow[] }>('/admin/account-settings')
      setRows(r.items.map((it) => ({
        product_name: it.product_name ?? '',
        amount: it.amount ?? '',
        coin_amount: it.coin_amount ?? '',
        bonus: it.extras?.bonus ?? '',
        message: it.extras?.message ?? '',
        is_active: it.is_active,
      })))
      if (r.items.length === 0) {
        // 비어있으면 sample 기준 5개 row 자동 생성
        setRows(Array.from({ length: 5 }, () => ({ product_name: '', amount: '', coin_amount: '', bonus: '', message: '', is_active: true })))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const set = (i: number, k: keyof Row, v: Row[keyof Row]) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  }
  const addRow = () => setRows((rs) => [...rs, { product_name: '', amount: '', coin_amount: '', bonus: '', message: '', is_active: true }])
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const save = async () => {
    setError(null); setSuccess(null); setSaving(true)
    try {
      // 모든 행 저장 — 0원도 유효한 값. 빈 칸은 0으로 처리.
      const items = rows.map((r) => ({
        product_name: r.product_name || null,
        amount: r.amount === '' ? 0 : Number(r.amount),
        coin_amount: r.coin_amount === '' ? 0 : Number(r.coin_amount),
        bonus: r.bonus === '' ? 0 : Number(r.bonus),
        message: r.message,
        is_active: r.is_active,
      }))
      await api('/admin/account-settings', { method: 'PUT', body: JSON.stringify({ items }) })
      setSuccess(`저장 완료. ${items.length}건 적용.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">충전금액 설정</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ※ 입력한 대로 노출. 숫자 입력 시 콤마(,) 금지.
          </p>
        </div>
        <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-12">#</th>
              <th className="px-3 py-2 text-left font-medium">상품명</th>
              <th className="px-3 py-2 text-right font-medium">결제금액(VAT 별도)</th>
              <th className="px-3 py-2 text-right font-medium">보너스 적립</th>
              <th className="px-3 py-2 text-right font-medium">총 지급 포인트</th>
              <th className="px-3 py-2 text-left font-medium">문구</th>
              <th className="px-3 py-2 text-center font-medium w-16">노출</th>
              <th className="px-3 py-2 text-center font-medium w-16">삭제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                <td className="px-3 py-2"><input type="text" value={r.product_name} onChange={(e) => set(i, 'product_name', e.target.value)} className={inputCls} placeholder="예: 1만원 패키지" /></td>
                <td className="px-3 py-2"><input type="text" inputMode="numeric" value={r.amount} onChange={(e) => set(i, 'amount', e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')))} className={`text-right ${inputCls}`} /></td>
                <td className="px-3 py-2"><input type="text" inputMode="numeric" value={r.bonus} onChange={(e) => set(i, 'bonus', e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')))} className={`text-right ${inputCls}`} /></td>
                <td className="px-3 py-2"><input type="text" inputMode="numeric" value={r.coin_amount} onChange={(e) => set(i, 'coin_amount', e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')))} className={`text-right font-medium ${inputCls}`} /></td>
                <td className="px-3 py-2"><input type="text" value={r.message} onChange={(e) => set(i, 'message', e.target.value)} className={inputCls} placeholder="예: 베스트셀러" /></td>
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={r.is_active} onChange={(e) => set(i, 'is_active', e.target.checked)} /></td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => removeRow(i)} className="text-rose-600 hover:text-rose-700">
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={8} className="px-3 py-2 text-center">
                <button onClick={addRow} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                  <Plus className="w-4 h-4" /> 행 추가
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'
