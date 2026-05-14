import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import UploadedImage from '../components/UploadedImage'

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">팝업레이어 관리</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            메인 화면 자동 노출 팝업 ({items.length}건)
          </p>
        </div>
        <Link
          to="/popup-layers/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white"
        >
          <Plus className="w-4 h-4" />
          팝업 추가
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-20">ID</th>
              <th className="px-3 py-2 text-left font-medium w-16">이미지</th>
              <th className="px-3 py-2 text-left font-medium">제목</th>
              <th className="px-3 py-2 text-left font-medium w-24">기기</th>
              <th className="px-3 py-2 text-left font-medium w-44">시작</th>
              <th className="px-3 py-2 text-left font-medium w-44">종료</th>
              <th className="px-3 py-2 text-left font-medium w-20">상태</th>
              <th className="px-3 py-2 text-right font-medium w-32">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-gray-400 text-sm">
                  등록된 팝업이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="text-gray-700 dark:text-gray-200">
                  <td className="px-3 py-2 text-gray-400">{p.id}</td>
                  <td className="px-3 py-2">
                    {p.image_url ? (
                      <UploadedImage
                        src={p.image_url}
                        srcWebp={p.image_url_webp}
                        alt=""
                        className="w-10 h-10 object-cover rounded border border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-gray-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{p.title}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{deviceLabel(p.device)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{fmt(p.starts_at)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{fmt(p.ends_at)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge active={p.is_active} starts={p.starts_at} ends={p.ends_at} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/popup-layers/${p.id}`}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                        title="수정"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => onDelete(p.id, p.title)}
                        className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
  if (!active) {
    return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-500">중지</span>
  }
  const now = Date.now()
  const s = new Date(starts).getTime()
  const e = new Date(ends).getTime()
  if (now < s) return <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">예약</span>
  if (now > e) return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">종료</span>
  return <span className="px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">노출중</span>
}
