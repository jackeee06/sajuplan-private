import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Search, AlertTriangle, CheckCircle, Eye, ShieldAlert, Lock } from 'lucide-react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody } from '../components/table'

/**
 * 어드민 — 알림톡 일괄 발송(수동) + 발송 이력.
 *
 * 2026-06-25 전면 개편 — "BizM 알림톡 작동방식"을 관리자 언어로 번역:
 *  1) 템플릿: 암호 코드 → 한글 이름 카드 택일(회원/상담사/운영자 그룹, 자동전용 경고)
 *  2) 대상: 전화번호 타이핑 → 이름/아이디로 회원 검색해 담기(전화번호는 서버에서 해석=PII 보호).
 *           번호 직접 붙여넣기는 [고급]으로 접어 유지.
 *  3) 변수(JSON) 제거 → 템플릿의 #{빈칸}을 자동 폼으로 생성 + 실시간 미리보기 + 글자수.
 *  4) 발송 전 대상 수·예상 비용·미리보기 확인 + 나에게 테스트 1건 발송.
 */

interface Template {
  template_code: string
  message: string
  is_active: boolean
}

interface JobRow {
  bulk_job_id: number
  template_code: string
  initiated_by: string | null
  total: string
  sent: string
  failed: string
  created_at: string
}

interface MemberMini {
  id: number
  mb_id: string
  name: string
  nickname: string | null
  role: string
}

type Group = 'member' | 'counselor' | 'ops' | 'etc'
type Target = 'all_members' | 'all_counselors' | 'members' | 'phones'

const GROUP_LABEL: Record<Group, string> = {
  member: '회원에게',
  counselor: '상담사에게',
  ops: '운영자에게',
  etc: '기타',
}

/** 템플릿 코드 → 관리자가 이해하는 한글 이름/설명/대상/자동전용 여부 */
const TEMPLATE_META: Record<string, { label: string; desc: string; group: Group; autoOnly?: boolean }> = {
  // ── 회원에게 ──
  register_num_v2:               { label: '회원가입 인증번호',    desc: '가입·본인확인 시 인증번호 발송', group: 'member', autoOnly: true },
  register_idpw_v2:              { label: '아이디·비밀번호 찾기',  desc: '비밀번호 재설정 안내',          group: 'member', autoOnly: true },
  register_idpw1:                { label: '아이디·비밀번호 찾기(구)', desc: '구버전 비밀번호 찾기',       group: 'member', autoOnly: true },
  order_payment_ok_v2:           { label: '결제 완료 안내',        desc: '코인 충전·결제 완료 확인',      group: 'member', autoOnly: true },
  order_bankinfo_v2:             { label: '가상계좌 입금 안내',    desc: '무통장 가상계좌 번호 안내',     group: 'member', autoOnly: true },
  qa_answer_v2:                  { label: '문의 답변 도착',        desc: '회원 문의에 답변이 달림',       group: 'member', autoOnly: true },
  review_req_v2:                 { label: '후기 작성 요청',        desc: '상담 후 후기 남겨달라고 요청',  group: 'member', autoOnly: true },
  chat_auto_cancelled_to_member: { label: '채팅 자동취소 안내',    desc: '상담사 미응답으로 채팅 자동취소', group: 'member', autoOnly: true },
  chat_counseling_v2:            { label: '채팅 상담 안내',        desc: '채팅 상담 관련 안내',           group: 'member', autoOnly: true },
  counselor_v2:                  { label: '단골 상담사 접속 알림', desc: '단골로 등록한 상담사가 접속함',  group: 'member', autoOnly: true },
  coupon_req_v2:                 { label: '쿠폰 발급 안내',        desc: '쿠폰을 지급했다고 회원에게 알림', group: 'member' },
  promoter_approved:             { label: '모집인(서포터즈) 승인', desc: '모집인 신청이 승인됨',          group: 'member' },
  // ── 상담사에게 ──
  chat_request_to_counselor:     { label: '채팅 상담 요청',        desc: '회원이 채팅 상담을 요청함',     group: 'counselor', autoOnly: true },
  qa_ask_v2:                     { label: '문의 도착',            desc: '회원 질문이 상담사에게 도착',   group: 'counselor', autoOnly: true },
  review_for_counselor_v2:       { label: '새 후기 알림',          desc: '내 상담에 후기가 등록됨',       group: 'counselor', autoOnly: true },
  settlement_complete:           { label: '정산 완료',            desc: '수익금 정산이 완료됨',          group: 'counselor', autoOnly: true },
  payout_request_received:       { label: '선지급 신청 접수',      desc: '선지급 신청이 접수됨',          group: 'counselor', autoOnly: true },
  payout_request_paid:           { label: '선지급 입금 완료',      desc: '선지급금이 통장에 입금됨',      group: 'counselor', autoOnly: true },
  payout_request_rejected:       { label: '선지급 신청 반려',      desc: '선지급 신청이 반려됨',          group: 'counselor', autoOnly: true },
  counselor_state_changed_v2:    { label: '자동 부재중 전환',      desc: '장시간 미접속으로 부재중 전환',  group: 'counselor', autoOnly: true },
  counselor_request_v1:          { label: '복귀 요청 안내',        desc: '부재중 상담사에게 복귀 요청',   group: 'counselor' },
  // ── 운영자에게 ──
  ops_admin_alert_v2:            { label: '운영자 알림',          desc: '시스템 → 운영자 자동 알림',     group: 'ops', autoOnly: true },
}

