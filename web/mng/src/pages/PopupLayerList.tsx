import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ImageIcon, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import UploadedImage from '../components/UploadedImage'
import { Th, Td, Tr, IdCell, TableShell, THead, TBody, EmptyRow, Badge, BadgeColor } from '../components/table'

interface PopupLayer {
  id: number
  device: string
  starts_at: string
  ends_at: string
  disable_hours: number
  title: string
  image_url: string | null
  image_url_webp: string | null
  is_active: boolean
  created_at: string
}

export default function PopupLayerList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<PopupLayer[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    api<{ items: PopupLayer[] }>('/admin/popup-layers')
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  const onDelete = async (id: number, title: string) => {
    if (!confirm(`"${title}" 팝업을 삭제할까요?`)) return
    try {
      await api(`/admin/popup-layers/${id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  if (error) return <div className="p-6 text-rose-600">{error}</div>
  if (!items) return <div className="p-6 text-sm text-gray-500">로딩...</div>

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">팝업레이어 관리</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">메인 화면 자동 노출 팝업 ({items.length}건)</p>
        </div>
        <Link to="/popup-layers/new" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium">
          <Plus className="w-4 h-4" /> 팝업 추가
        </Link>
      </div>

      <TableShell>
        <THead>
          <Th align="right">ID</Th>
          <Th align="left">이미지</Th>
          <Th align="left">제목</Th>
          <Th align="left">기기</Th>
          <Th align="left">시작</Th>
          <Th align="left">종료</Th>
          <Th align="center">상태</Th>
          <Th align="center">삭제</Th>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={8} />
          ) : (
            items.map((p) => (
              <Tr key={p.id} onClick={() => navigate(`/popup-layers/${p.id}`)}>
                <IdCell id={p.id} />
                <Td align="left">
                  {p.image_url ? (
                    <UploadedImage src={p.image_url} srcWebp={p.image_url_webp} alt="" className="w-10 h-10 object-cover rounded border border-gray-200 dark:border-gray-700" />
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-gray-400">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  )}
                </Td>
                <Td align="left" className="font-medium">{p.title}</Td>
                <Td align="left" className="text-xs text-gray-500">{deviceLabel(p.device)}</Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{fmt(p.starts_at)}</Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{fmt(p.ends_at)}</Td>
                <Td align="center"><StatusBadge active={p.is_active} starts={p.starts_at} ends={p.ends_at} /></Td>
                <Td align="center">
                  <button
                    onClick={(e) => { e.stopPropagation(); void onDelete(p.id, p.title) }}
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

function fmt(dt: string): string {
  if (!dt) return '-'
  return new Date(dt).toLocaleString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function deviceLabel(d: string): string {
  return d === 'pc' ? 'PC' : d === 'mobile' ? '모바일' : '모두'
}

function StatusBadge({ active, starts, ends }: { active: boolean; starts: string; ends: string }) {
  let label = '노출중'
  let color: BadgeColor = 'emerald'
  if (!active) { label = '중지'; color = 'gray' }
  else {
    const now = Date.now()
    const s = new Date(starts).getTime()
    const e = new Date(ends).getTime()
    if (now < s) { label = '예약'; color = 'amber' }
    else if (now > e) { label = '종료'; color = 'gray' }
  }
  return <Badge color={color}>{label}</Badge>
}
