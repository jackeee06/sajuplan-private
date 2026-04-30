import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'

interface Payload {
  subject: string
  cz_type: number
  cp_method: number
  cp_target: string
  cz_point: number | ''
  cp_type: boolean
  cp_id: string
  cz_period: number | ''
  cz_start: string
  cz_end: string
  is_active: boolean
}

const CZ_TYPE_OPTIONS = [
  { value: 0, label: '다운로드 쿠폰' },
  { value: 1, label: '포인트차감쿠폰' },
  { value: 2, label: '포인트추가쿠폰' },
  { value: 3, label: '코드입력쿠폰' },
]

const CP_METHOD_OPTIONS = [
  { value: 0, label: '개별상품할인' },
  { value: 1, label: '카테고리할인' },
  { value: 2, label: '주문금액할인' },
  { value: 3, label: '배송비할인' },
  { value: 4, label: '포인트' },
]

const empty = (): Payload => ({
  subject: '', cz_type: 0, cp_method: 4, cp_target: '',
  cz_point: '', cp_type: false, cp_id: '', cz_period: 30,
  cz_start: '', cz_end: '', is_active: true,
})

export default function CouponZoneForm() {
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
    api<Record<string, unknown>>(`/admin/coupon-zones/${id}`)
      .then((r) => setData({
        subject: String(r.subject ?? ''),
        cz_type: Number(r.cz_type ?? 0),
        cp_method: Number(r.cp_method ?? 4),
        cp_target: String(r.cp_target ?? ''),
        cz_point: Number(r.cz_point ?? 0),
        cp_type: !!r.cp_type,
        cp_id: String(r.cp_id ?? ''),
        cz_period: Number(r.cz_period ?? 30),
        cz_start: r.cz_start ? toLocal(String(r.cz_start)) : '',
        cz_end: r.cz_end ? toLocal(String(r.cz_end)) : '',
        is_active: !!r.is_active,
      }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof Payload>(k: K, v: Payload[K]) => setData((d) => ({ ...d, [k]: v }))

  const onSubmit = async () => {
    setError(null); setSuccess(null)
    if (!data.subject.trim()) return setError('쿠폰이름은 필수입니다.')

    setSaving(true)
    try {
      const payload = {
        ...data,
        cz_point: typeof data.cz_point === 'number' ? data.cz_point : 0,
        cz_period: typeof data.cz_period === 'number' ? data.cz_period : 0,
        cp_target: data.cp_target || null,
        cp_id: data.cp_id || null,
        cz_start: data.cz_start ? new Date(data.cz_start).toISOString() : null,
        cz_end: data.cz_end ? new Date(data.cz_end).toISOString() : null,
      }
      if (isNew) {
        const r = await api<{ id: number }>('/admin/coupon-zones', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess('등록 완료')
        navigate(`/coupon-zones/${r.id}`, { replace: true })
      } else {
        await api(`/admin/coupon-zones/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/coupon-zones')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{isNew ? '쿠폰존 추가' : `쿠폰존 수정 #${id}`}</h1>
        </div>
        <button onClick={onSubmit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
        <Row label="쿠폰이름" required>
          <input type="text" value={data.subject} onChange={(e) => set('subject', e.target.value)} className={inputCls} />
        </Row>
        <Row label="쿠폰종류">
          <select value={data.cz_type} onChange={(e) => set('cz_type', Number(e.target.value))} className={inputCls}>
            {CZ_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </Row>
        <Row label="적용대상">
          <select value={data.cp_method} onChange={(e) => set('cp_method', Number(e.target.value))} className={inputCls}>
            {CP_METHOD_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </Row>
        {(data.cp_method === 0 || data.cp_method === 1) && (
          <Row label="적용대상 ID" hint={data.cp_method === 0 ? '상품 ID' : '카테고리 ID'}>
            <input type="text" value={data.cp_target} onChange={(e) => set('cp_target', e.target.value)} className={inputCls} />
          </Row>
        )}
        <Row label="포인트/할인 금액">
          <div className="flex gap-2">
            <input type="text" inputMode="numeric" value={data.cz_point} onChange={(e) => set('cz_point', e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')))} className={inputCls} />
            <select value={data.cp_type ? '1' : '0'} onChange={(e) => set('cp_type', e.target.value === '1')} className={`max-w-[100px] ${inputCls}`}>
              <option value="0">원</option>
              <option value="1">%</option>
            </select>
          </div>
        </Row>
        {data.cz_type === 3 && (
          <Row label="쿠폰번호" hint="코드입력 쿠폰의 사용 코드">
            <input type="text" value={data.cp_id} onChange={(e) => set('cp_id', e.target.value)} className={inputCls} />
          </Row>
        )}
        <Row label="다운로드 후 사용가능 기간 (일)">
          <input type="text" inputMode="numeric" value={data.cz_period} onChange={(e) => set('cz_period', e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')))} className={inputCls} />
        </Row>
        <Row label="사용 시작">
          <input type="datetime-local" value={data.cz_start} onChange={(e) => set('cz_start', e.target.value)} className={inputCls} />
        </Row>
        <Row label="사용 종료">
          <input type="datetime-local" value={data.cz_end} onChange={(e) => set('cz_end', e.target.value)} className={inputCls} />
        </Row>
        <Row label="노출">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={data.is_active} onChange={(e) => set('is_active', e.target.checked)} /> 사용자에게 노출</label>
        </Row>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-gray-50'

function Row({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-4">
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
