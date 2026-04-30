import { useEffect, useState } from 'react'
import { Search, Send, Bell } from 'lucide-react'
import { api } from '../lib/api'

interface HistoryRow {
  id: number
  member_id: number | null
  mb_id: string | null
  login_id: string | null
  member_name: string | null
  title: string
  content: string
  link_url: string | null
  category: string | null
  created_at: string
}

type CategoryFilter = '' | '전체공지' | '일반회원' | '상담사'

export default function PushNotifications() {
  const [filter, setFilter] = useState<{ q: string; sfl: 'title' | 'content' | 'mb_id'; category: CategoryFilter; page: number }>({
    q: '', sfl: 'title', category: '', page: 1,
  })
  const [pending, setPending] = useState({ q: '', sfl: 'title' as 'title' | 'content' | 'mb_id' })
  const [data, setData] = useState<{ items: HistoryRow[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const p = new URLSearchParams()
    if (filter.q) p.set('q', filter.q)
    if (filter.category) p.set('category', filter.category)
    p.set('page', String(filter.page))
    setLoading(true)
    api<{ items: HistoryRow[]; total: number }>(`/admin/notifications/push-history?${p}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [filter, reload])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-brand-500" />
        <h1 className="text-xl font-semibold">푸시 알림</h1>
      </div>

      {/* ─── 발송 이력 ─── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">푸시알림 내역</h2>
          {data && <span className="text-xs text-gray-500">총 {data.total.toLocaleString()}건</span>}
        </div>

        {/* 카테고리 필터 칩 */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { v: '', label: '전체목록' },
            { v: '전체공지', label: '전체공지' },
            { v: '일반회원', label: '일반회원' },
            { v: '상담사', label: '상담사' },
          ] as const).map((c) => (
            <button
              key={c.v}
              onClick={() => setFilter((f) => ({ ...f, category: c.v as CategoryFilter, page: 1 }))}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                filter.category === c.v
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <select value={pending.sfl} onChange={(e) => setPending({ ...pending, sfl: e.target.value as 'title' | 'content' | 'mb_id' })} className={cls}>
              <option value="title">제목</option>
              <option value="content">본문</option>
              <option value="mb_id">아이디</option>
            </select>
            <input
              type="text"
              value={pending.q}
              onChange={(e) => setPending({ ...pending, q: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && setFilter({ ...filter, q: pending.q, sfl: pending.sfl, page: 1 })}
              placeholder="검색어"
              className={`w-64 ${cls}`}
            />
            <button
              onClick={() => setFilter({ ...filter, q: pending.q, sfl: pending.sfl, page: 1 })}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-500 hover:bg-brand-600 text-white"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
        </div>

        {/* 표 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-500 text-xs text-white">
                <tr>
                  <th className="px-3 py-2 text-center font-semibold w-40">일시</th>
                  <th className="px-3 py-2 text-center font-semibold w-24">분류</th>
                  <th className="px-3 py-2 text-center font-semibold">제목</th>
                  <th className="px-3 py-2 text-center font-semibold w-24">아이디</th>
                  <th className="px-3 py-2 text-center font-semibold">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading && !data ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">로딩…</td></tr>
                ) : !data || data.items.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">발송 내역이 없습니다.</td></tr>
                ) : data.items.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{formatDT(h.created_at)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 text-center">{h.category ?? '-'}</td>
                    <td className="px-3 py-2 font-medium">{h.title}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{h.login_id ?? h.mb_id ?? '-'}</td>
                    <td className="px-3 py-2 text-xs text-brand-600 max-w-[300px] truncate">
                      {h.link_url ? <a href={h.link_url} target="_blank" rel="noreferrer" className="hover:underline">{h.link_url}</a> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── 푸시 알림 입력 ─── */}
      <Compose onSent={() => setReload((r) => r + 1)} />
    </div>
  )
}

// ─── 발송 폼 ────────────────────────────────────
function Compose({ onSent }: { onSent: () => void }) {
  const [target, setTarget] = useState<'all' | 'user' | 'counselor'>('all')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; recipients?: number; pushed?: { success: number; failure: number; error?: string }; error?: string } | null>(null)

  const onSend = async () => {
    setResult(null)
    if (!title.trim()) return setResult({ ok: false, error: '알림 내용을 입력하세요.' })
    if (!window.confirm(`${labelFor(target)} 대상으로 발송하시겠습니까?`)) return
    setSending(true)
    try {
      const res = await api<{ ok: boolean; recipients: number; pushed: { success: number; failure: number; error?: string } }>(
        '/admin/notifications/push-send',
        { method: 'POST', body: JSON.stringify({ target, title, content, link_url: linkUrl }) },
      )
      setResult({ ok: true, recipients: res.recipients, pushed: res.pushed })
      setTitle(''); setContent(''); setLinkUrl('')
      onSent()
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : '발송 실패' })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">푸시 알림 입력</h2>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl p-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> 푸시알림 전송방법</div>
            <div><b>Step 1. 알림내용</b> : 고객에게 전달할 뉴스 또는 이벤트 내용을 입력합니다.</div>
            <div><b>Step 2. 주소</b> : 공지사항에 전달하실 내용의 글을 쓰고 해당 게시물의 URL을 "주소" 항목에 붙여넣기 하시면 됩니다.</div>
            <div><b>Step 3. 전송</b> : 알림내용과 주소항목을 입력한 후 하단 [푸시알림 보내기] 클릭하시면 선택한 대상에게 전송됩니다.</div>
          </div>
          <a
            href="/mng/notices/new"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-md bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 whitespace-nowrap"
          >
            공지사항 쓰러가기 →
          </a>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            <tr>
              <th className="text-left align-middle px-4 py-3 w-32 font-medium bg-gray-50 dark:bg-gray-800/50">구분 <span className="text-rose-500">*</span></th>
              <td className="px-4 py-3">
                <select value={target} onChange={(e) => setTarget(e.target.value as 'all' | 'user' | 'counselor')} className={cls + ' w-48'}>
                  <option value="all">전체공지</option>
                  <option value="user">일반회원</option>
                  <option value="counselor">상담사</option>
                </select>
              </td>
            </tr>
            <tr>
              <th className="text-left align-middle px-4 py-3 font-medium bg-gray-50 dark:bg-gray-800/50">알림내용 <span className="text-rose-500">*</span></th>
              <td className="px-4 py-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={60}
                  placeholder="푸시알림 제목"
                  className={cls + ' w-full'}
                />
              </td>
            </tr>
            <tr>
              <th className="text-left align-middle px-4 py-3 font-medium bg-gray-50 dark:bg-gray-800/50">본문</th>
              <td className="px-4 py-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="알림 본문 (선택)"
                  className={cls + ' w-full'}
                />
              </td>
            </tr>
            <tr>
              <th className="text-left align-middle px-4 py-3 font-medium bg-gray-50 dark:bg-gray-800/50">주소</th>
              <td className="px-4 py-3">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="전송할 게시물 URL"
                  className={cls + ' w-full font-mono text-xs'}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {result && (
        <div className={`p-3 rounded-lg text-sm ${
          result.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
        }`}>
          {result.ok ? (
            <>
              발송 완료 — 대상 {result.recipients}명에 큐 등록 / FCM 발송 성공 {result.pushed?.success ?? 0}건, 실패 {result.pushed?.failure ?? 0}건
              {result.pushed?.error && <span className="block text-xs text-amber-700 mt-1">⚠ {result.pushed.error}</span>}
            </>
          ) : `발송 실패: ${result.error}`}
        </div>
      )}

      <div>
        <button
          onClick={onSend}
          disabled={sending || !title.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {sending ? '발송 중…' : '푸시알림 보내기'}
        </button>
      </div>
    </section>
  )
}

function labelFor(t: 'all' | 'user' | 'counselor'): string {
  return t === 'all' ? '전체공지' : t === 'user' ? '일반회원' : '상담사'
}

const cls = 'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function formatDT(s: string): string {
  if (!s) return '-'
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
