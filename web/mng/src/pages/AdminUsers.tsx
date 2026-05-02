import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Shield } from 'lucide-react'
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

interface SearchResult { id: number; mb_id: string; name: string; nickname: string; role: string }

export default function AdminUsers() {
  const [items, setItems] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api<{ items: Admin[] }>('/admin/permissions/admins')
      setItems(r.items)
    } catch (e) { setError(e instanceof Error ? e.message : '로드 실패') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const onSearch = async () => {
    if (!search.trim()) { setResults([]); return }
    try {
      const r = await api<{ items: SearchResult[] }>(`/admin/permissions/search-member?q=${encodeURIComponent(search)}`)
      setResults(r.items)
    } catch (e) { setError(e instanceof Error ? e.message : '검색 실패') }
  }

  const grant = async (memberId: number, isAdmin: boolean, isSuper: boolean) => {
    if (!confirm(isAdmin ? `관리자 등급을 부여${isSuper ? '하고 슈퍼 권한도 같이 ' : ''}하시겠습니까?` : '관리자 권한을 해제하시겠습니까?')) return
    try {
      await api(`/admin/permissions/admins/${memberId}/role`, { method: 'PATCH', body: JSON.stringify({ isAdmin, isSuper }) })
      setSuccess('변경 완료')
      setResults([])
      setSearch('')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '실패') }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">관리자 계정</h1>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      {/* 회원 검색 → 관리자 부여 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> 관리자 추가 (회원 검색 후 권한 부여)
        </div>
        <div className="flex gap-2">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="아이디/이름/닉네임"
            className="flex-1 max-w-sm px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          <button onClick={onSearch} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
        {results.length > 0 && (
          <table className="w-full text-xs">
            <tbody className="divide-y">
              {results.map((m) => (
                <tr key={m.id}>
                  <td className="px-2 py-1.5">{m.mb_id}</td>
                  <td className="px-2 py-1.5">{m.name}</td>
                  <td className="px-2 py-1.5 text-gray-500">{m.nickname}</td>
                  <td className="px-2 py-1.5 text-gray-500">{m.role}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => grant(m.id, true, false)} className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 mr-1">관리자 부여</button>
                    <button onClick={() => grant(m.id, true, true)} className="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200">슈퍼 부여</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 관리자 목록 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium">아이디</th>
              <th className="px-3 py-2 text-left font-medium">이름</th>
              <th className="px-3 py-2 text-left font-medium">닉네임</th>
              <th className="px-3 py-2 text-center font-medium">등급</th>
              <th className="px-3 py-2 text-left font-medium">최근 로그인</th>
              <th className="px-3 py-2 text-right font-medium">권한 / 해제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">로딩...</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">관리자가 없습니다.</td></tr>
              : items.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
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
                    <button onClick={() => grant(a.id, false, false)} className="text-[11px] px-2 py-0.5 rounded bg-rose-100 text-rose-700 hover:bg-rose-200">해제</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatDT(s: string): string { const dt = new Date(s); if (isNaN(dt.getTime())) return s; const pad = (n: number) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}` }
