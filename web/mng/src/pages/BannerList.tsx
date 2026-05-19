import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import UploadedImage from '../components/UploadedImage'

/**
 * sample/adm/bannerlist.php (메뉴 350600 "배너관리") 정확 매핑.
 *
 * 컬럼: ID / 위치 / 시작 / 종료 / 출력순서 / 조회 / 관리 / 이미지
 * 필터: 위치(16종) / 상태(전체/진행중/종료)
 */

const POSITIONS = ['회원가입완료', '메인-상단배너', '메인-중앙배너']

interface Banner {
  id: number
  position: string | null
  title: string | null
  link_url: string | null
  image_url: string | null
  image_url_webp: string | null
  display_order: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  hit_count: number
}

interface Resp { items: Banner[]; total: number; page: number; limit: number }

export default function BannerList() {
  const [filter, setFilter] = useState<{ position: string; status: string; page: number }>({ position: '', status: '', page: 1 })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = () => {
    const params = new URLSearchParams()
    if (filter.position) params.set('position', filter.position)
    if (filter.status) params.set('status', filter.status)
    params.set('page', String(filter.page))
    params.set('limit', '50')
    setLoading(true); setError(null)
    api<Resp>(`/admin/banners?${params}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  const onDelete = async (b: Banner) => {
    if (!confirm(`배너를 삭제하시겠습니까?`)) return
    try {
      await api(`/admin/banners/${b.id}`, { method: 'DELETE' })
      setSuccess('삭제 완료')
      load()
    } catch (e) { setError(e instanceof Error ? e.message : '삭제 실패') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">배너 관리</h1>
          {data && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            총 <span className="text-brand-600 font-semibold tabular-nums">{data.total.toLocaleString()}</span>건
          </p>}
        </div>
        <Link to="/banners/new" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
          <Plus className="w-4 h-4" /> 배너추가
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 w-fit max-w-full">
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={filter.position} onChange={(e) => setFilter((f) => ({ ...f, position: e.target.value, page: 1 }))} className={cls}>
            <option value="">위치 전체</option>
            {POSITIONS.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value, page: 1 }))} className={cls}>
            <option value="">배너 시간 전체</option>
            <option value="ing">진행중인 배너</option>
            <option value="end">종료된 배너</option>
          </select>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm w-fit max-w-full">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm w-fit max-w-full">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden w-fit max-w-full">
        <div className="overflow-x-auto">
          <table className="text-sm w-auto">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">ID</th>
                <th className="px-3 py-1.5 text-left font-medium">위치</th>
                <th className="px-3 py-1.5 text-left font-medium">이미지</th>
                <th className="px-3 py-1.5 text-left font-medium">제목/링크</th>
                <th className="px-3 py-1.5 text-left font-medium">시작일시</th>
                <th className="px-3 py-1.5 text-left font-medium">종료일시</th>
                <th className="px-3 py-1.5 text-right font-medium">순서</th>
                <th className="px-3 py-1.5 text-right font-medium">조회</th>
                <th className="px-3 py-1.5 text-left font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={9} className="px-3 py-3 text-xs text-gray-400">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-3 text-xs text-gray-400">자료가 없습니다.</td></tr>
              ) : (
                data.items.map((b) => (
                  <tr key={b.id} className="hover:bg-brand-50 dark:hover:bg-brand-500/5">
                    <td className="px-3 py-1.5 text-xs text-gray-400 tabular-nums">{b.id}</td>
                    <td className="px-3 py-1.5 text-xs whitespace-nowrap">{b.position || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5">
                      {b.image_url ? (
                        <UploadedImage src={b.image_url} srcWebp={b.image_url_webp} alt={b.title || ''} className="h-10 max-w-[100px] object-contain" />
                      ) : <span className="text-[10px] text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-xs max-w-[260px] truncate">
                      <div className="font-medium text-gray-800 dark:text-gray-100">{b.title || '-'}</div>
                      {b.link_url && <a href={b.link_url} target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline">{b.link_url}</a>}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDT(b.starts_at)}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDT(b.ends_at)}</td>
                    <td className="px-3 py-1.5 text-xs text-right tabular-nums">{b.display_order}</td>
                    <td className="px-3 py-1.5 text-xs text-right text-gray-500 tabular-nums">{b.hit_count === 0 ? <span className="text-gray-300">0</span> : b.hit_count.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                      <Link to={`/banners/${b.id}`} className="inline-flex items-center px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 mr-1">수정</Link>
                      <button onClick={() => onDelete(b)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20">
                        <Trash2 className="w-3 h-3" />
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

const cls = 'px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function formatDT(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s); if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
