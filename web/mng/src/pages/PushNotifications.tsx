import { useEffect, useState } from 'react'
import { Search, Send, Bell, Trash2, X, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Chip } from '../components/table'

interface HistoryRow {
  id: number
  member_id: number | null
  mb_id: string | null
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
    <div className="space-y-3 max-w-[1500px]">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-brand-600" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">푸시 알림</h1>
        <span className="text-xs text-gray-500">— 발송 (좌측) + 내역 (우측)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* ─── 좌: 발송 폼 ─── */}
      <Compose onSent={() => setReload((r) => r + 1)} />

      {/* ─── 우: 발송 이력 ─── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">푸시알림 내역</h2>
          <div className="flex items-center gap-3">
            {data && <span className="text-xs text-gray-500">
              총 <span className="text-brand-600 font-semibold tabular-nums">{data.total.toLocaleString()}</span>건
            </span>}
            <button
              onClick={async () => {
                if (!data || data.total === 0) return
                if (!window.confirm(`푸시알림 발송 내역 ${data.total.toLocaleString()}건을 모두 삭제하시겠습니까?\n\n삭제 후 복구할 수 없습니다.`)) return
                try {
                  const r = await api<{ ok: true; deleted: number }>('/admin/notifications/push-history', { method: 'DELETE' })
                  alert(`${r.deleted.toLocaleString()}건 삭제되었습니다.`)
                  setReload((x) => x + 1)
                } catch (e) {
                  alert(`삭제 실패: ${e instanceof Error ? e.message : ''}`)
                }
              }}
              disabled={!data || data.total === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-rose-200 dark:border-rose-700 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" /> 내역 비우기
            </button>
          </div>
        </div>

        {/* 카테고리 필터 칩 */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { v: '', label: '전체목록' },
            { v: '전체공지', label: '전체공지' },
            { v: '일반회원', label: '일반회원' },
            { v: '상담사', label: '상담사' },
          ] as const).map((c) => (
            <Chip
              key={c.v}
              label={c.label}
              active={filter.category === c.v}
              onClick={() => setFilter((f) => ({ ...f, category: c.v as CategoryFilter, page: 1 }))}
            />
          ))}
        </div>

        {/* 검색 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 w-fit max-w-full">
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
              className={`w-60 ${cls}`}
            />
            <button
              onClick={() => setFilter({ ...filter, q: pending.q, sfl: pending.sfl, page: 1 })}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
        </div>

        {/* 표 */}
        <TableShell>
          <THead>
            <Th align="left">일시</Th>
            <Th align="left">분류</Th>
            <Th align="left">제목</Th>
            <Th align="left">아이디</Th>
            <Th align="left">URL</Th>
          </THead>
          <TBody>
            {loading && !data ? (
              <EmptyRow colSpan={5} loading />
            ) : !data || data.items.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : data.items.map((h) => (
              <Tr key={h.id}>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{formatDT(h.created_at)}</Td>
                <Td align="left" className="text-xs text-gray-600">{h.category ?? <span className="text-gray-300">—</span>}</Td>
                <Td align="left" className="text-xs font-medium">{h.title}</Td>
                <Td align="left" className="text-xs text-gray-500">{h.mb_id ?? <span className="text-gray-300">—</span>}</Td>
                <Td align="left" className="text-xs text-brand-600 max-w-[280px] truncate">
                  {h.link_url ? <a href={h.link_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="hover:underline">{h.link_url}</a> : <span className="text-gray-300">—</span>}
                </Td>
              </Tr>
            ))}
          </TBody>
        </TableShell>
      </section>
      </div>
    </div>
  )
}

// ─── 발송 폼 ────────────────────────────────────
type TargetKind = 'all' | 'user' | 'counselor' | 'member'

interface MemberMini {
  id: number
  mb_id: string
  name: string
  nickname: string | null
  role: string
}

const TARGET_GUIDE: Record<TargetKind, { icon: string; label: string; desc: string }> = {
  all:       { icon: '👥', label: '전체공지', desc: '앱을 설치한 모든 사용자에게 발송' },
  user:      { icon: '🧑', label: '일반회원', desc: '회원가입한 일반 사용자에게 발송' },
  counselor: { icon: '👨‍🏫', label: '상담사',   desc: '등록된 모든 상담사에게 발송' },
  member:    { icon: '👤', label: '개별회원', desc: '특정 회원 1명에게만 발송 (이름/닉네임/mb_id 로 검색)' },
}

