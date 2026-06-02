import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import { api } from '../lib/api'
import HtmlEditor, { type HtmlEditorHandle } from '../components/HtmlEditor'
import { USER_SITE_URL } from '../lib/runtime-env'

interface NoticePayload {
  title: string
  category: string
  is_pinned: boolean
}

const empty = (): NoticePayload => ({ title: '', category: '', is_pinned: false })

export default function NoticeForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()

  const [data, setData] = useState<NoticePayload>(empty())
  // 본문 HTML — Toast UI Editor 는 ref 기반이라 state 와 별도로 mount 직후 초기값만 주입.
  const [initialContent, setInitialContent] = useState<string>('')
  const editorRef = useRef<HtmlEditorHandle>(null)

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string>('')

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    api<{ id: number; title: string; content: string | null; category: string | null; is_pinned: boolean }>(`/admin/notices/${id}`)
      .then((r) => {
        setData({
          title: r.title ?? '',
          category: r.category ?? '',
          is_pinned: Boolean(r.is_pinned),
        })
        setInitialContent(r.content ?? '')
        setPublicUrl(buildPublicUrl(Number(id)))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof NoticePayload>(k: K, v: NoticePayload[K]) =>
    setData((d) => ({ ...d, [k]: v }))

  const onSubmit = async () => {
    setError(null); setSuccess(null)
    if (!data.title.trim()) return setError('제목을 입력하세요.')
    setSaving(true)
    try {
      const content = editorRef.current?.getHTML() ?? ''
      const body = { ...data, content }
      if (isNew) {
        const r = await api<{ id: number; url: string }>('/admin/notices', { method: 'POST', body: JSON.stringify(body) })
        setPublicUrl(buildPublicUrl(r.id))
        setSuccess('등록이 완료되었습니다. 아래 URL을 푸시 알림 주소에 붙여 넣으세요.')
        navigate(`/notices/${r.id}`, { replace: true })
      } else {
        await api(`/admin/notices/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
        setPublicUrl(buildPublicUrl(Number(id)))
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
    if (!window.confirm('이 공지사항을 삭제하시겠습니까?')) return
    try {
      await api(`/admin/notices/${id}`, { method: 'DELETE' })
      navigate('/notices')
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩…</div>

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/notices')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{isNew ? '공지사항 추가' : `공지사항 수정 #${id}`}</h1>
            <p className="text-xs text-gray-500 mt-0.5">사용자 사이트에 노출될 공지글</p>
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

      {publicUrl && !isNew && (
        <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30">
          <div className="text-xs text-brand-700 dark:text-brand-300 font-semibold mb-1">공개 URL — 푸시 알림 [주소]에 붙여넣기 가능</div>
          <div className="flex items-center gap-2">
            <input type="text" readOnly value={publicUrl} className={`flex-1 ${cls} font-mono text-xs bg-white dark:bg-gray-900`} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button
              onClick={() => { navigator.clipboard.writeText(publicUrl); setSuccess('URL이 복사되었습니다.') }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md bg-brand-500 hover:bg-brand-600 text-white"
            >
              <Copy className="w-3.5 h-3.5" /> 복사
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              <ExternalLink className="w-3.5 h-3.5" /> 열기
            </a>
            <Link to="/push-notifications" className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md border border-brand-200 text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/20">
              푸시 알림 페이지로 →
            </Link>
          </div>
        </div>
      )}

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
              <th className="text-left align-middle px-4 py-3 font-medium bg-gray-50 dark:bg-gray-800/50">카테고리</th>
              <td className="px-4 py-3">
                <input type="text" value={data.category} onChange={(e) => set('category', e.target.value)} placeholder="예: 이벤트, 점검, 업데이트" className={cls + ' w-64'} />
              </td>
            </tr>
            <tr>
              <th className="text-left align-middle px-4 py-3 font-medium bg-gray-50 dark:bg-gray-800/50">상단 고정</th>
              <td className="px-4 py-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={data.is_pinned} onChange={(e) => set('is_pinned', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{data.is_pinned ? '고정' : '일반'}</span>
                </label>
              </td>
            </tr>
            <tr>
              <th className="text-left align-top px-4 py-3 font-medium bg-gray-50 dark:bg-gray-800/50">본문</th>
              <td className="px-4 py-3">
                <HtmlEditor
                  ref={editorRef}
                  initialHtml={initialContent}
                  uploadEndpoint="/admin/notices/upload"
                  height="520px"
                />
                <p className="mt-2 text-[11px] text-gray-500">툴바 이미지 버튼으로 본문 인라인 이미지 업로드 가능 · 자동 WebP 변환 · 마크다운 ↔ WYSIWYG 탭 전환</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const cls = 'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function buildPublicUrl(id: number): string {
  // 사용자 SPA 도메인 (runtime-env 가 VITE_SAJUMOON_ENV 기반으로 결정).
  return `${USER_SITE_URL}/notices/${id}`
}
