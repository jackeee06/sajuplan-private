import { useEffect, useState } from 'react'
import { Send, Bell, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'

/**
 * 알림 보내기(수동) — 인앱·푸시 통합 발송(작성 전용). 보낸 이력은 별도 "알림 이력"(/notification-history).
 *   푸시는 항상 인앱과 함께 발송(2026-06-19) — 폰 알림 지워도 종모양에서 내용 복구.
 */
export default function PushNotifications() {
  return (
    <div className="space-y-3 max-w-[800px]">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-brand-600" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">알림 보내기(수동) <span className="text-sm font-normal text-gray-400">(인앱·푸시)</span></h1>
        <span className="text-xs text-gray-500">— 보낸 기록은 <a href="/mng/notification-history" className="text-brand-600 underline">알림 이력</a></span>
      </div>
      <Compose onSent={() => {}} />
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
  member:    { icon: '👤', label: '개별회원', desc: '특정 회원에게만 발송 — 여러 명 선택 가능 (이름/닉네임/mb_id 로 검색)' },
}

function Compose({ onSent }: { onSent: () => void }) {
  const [target, setTarget] = useState<TargetKind | ''>('') // 디폴트 미선택 — 반드시 골라야 발송(오발송 방지)
  const [selectedMembers, setSelectedMembers] = useState<MemberMini[]>([]) // 개별회원 다중 선택
  // 브로드캐스트 대상 수 — 클릭 확인창 + 안내에 사용 (백엔드 발송 기준: all = user + counselor)
  const [counts, setCounts] = useState<{ all: number; user: number; counselor: number } | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<MemberMini[]>([])
  const [searching, setSearching] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [chInapp, setChInapp] = useState(true)
  const [chPush, setChPush] = useState(false) // 디폴트 푸시 off — 의식적으로 켜야 발송(안전)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; recipients?: number; pushed?: { success: number; failure: number; error?: string }; channels?: { inapp: boolean; push: boolean }; error?: string; at?: Date } | null>(null)

  // 브로드캐스트 대상 수 조회 (마운트 1회) — 일반회원/상담사 total, 전체=합산
  useEffect(() => {
    let alive = true
    Promise.all([
      api<{ total?: number }>('/admin/members?role=user&limit=1'),
      api<{ total?: number }>('/admin/members?role=counselor&limit=1'),
    ])
      .then(([u, c]) => {
        if (!alive) return
        const user = Number(u.total ?? 0)
        const counselor = Number(c.total ?? 0)
        setCounts({ user, counselor, all: user + counselor })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // 회원 검색 (debounce 400ms) — 다중 선택이라 이미 고른 사람이 있어도 계속 검색 가능
  useEffect(() => {
    if (target !== 'member') {
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
  }, [searchQ, target])

  const onSelectMember = (m: MemberMini) => {
    setSelectedMembers((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    setSearchQ('')
    setSearchResults([])
  }
  const removeMember = (id: number) => setSelectedMembers((prev) => prev.filter((m) => m.id !== id))

  // 브로드캐스트(전체공지/일반회원/상담사) 선택 시 대규모 발송 경고 — 대상 수 포함. 취소하면 선택 안 함.
  const confirmBroadcast = (t: TargetKind): boolean => {
    if (t === 'member') return true
    const n = t === 'all' ? counts?.all : t === 'user' ? counts?.user : counts?.counselor
    const cntStr = n != null ? `약 ${n.toLocaleString()}명` : '다수'
    let head: string
    if (t === 'all') head = `정말 "전체공지"를 발송하시겠습니까?\n\n⚠️ 앱 설치자 전원(비가입자 포함)에게 발송됩니다.\n가입 회원 기준 ${cntStr}.`
    else if (t === 'user') head = `정말 "일반회원" 전체에게 발송하시겠습니까?\n\n⚠️ 일반회원 ${cntStr} 모두에게 발송됩니다.`
    else head = `정말 "상담사" 전체에게 발송하시겠습니까?\n\n⚠️ 상담사 ${cntStr} 모두에게 발송됩니다.`
    return window.confirm(`${head}\n\n계속하시겠습니까?`)
  }

  const onSend = async () => {
    setResult(null)
    if (!title.trim()) return setResult({ ok: false, error: '알림내용을 입력하세요.' })
    if (!chInapp && !chPush) return setResult({ ok: false, error: '보낼 방법(인앱·푸시) 중 하나 이상 선택하세요.' })
    if (!target) return setResult({ ok: false, error: '발송 대상을 먼저 선택하세요.' })

    let effectiveTarget: string = target
    let confirmLabel: string = TARGET_GUIDE[target].label
    if (target === 'member') {
      if (selectedMembers.length === 0) return setResult({ ok: false, error: '회원을 1명 이상 검색하여 추가하세요.' })
      effectiveTarget = selectedMembers.map((m) => m.id).join(',')
      const names = selectedMembers.map((m) => m.nickname || m.name).join(', ')
      confirmLabel = `개별회원 ${selectedMembers.length}명 — ${names}`
    }

    // 확인 다이얼로그 강화 — 미리보기 + 대상명 + 경고
    const lines = [
      `📨 알림 발송 확인`,
      ``,
      `대상: ${confirmLabel}`,
      `방법: ${[chInapp && '인앱(종모양)', chPush && '푸시(FCM)'].filter(Boolean).join(' + ')}`,
      `제목: ${title}`,
    ]
    if (content) lines.push(`본문: ${content.slice(0, 80)}${content.length > 80 ? '...' : ''}`)
    if (linkUrl) lines.push(`링크: ${linkUrl}`)
    lines.push('', '⚠️ 발송 후 취소 불가능합니다.', '정말 발송하시겠습니까?')
    if (!window.confirm(lines.join('\n'))) return

    setSending(true)
    try {
      const normalizedLink = normalizeLinkUrl(linkUrl)
      const res = await api<{ ok: boolean; recipients: number; pushed: { success: number; failure: number; error?: string } }>(
        '/admin/notifications/push-send',
        { method: 'POST', body: JSON.stringify({ target: effectiveTarget, title, content, link_url: normalizedLink, channels: { inapp: chInapp, push: chPush } }) },
      )
      setResult({ ok: true, recipients: res.recipients, pushed: res.pushed, channels: { inapp: chInapp, push: chPush }, at: new Date() })
      setTitle(''); setContent(''); setLinkUrl('')
      onSent()
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : '발송 실패' })
    } finally {
      setSending(false)
    }
  }

  const guide = target ? TARGET_GUIDE[target] : null

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">알림 작성</h2>

      {/* 가이드 박스 */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-gray-800 dark:text-gray-200 rounded-xl p-3 text-xs space-y-0.5">
        {/* 제목 줄 — 버튼은 카드 안에서 오른쪽 정렬 */}
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-200"><Bell className="w-3.5 h-3.5" /> 알림 작성·발송 방법</div>
          <a
            href="/mng/notices/new"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 whitespace-nowrap"
            title="긴 내용은 공지사항으로 먼저 작성한 뒤, 그 주소(/notices/123)를 아래 '주소' 칸에 넣어 알림으로 보냅니다."
          >
            공지사항 쓰러가기 →
          </a>
        </div>
        <div>보낼 방법(인앱·푸시)을 고른 뒤 [알림 보내기] → 확인 → 발송</div>
        <div className="mt-1.5 pt-1.5 border-t border-amber-200 dark:border-amber-800 space-y-0.5">
          <div className="font-semibold text-amber-800 dark:text-amber-200">📌 꼭 알아두기</div>
          <div>• <b>푸시를 켜면 인앱(종모양)도 자동으로 함께 발송</b>됩니다 — "푸시만" 발송은 없습니다(폰 알림을 지워도 종모양에 남도록). 반대로 "인앱만"은 가능합니다.</div>
          <div>• 도달 범위 — <b>전체공지</b>=앱 설치 전체(비가입 포함), <b>일반회원·상담사</b>=로그인한 해당 그룹, <b>개별회원</b>=고른 사람만(상담사도 검색됨).</div>
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-3 max-w-[760px]">
        {/* 구분 — 토글 칩 4개 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-gray-500">발송 대상 (구분) <span className="text-rose-500">*</span></label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TARGET_GUIDE) as TargetKind[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (t === target) return // 이미 선택된 칩 재클릭 — 확인창 반복 방지
                  if (!confirmBroadcast(t)) return // 취소 시 선택 안 함
                  setTarget(t)
                  if (t !== 'member') {
                    setSelectedMembers([]); setSearchQ(''); setSearchResults([])
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
            {guide
              ? (<><span className="text-base leading-none">{guide.icon}</span><span>{guide.desc}</span></>)
              : (<span className="text-rose-500">⚠ 발송 대상을 먼저 선택하세요 (기본값 없음 — 오발송 방지)</span>)}
          </div>
          {target && target !== 'member' && (
            <div className="text-[11.5px] font-medium text-rose-600 dark:text-rose-400 pt-0.5">
              📣 이 발송은 {(() => {
                const n = target === 'all' ? counts?.all : target === 'user' ? counts?.user : counts?.counselor
                return n != null ? `약 ${n.toLocaleString()}명` : '다수'
              })()}에게 일괄 발송됩니다.
            </div>
          )}
        </div>

        {/* 개별회원 — 다중 선택 (검색해서 칩으로 누적 추가) */}
        {target === 'member' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-gray-500">
              회원 검색 <span className="text-rose-500">*</span>
              <span className="ml-1 text-gray-400 font-normal">여러 명 추가 가능</span>
            </label>

            {/* 선택된 회원 칩 */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 rounded-md text-xs text-brand-700 dark:text-brand-300"
                  >
                    <span className="font-medium">{m.nickname || m.name}</span>
                    <span className="text-[10px] text-gray-400">{m.mb_id}</span>
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="w-4 h-4 flex items-center justify-center rounded text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                      aria-label={`${m.nickname || m.name} 제거`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <span className="text-[11px] text-gray-500">총 {selectedMembers.length}명</span>
              </div>
            )}

            {/* 검색 입력 — 항상 노출 (계속 추가 가능) */}
            <div className="relative">
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="이름, 닉네임, 아이디로 검색 (2자 이상) → 결과 클릭하여 추가"
                className={`${cls} w-full`}
              />
              {searching && <div className="text-[10.5px] text-gray-400 mt-1">검색 중…</div>}
              {!searching && searchQ.trim().length >= 2 && searchResults.length === 0 && (
                <div className="text-[10.5px] text-gray-400 mt-1">일치하는 회원 없음</div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                  {searchResults.map((m) => {
                    const already = selectedMembers.some((x) => x.id === m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={already}
                        onClick={() => onSelectMember(m)}
                        className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                          already ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-50 dark:hover:bg-brand-900/30'
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {m.nickname || m.name}
                          <span className="ml-1.5 text-[10px] font-normal text-gray-400">
                            {m.role === 'counselor' ? '상담사' : '회원'}
                          </span>
                          {already && <span className="ml-1.5 text-[10px] font-normal text-brand-500">✓ 추가됨</span>}
                        </div>
                        <div className="text-[11px] text-gray-500">{m.mb_id} · #{m.id}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
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

        {/* 보낼 방법 (채널) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-gray-500">보낼 방법 (채널) <span className="text-rose-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm select-none ${chPush ? 'cursor-not-allowed' : 'cursor-pointer'} ${(chInapp || chPush) ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-400 dark:border-brand-600 text-brand-700 dark:text-brand-300' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
              <input type="checkbox" checked={chInapp || chPush} disabled={chPush} onChange={(e) => setChInapp(e.target.checked)} />
              🔔 인앱(종모양){chPush && <span className="ml-0.5 text-[10px] text-gray-400">🔒 자동</span>}
            </label>
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer select-none ${chPush ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-400 dark:border-brand-600 text-brand-700 dark:text-brand-300' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
              <input type="checkbox" checked={chPush} onChange={(e) => { const v = e.target.checked; setChPush(v); if (v) setChInapp(true) }} />
              📲 푸시(FCM)
            </label>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed pt-0.5">
            💡 <b>인앱</b>=앱 켜고 종모양🔔에서 봄 · <b>푸시</b>=앱 꺼도 폰 알림으로 도착. <b>푸시는 항상 인앱과 함께 발송</b>됩니다 (폰 알림을 지워도 종모양에서 내용을 다시 볼 수 있게). 카카오톡은 → <a href="/mng/alimtalk-bulk" className="text-brand-600 underline">알림톡 발송</a>
          </div>
        </div>

        {/* 발송 버튼 */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !target || !title.trim() || (target === 'member' && selectedMembers.length === 0) || (!chInapp && !chPush)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? '발송 중…' : '알림 보내기'}
          </button>
        </div>
      </div>

      {/* 결과 카드 */}
      {result && (
        result.ok ? (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 space-y-1.5 max-w-[760px]">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
              <CheckCircle className="w-4 h-4" /> 발송 완료
            </div>
            <div className="text-[13px] text-gray-700 dark:text-gray-200 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>대상 <span className="font-semibold tabular-nums">{result.recipients ?? 0}</span>명</span>
              {result.channels?.inapp && <span className="text-violet-600 dark:text-violet-300">🔔 인앱 기록 완료</span>}
              {result.at && <span className="text-gray-400 text-xs">{result.at.toLocaleTimeString()}</span>}
            </div>
            {result.channels?.push && (
              <div className="text-[12px] text-gray-600 dark:text-gray-300">
                📲 푸시(FCM): 토큰 <span className="tabular-nums">{(result.pushed?.success ?? 0) + (result.pushed?.failure ?? 0)}</span>개 중 성공 <span className="tabular-nums text-emerald-700 dark:text-emerald-300">{result.pushed?.success ?? 0}</span>
                {(result.pushed?.failure ?? 0) > 0 && (result.pushed?.success ?? 0) === 0 && (
                  <div className="text-[11.5px] text-rose-600 dark:text-rose-400 mt-0.5">
                    ⚠ 푸시 토큰이 모두 실패했습니다. 이 숫자는 <b>사람 수가 아니라 그 대상의 누적 토큰 수</b>입니다 (만료 토큰 정리 또는 FCM 점검 필요).
                  </div>
                )}
                <div className="text-[11px] text-gray-400 mt-0.5">
                  ※ 숫자 읽는 법 — 전체·회원·상담사(브로드캐스트)는 <b>"토픽 1건 전송"</b>(개인 도달 수 아님), 개별은 <b>토큰 수</b>(폰 여러 대·재설치 시 사람 수보다 많을 수 있음).
                </div>
              </div>
            )}
            {result.pushed?.error && (
              <div className="text-[11.5px] text-amber-700 dark:text-amber-300">⚠ {result.pushed.error}</div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/20 p-3 flex items-start gap-1.5 max-w-[760px]">
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
 */
function normalizeLinkUrl(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('/')) return s
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(s)) return `https://${s}`
  return s
}
