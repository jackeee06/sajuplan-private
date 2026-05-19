import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { api } from '../lib/api'
import HtmlEditor, { type HtmlEditorHandle } from '../components/HtmlEditor'
import UploadedImage from '../components/UploadedImage'
import { API_BASE } from '../lib/runtime-env'

interface EventPayload {
  title: string
  /** 'YYYY-MM-DDTHH:mm' (datetime-local) — 빈 문자열이면 무기한 */
  starts_at: string
  ends_at: string
  thumbnail_url: string
  thumbnail_url_webp: string
}

const empty = (): EventPayload => ({
  title: '', starts_at: '', ends_at: '', thumbnail_url: '', thumbnail_url_webp: '',
})

const apiBase = API_BASE

export default function EventForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()

  const [data, setData] = useState<EventPayload>(empty())
  // 본문 HTML — Toast UI Editor 는 ref 기반이라 state 와 별도로 mount 직후 초기값만 주입.
  const [initialContent, setInitialContent] = useState<string>('')
  const editorRef = useRef<HtmlEditorHandle>(null)

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    api<{
      id: number
      title: string
      content: string | null
      thumbnail_url: string | null
      thumbnail_url_webp: string | null
      starts_at: string | null
      ends_at: string | null
    }>(`/admin/events/${id}`)
      .then((r) => {
        setData({
          title: r.title ?? '',
          starts_at: toLocalInput(r.starts_at),
          ends_at: toLocalInput(r.ends_at),
          thumbnail_url: r.thumbnail_url ?? '',
          thumbnail_url_webp: r.thumbnail_url_webp ?? '',
        })
        setInitialContent(r.content ?? '')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof EventPayload>(k: K, v: EventPayload[K]) =>
    setData((d) => ({ ...d, [k]: v }))

  const onUploadThumb = async (file: File) => {
    setError(null); setSuccess(null); setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${apiBase}/admin/events/upload`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || `업로드 실패 (${res.status})`)
      }
      const j = (await res.json()) as { image_url: string; image_url_webp: string | null }
      setData((d) => ({
        ...d,
        thumbnail_url: j.image_url,
        thumbnail_url_webp: j.image_url_webp ?? '',
      }))
      setSuccess(j.image_url_webp ? '썸네일 업로드 완료 (WebP 변환됨)' : '썸네일 업로드 완료')
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = async () => {
    setError(null); setSuccess(null)
    if (!data.title.trim()) return setError('제목을 입력하세요.')
    if (data.starts_at && data.ends_at && data.starts_at > data.ends_at) {
      return setError('진행 종료 시각은 시작 시각보다 뒤여야 합니다.')
    }
    setSaving(true)
    try {
      const content = editorRef.current?.getHTML() ?? ''
      const body = {
        title: data.title,
        content,
        thumbnail_url: data.thumbnail_url || null,
        thumbnail_url_webp: data.thumbnail_url_webp || null,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
      }
      if (isNew) {
        const r = await api<{ id: number; url: string }>('/admin/events', {
          method: 'POST', body: JSON.stringify(body),
        })
        setSuccess('등록이 완료되었습니다.')
        navigate(`/events/${r.id}`, { replace: true })
      } else {
        await api(`/admin/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
        setSuccess('수정이 완료되었습니다.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (isNew || !id) return
    if (!window.confirm('이 이벤트를 삭제하시겠습니까?')) return
    try {
      await api(`/admin/events/${id}`, { method: 'DELETE' })
      navigate('/events')
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩…</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/events')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{isNew ? '이벤트 추가' : `이벤트 수정 #${id}`}</h1>
            <p className="text-xs text-gray-500 mt-0.5">사용자 사이트에 노출될 이벤트 글</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button onClick={onDelete} className="px-3 py-2 text-xs rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20">
              삭제
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
          >
            {saving ? '저장 중…' : isNew ? '등록' : '저장'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            <tr>
              <th className="text-left align-middle px-4 py-3 w-32 font-medium bg-gray-50 dark:bg-gray-800/50">제목 <span className="text-rose-500">*</span></th>
              <td className="px-4 py-3">
                <input type="text" value={data.title} onChange={(e) => set('title', e.target.value)} maxLength={200} className={cls + ' w-full'} />
              </td>
            </tr>
            <tr>
              <th className="text-left align-middle px-4 py-3 font-medium bg-gray-50 dark:bg-gray-800/50">진행 기간</th>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="datetime-local"
                    value={data.starts_at}
                    onChange={(e) => set('starts_at', e.target.value)}
                    className={cls}
                  />
                  <span className="text-gray-400 text-xs">~</span>
                  <input
                    type="datetime-local"
                    value={data.ends_at}
                    onChange={(e) => set('ends_at', e.target.value)}
                    className={cls}
                  />
                  <span className="text-xs text-gray-500">(비워두면 무기한)</span>
                </div>
              </td>
            </tr>
            <tr>
              <th className="text-left align-top px-4 py-3 font-medium bg-gray-50 dark:bg-gray-800/50">썸네일</th>
              <td className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="file" accept="image/*" disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onUploadThumb(f)
                      e.target.value = ''
                    }}
                    className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-brand-500 file:text-white hover:file:bg-brand-600 file:cursor-pointer"
                  />
                  {uploading && <span className="text-xs text-gray-500">업로드 중…</span>}
                </div>
                {data.thumbnail_url && (
                  <div className="flex items-start gap-3">
                    <UploadedImage
                      src={data.thumbnail_url}
                      srcWebp={data.thumbnail_url_webp}
                      alt="썸네일 미리보기"
                      className="w-40 h-40 object-cover rounded-md border border-gray-200 dark:border-gray-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gray-500 break-all">
                        {data.thumbnail_url}
                        {data.thumbnail_url_webp && <span className="ml-1 text-emerald-600">· webp ✓</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setData((d) => ({ ...d, thumbnail_url: '', thumbnail_url_webp: '' }))}
                        className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-gray-200 dark:border-gray-700 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <X className="w-3 h-3" /> 제거
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-gray-500">jpg/png/gif/webp · 최대 10MB · WebP 자동 변환됨</p>
              </td>
            </tr>
            <tr>
              <th className="text-left align-top px-4 py-3 font-medium bg-gray-50 dark:bg-gray-800/50">본문</th>
              <td className="px-4 py-3">
                <HtmlEditor
                  ref={editorRef}
                  initialHtml={initialContent}
                  uploadEndpoint="/admin/events/upload"
                  height="520px"
                />
                <p className="mt-2 text-[11px] text-gray-500">툴바 이미지 버튼으로 본문 인라인 이미지 업로드 가능 · 마크다운 ↔ WYSIWYG 탭 전환</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const cls = 'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

/**
 * 서버에서 받은 ISO timestamp 를 <input type="datetime-local"> 에 넣을 수 있는
 * 'YYYY-MM-DDTHH:mm' 형식으로 변환. null/빈값은 빈 문자열.
 */
function toLocalInput(s: string | null): string {
  if (!s) return ''
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
