import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import UploadedImage from '../components/UploadedImage'
import { API_BASE } from '../lib/runtime-env'

/** sample/adm/bannerform.php의 help 텍스트에서 추출 — 위치별 권장 사이즈 */
const POSITION_SIZES: Record<string, { w: number; h: number | null; note?: string }> = {
  '회원가입완료':       { w: 1000, h: 520 },
  '메인-상단배너':       { w: 1000, h: 520 },
  '메인-중앙배너':       { w: 1000, h: 160 },
}

const POSITIONS = Object.keys(POSITION_SIZES)

interface Payload {
  position: string
  title: string
  link_url: string
  image_url: string
  image_url_webp: string
  display_order: number | ''
  starts_at: string
  ends_at: string
  is_active: boolean
}

const empty = (): Payload => ({
  position: POSITIONS[0], title: '', link_url: '', image_url: '', image_url_webp: '',
  display_order: 0, starts_at: '', ends_at: '', is_active: true,
})

export default function BannerForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [data, setData] = useState<Payload>(empty())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const onUpload = async (file: File) => {
    setUploading(true); setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const apiBase = API_BASE
      const res = await fetch(`${apiBase}/admin/banners/upload`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message ?? '업로드 실패')
      }
      const j = (await res.json()) as { image_url: string; image_url_webp: string | null }
      setData((d) => ({ ...d, image_url: j.image_url, image_url_webp: j.image_url_webp ?? '' }))
      setSuccess(j.image_url_webp ? '이미지 업로드 완료 (WebP 변환됨)' : '이미지 업로드 완료')
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    api<Record<string, unknown>>(`/admin/banners/${id}`)
      .then((r) => setData({
        position: String(r.position ?? POSITIONS[0]),
        title: String(r.title ?? ''),
        link_url: String(r.link_url ?? ''),
        image_url: String(r.image_url ?? ''),
        image_url_webp: String(r.image_url_webp ?? ''),
        display_order: Number(r.display_order ?? 0),
        starts_at: r.starts_at ? toLocal(String(r.starts_at)) : '',
        ends_at: r.ends_at ? toLocal(String(r.ends_at)) : '',
        is_active: !!r.is_active,
      }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof Payload>(k: K, v: Payload[K]) => setData((d) => ({ ...d, [k]: v }))

  const onSubmit = async () => {
    setError(null); setSuccess(null)
    if (!data.position) return setError('출력 위치를 선택하세요.')
    setSaving(true)
    try {
      const payload = {
        ...data,
        display_order: typeof data.display_order === 'number' ? data.display_order : 0,
        starts_at: data.starts_at ? new Date(data.starts_at).toISOString() : null,
        ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
        title: data.title || null,
        link_url: data.link_url || null,
        image_url: data.image_url || null,
        image_url_webp: data.image_url_webp || null,
      }
      if (isNew) {
        const r = await api<{ id: number }>('/admin/banners', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess('등록 완료')
        navigate(`/banners/${r.id}`, { replace: true })
      } else {
        await api(`/admin/banners/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
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
          <button onClick={() => navigate('/banners')} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">{isNew ? '배너 추가' : `배너 수정 #${id}`}</h1>
        </div>
        <button onClick={onSubmit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
        <Row label="출력 위치" required hint={(() => {
          const s = POSITION_SIZES[data.position]
          if (!s) return undefined
          return s.h ? `권장 사이즈: ${s.w} × ${s.h}px${s.note ? ` (${s.note})` : ''}` : `권장 너비: ${s.w}px${s.note ? ` (${s.note})` : ''}`
        })()}>
          <select value={data.position} onChange={(e) => set('position', e.target.value)} className={inputCls}>
            {POSITIONS.map((p) => {
              const s = POSITION_SIZES[p]
              const sizeLabel = s.h ? `${s.w}×${s.h}` : `${s.w}× 가변`
              return (<option key={p} value={p}>{p} ({sizeLabel})</option>)
            })}
          </select>
        </Row>

        <Row label="이미지 업로드" required hint="JPG/PNG/GIF/WEBP, 10MB 이하">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="file" accept="image/*" disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) { void onUpload(f); e.target.value = '' }
                }}
                className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-brand-500 file:text-white hover:file:bg-brand-600 file:cursor-pointer"
              />
              {uploading && <span className="text-xs text-gray-500">업로드 중…</span>}
            </div>
            {data.image_url && (
              <div className="space-y-2">
                <UploadedImage
                  src={data.image_url}
                  srcWebp={data.image_url_webp}
                  alt="미리보기"
                  className="max-w-full max-h-[300px] border border-gray-200 dark:border-gray-700"
                />
                <div className="text-[11px] text-gray-500 break-all">
                  {data.image_url}
                  {data.image_url_webp && <span className="ml-1 text-emerald-600">· webp ✓</span>}
                </div>
              </div>
            )}
            <div className="text-[11px] text-gray-400">
              직접 URL 입력도 가능 (외부 CDN):
            </div>
            <input
              type="text" value={data.image_url}
              onChange={(e) => set('image_url', e.target.value)}
              placeholder="https://... 또는 /uploads/banner/..."
              className={inputCls}
            />
          </div>
        </Row>

        <Row label="이미지 설명" hint="alt 속성에 표시됩니다.">
          <input type="text" value={data.title} onChange={(e) => set('title', e.target.value)} className={inputCls} />
        </Row>
        <Row label="링크" hint="배너 클릭 시 이동할 URL">
          <input type="text" value={data.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://..." className={inputCls} />
        </Row>
        <Row label="시작일시">
          <input type="datetime-local" value={data.starts_at} onChange={(e) => set('starts_at', e.target.value)} className={inputCls} />
        </Row>
        <Row label="종료일시">
          <input type="datetime-local" value={data.ends_at} onChange={(e) => set('ends_at', e.target.value)} className={inputCls} />
        </Row>
        <Row label="출력 순서" hint="작은 숫자가 위로 노출됨">
          <input type="number" value={data.display_order} onChange={(e) => set('display_order', e.target.value === '' ? '' : Number(e.target.value))} className={`max-w-[150px] ${inputCls}`} />
        </Row>
        <Row label="노출">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={data.is_active} onChange={(e) => set('is_active', e.target.checked)} /> 사용자에게 노출</label>
        </Row>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function Row({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-4">
      <div className="pt-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}{required && <span className="text-rose-500 ml-1">*</span>}</label>
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