function Compose({ onSent }: { onSent: () => void }) {
  const [target, setTarget] = useState<TargetKind>('all')
  const [memberId, setMemberId] = useState('')
  const [memberLabel, setMemberLabel] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<MemberMini[]>([])
  const [searching, setSearching] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; recipients?: number; pushed?: { success: number; failure: number; error?: string }; error?: string; at?: Date } | null>(null)

  // 회원 검색 (debounce 400ms)
  useEffect(() => {
    if (target !== 'member' || memberId) {
      setSearchResults([])
      return
    }
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        // /admin/members?q= 사용 — role 무관 전체 회원 (상담사 포함) 검색.
        //   "상담사도 회원이다" 본질 반영 — 사장님 (상담사) 본인도 검색 결과에 나옴.
        const qs = new URLSearchParams({ q, limit: '10' })
        const r = await api<{ items?: MemberMini[] }>(`/admin/members?${qs}`)
        setSearchResults((r.items ?? []) as MemberMini[])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [searchQ, target, memberId])

  const onSelectMember = (m: MemberMini) => {
    setMemberId(String(m.id))
    setMemberLabel(`${m.nickname || m.name} (${m.mb_id}, #${m.id}, ${m.role === 'counselor' ? '상담사' : '회원'})`)
    setSearchQ('')
    setSearchResults([])
  }

  const onSend = async () => {
    setResult(null)
    if (!title.trim()) return setResult({ ok: false, error: '알림내용을 입력하세요.' })

    let effectiveTarget = target as string
    let confirmLabel: string = TARGET_GUIDE[target].label
    if (target === 'member') {
      if (!/^\d+$/.test(memberId)) return setResult({ ok: false, error: '회원을 검색하여 선택하세요.' })
      effectiveTarget = memberId
      confirmLabel = memberLabel || `개별회원 (ID=${memberId})`
    }

    // 확인 다이얼로그 강화 — 미리보기 + 대상명 + 경고
    const lines = [
      `📨 푸시 알림 발송 확인`,
      ``,
      `대상: ${confirmLabel}`,
      `제목: ${title}`,
    ]
    if (content) lines.push(`본문: ${content.slice(0, 80)}${content.length > 80 ? '...' : ''}`)
    if (linkUrl) lines.push(`링크: ${linkUrl}`)
    lines.push('', '⚠️ 발송 후 취소 불가능합니다.', '정말 발송하시겠습니까?')
    if (!window.confirm(lines.join('\n'))) return

    setSending(true)
    try {
      // url 자동 정규화 — 사용자가 'www.example.com' 같이 스킴 없이 입력해도 'https://' 자동 prepend
      const normalizedLink = normalizeLinkUrl(linkUrl)
      const res = await api<{ ok: boolean; recipients: number; pushed: { success: number; failure: number; error?: string } }>(
        '/admin/notifications/push-send',
        { method: 'POST', body: JSON.stringify({ target: effectiveTarget, title, content, link_url: normalizedLink }) },
      )
      setResult({ ok: true, recipients: res.recipients, pushed: res.pushed, at: new Date() })
      setTitle(''); setContent(''); setLinkUrl('')
      onSent()
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : '발송 실패' })
    } finally {
      setSending(false)
    }
  }

  const guide = TARGET_GUIDE[target]

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">푸시 알림 입력</h2>

      {/* 가이드 박스 */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl p-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 flex-1 min-w-0">
            <div className="font-semibold flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> 푸시알림 전송방법</div>
            <div><b>1.</b> 발송 대상 (구분) 을 선택합니다.</div>
            <div><b>2.</b> 알림내용 (제목) 과 본문을 입력합니다.</div>
            <div><b>3.</b> 주소: 공지사항 URL 또는 외부 사이트 URL (선택)</div>
            <div><b>4.</b> [푸시알림 보내기] 클릭 → 확인 → 발송</div>
          </div>
          <a
            href="/mng/notices/new"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 whitespace-nowrap"
          >
            공지사항 쓰러가기 →
          </a>
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-3">
        {/* 구분 — 토글 칩 4개 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-gray-500">발송 대상 (구분) <span className="text-rose-500">*</span></label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TARGET_GUIDE) as TargetKind[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTarget(t)
                  if (t !== 'member') {
                    setMemberId(''); setMemberLabel(''); setSearchQ(''); setSearchResults([])
                  }
                }}
                className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                  target === t
                    ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-400 dark:border-brand-600 text-brand-700 dark:text-brand-300'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {TARGET_GUIDE[t].icon} {TARGET_GUIDE[t].label}
              </button>
            ))}
          </div>
          <div className="text-[11.5px] text-gray-600 dark:text-gray-400 flex items-center gap-1 pt-0.5">
            <span className="text-base leading-none">{guide.icon}</span>
            <span>{guide.desc}</span>
          </div>
        </div>

        {/* 개별회원 — 검색 박스 */}
        {target === 'member' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-gray-500">회원 검색 <span className="text-rose-500">*</span></label>
            {memberId ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 rounded-md">
                <span className="text-sm font-medium text-brand-700 dark:text-brand-300 flex-1 min-w-0 truncate">✓ {memberLabel}</span>
                <button
                  type="button"
                  onClick={() => { setMemberId(''); setMemberLabel(''); setSearchQ('') }}
                  className="text-xs text-rose-600 hover:underline shrink-0"
                >
                  변경
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="이름, 닉네임, 아이디로 검색 (2자 이상)"
                  className={`${cls} w-full`}
                />
                {searching && <div className="text-[10.5px] text-gray-400 mt-1">검색 중…</div>}
                {!searching && searchQ.trim().length >= 2 && searchResults.length === 0 && (
                  <div className="text-[10.5px] text-gray-400 mt-1">일치하는 회원 없음</div>
                )}
                {searchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                    {searchResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onSelectMember(m)}
                        className="w-full text-left px-3 py-2 hover:bg-brand-50 dark:hover:bg-brand-900/30 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {m.nickname || m.name}
                          <span className="ml-1.5 text-[10px] font-normal text-gray-400">
                            {m.role === 'counselor' ? '상담사' : '회원'}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500">{m.mb_id} · #{m.id}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 알림내용 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-gray-500">
            알림내용 (제목) <span className="text-rose-500">*</span>
            <span className="ml-2 text-gray-400">{title.length}/60</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder="예: 사주플랜 신규 이벤트 안내"
            className={`${cls} w-full`}
          />
        </div>

        {/* 본문 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-gray-500">
            본문 (선택)
            <span className="ml-2 text-gray-400">{content.length}/200</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="알림 미리보기에 표시될 짧은 본문"
            className={`${cls} w-full`}
          />
        </div>

        {/* 주소 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-gray-500">
            주소 (선택) — 클릭 시 이동할 페이지
          </label>
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="예: /notices/123 (앱 내) 또는 https://example.com 또는 www.example.com (외부)"
            className={`${cls} w-full font-mono text-xs`}
          />
          {linkUrl && (
            <div className="text-[10.5px] text-gray-500">
              실제 발송 URL: <code className="text-blue-700 dark:text-blue-300">{normalizeLinkUrl(linkUrl)}</code>
            </div>
          )}
        </div>

        {/* 발송 버튼 */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !title.trim() || (target === 'member' && !memberId)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? '발송 중…' : '푸시알림 보내기'}
          </button>
        </div>
      </div>

      {/* 결과 카드 */}
      {result && (
        result.ok ? (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
              <CheckCircle className="w-4 h-4" /> 발송 완료
            </div>
            <div className="text-[13px] text-gray-700 dark:text-gray-200 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>대상 <span className="font-semibold tabular-nums">{result.recipients ?? 0}</span>명</span>
              <span className="text-emerald-700 dark:text-emerald-300">
                성공 <span className="font-semibold tabular-nums">{result.pushed?.success ?? 0}</span>건
              </span>
              {(result.pushed?.failure ?? 0) > 0 && (
                <span className="text-rose-600 dark:text-rose-400">
                  실패 <span className="font-semibold tabular-nums">{result.pushed?.failure}</span>건
                </span>
              )}
              {result.at && <span className="text-gray-400 text-xs">{result.at.toLocaleTimeString()}</span>}
            </div>
            {result.pushed?.error && (
              <div className="text-[11.5px] text-amber-700 dark:text-amber-300">⚠ {result.pushed.error}</div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/20 p-3 flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div className="text-sm text-rose-700 dark:text-rose-300">
              <div className="font-semibold">발송 실패</div>
              <div className="text-[12.5px]">{result.error}</div>
            </div>
          </div>
        )
      )}
    </section>
  )
}

const cls = 'px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

/**
 * 푸시 link_url 정규화 — 사용자 친화 자동 처리.
 *   - 빈 값 → 빈 문자열
 *   - http(s):// 이미 있음 → 그대로
 *   - '/' 로 시작 → 내부 path (그대로, 앱이 webUrl 기준으로 처리)
 *   - 도메인 패턴 (점 포함, 'www.foo.com' 또는 'foo.com') → 'https://' prepend → 외부 URL
 *   - 그 외 → 그대로 (백엔드/앱 측에서 추가 처리)
 */
function normalizeLinkUrl(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('/')) return s
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(s)) return `https://${s}`
  return s
}

function formatDT(s: string): string {
  if (!s) return '-'
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
