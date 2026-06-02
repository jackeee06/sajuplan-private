import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Badge } from '../components/table'

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
  const navigate = useNavigate()
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
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
    <div className="space-y-3 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">내용 관리</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            회사소개·이용약관·개인정보처리방침 등 정적 페이지 (slug 기반)
          </p>
        </div>
        <Link to="/contents/new" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium">
          <Plus className="w-4 h-4" /> 내용 추가
        </Link>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <TableShell>
        <THead>
          <Th align="left">ID (slug)</Th>
          <Th align="left">제목</Th>
          <Th align="center">유형</Th>
          <Th align="center">노출</Th>
          <Th align="left">최근수정</Th>
          <Th align="center">삭제</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={6} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={6} />
          ) : (
            data.items.map((p) => (
              <Tr key={p.id} onClick={() => navigate(`/contents/${p.id}`)}>
                <Td align="left" className="font-mono text-xs text-gray-600">{p.slug}</Td>
                <Td align="left" className="font-medium">{p.title}</Td>
                <Td align="center"><Badge color={p.use_html ? 'blue' : 'gray'}>{p.use_html ? 'HTML' : 'TEXT'}</Badge></Td>
                <Td align="center"><Badge color={p.is_active ? 'emerald' : 'gray'}>{p.is_active ? '노출' : '비노출'}</Badge></Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{formatDate(p.updated_at)}</Td>
                <Td align="center">
                  <button
                    onClick={(e) => { e.stopPropagation(); void onDelete(p) }}
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

function formatDate(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
