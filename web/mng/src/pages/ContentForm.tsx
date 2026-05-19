import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'

interface Payload {
  slug: string
  title: string
  content: string
  mobile_content: string
  use_html: boolean
  head_html: string
  tail_html: string
  is_active: boolean
}

const empty = (): Payload => ({
  slug: '', title: '', content: '', mobile_content: '',
  use_html: true, head_html: '', tail_html: '', is_active: true,
})

export default function ContentForm() {
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
    api<Record<string, unknown>>(`/admin/contents/${id}`)
      .then((r) => setData({
        slug: String(r.slug ?? ''),
        title: String(r.title ?? ''),
        content: String(r.content ?? ''),
        mobile_content: String(r.mobile_content ?? ''),
        use_html: !!r.use_html,
        head_html: String(r.head_html ?? ''),
        tail_html: String(r.tail_html ?? ''),
        is_active: !!r.is_active,
      }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof Payload>(k: K, v: Payload[K]) => setData((d) => ({ ...d, [k]: v }))

  const onSubmit = async () => {
    setError(null); setSuccess(null)
    if (!data.slug.trim()) return setError('ID(slug)는 필수입니다.')
    if (!/^[a-zA-Z0-9_-]+$/.test(data.slug.trim())) return setError('slug는 영문/숫자/_/- 만 허용됩니다.')
    if (!data.title.trim()) return setError('제목은 필수입니다.')

    setSaving(true)
    try {
      if (isNew) {
        const r = await api<{ id: number }>('/admin/contents', { method: 'POST', body: JSON.stringify(data) })
        setSuccess('등록 완료')
        navigate(`/contents/${r.id}`, { replace: true })
      } else {
        await api(`/admin/contents/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
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
          <button onClick={() => navigate('/contents')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {isNew ? '내용 추가' : `내용 수정 #${id}`}
          </h1>
        </div>
        <button onClick={onSubmit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
        <Row label="ID (slug)" required hint="URL 식별자. 영문/숫자/_/- 만 허용. 예: company, privacy, provision">
          <input type="text" value={data.slug} onChange={(e) => set('slug', e.target.value)} disabled={!isNew} className={inputCls} />
        </Row>
        <Row label="제목" required>
          <input type="text" value={data.title} onChange={(e) => set('title', e.target.value)} className={inputCls} />
        </Row>
        <Row label="HTML 사용">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={data.use_html} onChange={(e) => set('use_html', e.target.checked)} />
            <span className="text-sm">HTML 태그를 그대로 렌더링</span>
          </label>
        </Row>
        <Row label="본문 (PC)">
          <textarea
            rows={12} value={data.content}
            onChange={(e) => set('content', e.target.value)}
            className={`${inputCls} font-mono text-xs`}
            placeholder="HTML 또는 일반 텍스트"
          />
        </Row>
        <Row label="본문 (모바일)" hint="비워두면 PC 본문 사용">
          <textarea
            rows={6} value={data.mobile_content}
            onChange={(e) => set('mobile_content', e.target.value)}
            className={`${inputCls} font-mono text-xs`}
          />
        </Row>
        <Row label="head HTML" hint="페이지 head에 삽입 (옵션)">
          <textarea rows={3} value={data.head_html} onChange={(e) => set('head_html', e.target.value)} className={`${inputCls} font-mono text-xs`} />
        </Row>
        <Row label="tail HTML" hint="페이지 tail에 삽입 (옵션)">
          <textarea rows={3} value={data.tail_html} onChange={(e) => set('tail_html', e.target.value)} className={`${inputCls} font-mono text-xs`} />
        </Row>
        <Row label="노출">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={data.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <span className="text-sm">사용자에게 노출</span>
          </label>
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
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}