/** 변수명(영문) → 한글 라벨 (없으면 원문 그대로) */
const VAR_LABEL: Record<string, string> = {
  nick: '이름·닉네임', name: '이름', nickname: '닉네임',
  url: '이동 주소(링크)', link: '이동 주소(링크)',
  amount: '금액', coin: '코인', point: '포인트', price: '금액',
  code: '인증번호', date: '날짜', day: '일수', time: '시간',
  counselor: '상담사명', title: '제목', content: '내용',
  coupon: '쿠폰명', bank: '입금 은행', account: '계좌번호', deadline: '입금 기한',
}

const META = (code: string) => TEMPLATE_META[code] ?? { label: code, desc: '등록된 설명 없음', group: 'etc' as Group }
const varLabel = (v: string) => VAR_LABEL[v.trim()] ?? v.trim()
const COST_PER_MSG = 7 // BizM 알림톡 건당 약 7원

export default function AlimtalkBulk() {
  // 잠금 게이트 — 이 화면은 평소 쓸 일이 없어 의도치 않은 발송이 잦음(사장님도 착각). 의식적 해제 후에만 폼 노출.
  const [acked, setAcked] = useState(false)

  const [templates, setTemplates] = useState<Template[]>([])
  const [tplCode, setTplCode] = useState('')
  const [tplSearch, setTplSearch] = useState('')

  const [target, setTarget] = useState<Target>('members')
  const [phones, setPhones] = useState('')
  const [showPhonePaste, setShowPhonePaste] = useState(false)

  // 회원 검색 (member 타겟)
  const [selectedMembers, setSelectedMembers] = useState<MemberMini[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<MemberMini[]>([])
  const [searching, setSearching] = useState(false)

  // 변수 값
  const [varValues, setVarValues] = useState<Record<string, string>>({})

  // 대상 수
  const [counts, setCounts] = useState<{ all: number; user: number; counselor: number } | null>(null)

  // 발송
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ job_id: number; total: number; sent: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 테스트 발송
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  // 이력
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    api<Template[]>('/admin/alimtalk-bulk/templates').then(setTemplates).catch(() => {})
    Promise.all([
      api<{ total?: number }>('/admin/members?role=user&limit=1'),
      api<{ total?: number }>('/admin/members?role=counselor&limit=1'),
    ])
      .then(([u, c]) => {
        const user = Number(u.total ?? 0)
        const counselor = Number(c.total ?? 0)
        setCounts({ user, counselor, all: user + counselor })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLogsLoading(true)
    api<JobRow[]>('/admin/alimtalk-bulk/jobs?limit=50')
      .then(setJobs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLogsLoading(false))
  }, [result])

  // 회원 검색 (debounce)
  useEffect(() => {
    if (target !== 'members') { setSearchResults([]); return }
    const q = searchQ.trim()
    if (q.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const qs = new URLSearchParams({ q, limit: '10' })
        const r = await api<{ items?: MemberMini[] }>(`/admin/members?${qs}`)
        setSearchResults((r.items ?? []) as MemberMini[])
      } catch { setSearchResults([]) } finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [searchQ, target])

  const selectedTpl = templates.find((t) => t.template_code === tplCode)
  const meta = tplCode ? META(tplCode) : null

  // 템플릿 본문에서 #{변수} 추출 (중복 제거, 등장 순서 유지)
  const tplVars = useMemo(() => {
    if (!selectedTpl) return [] as string[]
    const set: string[] = []
    const re = /#\{\s*([^}]+?)\s*\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(selectedTpl.message)) !== null) {
      const name = m[1].trim()
      if (!set.includes(name)) set.push(name)
    }
    return set
  }, [selectedTpl])

  // 템플릿 바뀌면 변수값 초기화
  useEffect(() => { setVarValues({}) }, [tplCode])

  // 실시간 미리보기 (채운 값 반영, 미입력은 [라벨])
  const preview = useMemo(() => {
    if (!selectedTpl) return ''
    return selectedTpl.message.replace(/#\{\s*([^}]+?)\s*\}/g, (_full, name: string) => {
      const v = varValues[name.trim()]
      return v && v.length ? v : `[${varLabel(name)}]`
    })
  }, [selectedTpl, varValues])

  const phoneCount = useMemo(
    () => phones.split(/[,\n\r;]/).map((s) => s.replace(/[^0-9]/g, '')).filter((s) => s.length >= 10).length,
    [phones],
  )

  const recipientCount =
    target === 'all_members' ? counts?.all ?? null
    : target === 'all_counselors' ? counts?.counselor ?? null
    : target === 'members' ? selectedMembers.length
    : phoneCount

  // 템플릿 그룹핑 + 검색
  const grouped = useMemo(() => {
    const q = tplSearch.trim().toLowerCase()
    const filtered = templates.filter((t) => {
      if (!q) return true
      const mt = META(t.template_code)
      return (
        mt.label.toLowerCase().includes(q) ||
        mt.desc.toLowerCase().includes(q) ||
        t.template_code.toLowerCase().includes(q)
      )
    })
    const groups: Record<Group, Template[]> = { member: [], counselor: [], ops: [], etc: [] }
    for (const t of filtered) groups[META(t.template_code).group].push(t)
    return groups
  }, [templates, tplSearch])

  const onSelectMember = (m: MemberMini) => {
    setSelectedMembers((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    setSearchQ(''); setSearchResults([])
  }
  const removeMember = (id: number) => setSelectedMembers((prev) => prev.filter((m) => m.id !== id))

  const buildBody = () => ({
    template_code: tplCode,
    target,
    phones: target === 'phones' ? phones : undefined,
    member_ids: target === 'members' ? selectedMembers.map((m) => m.id) : undefined,
    vars: varValues,
  })

  const handleSend = async () => {
    if (!tplCode) return
    setError(null); setResult(null)
    if (target === 'members' && selectedMembers.length === 0) { setError('회원을 1명 이상 검색하여 추가하세요.'); return }
    if (target === 'phones' && phoneCount === 0) { setError('보낼 전화번호를 입력하세요.'); return }

    const cntStr = recipientCount != null ? `${recipientCount.toLocaleString()}명` : '다수'
    const cost = recipientCount != null ? `약 ${(recipientCount * COST_PER_MSG).toLocaleString()}원` : '미정'
    const lines = [
      `📨 알림톡 발송 확인`,
      ``,
      `템플릿: ${meta?.label} (${GROUP_LABEL[meta?.group ?? 'etc']})`,
      `대상: ${TARGET_LABEL[target]} — ${cntStr}`,
      `예상 비용: ${cost} (건당 ${COST_PER_MSG}원)`,
      ``,
      `미리보기:`,
      preview.slice(0, 200) + (preview.length > 200 ? '…' : ''),
      ``,
      `⚠️ 발송 후 취소 불가. 채운 값은 받는 사람 모두에게 동일하게 들어갑니다.`,
      `정말 발송하시겠습니까?`,
    ]
    if (!confirm(lines.join('\n'))) return

    setSending(true)
    try {
      const r = await api<{ job_id: number; total: number; sent: number; failed: number }>(
        '/admin/alimtalk-bulk/send',
        { method: 'POST', body: JSON.stringify(buildBody()) },
      )
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : '발송 실패')
    } finally { setSending(false) }
  }

  const handleTest = async () => {
    setTestMsg(null)
    if (!tplCode) { setTestMsg('먼저 템플릿을 선택하세요.'); return }
    const p = testPhone.replace(/[^0-9]/g, '')
    if (p.length < 10) { setTestMsg('테스트 받을 전화번호를 정확히 입력하세요.'); return }
    setTesting(true)
    try {
      const r = await api<{ sent: number; failed: number }>(
        '/admin/alimtalk-bulk/send',
        { method: 'POST', body: JSON.stringify({ template_code: tplCode, target: 'phones', phones: p, vars: varValues }) },
      )
      setTestMsg(r.sent > 0 ? '✅ 테스트 1건 발송 완료 — 카카오톡을 확인하세요.' : '⚠️ 발송 실패 — 발신 환경/번호를 확인하세요.')
    } catch (e) {
      setTestMsg(e instanceof Error ? `⚠️ ${e.message}` : '⚠️ 테스트 발송 실패')
    } finally { setTesting(false) }
  }

  return (
    <div className="space-y-4 max-w-[860px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">알림톡 발송 (수동)</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          카카오 알림톡을 회원·상담사에게 골라서 보내는 화면입니다.
        </p>
      </div>

      {/* 🚫 최상단 경고 — 항상 노출 */}
      <div className="rounded-lg border-2 border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/20 p-4 text-rose-800 dark:text-rose-200 space-y-1.5">
        <div className="flex items-center gap-2 text-[15px] font-bold text-rose-700 dark:text-rose-300">
          <ShieldAlert className="w-5 h-5" /> 이 화면은 평소 쓸 일이 없습니다 — 함부로 발송하지 마세요
        </div>
        <ul className="text-[12.5px] leading-relaxed list-disc pl-5 space-y-0.5">
          <li>알림톡(인증·결제·정산 등)은 <b>시스템이 자동으로 발송</b>합니다. 관리자가 평소 보낼 일이 없습니다.</li>
          <li><b>한 명이 못 받았다면 → 그 분께 직접 전화/카톡</b> 하세요. 이 화면으로 처리할 일이 아닙니다.</li>
          <li>알림톡은 <b>카카오 승인 양식만</b> 보냅니다 — 자유 문구는 불가. 자유 문구는 → <Link to="/push-notifications" className="underline font-semibold">알림 보내기(수동) 인앱·푸시</Link>.</li>
          <li>이 화면은 <b>대량 공지 캠페인·시스템 장애 복구</b> 같은 특수 상황 전용입니다.</li>
        </ul>
      </div>

      {!acked ? (
        /* 잠금 게이트 — 의식적 해제 전엔 발송 폼을 아예 숨김 */
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center space-y-3 max-w-[560px]">
          <Lock className="w-8 h-8 text-gray-400 mx-auto" />
          <div className="text-sm text-gray-700 dark:text-gray-200">
            발송 화면이 잠겨 있습니다. <b>대량 캠페인·장애 복구</b> 등 꼭 필요한 경우에만 여세요.
          </div>
          <button
            type="button"
            onClick={() => setAcked(true)}
            className="px-4 py-2 rounded-md border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-900/30"
          >
            위험을 이해했습니다 — 그래도 발송 화면 열기
          </button>
        </div>
      ) : (
      <>
      {/* 안내 */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
        <div className="font-semibold">📌 알아두세요 — 알림톡은 이렇게 작동합니다</div>
        <div>• 알림톡 <b>본문은 관리자가 못 바꿉니다.</b> 카카오에서 미리 승인받은 양식을 고르고, 양식의 <b>빈칸만 채워</b> 보냅니다. (양식 등록·검수는 카카오 비즈(BizM) 콘솔)</div>
        <div>• 이 화면 = <b>수동 일괄발송</b>. 아래 "발송 이력"도 수동으로 보낸 건만 보입니다. <b>자동 알림톡</b>(인증·결제·정산 등)은 시스템이 알아서 보냅니다 → 전체 기록은 <Link to="/alert-logs" className="underline font-medium">알림톡 이력</Link>.</div>
        <div>• 🔒 <b>자동 전용</b> 표시가 붙은 템플릿은 평소 시스템이 자동 발송합니다. 수동으로 보낼 땐 한 번 더 확인하세요.</div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm w-fit max-w-full">{error}</div>}

      {/* ① 템플릿 선택 */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold">1</span>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">보낼 내용(템플릿) 고르기</h2>
        </div>
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={tplSearch}
            onChange={(e) => setTplSearch(e.target.value)}
            placeholder="이름으로 검색 (예: 쿠폰, 후기, 정산)"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800"
          />
        </div>

        <div className="space-y-3">
          {(['member', 'counselor', 'ops', 'etc'] as Group[]).map((g) =>
            grouped[g].length === 0 ? null : (
              <div key={g}>
                <div className="text-[11px] font-semibold text-gray-400 mb-1">{GROUP_LABEL[g]}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {grouped[g].map((t) => {
                    const mt = META(t.template_code)
                    const on = t.template_code === tplCode
                    return (
                      <button
                        key={t.template_code}
                        type="button"
                        onClick={() => setTplCode(t.template_code)}
                        className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                          on
                            ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-400 dark:border-brand-600'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium ${on ? 'text-brand-700 dark:text-brand-200' : 'text-gray-900 dark:text-gray-100'}`}>{mt.label}</span>
                          {mt.autoOnly && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">🔒 자동 전용</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{mt.desc}</div>
                        <div className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5 font-mono">{t.template_code}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ),
          )}
          {templates.length === 0 && <div className="text-xs text-gray-400">템플릿 불러오는 중…</div>}
        </div>

        {meta?.autoOnly && selectedTpl && (
          <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-[12px] text-orange-800 dark:text-orange-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>이 템플릿은 평소 <b>시스템이 자동으로 보내는</b> 종류입니다. 수동 일괄발송하면 회원이 같은 알림을 중복으로 받을 수 있어요. 꼭 필요한지 확인하세요.</span>
          </div>
        )}
      </section>

      {selectedTpl && (
        <>
          {/* ② 빈칸 채우기 + 미리보기 */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold">2</span>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">빈칸 채우기 &amp; 미리보기</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 빈칸 입력 */}
              <div className="space-y-2">
                {tplVars.length === 0 ? (
                  <div className="flex items-center gap-1.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-[12px] text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="w-4 h-4" /> 이 템플릿은 따로 채울 빈칸이 없습니다. 바로 발송할 수 있어요.
                  </div>
                ) : (
                  <>
                    <div className="text-[11px] text-gray-500">
                      아래 빈칸을 채우면 미리보기에 바로 반영됩니다. <b className="text-rose-500">채운 값은 받는 사람 모두에게 똑같이</b> 들어갑니다(사람마다 다른 이름·금액은 일괄발송 불가).
                    </div>
                    {tplVars.map((v) => {
                      const val = varValues[v] ?? ''
                      const MAX = 300
                      return (
                        <div key={v}>
                          <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center justify-between mb-1">
                            <span>{varLabel(v)} <span className="text-gray-300 font-mono">#{'{'}{v}{'}'}</span></span>
                            <span className={`tabular-nums ${val.length > MAX ? 'text-rose-500' : 'text-gray-400'}`}>{val.length}/{MAX}자</span>
                          </label>
                          <textarea
                            value={val}
                            onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))}
                            rows={2}
                            maxLength={MAX}
                            placeholder={`${varLabel(v)} 입력`}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800"
                          />
                        </div>
                      )
                    })}
                    <p className="text-[10px] text-gray-400">※ 알림톡 본문은 전체 1,000자까지입니다. 빈칸 값이 길면 합산 길이에 주의하세요.</p>
                  </>
                )}
              </div>

              {/* 미리보기 */}
              <div>
                <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> 실제 발송 미리보기</div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-[#b2c7d9]/40 dark:bg-gray-800 p-3">
                  <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 text-[13px] leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200 shadow-sm">
                    {preview}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ③ 받는 사람 */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold">3</span>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">받는 사람 고르기</h2>
            </div>

            <div className="flex gap-2 flex-wrap">
              {(['members', 'all_members', 'all_counselors'] as Target[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTarget(t)}
                  className={`px-3 py-1.5 text-xs rounded-md border ${
                    target === t
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {TARGET_LABEL[t]}
                </button>
              ))}
            </div>

            {/* 골라서 보내기 = 회원 검색 */}
            {target === 'members' && (
              <div className="space-y-1.5 max-w-lg">
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedMembers.map((m) => (
                      <span key={m.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 rounded-md text-xs text-brand-700 dark:text-brand-300">
                        <span className="font-medium">{m.nickname || m.name}</span>
                        <span className="text-[10px] text-gray-400">{m.mb_id}</span>
                        <button type="button" onClick={() => removeMember(m.id)} className="w-4 h-4 flex items-center justify-center rounded text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40" aria-label="제거">✕</button>
                      </span>
                    ))}
                    <span className="text-[11px] text-gray-500">총 {selectedMembers.length}명</span>
                  </div>
                )}
                <div className="relative">
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="이름·닉네임·아이디로 검색 (2자 이상) → 결과 클릭하여 추가"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800"
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
                            className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${already ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-50 dark:hover:bg-brand-900/30'}`}
                          >
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {m.nickname || m.name}
                              <span className="ml-1.5 text-[10px] font-normal text-gray-400">{m.role === 'counselor' ? '상담사' : '회원'}</span>
                              {already && <span className="ml-1.5 text-[10px] font-normal text-brand-500">✓ 추가됨</span>}
                            </div>
                            <div className="text-[11px] text-gray-500">{m.mb_id} · #{m.id}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">전화번호는 입력할 필요 없습니다 — 이름·아이디로 고르면 서버가 알아서 보냅니다.</p>

                {/* 고급: 번호 직접 붙여넣기 */}
                <button type="button" onClick={() => setShowPhonePaste((v) => !v)} className="text-[11px] text-gray-500 underline">
                  {showPhonePaste ? '번호 직접 붙여넣기 닫기' : '＋ 번호 직접 붙여넣기 (엑셀에서 복사한 경우)'}
                </button>
              </div>
            )}

            {/* 직접 번호 입력 (members 안의 고급 토글로 노출) */}
            {target === 'members' && showPhonePaste && (
              <div className="max-w-lg">
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1">전화번호 직접 입력 (콤마 또는 줄바꿈 구분) — 이걸 쓰면 위 회원 선택 대신 이 번호로 보냅니다</label>
                <textarea
                  value={phones}
                  onChange={(e) => { setPhones(e.target.value); setTarget('phones') }}
                  rows={4}
                  placeholder="01012345678, 01087654321&#10;01099998888"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-mono bg-white dark:bg-gray-800"
                />
                <p className="text-[10px] text-gray-400 mt-1">현재 {phoneCount}개 번호 인식됨</p>
              </div>
            )}

            {/* phones 타겟이 활성화된 상태 (고급에서 입력 후) */}
            {target === 'phones' && (
              <div className="max-w-lg">
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1 flex items-center justify-between">
                  <span>전화번호 직접 입력 (콤마/줄바꿈 구분)</span>
                  <button type="button" onClick={() => { setTarget('members'); setShowPhonePaste(false); setPhones('') }} className="text-gray-400 underline">회원 검색으로 돌아가기</button>
                </label>
                <textarea
                  value={phones}
                  onChange={(e) => setPhones(e.target.value)}
                  rows={4}
                  placeholder="01012345678, 01087654321&#10;01099998888"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-mono bg-white dark:bg-gray-800"
                />
                <p className="text-[10px] text-gray-400 mt-1">현재 {phoneCount}개 번호 인식됨</p>
              </div>
            )}

            {/* 대상 수 + 비용 */}
            <div className="text-[12.5px] font-medium text-gray-700 dark:text-gray-200">
              📣 받는 사람 <span className="text-brand-600 dark:text-brand-300">{recipientCount != null ? recipientCount.toLocaleString() : '—'}</span>명
              {recipientCount != null && recipientCount > 0 && (
                <span className="text-gray-500"> · 예상 비용 약 <span className="tabular-nums">{(recipientCount * COST_PER_MSG).toLocaleString()}</span>원 (건당 {COST_PER_MSG}원)</span>
              )}
            </div>
          </section>

          {/* ④ 테스트 + 발송 */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold">4</span>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">테스트 후 발송</h2>
            </div>

            {/* 테스트 발송 */}
            <div className="flex flex-wrap items-end gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1">먼저 나에게 테스트 1건</label>
                <input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="내 전화번호 01012345678"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-mono bg-white dark:bg-gray-900 w-52"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={testing || !tplCode}
                className="px-3 py-2 rounded-md border border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 text-sm hover:bg-brand-50 dark:hover:bg-brand-900/30 disabled:opacity-50"
              >
                {testing ? '발송 중…' : '테스트 발송'}
              </button>
              {testMsg && <span className="text-[12px] text-gray-600 dark:text-gray-300">{testMsg}</span>}
            </div>

            <button
              disabled={!tplCode || sending}
              onClick={() => void handleSend()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? '발송 중... (최대 수분)' : `일괄 발송${recipientCount ? ` (${recipientCount.toLocaleString()}명)` : ''}`}
            </button>

            {result && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm w-fit max-w-full">
                <div className="font-medium text-emerald-800 dark:text-emerald-200">발송 완료 — Job #{result.job_id}</div>
                <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  전체 {result.total} · 성공 {result.sent} · 실패 {result.failed}
                </div>
              </div>
            )}
          </section>
        </>
      )}
      </>
      )}

      {/* ── 일괄 발송 이력 ── */}
      <section className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200">최근 일괄 발송 작업</h2>
        {logsLoading ? (
          <div className="text-xs text-gray-500">로딩...</div>
        ) : jobs.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-fit">아직 발송 없음</div>
        ) : (
          <TableShell>
            <THead>
              <Th align="left">시각</Th>
              <Th align="left">Job ID</Th>
              <Th align="left">템플릿</Th>
              <Th align="right">전체</Th>
              <Th align="right">성공</Th>
              <Th align="right">실패</Th>
              <Th align="left">발송자</Th>
            </THead>
            <TBody>
              {jobs.map((j) => (
                <Tr key={j.bulk_job_id}>
                  <Td align="left" className="text-xs text-gray-500 tabular-nums">{j.created_at.slice(0, 16).replace('T', ' ')}</Td>
                  <Td align="left" className="text-xs">#{j.bulk_job_id}</Td>
                  <Td align="left" className="text-xs">{META(j.template_code).label}<span className="block text-[10px] text-gray-300 font-mono">{j.template_code}</span></Td>
                  <Td align="right" className="tabular-nums">{Number(j.total)}</Td>
                  <Td align="right" className="tabular-nums text-emerald-700 font-medium">{Number(j.sent)}</Td>
                  <Td align="right" className={`tabular-nums ${Number(j.failed) > 0 ? 'text-rose-600 font-medium' : 'text-gray-300'}`}>{Number(j.failed)}</Td>
                  <Td align="left" className="text-xs text-gray-500">{j.initiated_by ?? '—'}</Td>
                </Tr>
              ))}
            </TBody>
          </TableShell>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          건별 발송 결과(성공·실패·사유)는 <Link to="/alert-logs" className="text-brand-600 underline">알림톡 발송 이력</Link> 메뉴에서 확인하세요. (수동·자동 발송 전체 기록)
        </p>
      </section>
    </div>
  )
}

const TARGET_LABEL: Record<Target, string> = {
  members: '골라서 보내기',
  all_members: '회원 전원',
  all_counselors: '상담사 전원',
  phones: '번호 직접 입력',
}
