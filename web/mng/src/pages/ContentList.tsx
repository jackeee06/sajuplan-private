import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/contentlist.php (메뉴 700600 "내용관리") 정확 매핑.
 * 컬럼: ID(slug) / 제목 / 관리(수정/삭제)
 */

interface Page {
  id: number
  co_id: string | null
  slug: string
  title: string
  use_html: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Resp {
  items: Page[]
  total: number
  page: number
  limit: number
}

export default function ContentList() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = () => {
    setLoading(true); setError(null)
    api<Resp>('/admin/contents').then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const onDelete = async (p: Page) => {
    if (!confirm(`"${p.title}" 콘텐츠를 삭제하시겠습니까?`)) return
    try {
      await api(`/admin/contents/${p.id}`, { method: 'DELETE' })
      setSuccess(`삭제 완료: ${p.title}`)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">내용 관리</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            회사소개·이용약관·개인정보처리방침 등 정적 페이지 (slug 기반)
          </p>
        </div>
        <Link to="/contents/new" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
          <Plus className="w-4 h-4" /> 내용 추가
        </Link>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
              <tr>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap">ID (slug)</th>
                <th className="px-4 py-2 text-left font-medium">제목</th>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap">HTML</th>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap">노출</th>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap">최근수정</th>
                <th className="px-4 py-2 text-right font-medium whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">자료가 한건도 없습니다.</td></tr>
              ) : (
                data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-2 text-xs font-mono text-gray-600">{p.slug}</td>
                    <td className="px-4 py-2">{p.title}</td>
                    <td className="px-4 py-2">
                      {p.use_html ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">HTML</span>
                      ) : (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">TEXT</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {p.is_active ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">노출</span>
                      ) : (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">비노출</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{formatDate(p.updated_at)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Link to={`/contents/${p.id}`} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 mr-1">
                        <Pencil className="w-3.5 h-3.5" /> 수정
                      </Link>
                      <button
                        onClick={() => onDelete(p)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function formatDate(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
