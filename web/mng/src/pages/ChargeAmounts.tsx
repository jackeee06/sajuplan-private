import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { Th, Td, TableShell, THead, TBody } from '../components/table'

/**
 * sample/adm/coin_pay_form.php (메뉴 350460 "충전금액 설정") 정확 매핑.
 *
 * 컬럼: 상품명 / 결제금액(VAT 별도) / 보너스 적립 / 총 지급 포인트 / 문구 / 노출 / 삭제
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
    setLoading(true)
    setError(null)
    try {
      const r = await api<{ items: ApiRow[] }>('/admin/account-settings')
      setRows(
        r.items.map((it) => ({
          product_name: it.product_name ?? '',
          amount: it.amount ?? '',
          coin_amount: it.coin_amount ?? '',
          bonus: it.extras?.bonus ?? '',
          message: it.extras?.message ?? '',
          is_active: it.is_active,
        })),
      )
      if (r.items.length === 0) {
        setRows(
          Array.from({ length: 5 }, () => ({
            product_name: '',
            amount: '',
            coin_amount: '',
            bonus: '',
            message: '',
            is_active: true,
          })),
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const set = (i: number, k: keyof Row, v: Row[keyof Row]) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  }
  const addRow = () =>
    setRows((rs) => [
      ...rs,
      { product_name: '', amount: '', coin_amount: '', bonus: '', message: '', is_active: true },
    ])
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const save = async () => {
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
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
    <div className="space-y-4">
      {/* 타이틀 + 저장 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">충전금액 설정</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ※ 입력한 대로 노출. 숫자 입력 시 콤마(,) 금지.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="center">#</Th>
          <Th align="left">상품명</Th>
          <Th align="right">결제금액(VAT 별도)</Th>
          <Th align="right">보너스 적립 %</Th>
          <Th align="right">총 지급 포인트</Th>
          <Th align="left">문구</Th>
          <Th align="center">노출</Th>
          <Th align="center">삭제</Th>
        </THead>
        <TBody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
              <Td align="center" className="text-gray-400 tabular-nums">
                {i + 1}
              </Td>
              <Td align="left">
                <input
                  type="text"
                  value={r.product_name}
                  onChange={(e) => set(i, 'product_name', e.target.value)}
                  className={`w-[180px] ${cellInput}`}
                  placeholder="예: 1만원 패키지"
                />
              </Td>
              <Td align="right">
                <input
                  type="text"
                  inputMode="numeric"
                  value={r.amount}
                  onChange={(e) =>
                    set(
                      i,
                      'amount',
                      e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')),
                    )
                  }
                  className={`w-[120px] text-right tabular-nums ${cellInput}`}
                />
              </Td>
              <Td align="right">
                <input
                  type="text"
                  inputMode="numeric"
                  value={r.bonus}
                  onChange={(e) =>
                    set(
                      i,
                      'bonus',
                      e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')),
                    )
                  }
                  className={`w-[100px] text-right tabular-nums ${cellInput}`}
                />
              </Td>
              <Td align="right">
                <input
                  type="text"
                  inputMode="numeric"
                  value={r.coin_amount}
                  onChange={(e) =>
                    set(
                      i,
                      'coin_amount',
                      e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')),
                    )
                  }
                  className={`w-[120px] text-right font-medium tabular-nums ${cellInput}`}
                />
              </Td>
              <Td align="left">
                <input
                  type="text"
                  value={r.message}
                  onChange={(e) => set(i, 'message', e.target.value)}
                  className={`w-[160px] ${cellInput}`}
                  placeholder="예: 베스트셀러"
                />
              </Td>
              <Td align="center">
                <input
                  type="checkbox"
                  checked={r.is_active}
                  onChange={(e) => set(i, 'is_active', e.target.checked)}
                />
              </Td>
              <Td align="center">
                <button
                  onClick={() => removeRow(i)}
                  className="text-rose-500 hover:text-rose-700 transition-colors"
                  title="행 삭제"
                >
                  <Trash2 className="w-4 h-4 inline" />
                </button>
              </Td>
            </tr>
          ))}
          <tr>
            <td colSpan={8} className="px-3 py-2 text-center">
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 hover:underline font-medium"
              >
                <Plus className="w-4 h-4" /> 행 추가
              </button>
            </td>
          </tr>
        </TBody>
      </TableShell>
    </div>
  )
}

const cellInput =
  'px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 outline-none transition'
