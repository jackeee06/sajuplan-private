import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Shield, X } from 'lucide-react'
import { api } from '../lib/api'

interface Admin {
  id: number
  mb_id: string | null
  name: string | null
  nickname: string | null
  role: string | null
  level: number | null
  is_super: boolean
  last_login_at: string | null
  created_at: string
}

interface CreateForm {
  mb_id: string
  password: string
  password_confirm: string
  name: string
  nickname: string
  email: string
  phone: string
  is_super: boolean
}

const emptyForm = (): CreateForm => ({
  mb_id: '',
  password: '',
  password_confirm: '',
  name: '',
  nickname: '',
  email: '',
  phone: '',
  is_super: false,
})

export default function AdminUsers() {
  const [items, setItems] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api<{ items: Admin[] }>('/admin/permissions/admins')
      setItems(r.items)
    } catch (e) { setError(e instanceof Error ? e.message : '로드 실패') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const openCreate = () => { setForm(emptyForm()); setError(null); setSuccess(null); setOpen(true) }

  const submit = async () => {
    setError(null); setSuccess(null)
    if (!form.mb_id.trim()) return setError('아이디는 필수입니다.')
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(form.mb_id.trim())) return setError('아이디는 3~30자의 영문/숫자/_/- 만 사용할 수 있습니다.')
    if (form.password.length < 6) return setError('비밀번호는 6자 이상이어야 합니다.')
    if (form.password !== form.password_confirm) return setError('비밀번호 확인이 일치하지 않습니다.')
    if (!form.name.trim()) return setError('이름은 필수입니다.')

    setSaving(true)
    try {
      await api('/admin/permissions/admins', {
        method: 'POST',
        body: JSON.stringify({
          mb_id: form.mb_id.trim(),
          password: form.password,
          name: form.name.trim(),
          nickname: form.nickname.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          is_super: form.is_super,
        }),
      })
      setSuccess('관리자 계정이 생성되었습니다.')
      setOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패')
    } finally {
      setSaving(false)
    }
  }

  const toggleSuper = async (a: Admin) => {
    const next = !a.is_super
    if (!confirm(next ? `${a.mb_id} 에게 슈퍼 관리자 권한을 부여하시겠습니까?` : `${a.mb_id} 의 슈퍼 관리자 권한을 해제하시겠습니까?`)) return
    try {
      await api(`/admin/permissions/admins/${a.id}/super`, { method: 'PATCH', body: JSON.stringify({ isSuper: next }) })
      setSuccess('변경 완료')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '변경 실패') }
  }

  const remove = async (a: Admin) => {
    if (!confirm(`관리자 "${a.mb_id}" 계정을 비활성화하시겠습니까?\n(계정은 보존되며 로그인만 차단됩니다)`)) return
    try {
      await api(`/admin/permissions/admins/${a.id}`, { method: 'DELETE' })
      setSuccess('비활성화 완료')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '실패') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">관리자 계정</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
          <Plus className="w-4 h-4" /> 관리자 추가
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="text-xs text-gray-500 -mt-2">
        ※ 신규 관리자 계정은 별도 레코드로 생성됩니다. 기존 회원의 등급(mb_level)·권한은 변경되지 않습니다.
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2 text-left font-medium">아이디</th>
              <th className="px-3 py-2 text-left font-medium">이름</th>
              <th className="px-3 py-2 text-left font-medium">닉네임</th>
              <th className="px-3 py-2 text-center font-medium">등급</th>
              <th className="px-3 py-2 text-left font-medium">최근 로그인</th>
              <th className="px-3 py-2 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">로딩...</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">관리자가 없습니다.</td></tr>
              : items.map((a) => (
                <tr key={a.id} className="hover:bg-brand-50 dark:hover:bg-brand-500/5">
                  <td className="px-3 py-2 font-medium">{a.mb_id}</td>
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2 text-gray-500">{a.nickname}</td>
                  <td className="px-3 py-2 text-center">
                    {a.is_super ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                        <Shield className="w-3 h-3" /> SUPER
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">관리자</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{a.last_login_at ? formatDT(a.last_login_at) : '-'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link to={`/admin-permissions/${a.id}`} className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 mr-1">권한 매트릭스</Link>
                    <button onClick={() => toggleSuper(a)} className="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 mr-1">
                      {a.is_super ? '슈퍼 해제' : '슈퍼 부여'}
                    </button>
                    <button onClick={() => remove(a)} className="text-[11px] px-2 py-0.5 rounded bg-rose-100 text-rose-700 hover:bg-rose-200">비활성화</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-semibold">관리자 추가</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <Field label="아이디" required hint="3~30자의 영문/숫자/_/-">
                <input value={form.mb_id} onChange={(e) => setForm({ ...form, mb_id: e.target.value })} className={inputCls} placeholder="예: admin01" autoFocus />
              </Field>
              <Field label="비밀번호" required hint="6자 이상">
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} />
              </Field>
              <Field label="비밀번호 확인" required>
                <input type="password" value={form.password_confirm} onChange={(e) => setForm({ ...form, password_confirm: e.target.value })} className={inputCls} />
              </Field>
              <Field label="이름" required>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="닉네임" hint="비워두면 이름과 동일하게 설정">
                <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className={inputCls} />
              </Field>
              <Field label="이메일">
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
              </Field>
              <Field label="휴대폰">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="01012345678" />
              </Field>
              <Field label="권한">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_super} onChange={(e) => setForm({ ...form, is_super: e.target.checked })} />
                  슈퍼 관리자 (모든 권한 매트릭스 무시, 전권 보유)
                </label>
              </Field>

              {error && <div className="p-2 rounded bg-rose-50 text-rose-700 text-xs">{error}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200 hover:bg-gray-50">취소</button>
              <button onClick={submit} disabled={saving} className="px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
                {saving ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-1 md:gap-3">
      <div className="pt-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}{required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function formatDT(s: string): string { const dt = new Date(s); if (isNaN(dt.getTime())) return s; const pad = (n: number) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}` }
