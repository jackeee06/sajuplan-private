import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import UploadedImage from '../components/UploadedImage'
import { Th, Td, Tr, IdCell, TableShell, THead, TBody, EmptyRow } from '../components/table'

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
  const navigate = useNavigate()
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
    <div className="space-y-3 max-w-[1100px]">
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

      <TableShell>
        <THead>
          <Th align="right">ID</Th>
          <Th align="left">위치</Th>
          <Th align="left">이미지</Th>
          <Th align="left">제목/링크</Th>
          <Th align="left">시작일시</Th>
          <Th align="left">종료일시</Th>
          <Th align="right">순서</Th>
          <Th align="right">조회</Th>
          <Th align="center">삭제</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={9} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={9} />
          ) : (
            data.items.map((b) => (
              <Tr key={b.id} onClick={() => navigate(`/banners/${b.id}`)}>
                <IdCell id={b.id} />
                <Td align="left" className="text-xs">{b.position || <span className="text-gray-300">—</span>}</Td>
                <Td align="left">
                  {b.image_url ? (
                    <UploadedImage src={b.image_url} srcWebp={b.image_url_webp} alt={b.title || ''} className="h-10 max-w-[100px] object-contain" />
                  ) : <span className="text-[10px] text-gray-300">—</span>}
                </Td>
                <Td align="left" className="text-xs max-w-[260px] truncate">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{b.title || '-'}</div>
                  {b.link_url && <a href={b.link_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-brand-600 hover:underline">{b.link_url}</a>}
                </Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{formatDT(b.starts_at)}</Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{formatDT(b.ends_at)}</Td>
                <Td align="right" className="text-xs tabular-nums">{b.display_order}</Td>
                <Td align="right" className="text-xs text-gray-500 tabular-nums">{b.hit_count === 0 ? <span className="text-gray-300">0</span> : b.hit_count.toLocaleString()}</Td>
                <Td align="center">
                  <button
                    onClick={(e) => { e.stopPropagation(); void onDelete(b) }}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>
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
