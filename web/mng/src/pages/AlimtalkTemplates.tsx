import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

interface Template {
  id: number
  template_code: string
  subject: string | null
  message: string
  primary_btn_name: string | null
  primary_btn_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AlimtalkTemplates() {
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Template> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api<{ items: Template[] }>('/admin/notifications/alimtalk-templates')
      setItems(r.items)
    } catch (e) { setError(e instanceof Error ? e.message : '로드 실패') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const save = async () => {
    if (!edit) return
    if (!edit.template_code?.trim()) return setError('템플릿 코드를 입력하세요.')
    if (!edit.message?.trim()) return setError('메시지를 입력하세요.')
    try {
      if (edit.id) {
        await api(`/admin/notifications/alimtalk-templates/${edit.id}`, { method: 'PATCH', body: JSON.stringify(edit) })
        setSuccess('수정 완료')
      } else {
        await api('/admin/notifications/alimtalk-templates', { method: 'POST', body: JSON.stringify(edit) })
        setSuccess('등록 완료')
      }
      setEdit(null)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '저장 실패') }
  }

  const onDelete = async (t: Template) => {
    if (!confirm(`"${t.template_code}" 템플릿을 삭제하시겠습니까?`)) return
    await api(`/admin/notifications/alimtalk-templates/${t.id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">알림톡 템플릿</h1>
        <button onClick={() => setEdit({ template_code: '', message: '', is_active: true })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
          <Plus className="w-4 h-4" /> 템플릿 추가
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium">코드</th>
              <th className="px-3 py-2 text-left font-medium">제목</th>
              <th className="px-3 py-2 text-left font-medium">메시지</th>
              <th className="px-3 py-2 text-left font-medium">버튼</th>
              <th className="px-3 py-2 text-center font-medium">활성</th>
              <th className="px-3 py-2 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">로딩...</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">자료가 없습니다.</td></tr>
              : items.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{t.template_code}</td>
                  <td className="px-3 py-2">{t.subject || '-'}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[300px] truncate">{t.message}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{t.primary_btn_name || '-'}</td>
                  <td className="px-3 py-2 text-center">
                    {t.is_active ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">활성</span> : <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">비활성</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit(t)} className="px-2 py-1 text-xs rounded border hover:bg-gray-50 mr-1">수정</button>
                    <button onClick={() => onDelete(t)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-rose-200 text-rose-700 hover:bg-rose-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEdit(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-xl w-[92%] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold">
              {edit.id ? '템플릿 수정' : '템플릿 추가'}
            </div>
            <div className="p-5 space-y-3">
              <Field label="템플릿 코드 *"><input type="text" value={edit.template_code ?? ''} onChange={(e) => setEdit({ ...edit, template_code: e.target.value })} className={inputCls} placeholder="예: SIGNUP_WELCOME" /></Field>
              <Field label="제목"><input type="text" value={edit.subject ?? ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} className={inputCls} /></Field>
              <Field label="메시지 *"><textarea rows={6} value={edit.message ?? ''} onChange={(e) => setEdit({ ...edit, message: e.target.value })} className={`${inputCls} font-mono text-xs`} placeholder="알림톡 본문 — #{변수} 형식 사용 가능" /></Field>
              <Field label="버튼명"><input type="text" value={edit.primary_btn_name ?? ''} onChange={(e) => setEdit({ ...edit, primary_btn_name: e.target.value })} className={inputCls} /></Field>
              <Field label="버튼 URL"><input type="text" value={edit.primary_btn_url ?? ''} onChange={(e) => setEdit({ ...edit, primary_btn_url: e.target.value })} className={inputCls} placeholder="https://..." /></Field>
              <Field label="활성"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> 사용</label></Field>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setEdit(null)} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">취소</button>
              <button onClick={save} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{label}</label>{children}</div>
}
