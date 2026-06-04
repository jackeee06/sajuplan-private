import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { api } from '../lib/api'

interface PermItem { resource: string; can_read: boolean; can_write: boolean; can_delete: boolean }

const RESOURCE_LABELS: Record<string, string> = {
  'dashboard': '대시보드',
  'members.customers': '회원관리 - 고객',
  'members.counselors': '회원관리 - 상담사',
  'sales.consultations': '매출 - 사용(상담) 내역',
  'sales.charge_amounts': '매출 - 충전금액 설정',
  'sales.payments': '매출 - 결제 내역',
  'sales.points': '매출 - 포인트 관리',
  'sales.settlements': '매출 - 정산 이력',
  'consultation.reviews': '상담 - 상담후기',
  'consultation.chat': '상담 - 채팅내역',
  'board.search_keywords': '게시판 - 인기검색어',
  'board.search_popular': '게시판 - 인기검색어 순위',
  'board.faqs': '게시판 - FAQ',
  'board.posts_overview': '게시판 - 글/댓글 현황',
  'board.reports': '게시판 - 신고관리',
  'notification.push': '알림 - 푸시',
  'notification.alimtalk': '알림 - 알림톡',
  'notification.email': '알림 - 메일',
  'misc.banners': '기타 - 배너',
  'misc.popup_layers': '기타 - 팝업레이어',

  'misc.wish': '기타 - 소원다락방',
  'misc.wish_event': '기타 - 소원다락방 EVENT',
  'misc.qa': '기타 - 상담문의',
  'misc.qa_counselor': '기타 - 1:1문의',
  'config.settings': '설정 - 기본환경설정',
  'config.permissions': '설정 - 권한관리',
  'stats.visit': '통계 - 방문자',
  'stats.revenue': '통계 - 매출',
}

export default function AdminPermissionMatrix() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [items, setItems] = useState<PermItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api<{ items: PermItem[] }>(`/admin/permissions/admins/${id}/matrix`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const setBit = (i: number, key: 'can_read' | 'can_write' | 'can_delete', v: boolean) => {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [key]: v } : it))
  }

  const toggleRow = (i: number, on: boolean) => {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, can_read: on, can_write: on, can_delete: on } : it))
  }

  const onSave = async () => {
    setSaving(true); setError(null); setSuccess(null)
    try {
      await api(`/admin/permissions/admins/${id}/matrix`, { method: 'PUT', body: JSON.stringify({ items }) })
      setSuccess('저장 완료')
    } catch (e) { setError(e instanceof Error ? e.message : '저장 실패') } finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>

  return (
    <div className="space-y-3 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin-users')} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">권한 매트릭스 (관리자 #{id})</h1>
        </div>
        <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium">리소스</th>
              <th className="px-3 py-2 text-center font-medium w-20">읽기</th>
              <th className="px-3 py-2 text-center font-medium w-20">쓰기</th>
              <th className="px-3 py-2 text-center font-medium w-20">삭제</th>
              <th className="px-3 py-2 text-center font-medium w-24">전체</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((it, i) => (
              <tr key={it.resource} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-3 py-2">
                  <div className="font-medium">{RESOURCE_LABELS[it.resource] ?? it.resource}</div>
                  <div className="text-[10px] text-gray-400 font-mono">{it.resource}</div>
                </td>
                <td className="text-center"><input type="checkbox" checked={it.can_read} onChange={(e) => setBit(i, 'can_read', e.target.checked)} /></td>
                <td className="text-center"><input type="checkbox" checked={it.can_write} onChange={(e) => setBit(i, 'can_write', e.target.checked)} /></td>
                <td className="text-center"><input type="checkbox" checked={it.can_delete} onChange={(e) => setBit(i, 'can_delete', e.target.checked)} /></td>
                <td className="text-center">
                  <button onClick={() => toggleRow(i, !(it.can_read && it.can_write && it.can_delete))} className="text-[10px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200">
                    {it.can_read && it.can_write && it.can_delete ? '해제' : '전체'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
