import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'

interface Payload {
  cp_id: string
  title: string
  method: number
  target: string
  mb_id: string
  starts_at: string
  ends_at: string
  discount_value: number | ''
  discount_type: number
  is_visible: boolean
}

const METHOD_OPTIONS = [
  { value: 0, label: '개별상품할인' },
  { value: 1, label: '카테고리할인' },
  { value: 2, label: '주문금액할인' },
  { value: 3, label: '배송비할인' },
  { value: 4, label: '포인트추가' },
]

const empty = (): Payload => ({
  cp_id: '', title: '', method: 2, target: '', mb_id: '',
  starts_at: '', ends_at: '', discount_value: '', discount_type: 0, is_visible: true,
})

export default function CouponForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [data, setData] = useState<Payload>(empty())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    api<Record<string, unknown>>(`/admin/coupons/${id}`)
      .then((r) => setData({
        cp_id: String(r.cp_id ?? ''),
        title: String(r.title ?? ''),
        method: Number(r.method ?? 2),
        target: String(r.target ?? ''),
        mb_id: String(r.mb_id ?? ''),
        starts_at: r.starts_at ? toLocal(String(r.starts_at)) : '',
        ends_at: r.ends_at ? toLocal(String(r.ends_at)) : '',
        discount_value: Number(r.discount_value ?? 0),
        discount_type: Number(r.discount_type ?? 0),
        is_visible: !!r.is_visible,
      }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof Payload>(k: K, v: Payload[K]) => setData((d) => ({ ...d, [k]: v }))

  const onSubmit = async () => {
    setError(null); setSuccess(null)
    if (!data.cp_id.trim()) return setError('쿠폰코드는 필수입니다.')
    if (!data.title.trim()) return setError('쿠폰이름은 필수입니다.')

    setSaving(true)
    try {
      const payload = {
        ...data,
        discount_value: typeof data.discount_value === 'number' ? data.discount_value : 0,
        starts_at: data.starts_at ? new Date(data.starts_at).toISOString() : null,
        ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
        target: data.target || null,
        mb_id: data.mb_id || null,
      }
      if (isNew) {
        const r = await api<{ id: number }>('/admin/coupons', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess('등록 완료')
        navigate(`/coupons/${r.id}`, { replace: true })
      } else {
        await api(`/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setSuccess('수정 완료')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/coupons')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{isNew ? '쿠폰 추가' : `쿠폰 수정 #${id}`}</h1>
        </div>
        <button onClick={onSubmit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
        <Row label="쿠폰코드" required>
          <input type="text" value={data.cp_id} onChange={(e) => set('cp_id', e.target.value)} disabled={!isNew} className={inputCls} />
        </Row>
        <Row label="쿠폰이름" required>
          <input type="text" value={data.title} onChange={(e) => set('title', e.target.value)} className={inputCls} />
        </Row>
        <Row label="쿠폰종류">
          <select value={data.method} onChange={(e) => set('method', Number(e.target.value))} className={inputCls}>
            {METHOD_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </Row>
        <Row label="적용대상" hint="상품ID/카테고리ID 또는 비워두면 전체">
          <input type="text" value={data.target} onChange={(e) => set('target', e.target.value)} className={inputCls} />
        </Row>
        <Row label="회원아이디" hint="특정 회원에게만 발급. 비워두면 공통">
          <input type="text" value={data.mb_id} onChange={(e) => set('mb_id', e.target.value)} className={inputCls} />
        </Row>
        <Row label="할인값">
          <input type="text" inputMode="numeric" value={data.discount_value} onChange={(e) => set('discount_value', e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')))} className={inputCls} />
        </Row>
        <Row label="할인 타입">
          <select value={data.discount_type} onChange={(e) => set('discount_type', Number(e.target.value))} className={inputCls}>
            <option value={0}>금액 (원)</option>
            <option value={1}>비율 (%)</option>
          </select>
        </Row>
        <Row label="시작일시">
          <input type="datetime-local" value={data.starts_at} onChange={(e) => set('starts_at', e.target.value)} className={inputCls} />
        </Row>
        <Row label="종료일시">
          <input type="datetime-local" value={data.ends_at} onChange={(e) => set('ends_at', e.target.value)} className={inputCls} />
        </Row>
        <Row label="노출">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={data.is_visible} onChange={(e) => set('is_visible', e.target.checked)} /> 사용자에게 노출</label>
        </Row>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-gray-50 disabled:text-gray-500'

function Row({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-4">
      <div className="pt-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}{required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function toLocal(s: string): string {
  const dt = new Date(s); if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
