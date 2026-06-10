import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Link2, KeyRound, User, Headphones, BadgeCheck, Megaphone, CreditCard, Paperclip } from 'lucide-react'
import { api } from '../lib/api'
import HtmlEditor, { type HtmlEditorHandle } from '../components/HtmlEditor'
import UploadedImage from '../components/UploadedImage'
import CounselorOpsCompact from '../components/CounselorOpsCompact'
import { API_BASE, FILE_BASE as FILE_ORIGIN } from '../lib/runtime-env'

// 한국 주요 은행 — 사용자 측 PayoutBankModal.tsx 와 동일 리스트
// (오타 방지 + 데이터 일관성을 위해 자유 입력 → select)
const KOREAN_BANKS = [
  '국민', '신한', '우리', '하나', '농협', 'IBK기업', 'SC제일', '씨티', 'KDB산업',
  '카카오뱅크', '케이뱅크', '토스뱅크',
  '부산', '대구', '경남', '광주', '전북', '제주',
  '새마을금고', '신협', '우체국', '수협',
] as const

interface CounselorPayload {
  // 계정
  mb_id: string
  password: string
  // 기본
  name: string
  nickname: string
  email: string
  phone: string
  gender: 'M' | 'F' | ''
  // 분야
  counselor_category: string
  // 운영
  dtmfno: string
  csrid: string
  telno: string
  counselor_priority: number | ''
  call_unit_seconds: number | ''
  call_070_unit_cost: number | ''
  call_060_unit_cost: number | ''
  chat_unit_seconds: number | ''
  chat_unit_cost: number | ''
  preflag: 'P' | 'Y' | ''
  paid_royalty_pct: number | ''
  free_royalty_pct: number | ''
  bank_name: string
  bank_holder: string
  bank_account: string
  state: string
  use_phone: boolean
  use_chat: boolean
  is_rising: boolean
  /** 메인 상위노출 — 정렬 1순위. 평소 false, 가끔 1~2명만 깜짝 노출 (2026-05-15) */
  is_recommended: boolean
  admin_memo: string
  register_m2net: boolean
  // 프로필
  profile_headline: string
  profile_hashtag1: string
  profile_hashtag2: string
  profile_specialty: string[]
  profile_traits: string[]
  profile_bio: string
  profile_notice: string
  profile_intro: string
  // 이벤트
  event_starts_at: string
  event_ends_at: string
  event_banner_image_url: string
  // 와이드 사진 오버레이 캡션
  wide_headline: string
  wide_subcaption: string
  // 전속파트너
  is_exclusive: boolean
}

const empty = (): CounselorPayload => ({
  mb_id: '', password: '',
  name: '', nickname: '', email: '', phone: '',
  gender: '',
  counselor_category: '타로',
  dtmfno: '', csrid: '', telno: '',
  counselor_priority: 1,
  call_unit_seconds: 30,
  call_070_unit_cost: 1500,
  call_060_unit_cost: 1500,
  chat_unit_seconds: 30,
  chat_unit_cost: 1500,
  preflag: 'P',
  paid_royalty_pct: '', free_royalty_pct: '',
  bank_name: '', bank_holder: '', bank_account: '',
  state: 'IDLE',
  use_phone: true, use_chat: true, is_rising: false, is_recommended: false,
  admin_memo: '',
  register_m2net: true,
  profile_headline: '',
  profile_hashtag1: '', profile_hashtag2: '',
  profile_specialty: [], profile_traits: [],
  profile_bio: '', profile_notice: '', profile_intro: '',
  event_starts_at: '', event_ends_at: '', event_banner_image_url: '',
  wide_headline: '', wide_subcaption: '',
  is_exclusive: false,
})

const CATEGORIES = ['타로', '신점', '사주', '심리'] as const
interface CounselorFile {
  id: number
  kind: string | null
  source_name: string
  stored_name: string
  stored_name_webp: string | null
  filesize: number
  created_at: string
}

const FILE_BASE = `${FILE_ORIGIN}/uploads/member/`

// 2026-05-15 운영 정책 갱신 — 12개. 사용자 신청 폼(APPLY_SPECIALTY_OPTIONS) 과 동일하게 유지.
const SPECIALTY_OPTIONS = ['재회', '속마음/궁합', '연애/짝사랑', '운세/총운', '금전/재물', '취업/합격', '사업/직장', '건강', '이사/부동산', '택일', '작명/개명', '가족/고민상담'] as const
export default function CounselorForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [data, setData] = useState<CounselorPayload>(empty())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  // 입력 변경 추적 — 저장 잊지 않도록 sticky 저장바에 펄스/뱃지 노출
  const [dirty, setDirty] = useState(isNew)
  // 비밀번호 보기 토글
  const [showPassword, setShowPassword] = useState(false)
  // 이벤트 활성 상담사 수 (3명 제한 — 등록 전 미리 보여줘서 사고 방지)
  const [eventActiveCount, setEventActiveCount] = useState<number | null>(null)
  // 스타일 선택지 — setting에서 동적 로드
  const [traitOptions, setTraitOptions] = useState<string[]>(['친절한', '직설적인', '논리적인', '공감형', '예언적인'])
  // 이벤트 배너 업로드 상태
  const [uploadingEventBanner, setUploadingEventBanner] = useState(false)
  // HtmlEditor refs — onSubmit 직전에 getHTML() 로 본문 추출
  const noticeRef = useRef<HtmlEditorHandle>(null)
  const introRef = useRef<HtmlEditorHandle>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [m2netResult, setM2netResult] = useState<{ ok: boolean; csrid?: string | null; error?: string } | null>(null)
  const [linkingM2net, setLinkingM2net] = useState(false)
  const [files, setFiles] = useState<CounselorFile[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  // 신규 등록 시 INSERT 전에 임시 보관할 파일 (등록 직후 일괄 업로드)
  const [pendingFiles, setPendingFiles] = useState<{
    profile?: File
    wide?: File
    contracts: File[]
  }>({ contracts: [] })

  // dirty 상태에서 페이지 이탈 시 브라우저 경고 — 저장 잊음 방지.
  // beforeunload는 탭 닫기·새로고침·외부 URL 이동에서만 동작 (SPA 내 라우팅은 별도)
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // 이벤트 활성 상담사 수 조회 — 3명 제한 사전 안내용. 사용자 API 재활용 (public).
  useEffect(() => {
    fetch(`${API_BASE}/user/counselors/event`)
      .then((r) => r.json())
      .then((j) => setEventActiveCount(Array.isArray(j.items) ? j.items.length : 0))
      .catch(() => setEventActiveCount(null))
  }, [])

  // 스타일 선택지 — setting에서 동적 로드 (어드민 환경설정에서 관리)
  useEffect(() => {
    api<{ data: Record<string, string> }>('/admin/settings/counselor')
      .then((r) => {
        const raw = r.data?.style_options
        if (raw) {
          try { setTraitOptions(JSON.parse(raw) as string[]) } catch { /* 파싱 실패 시 기본값 유지 */ }
        }
      })
      .catch(() => { /* 실패 시 기본값 유지 */ })
  }, [])

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    api<Record<string, unknown>>(`/admin/members/counselors/${id}`)
      .then((r) => {
        setData((d) => ({
          ...d,
          mb_id: String(r.mb_id ?? ''),
          name: String(r.name ?? ''),
          nickname: String(r.nickname ?? ''),
          email: String(r.email ?? ''),
          phone: String(r.phone ?? ''),
          gender: (r.gender as 'M' | 'F') ?? '',
          counselor_category: String(r.counselor_category ?? '타로'),
          dtmfno: String(r.dtmfno ?? ''),
          csrid: String(r.csrid ?? ''),
          telno: String(r.telno ?? ''),
          counselor_priority: (r.counselor_priority as number) ?? '',
          call_unit_seconds: (r.call_unit_seconds as number) ?? '',
          call_070_unit_cost: (r.call_070_unit_cost as number) ?? '',
          call_060_unit_cost: (r.call_060_unit_cost as number) ?? '',
          chat_unit_seconds: (r.chat_unit_seconds as number) ?? '',
          chat_unit_cost: (r.chat_unit_cost as number) ?? '',
          preflag: (r.preflag as 'P' | 'Y' | '') ?? 'P',
          paid_royalty_pct: (r.paid_royalty_pct as number) ?? '',
          free_royalty_pct: (r.free_royalty_pct as number) ?? '',
          bank_name: String(r.bank_name ?? ''),
          bank_holder: String(r.bank_holder ?? ''),
          bank_account: String(r.bank_account ?? ''),
          use_phone: r.use_phone === undefined ? true : Boolean(r.use_phone),
          use_chat: r.use_chat === undefined ? true : Boolean(r.use_chat),
          state: String(r.state ?? 'IDLE'),
          is_rising: Boolean(r.is_rising),
          is_recommended: Boolean(r.is_recommended),
          admin_memo: String(r.admin_memo ?? ''),
          register_m2net: false,  // 수정 시엔 m2net 재등록 기본 off
          profile_headline: String(r.profile_headline ?? ''),
          profile_hashtag1: String(r.profile_hashtag1 ?? ''),
          profile_hashtag2: String(r.profile_hashtag2 ?? ''),
          profile_specialty: Array.isArray(r.profile_specialty) ? (r.profile_specialty as string[]).filter(Boolean) : [],
          profile_traits: Array.isArray(r.profile_traits) ? (r.profile_traits as string[]).filter(Boolean) : [],
          profile_bio: String(r.profile_bio ?? ''),
          profile_notice: String(r.profile_notice ?? ''),
          profile_intro: String(r.profile_intro ?? ''),
          event_starts_at: r.event_starts_at ? toLocal(String(r.event_starts_at)) : '',
          event_ends_at: r.event_ends_at ? toLocal(String(r.event_ends_at)) : '',
          event_banner_image_url: String(r.event_banner_image_url ?? ''),
          wide_headline: String(r.wide_headline ?? ''),
          wide_subcaption: String(r.wide_subcaption ?? ''),
          is_exclusive: Boolean(r.is_exclusive),
        }))
        setFiles(Array.isArray(r.files) ? (r.files as CounselorFile[]) : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof CounselorPayload>(k: K, v: CounselorPayload[K]) => {
    setData((d) => ({ ...d, [k]: v }))
    setDirty(true)
  }

  // datetime-local 포맷 헬퍼 — Date → "YYYY-MM-DDTHH:mm"
  const toLocalInput = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // 이벤트 기간 프리셋 — 빠른 선택
  const applyEventPreset = (preset: 'today7' | 'today30' | 'thismonth' | 'nextmonth' | 'clear') => {
    if (preset === 'clear') {
      set('event_starts_at', '')
      set('event_ends_at', '')
      return
    }
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    let start = new Date(now), end = new Date(now)
    if (preset === 'today7') {
      end.setDate(end.getDate() + 7)
    } else if (preset === 'today30') {
      end.setDate(end.getDate() + 30)
    } else if (preset === 'thismonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    } else if (preset === 'nextmonth') {
      start = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      end = new Date(now.getFullYear(), now.getMonth() + 2, 1)
    }
    set('event_starts_at', toLocalInput(start))
    set('event_ends_at', toLocalInput(end))
  }

  // 이벤트 배너 이미지 업로드 — /admin/banners/upload 재활용 (WebP 변환 포함).
  // 폰 카메라 원본 같은 큰 파일은 클라이언트에서 최대 1600px 로 미리 축소 후 업로드.
  const uploadEventBanner = async (file: File) => {
    setUploadingEventBanner(true)
    setError(null)
    try {
      const resized = await resizeImage(file, 1600)
      const fd = new FormData()
      fd.append('file', resized)
      const res = await fetch(`${API_BASE}/admin/banners/upload`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message ?? '업로드 실패')
      }
      const j = (await res.json()) as { image_url: string; image_url_webp: string | null }
      // WebP 가 있으면 우선 사용 (배너는 정적 이미지라 호환성 OK)
      set('event_banner_image_url', j.image_url_webp ?? j.image_url)
      setSuccess('이벤트 배너 업로드 완료')
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploadingEventBanner(false)
    }
  }

  const onSubmit = async () => {
    setError(null)
    setSuccess(null)
    setM2netResult(null)
    // 검증
    if (isNew) {
      if (!data.mb_id) return setError('아이디를 입력하세요.')
      if (!data.password) return setError('비밀번호를 입력하세요.')
    }
    if (!data.name) return setError('이름을 입력하세요.')
    if (!data.nickname) return setError('닉네임을 입력하세요.')

    setSaving(true)
    try {
      // HtmlEditor 본문 추출 (state 가 아닌 ref 로 관리됨)
      const noticeHtml = noticeRef.current?.getHTML() ?? data.profile_notice
      const introHtml = introRef.current?.getHTML() ?? data.profile_intro
      const payload = {
        ...data,
        profile_notice: noticeHtml,
        profile_intro: introHtml,
        counselor_priority: data.counselor_priority === '' ? null : Number(data.counselor_priority),
        call_unit_seconds: data.call_unit_seconds === '' ? null : Number(data.call_unit_seconds),
        call_070_unit_cost: data.call_070_unit_cost === '' ? null : Number(data.call_070_unit_cost),
        call_060_unit_cost: data.call_060_unit_cost === '' ? null : Number(data.call_060_unit_cost),
        chat_unit_seconds: data.chat_unit_seconds === '' ? null : Number(data.chat_unit_seconds),
        chat_unit_cost: data.chat_unit_cost === '' ? null : Number(data.chat_unit_cost),
        paid_royalty_pct: data.paid_royalty_pct === '' ? null : Number(data.paid_royalty_pct),
        free_royalty_pct: data.free_royalty_pct === '' ? null : Number(data.free_royalty_pct),
        // 수정 시 비밀번호 비어있으면 미전송
        password: !isNew && !data.password ? undefined : data.password,
        event_starts_at: data.event_starts_at ? new Date(data.event_starts_at).toISOString() : null,
        event_ends_at: data.event_ends_at ? new Date(data.event_ends_at).toISOString() : null,
        event_banner_image_url: data.event_banner_image_url || null,
        wide_headline: data.wide_headline || null,
        wide_subcaption: data.wide_subcaption || null,
        is_exclusive: data.is_exclusive,
      }

      if (isNew) {
        const res = await api<{ id: number; csrid: string | null; m2net: { ok: boolean; error?: string } }>(
          '/admin/members/counselors',
          { method: 'POST', body: JSON.stringify(payload) },
        )
        setM2netResult({ ok: res.m2net.ok, csrid: res.csrid, error: res.m2net.error })
        // 임시 보관된 첨부파일들 자동 업로드
        await flushPendingFiles(res.id)
        if (!res.m2net.ok) {
          setSuccess(`등록이 완료되었습니다. (엠투넷 연동 실패: ${res.m2net.error ?? '알 수 없음'} — 수정 화면에서 재연동 가능)`)
        } else {
          setSuccess('등록이 완료되었습니다.')
        }
        navigate(`/members/counselors/${res.id}`, { replace: true })
      } else {
        await api(`/admin/members/counselors/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        setSuccess('수정이 완료되었습니다.')
        setDirty(false)
        // 저장 후 files / 이벤트 활성 카운트 재로드 — 서버 상태와 화면 동기화 (stale 방지)
        try {
          const fresh = await api<Record<string, unknown>>(`/admin/members/counselors/${id}`)
          setFiles(Array.isArray(fresh.files) ? (fresh.files as CounselorFile[]) : [])
          fetch(`${API_BASE}/user/counselors/event`)
            .then((r) => r.json())
            .then((j) => setEventActiveCount(Array.isArray(j.items) ? j.items.length : 0))
            .catch(() => {})
        } catch { /* 화면 stale 방지 실패는 무시 — 수정 자체는 성공 */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>

  // 상담사 상태 → 한글 라벨 + 색상 매핑 (헤더 뱃지용)
  const stateLabel: Record<string, { label: string; cls: string }> = {
    IDLE: { label: '상담가능', cls: 'bg-emerald-100 text-emerald-700' },
    CONN: { label: '상담중',   cls: 'bg-amber-100 text-amber-700' },
    ABSE: { label: '부재중',   cls: 'bg-gray-200 text-gray-600' },
    CRDY: { label: '상담준비', cls: 'bg-blue-100 text-blue-700' },
    RESV: { label: '예약',     cls: 'bg-violet-100 text-violet-700' },
  }
  const profileFile = files.find((f) => f.kind === 'profile')
  const wideFile = files.find((f) => f.kind === 'wide')
  const wideBgUrl = wideFile ? FILE_BASE + (wideFile.stored_name_webp ?? wideFile.stored_name) : null

  return (
    <div className="space-y-3 max-w-[1400px]">
      {/* 페이지 헤더 — 신규: 단순 타이틀 / 수정: 상담사 카드 (사진·이름·뱃지) */}
      {isNew ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/members/counselors')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">상담사 추가</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">신규 등록 시 엠투넷(m2net)에 자동 연동됩니다.</p>
            </div>
          </div>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
          >
            {saving ? '저장 중...' : '등록'}
          </button>
        </div>
      ) : (
        <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
          {/* 좌측 보라 액센트 바 */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500" aria-hidden />
          <div className="pl-6 pr-5 py-4 flex items-center gap-4">
            <button onClick={() => navigate('/members/counselors')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 shrink-0" aria-label="목록으로">
              <ArrowLeft className="w-5 h-5" />
            </button>
            {/* 프로필 사진 — 없으면 회색 원 + 이니셜 */}
            {profileFile ? (
              <picture className="shrink-0">
                {profileFile.stored_name_webp && <source srcSet={FILE_BASE + profileFile.stored_name_webp} type="image/webp" />}
                <img src={FILE_BASE + profileFile.stored_name} alt={data.nickname || data.name} className="w-14 h-14 rounded-full object-cover border border-gray-200" />
              </picture>
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 font-bold text-lg shrink-0">
                {(data.nickname || data.name || '?').slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[13px]">
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50 truncate">{data.nickname || data.name || `상담사 #${id}`}</h1>
                {data.nickname && data.name && data.nickname !== data.name && (
                  <span className="text-xs text-gray-400">({data.name})</span>
                )}
                <span className="text-xs text-gray-400">#{id}</span>
                {data.counselor_category && (
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium text-[12px]">{data.counselor_category}</span>
                )}
                {stateLabel[data.state] && (
                  <span className={`px-2 py-0.5 rounded-full font-medium text-[12px] ${stateLabel[data.state].cls}`}>● {stateLabel[data.state].label}</span>
                )}
                {data.csrid && (
                  <span className="text-gray-500"><span className="text-gray-400">csrid</span> <span className="font-mono">{data.csrid}</span></span>
                )}
                {data.dtmfno && (
                  <span className="text-gray-500"><span className="text-gray-400">dtmfno</span> <span className="font-mono">{data.dtmfno}</span></span>
                )}
                {data.mb_id && (
                  <span className="text-gray-500"><span className="text-gray-400">ID</span> <span className="font-mono">{data.mb_id}</span></span>
                )}
              </div>
            </div>
            {/* 비밀번호 변경 — 헤더 우측 빈 공간 활용 (계정 정보 섹션 흡수) */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">비밀번호 변경</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={data.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="비워두면 변경 안 함"
                  className={inputW.md + ' pr-12'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showPassword ? '숨김' : '보기'}
                </button>
              </div>
            </div>
            <button
              onClick={onSubmit}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 shrink-0"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 운영 현황 — 사진 카드 직후 조밀 패널 (자주 변하는 정보 우선 노출). 신규 모드는 데이터 없으니 표시 안 함. */}
      {!isNew && Number.isFinite(Number(id)) && Number(id) > 0 && (
        <CounselorOpsCompact memberId={Number(id)} />
      )}

      {/* 등급/단가 상세 진입 링크 — 수정 모드 한정 (Phase 8) */}
      {!isNew && (
        <Link
          to={`/members/counselors/${id}/grade-detail`}
          className="block px-4 py-3 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-700 text-sm transition-colors"
        >
          <span className="font-medium text-purple-700 dark:text-purple-300">⭐ 등급/단가 관리 →</span>
          <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">
            현재 등급 · 단가 · 변경 이력 + 분쟁 시 강제 수정
          </span>
        </Link>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm">{success}</div>
      )}
      {m2netResult && !m2netResult.ok && (
        <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-sm">
          엠투넷 연동 실패: {m2netResult.error}. 회원은 등록됨.
        </div>
      )}

      {/* 1) 계정 정보 — 신규 등록 시만 별도 섹션. 수정 모드는 헤더 우측에 비밀번호 입력 흡수됨. */}
      {isNew && (
      <Section title="계정 정보" subtitle="로그인 ID와 비밀번호" icon={<KeyRound className="w-5 h-5" />}>
        <FieldRow>
          <FieldPair label="아이디" required>
            <input type="text" value={data.mb_id} disabled={!isNew} onChange={(e) => set('mb_id', e.target.value)} className={inputW.md} />
          </FieldPair>
          <FieldPair label="비밀번호" required={isNew} hint={!isNew ? '비워두면 변경 안 함' : undefined}>
            <div className="flex items-center gap-1">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={data.password}
                onChange={(e) => set('password', e.target.value)}
                className={inputW.md}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500"
                title={showPassword ? '숨기기' : '보기'}
              >
                {showPassword ? '숨김' : '보기'}
              </button>
            </div>
          </FieldPair>
        </FieldRow>
      </Section>
      )}

      {/* 2) 기본 정보 — 한 줄에 다 (모니터 좁으면 자동 줄바꿈) */}
      <Section title="기본 정보" subtitle="인적사항·연락처·분야" icon={<User className="w-5 h-5" />}>
        <FieldRow>
          <FieldPair label="이름" required>
            <input type="text" value={data.name} onChange={(e) => set('name', e.target.value)} className={inputW.sm} />
          </FieldPair>
          <FieldPair label="닉네임" required hint="엠투넷 csrnm">
            <input type="text" value={data.nickname} onChange={(e) => set('nickname', e.target.value)} className={inputW.sm} />
          </FieldPair>
          <FieldPair label="휴대폰">
            <input
              type="tel"
              inputMode="tel"
              value={data.phone}
              onChange={(e) => set('phone', formatPhone(e.target.value))}
              placeholder="010-1234-5678"
              maxLength={13}
              className={inputW.md}
            />
          </FieldPair>
          <FieldPair label="이메일">
            <input type="email" value={data.email} onChange={(e) => set('email', e.target.value)} className={inputW.md} />
          </FieldPair>
          <FieldPair label="성별">
            <Segmented
              value={data.gender}
              onChange={(v) => set('gender', v as 'M' | 'F' | '')}
              options={[
                { value: '', label: '미지정' },
                { value: 'M', label: '남' },
                { value: 'F', label: '여' },
              ]}
            />
          </FieldPair>
          <FieldPair label="분야">
            <Segmented
              value={data.counselor_category}
              onChange={(v) => set('counselor_category', v)}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </FieldPair>
        </FieldRow>
      </Section>

      {/* 2-1) 계좌 정보 — 기본 정보 직후 (인적 정보 묶음) */}
      <Section title="계좌 정보" subtitle="정산 입금 계좌" icon={<CreditCard className="w-5 h-5" />}>
        <FieldRow>
          <FieldPair label="예금주">
            <input type="text" value={data.bank_holder} onChange={(e) => set('bank_holder', e.target.value)} className={inputW.md} />
          </FieldPair>
          <FieldPair label="은행명">
            <select
              value={data.bank_name}
              onChange={(e) => set('bank_name', e.target.value)}
              className={inputW.md + ' bg-white dark:bg-gray-800'}
            >
              <option value="">은행 선택</option>
              {KOREAN_BANKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </FieldPair>
          <FieldPair label="계좌번호">
            <input
              type="text"
              inputMode="numeric"
              value={data.bank_account}
              onChange={(e) => set('bank_account', e.target.value.replace(/[^0-9-]/g, ''))}
              className={inputW.lg + ' font-mono'}
            />
          </FieldPair>
        </FieldRow>
      </Section>

      {/* 3) 상담사 운영 — 좌(연결/운영) + 우(요금) 2열 분할, 가운데 세로 구분선 */}
      <Section title="상담사 운영" subtitle="연결번호·요금·정산 비율" icon={<Headphones className="w-5 h-5" />}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-3 xl:divide-x xl:divide-gray-200 xl:dark:divide-gray-700">
        {/* ─── 좌: 연결/운영 ─── */}
        <div className="space-y-3 xl:pr-10">
        <FieldRow>
          <FieldPair label="dtmfno" hint="ARS 연결번호 — 비우면 자동">
            <input
              type="text"
              inputMode="numeric"
              value={data.dtmfno}
              onChange={(e) => set('dtmfno', digitsOnly(e.target.value))}
              placeholder="자동"
              className={inputW.xs}
            />
          </FieldPair>
          <FieldPair label="연결순위" hint="작을수록 우선">
            <NumInput value={data.counselor_priority} onChange={(v) => set('counselor_priority', v)} className={inputW.xs} />
          </FieldPair>
        </FieldRow>
        <Row label="상담사 ID (csrid)" hint="엠투넷 발급 — 수정 불가">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={data.csrid}
              readOnly
              disabled
              placeholder={isNew ? '등록 시 자동 발급' : '미등록'}
              className={inputW.md + ' font-mono bg-gray-50 dark:bg-gray-800/60 text-gray-500'}
            />
            {!isNew && (
              <button
                type="button"
                disabled={linkingM2net}
                onClick={async () => {
                  setError(null); setSuccess(null); setLinkingM2net(true)
                  try {
                    // 폼 dirty 값(dtmfno·telno·단가 등)을 먼저 PATCH 로 저장 → 그 다음 m2net-link.
                    // 안 그러면 백엔드가 DB 의 옛 값으로 M2NET 에 등록 → dtmfno 가 빈값/구값으로 들어가는 버그.
                    const payload = {
                      ...data,
                      counselor_priority: data.counselor_priority === '' ? null : Number(data.counselor_priority),
                      call_unit_seconds: data.call_unit_seconds === '' ? null : Number(data.call_unit_seconds),
                      call_070_unit_cost: data.call_070_unit_cost === '' ? null : Number(data.call_070_unit_cost),
                      call_060_unit_cost: data.call_060_unit_cost === '' ? null : Number(data.call_060_unit_cost),
                      chat_unit_seconds: data.chat_unit_seconds === '' ? null : Number(data.chat_unit_seconds),
                      chat_unit_cost: data.chat_unit_cost === '' ? null : Number(data.chat_unit_cost),
                      paid_royalty_pct: data.paid_royalty_pct === '' ? null : Number(data.paid_royalty_pct),
                      free_royalty_pct: data.free_royalty_pct === '' ? null : Number(data.free_royalty_pct),
                      password: !data.password ? undefined : data.password,
                    }
                    await api(`/admin/members/counselors/${id}`, {
                      method: 'PATCH',
                      body: JSON.stringify(payload),
                    })
                    const res = await api<{ ok: boolean; csrid: string | null; error?: string }>(
                      `/admin/members/counselors/${id}/m2net-link`,
                      { method: 'POST' },
                    )
                    if (res.ok && res.csrid) {
                      set('csrid', res.csrid)
                      setSuccess(`엠투넷 연동 완료 (csrid: ${res.csrid})`)
                    } else {
                      setError(`엠투넷 연동 실패: ${res.error ?? '알 수 없음'}`)
                    }
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '엠투넷 연동 실패')
                  } finally {
                    setLinkingM2net(false)
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-md bg-brand-500 hover:bg-brand-600 text-white whitespace-nowrap disabled:opacity-50"
              >
                <Link2 className="w-3.5 h-3.5" />
                {linkingM2net ? '연동 중…' : data.csrid ? '재연동' : '엠투넷 연동하기'}
              </button>
            )}
          </div>
        </Row>
        <Row label="실제 연결 전화번호" hint="070 발신 시 실제 연결될 번호">
          <input
            type="tel"
            inputMode="tel"
            value={data.telno}
            onChange={(e) => set('telno', formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            maxLength={13}
            className={inputW.md}
          />
        </Row>
        {/* 선불여부 + 상담사 상태 */}
        <FieldRow>
          <FieldPair label="선불여부">
            <Segmented
              value={data.preflag}
              onChange={(v) => set('preflag', v as 'P' | 'Y' | '')}
              options={[
                { value: 'P', label: '둘다' },
                { value: 'Y', label: '선불' },
                { value: '', label: '후불' },
              ]}
            />
          </FieldPair>
          <FieldPair label="상담사 상태" hint="시스템 자동 관리 — 표시만">
            <Segmented
              value={data.state}
              onChange={() => { /* readonly */ }}
              disabled
              options={[
                { value: 'IDLE', label: '상담가능' },
                { value: 'ABSE', label: '부재중' },
                { value: 'CONN', label: '상담중' },
                { value: 'CRDY', label: '상담준비' },
                { value: 'RESV', label: '예약' },
              ]}
            />
          </FieldPair>
        </FieldRow>
        <Row label="상담 사용">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-300 shrink-0">전화</span>
              <Segmented
                value={data.use_phone ? '1' : '0'}
                onChange={(v) => set('use_phone', v === '1')}
                options={[{ value: '1', label: '사용' }, { value: '0', label: '미사용' }]}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-300 shrink-0">채팅</span>
              <Segmented
                value={data.use_chat ? '1' : '0'}
                onChange={(v) => set('use_chat', v === '1')}
                options={[{ value: '1', label: '사용' }, { value: '0', label: '미사용' }]}
              />
            </label>
            <div className="ml-4 flex items-center gap-4 text-sm">
              <Toggle label="급상승" checked={data.is_rising} onChange={(v) => set('is_rising', v)} />
              <Toggle label="⭐ 메인 상위노출" checked={data.is_recommended} onChange={(v) => set('is_recommended', v)} />
              <Toggle label="🏅 전속파트너" checked={data.is_exclusive} onChange={(v) => set('is_exclusive', v)} />
              {isNew && (
                <Toggle label="엠투넷 자동 등록" checked={data.register_m2net} onChange={(v) => set('register_m2net', v)} />
              )}
            </div>
          </div>
        </Row>
        </div>
        {/* ─── 우: 요금/정산 ─── */}
        <div className="space-y-3 xl:pl-10">
        {/* 단위시간 그룹 — 전화 / 채팅 + 프리셋 (30·60초) */}
        <Row label="단위시간 (초)" hint="회원에게 차감되는 단위 (M2NET dectm)">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              전화 <NumInput value={data.call_unit_seconds} onChange={(v) => set('call_unit_seconds', v)} className={inputW.xs} />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              채팅 <NumInput value={data.chat_unit_seconds} onChange={(v) => set('chat_unit_seconds', v)} className={inputW.xs} />
            </label>
          </div>
        </Row>
        {/* 단가 그룹 — 070 / 060 / 채팅 한 줄 */}
        <Row label="단가 (원)" hint="단위시간당 차감 금액">
          <div className="flex flex-col gap-2">
            {/* 신규 가입자 기본단가 안내 (2026-05-22) — 가입 후 30일 이내 + 1000원 기본값일 때 노출.
                조건이 맞으면 운영자가 "이건 자동 박힌 기본값이구나" 인지 가능. */}
            {Number(data.call_070_unit_cost) === 1000
              && Number(data.chat_unit_cost) === 1000 && (
              <div className="px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                💡 가입 시 자동 설정된 <strong>기본값(1,000원)</strong>일 수 있습니다.
                필요 시 단가를 수정해주세요.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                070 <NumInput value={data.call_070_unit_cost} onChange={(v) => set('call_070_unit_cost', v)} className={inputW.sm} thousand />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                060 <NumInput value={data.call_060_unit_cost} onChange={(v) => set('call_060_unit_cost', v)} className={inputW.sm} thousand />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                채팅 <NumInput value={data.chat_unit_cost} onChange={(v) => set('chat_unit_cost', v)} className={inputW.sm} thousand />
              </label>
            </div>
          </div>
        </Row>
        {/* 로열티 그룹 — 유료 / 무료 한 줄 */}
        <Row label="로열티 (%)" hint="상담사 정산 비율">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              유료 <NumInput value={data.paid_royalty_pct} onChange={(v) => set('paid_royalty_pct', v)} className={inputW.xs} />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              무료 <NumInput value={data.free_royalty_pct} onChange={(v) => set('free_royalty_pct', v)} className={inputW.xs} />
            </label>
          </div>
        </Row>
        </div>
        </div>
      </Section>

      {/* 4) 프로필 */}
      <Section title="프로필 정보" subtitle="고객에게 노출되는 자기소개" icon={<BadgeCheck className="w-5 h-5" />}>
        {/* 한줄소개 + 해시태그 한 줄 */}
        <FieldRow>
          <FieldPair label="한줄소개" hint="최대 25자 · 카드/리스트 노출명">
            <input
              type="text"
              maxLength={25}
              value={data.profile_headline}
              onChange={(e) => set('profile_headline', e.target.value)}
              placeholder="25자 이내"
              className={inputW.xl}
            />
          </FieldPair>
          <FieldPair label="해시태그" hint="각 5자 이내, 최대 2개">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-gray-400">#</span>
                <input
                  type="text"
                  maxLength={5}
                  value={data.profile_hashtag1}
                  onChange={(e) => set('profile_hashtag1', e.target.value)}
                  placeholder="태그1"
                  className={inputW.sm}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">#</span>
                <input
                  type="text"
                  maxLength={5}
                  value={data.profile_hashtag2}
                  onChange={(e) => set('profile_hashtag2', e.target.value)}
                  placeholder="태그2"
                  className={inputW.sm}
                />
              </div>
            </div>
          </FieldPair>
        </FieldRow>
        <Row label="전문분야" hint={`${data.profile_specialty.length} / ${SPECIALTY_OPTIONS.length} 선택됨`}>
          <CheckGrid
            options={SPECIALTY_OPTIONS as readonly string[]}
            value={data.profile_specialty}
            onChange={(v) => set('profile_specialty', v)}
          />
        </Row>
        <Row label="스타일" hint={`${data.profile_traits.length} / ${traitOptions.length} 선택됨`}>
          <CheckGrid
            options={traitOptions}
            value={data.profile_traits}
            onChange={(v) => set('profile_traits', v)}
          />
        </Row>
        {/* 모바일 상세 페이지에 노출되는 콘텐츠 3종 — 폰 프레임에 감싸 모바일 노출 모습을 시각화.
            xl 이하에서는 자동 1열로 wrap. 폭 375px 고정 (실제 모바일 뷰포트와 동일). */}
        <div className="pt-2">
          <div className="flex flex-wrap gap-6 justify-start">
            <PhoneFrame title="상담사 약력" subtitle="최대 1000자 · 줄바꿈으로 항목 구분">
              <div className="px-3 pb-3 relative">
                <textarea
                  maxLength={1000}
                  value={data.profile_bio}
                  onChange={(e) => set('profile_bio', e.target.value)}
                  className={`w-full h-[460px] resize-none text-[13px] ${inputBase}`}
                />
                {/* 항목 카운터 — 모바일에서 N개 항목으로 노출됨 */}
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-brand-600 dark:text-brand-400">
                    {(() => {
                      const n = data.profile_bio.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).length
                      return n > 0 ? `📱 모바일에서 ${n}개 항목으로 노출됩니다` : '줄바꿈으로 항목 구분'
                    })()}
                  </span>
                  <span className="text-gray-400">{data.profile_bio.length} / 1000</span>
                </div>
              </div>
            </PhoneFrame>
            <PhoneFrame title="상담사 공지" subtitle="고객에게 보일 짧은 공지 · WYSIWYG">
              <div className="px-1 pb-3">
                <HtmlEditor ref={noticeRef} initialHtml={data.profile_notice} height="460px" uploadEndpoint="/admin/events/upload" />
              </div>
            </PhoneFrame>
            <PhoneFrame title="상담사 소개" subtitle="프로필 상세 본문 · 이미지·서식 가능">
              <div className="px-1 pb-3">
                <HtmlEditor ref={introRef} initialHtml={data.profile_intro} height="460px" uploadEndpoint="/admin/events/upload" />
              </div>
            </PhoneFrame>
          </div>
        </div>
      </Section>

      {/* 5) 이벤트 상담사 — 기간 + 배너 URL 한 줄 */}
      <Section title="이벤트 상담사" subtitle="메인 배너 + 리스트 이벤트 탭 노출 (동시 3명)" icon={<Megaphone className="w-5 h-5" />}>
        {/* 현재 활성 상담사 수 — 3명 제한 사전 안내 */}
        {eventActiveCount !== null && (
          <div className={`text-sm mb-2 ${eventActiveCount >= 3 ? 'text-rose-600' : 'text-gray-600 dark:text-gray-300'}`}>
            현재 활성 이벤트 상담사: <strong className={eventActiveCount >= 3 ? 'text-rose-700' : 'text-brand-600'}>{eventActiveCount}</strong> / 3명
            {eventActiveCount >= 3 && (
              <span className="ml-2 text-xs text-rose-500">⚠ 이미 3명 등록됨 — 기존 1명을 해제해야 추가 가능</span>
            )}
          </div>
        )}
        {/* 가로 2 column: 좌=② 자동 카드 박스(큰 박스), 우=이벤트 기간 + ① 커스텀 배너(세로 stack) */}
        <div className="flex flex-wrap items-start gap-6">
          {/* 좌: ② 자동 카드 — 회색 dashed border (fallback). 내부 가로 2 column: input 좌 / 미리보기 우 */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-700 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-400 text-white text-[11px] font-bold">2</span>
              <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">자동 카드 캡션</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">— 커스텀 배너 비었을 때 fallback</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mb-3">와이드 사진(첨부파일 섹션) 위에 아래 캡션이 합성되어 노출됩니다</p>
            <div className="flex flex-wrap items-start gap-5">
              {/* input 들 */}
              <div className="flex flex-col gap-2 min-w-[280px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-gray-700 dark:text-gray-300">헤드라인 <span className="text-gray-400 text-[11px]">(굵게 — 1줄)</span></span>
                    <span className="text-[11px] text-gray-400">{data.wide_headline.length}/40</span>
                  </div>
                  <input
                    type="text"
                    value={data.wide_headline}
                    onChange={(e) => set('wide_headline', e.target.value)}
                    placeholder="예: 다시 시작하는 인연"
                    maxLength={40}
                    className={`w-[300px] max-w-full text-[13px] font-semibold ${inputBase}`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-gray-700 dark:text-gray-300">서브카피 <span className="text-gray-400 text-[11px]">(작게 — 1줄)</span></span>
                    <span className="text-[11px] text-gray-400">{data.wide_subcaption.length}/40</span>
                  </div>
                  <input
                    type="text"
                    value={data.wide_subcaption}
                    onChange={(e) => set('wide_subcaption', e.target.value)}
                    placeholder="예: 재혼·재회 타로 · 30초 1,800원"
                    maxLength={40}
                    className={`w-[300px] max-w-full text-[13px] ${inputBase}`}
                  />
                </div>
              </div>

              {/* 자동 카드 미리보기 */}
              <div className="flex flex-col">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">자동 카드 미리보기</div>
                <div
                  className="relative w-[320px] max-w-full aspect-[16/9] rounded-lg overflow-hidden bg-[#3D2078] bg-cover bg-center"
                  style={wideBgUrl ? { backgroundImage: `url(${wideBgUrl})` } : undefined}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black/70" />
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-[#f472b6] text-white text-[10px] font-semibold leading-none">
                    이벤트 상담사
                  </div>
                  <p className="absolute left-3 right-3 top-1/2 -translate-y-1/2 text-white text-[18px] font-bold leading-tight drop-shadow line-clamp-1">
                    {data.wide_headline.trim() || <span className="text-white/40">(헤드라인 입력)</span>}
                  </p>
                  <p className="absolute left-3 right-3 top-[75%] -translate-y-1/2 text-white/85 text-[12px] leading-tight line-clamp-1">
                    {data.wide_subcaption.trim() || <span className="text-white/30">(서브카피 입력)</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 우: 이벤트 기간 + ① 커스텀 배너 — 세로 stack */}
          <div className="flex flex-col gap-4 max-w-2xl">
            {/* 이벤트 기간 */}
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 block mb-2">이벤트 기간</label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="datetime-local" value={data.event_starts_at} onChange={(e) => set('event_starts_at', e.target.value)} className={`w-[220px] ${inputBase}`} />
                  <span className="text-gray-400 text-sm">~</span>
                  <input type="datetime-local" value={data.event_ends_at} onChange={(e) => set('event_ends_at', e.target.value)} className={`w-[220px] ${inputBase}`} />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-gray-400 text-xs mr-1">빠른 선택:</span>
                  <button type="button" onClick={() => applyEventPreset('today7')} className="px-2 py-0.5 text-xs rounded border border-gray-200 hover:bg-gray-50 text-gray-600">+7일</button>
                  <button type="button" onClick={() => applyEventPreset('today30')} className="px-2 py-0.5 text-xs rounded border border-gray-200 hover:bg-gray-50 text-gray-600">+30일</button>
                  <button type="button" onClick={() => applyEventPreset('thismonth')} className="px-2 py-0.5 text-xs rounded border border-gray-200 hover:bg-gray-50 text-gray-600">이번달</button>
                  <button type="button" onClick={() => applyEventPreset('nextmonth')} className="px-2 py-0.5 text-xs rounded border border-gray-200 hover:bg-gray-50 text-gray-600">다음달</button>
                  {(data.event_starts_at || data.event_ends_at) && (
                    <button type="button" onClick={() => applyEventPreset('clear')} className="px-2 py-0.5 text-xs rounded border border-rose-200 text-rose-600 hover:bg-rose-50">해제</button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 leading-snug">종료 비우면 무기한. 동시 최대 3명.</p>
              </div>
            </div>

            {/* ① 커스텀 배너 — 연보라 박스 (우선) */}
            <div className="rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-500 text-white text-[11px] font-bold">1</span>
                <span className="text-[13px] font-semibold text-brand-700 dark:text-brand-300">커스텀 배너 이미지</span>
                <span className="text-[11px] text-brand-600/70 dark:text-brand-400/70">— 채우면 이 이미지가 우선 노출</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={data.event_banner_image_url}
                  onChange={(e) => set('event_banner_image_url', e.target.value)}
                  placeholder="URL 직접 입력"
                  className={`w-[240px] text-xs ${inputBase}`}
                />
                <label className={`shrink-0 inline-flex items-center px-3 py-2 rounded-md text-xs font-medium cursor-pointer ${uploadingEventBanner ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600 text-white'}`}>
                  {uploadingEventBanner ? '업로드 중…' : '파일 선택'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingEventBanner}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) { void uploadEventBanner(f); e.target.value = '' }
                    }}
                    className="hidden"
                  />
                </label>
                {data.event_banner_image_url && (
                  <button type="button" onClick={() => set('event_banner_image_url', '')} className="shrink-0 px-2 py-0.5 text-xs rounded border border-rose-200 text-rose-600 hover:bg-rose-50">제거</button>
                )}
              </div>
              {data.event_banner_image_url && (
                <UploadedImage
                  src={data.event_banner_image_url}
                  alt="이벤트 배너"
                  className="mt-2 max-w-[360px] max-h-[220px] rounded-lg border border-gray-200"
                />
              )}
            </div>
          </div>
        </div>
        {false && data.event_starts_at && (
          <Row label="">
            <button
              type="button"
              onClick={() => { set('event_starts_at', ''); set('event_ends_at', ''); set('event_banner_image_url', '') }}
              className="text-xs text-rose-600 hover:text-rose-700 underline"
            >
              이벤트 해제 (등록 해제 시 저장 필요)
            </button>
          </Row>
        )}
      </Section>

      {/* 7) 첨부파일 + 메모 — 신규 등록 시 임시 보관, 저장 시 자동 업로드 */}
      <Section title="첨부파일 / 메모" subtitle="프로필·와이드 사진·계약서·관리자 메모" icon={<Paperclip className="w-5 h-5" />}>
        {/* 상단: 사진 영역 — 프로필 + (와이드+캡션) 가로 2 column */}
        <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
          {/* 좌: 프로필 사진 */}
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 block">프로필 사진</label>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">JPG/PNG/GIF/WEBP · 5MB 이하 · 권장 750×600 (5:4 비율) · 어깨가 모두 나오는 상반신 정면 사진 권장</p>
            </div>
            <FileSlot
              kind="profile"
              accept="image/*"
              files={files.filter((f) => f.kind === 'profile')}
              uploading={uploading === 'profile'}
              onUpload={(file) => uploadFile('profile', file)}
              onDelete={(fileId) => removeFile(fileId)}
            />
          </div>

          {/* 우: 와이드 사진 — 상세 페이지 hero + 이벤트 자동 카드 배경으로 사용. 캡션은 "이벤트 상담사" 섹션으로 이동 */}
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 block">와이드 사진</label>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">JPG/PNG/GIF/WEBP · 5MB 이하 · 권장 780×384 (≈ 65:32). 상세 페이지 hero + 이벤트 활성 시 자동 카드 배경</p>
            </div>
            <FileSlot
              kind="wide"
              accept="image/*"
              files={files.filter((f) => f.kind === 'wide')}
              uploading={uploading === 'wide'}
              onUpload={(file) => uploadFile('wide', file)}
              onDelete={(fileId) => removeFile(fileId)}
            />
          </div>
        </div>

        {/* 하단: 운영 자료 — 계약서 + 관리자 메모 가로 2 column. 상단 영역과 시각적 분리를 위해 상단 border */}
        <div className="flex flex-wrap items-start gap-x-10 gap-y-6 pt-5 mt-5 border-t border-gray-100 dark:border-gray-800">
          {/* 좌: 계약서 */}
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 block">계약서</label>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">PDF/JPG/PNG, 10MB 이하 — 여러 장 가능</p>
            </div>
            <FileSlot
              kind="contract"
              accept="application/pdf,image/*"
              files={files.filter((f) => f.kind === 'contract')}
              uploading={uploading === 'contract'}
              onUpload={(file) => uploadFile('contract', file)}
              onDelete={(fileId) => removeFile(fileId)}
              multipleSlot
            />
          </div>

          {/* 우: 관리자 메모 — 적당한 max-width 로 무한정 늘어남 방지 */}
          <div className="flex-1 min-w-[300px] max-w-2xl flex flex-col gap-2">
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 block">관리자 메모</label>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">회원에게 노출되지 않는 내부 메모</p>
            </div>
            <textarea
              rows={3}
              value={data.admin_memo}
              onChange={(e) => set('admin_memo', e.target.value)}
              placeholder="특이사항, 연락 이력 등"
              className={`w-full ${inputBase}`}
            />
          </div>
        </div>
      </Section>

      {/* 차단 관리 — 수정 모드만 */}
      {!isNew && id && <BlockPanel counselorId={Number(id)} />}

        {/* 폼이 길어 상단 저장 버튼이 안 보이는 문제 해결 — 항상 보이는 sticky 저장 바.
            dirty 상태면 펄스/그림자/뱃지로 강조, 없으면 차분한 회색. */}
        <div className="sticky bottom-0 left-0 right-0 -mx-5 px-5 py-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 z-30">
          <button
            onClick={onSubmit}
            disabled={saving}
            className={`relative inline-flex items-center gap-2 px-8 h-12 text-base font-semibold rounded-xl text-white transition-all disabled:opacity-50 ${
              dirty
                ? 'bg-brand-600 hover:bg-brand-700 shadow-[0_8px_24px_-6px_rgba(130,89,245,0.55)] hover:scale-[1.02] save-pulse'
                : 'bg-gray-400 hover:bg-gray-500'
            }`}
          >
            {dirty && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              </span>
            )}
            <span>{saving ? '저장 중…' : isNew ? '등록' : '저장'}</span>
            {!saving && (
              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden>
                <path d="M7.3 4.3a1 1 0 0 0 0 1.4L11.6 10l-4.3 4.3a1 1 0 1 0 1.4 1.4l5-5a1 1 0 0 0 0-1.4l-5-5a1 1 0 0 0-1.4 0z" />
              </svg>
            )}
          </button>
          <span className={`text-sm font-medium ${dirty ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400 dark:text-gray-500'}`}>
            {dirty ? '저장하지 않은 변경이 있습니다' : '변경 사항 없음'}
          </span>
        </div>
    </div>
  )

  async function uploadFile(kind: 'profile' | 'contract' | 'wide', rawFile: File) {
    setError(null)

    // 큰 사진은 클라이언트에서 리사이즈 후 업로드 — 폰 카메라 원본 등 네트워크/서버 부하 ↓.
    // PDF/GIF 는 resizeImage 내부에서 자동으로 원본 그대로 반환됨.
    const maxDim = kind === 'profile' ? 800 : 1600
    const file = await resizeImage(rawFile, maxDim)

    // 신규 등록 모드 — 아직 ID 없음 → 임시 보관 + 미리보기용 fake CounselorFile 생성
    if (isNew) {
      const blobUrl = URL.createObjectURL(file)
      const fakeId = -Math.floor(Math.random() * 1_000_000) - 1 // 음수 ID로 임시 표시
      setFiles((arr) => {
        const isSingle = kind === 'profile' || kind === 'wide'
        const next = isSingle ? arr.filter((f) => f.kind !== kind) : arr
        return [
          {
            id: fakeId,
            kind,
            source_name: file.name,
            stored_name: blobUrl,
            stored_name_webp: null,
            filesize: file.size,
            created_at: new Date().toISOString(),
          },
          ...next,
        ]
      })
      setPendingFiles((p) => {
        if (kind === 'profile') return { ...p, profile: file }
        if (kind === 'wide') return { ...p, wide: file }
        return { ...p, contracts: [...p.contracts, file] }
      })
      const label = kind === 'profile' ? '프로필 사진' : kind === 'wide' ? '와이드 사진' : '계약서'
      setSuccess(`${label} 선택됨 — 등록 시 함께 업로드됩니다.`)
      return
    }

    if (!id) return
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(
        API_BASE + `/admin/members/counselors/${id}/files/${kind}`,
        { method: 'POST', credentials: 'include', body: fd },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message ?? `업로드 실패 (${res.status})`)
      }
      const r = await res.json()
      setFiles((arr) => {
        // 단일 슬롯 (profile / wide) 은 같은 kind 의 기존 row 를 교체
        const isSingle = kind === 'profile' || kind === 'wide'
        const next = isSingle ? arr.filter((f) => f.kind !== kind) : arr
        return [{ id: r.id, kind, source_name: r.source_name, stored_name: r.stored_name, stored_name_webp: r.stored_name_webp ?? null, filesize: file.size, created_at: new Date().toISOString() }, ...next]
      })
      const label = kind === 'profile' ? '프로필 사진' : kind === 'wide' ? '와이드 사진' : '계약서'
      setSuccess(`${label} 업로드 완료`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploading(null)
    }
  }

  async function removeFile(fileId: number) {
    setError(null)

    // 신규 등록 시 임시 파일 (음수 ID) — 서버 호출 없이 로컬 제거만
    if (fileId < 0) {
      const target = files.find((f) => f.id === fileId)
      setFiles((arr) => arr.filter((f) => f.id !== fileId))
      if (target?.kind === 'profile') {
        setPendingFiles((p) => ({ ...p, profile: undefined }))
      } else if (target?.kind === 'wide') {
        setPendingFiles((p) => ({ ...p, wide: undefined }))
      } else if (target?.kind === 'contract') {
        setPendingFiles((p) => ({
          ...p,
          contracts: p.contracts.filter((f) => f.name !== target.source_name),
        }))
      }
      return
    }

    if (!id) return
    if (!window.confirm('파일을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(
        API_BASE + `/admin/members/counselors/${id}/files/${fileId}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!res.ok) throw new Error(`삭제 실패 (${res.status})`)
      setFiles((arr) => arr.filter((f) => f.id !== fileId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  /** 신규 등록 직후 임시 파일들을 일괄 업로드 */
  async function flushPendingFiles(newId: number): Promise<void> {
    const tasks: Array<{ kind: string; file: File }> = []
    if (pendingFiles.profile) tasks.push({ kind: 'profile', file: pendingFiles.profile })
    if (pendingFiles.wide) tasks.push({ kind: 'wide', file: pendingFiles.wide })
    pendingFiles.contracts.forEach((f) => tasks.push({ kind: 'contract', file: f }))
    if (tasks.length === 0) return

    for (const t of tasks) {
      try {
        const fd = new FormData()
        fd.append('file', t.file)
        await fetch(
          API_BASE + `/admin/members/counselors/${newId}/files/${t.kind}`,
          { method: 'POST', credentials: 'include', body: fd },
        )
      } catch {
        // 업로드 실패는 무시 — 사용자가 수정 페이지에서 재시도 가능
      }
    }
  }
}

// ─── 헬퍼 ─────────────────────────────────────
// 인풋 폭 프리셋 — 데이터 유형별 적정 폭 (좌측 정렬 + 우측 여백)
const inputBase = 'px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-500 disabled:hover:border-gray-300'
const inputClsFull = `w-full max-w-2xl ${inputBase}` // textarea·HTML 에디터·캡션 입력 등
const inputW = {
  xs: `w-24 ${inputBase}`,   // 96px  — 매우 짧은 숫자 (단위 초·우선순위)
  sm: `w-32 ${inputBase}`,   // 128px — 숫자, 짧은 코드
  md: `w-48 ${inputBase}`,   // 192px — 짧은 텍스트 (이름·전화·닉네임)
  lg: `w-64 ${inputBase}`,   // 256px — 일반 텍스트 (아이디·계좌·이메일)
  xl: `w-80 ${inputBase}`,   // 320px — 긴 텍스트 (한줄소개)
}
// 기본 inputCls — 짧은 텍스트 적정 폭 (lg). 더 좁거나 넓은 칸은 inputW.{xs|sm|md|xl} / inputClsFull 명시.
const inputCls = inputW.lg

/** 숫자만 허용. IME 한글 입력은 무시 */
function digitsOnly(s: string): string {
  return s.replace(/[^0-9]/g, '')
}

/**
 * 이미지 파일 클라이언트 리사이즈.
 *  - max(width, height) 가 maxDim 보다 크면 비율 유지하며 축소
 *  - JPEG quality 0.85 로 인코딩 (배너 용도 충분)
 *  - GIF/non-image 는 그대로 반환 (애니메이션 보존)
 *  - 실패 시 원본 그대로 반환 (업로드는 진행)
 */
async function resizeImage(file: File, maxDim: number): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/gif') return file
  try {
    const url = URL.createObjectURL(file)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = url
    })
    URL.revokeObjectURL(url)
    const { width, height } = img
    if (width <= maxDim && height <= maxDim) return file
    const scale = Math.min(maxDim / width, maxDim / height)
    const w = Math.round(width * scale)
    const h = Math.round(height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob) return file
    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], newName, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
/**
 * 한국 전화번호 자동 포맷.
 *  - 숫자만 추출 후 최대 11자리
 *  - 010/011/016~019 (휴대폰): 3-4-4
 *  - 02 (서울)            : 2-3-4 또는 2-4-4
 *  - 0XX (지역 3자리)     : 3-3-4 또는 3-4-4
 */
// ISO 문자열 → datetime-local input 값 형식 (YYYY-MM-DDTHH:mm, 로컬 타임)
function toLocal(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function formatPhone(s: string): string {
  const d = s.replace(/[^0-9]/g, '').slice(0, 11)
  if (!d) return ''
  if (d.startsWith('02')) {
    if (d.length <= 2) return d
    if (d.length <= 5) return `02-${d.slice(2)}`
    if (d.length <= 9) return `02-${d.slice(2, 5)}-${d.slice(5)}`
    return `02-${d.slice(2, 6)}-${d.slice(6)}`
  }
  if (d.startsWith('01') && d.length >= 4) {
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }
  if (d.startsWith('0') && d.length >= 4) {
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
    if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }
  return d
}

// Section — 1열 단방향 흐름. cols prop은 호환을 위해 남겨둠(무시).
// Section — 시각적 계층 강화: 좌측 보라 액센트 바 + 아이콘 + 굵은 제목 + 부제 + shadow
// icon, subtitle 는 선택 — 없으면 기본 헤더만 노출
function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  cols?: 1 | 2
}) {
  return (
    <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
      {/* 좌측 보라 액센트 바 — 섹션 영역을 명확히 구분 */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500" aria-hidden />
      <div className="pl-6 pr-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-50 leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="pl-6 pr-5 py-5 space-y-3">{children}</div>
    </div>
  )
}

// Row — 라벨(140px 고정) + 인풋(자체 폭) 좌측 정렬. 우측은 자연스러운 여백.
// 단일 인풋·textarea·파일슬롯 같은 풀폭 항목에 사용. 여러 짧은 인풋은 FieldRow + FieldPair 사용.
function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
  fullWidth?: boolean
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-4 py-1">
      <div className="md:w-[140px] md:pt-2 shrink-0">
        <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{hint}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// FieldRow — 짧은 인풋 여러 개를 가로로 배치. 정보 밀도 높이고 스크롤 줄임.
function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3 py-1">
      {children}
    </div>
  )
}

// FieldPair — 작은 라벨 + 인풋 한 쌍. FieldRow 안에서 사용.
function FieldPair({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      <div className="flex flex-col gap-0.5">
        <div>{children}</div>
        {hint && <div className="text-[11px] text-gray-400 leading-snug">{hint}</div>}
      </div>
    </div>
  )
}

/** 숫자 전용 입력 — IME 한글 입력 차단, 빈 값은 ''로 보존.
 *  thousand=true 시 입력 중에도 천 단위 콤마 표시 (1500 → 1,500). 저장 시엔 숫자만. */
function NumInput({
  value,
  onChange,
  className,
  placeholder,
  thousand,
}: {
  value: number | ''
  onChange: (v: number | '') => void
  className?: string
  placeholder?: string
  thousand?: boolean
}) {
  const display = thousand && typeof value === 'number' ? value.toLocaleString('ko-KR') : String(value === '' ? '' : value)
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        const cleaned = digitsOnly(e.target.value)
        onChange(cleaned === '' ? '' : Number(cleaned))
      }}
      className={className ?? inputCls}
    />
  )
}

/** 세그먼트 컨트롤 — 연결된 버튼 그룹 (단일 선택). 옵션 적을 때 셀렉트보다 직관적.
 *  disabled=true 시 비인터랙티브 (시스템 자동 관리 값을 표시만 할 때). */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
}) {
  return (
    <div className={`inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden text-sm ${disabled ? 'opacity-70' : ''}`}>
      {options.map((o, i) => {
        const on = value === o.value
        return (
          <button
            type="button"
            key={String(o.value)}
            disabled={disabled}
            onClick={() => !disabled && onChange(o.value)}
            className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-gray-300 dark:border-gray-700' : ''} ${
              on
                ? (disabled ? 'bg-gray-300 text-gray-700' : 'bg-brand-500 text-white')
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ' + (disabled ? 'cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700')
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
      <span>{label}</span>
    </label>
  )
}

function FileSlot({
  kind,
  accept,
  files,
  uploading,
  onUpload,
  onDelete,
  multipleSlot = false,
  overlay,
}: {
  kind: 'profile' | 'contract' | 'wide'
  accept: string
  files: CounselorFile[]
  uploading: boolean
  onUpload: (f: File) => void | Promise<void>
  onDelete: (id: number) => void | Promise<void>
  multipleSlot?: boolean
  /** 미리보기 이미지 위에 그려지는 absolute 오버레이 — 와이드 사진 캡션 등 */
  overlay?: React.ReactNode
}) {
  const isImage = (name: string) => /\.(jpe?g|png|gif|webp)$/i.test(name)
  // 단일 슬롯 (1장만 존재 — 같은 kind 업로드 시 기존 row 교체)
  const isSingleSlot = kind === 'profile' || kind === 'wide'
  // 미리보기 크기 — 프로필 200×200 정사각, 와이드 390×192 (실제 노출 사이즈와 동일, ≈ 65:32)
  const preview =
    kind === 'profile'
      ? { width: 200, height: 200 }
      : kind === 'wide'
        ? { width: 390, height: 192 }
        : { width: 390, height: 192 }

  if (isSingleSlot) {
    const f = files[0]
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                void onUpload(file)
                e.target.value = ''
              }
            }}
            className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-brand-500 file:text-white hover:file:bg-brand-600 file:cursor-pointer"
          />
          {uploading && <span className="text-xs text-gray-500">업로드 중…</span>}
          {f && (
            <button
              type="button"
              onClick={() => onDelete(f.id)}
              className="text-xs text-rose-600 hover:text-rose-700 ml-2"
              title="삭제"
            >
              삭제
            </button>
          )}
        </div>

        {f && isImage(f.stored_name) ? (
          <a
            href={FILE_BASE + f.stored_name}
            target="_blank"
            rel="noreferrer"
            title="원본 보기 (새 탭)"
            className="relative inline-block"
          >
            <picture>
              {f.stored_name_webp && (
                <source srcSet={FILE_BASE + f.stored_name_webp} type="image/webp" />
              )}
              <img
                src={FILE_BASE + f.stored_name}
                alt={f.source_name}
                style={{ width: preview.width, height: preview.height, objectFit: 'cover' }}
                className="border border-gray-200 dark:border-gray-700"
              />
            </picture>
            {overlay}
          </a>
        ) : f ? (
          // 이미지가 아닌 경우 (PDF 등 — profile은 보통 안 씀)
          <div className="px-3 py-2 rounded border border-gray-200 dark:border-gray-700 inline-flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 font-mono text-[10px]">FILE</span>
            <a href={FILE_BASE + f.stored_name} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{f.source_name}</a>
          </div>
        ) : (
          <div className="text-[11px] text-gray-400">기본 프로필 사진이 사용됩니다.</div>
        )}
      </div>
    )
  }

  // 그 외 (계약서 등): 기존 다중 썸네일 리스트
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              void onUpload(f)
              e.target.value = ''
            }
          }}
          className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-brand-500 file:text-white hover:file:bg-brand-600 file:cursor-pointer"
        />
        {uploading && <span className="text-xs text-gray-500">업로드 중…</span>}
      </div>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs">
              {isImage(f.stored_name) ? (
                <a href={FILE_BASE + f.stored_name} target="_blank" rel="noreferrer">
                  <picture>
                    {f.stored_name_webp && (
                      <source srcSet={FILE_BASE + f.stored_name_webp} type="image/webp" />
                    )}
                    <img src={FILE_BASE + f.stored_name} alt={f.source_name} className="w-12 h-12 object-cover rounded hover:opacity-80 transition" />
                  </picture>
                </a>
              ) : (
                <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 font-mono text-[10px]">PDF</span>
              )}
              <a
                href={FILE_BASE + f.stored_name}
                target="_blank"
                rel="noreferrer"
                className="max-w-[180px] truncate text-brand-600 hover:underline"
                title={f.source_name}
              >
                {f.source_name}
              </a>
              <button
                type="button"
                onClick={() => onDelete(f.id)}
                className="text-rose-600 hover:text-rose-700 ml-1"
                title="삭제"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {!multipleSlot && files.length === 0 && (
        <div className="text-xs text-gray-400">아직 등록된 파일 없음</div>
      )}
    </div>
  )
}

/**
 * PhoneFrame — 어드민 폼 안에 모바일 폰 외형 모사.
 * 실제 모바일 뷰포트(375px) 폭 + 둥근 베젤 + 상단 상태바 + 노치 + 하단 홈 인디케이터.
 * 운영자가 "이게 모바일에 어떻게 보일지" 즉시 시각화.
 */
function PhoneFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="w-[395px] shrink-0 flex flex-col items-center">
      {/* 라벨 — 폰 외부 상단 */}
      <div className="mb-2 text-center">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
      </div>
      {/* 폰 외곽 베젤 — 옅은 라이트 그레이로 변경 (눈 피로 ↓).
          height 고정으로 3개 폰 사이즈 통일 (9:17 비율). */}
      <div className="w-[395px] h-[700px] rounded-[36px] bg-gray-200 p-[4px] shadow-sm flex flex-col">
        {/* 폰 화면 */}
        <div className="flex-1 rounded-[32px] bg-white dark:bg-gray-50 overflow-hidden flex flex-col">
          {/* 상태바 + Dynamic Island 노치 */}
          <div className="relative h-7 px-5 flex items-center justify-between text-[11px] text-gray-500">
            <span className="font-semibold tabular-nums">9:41</span>
            <div className="absolute left-1/2 -translate-x-1/2 top-[6px] w-[80px] h-[18px] rounded-full bg-gray-400" />
            <div className="flex items-center gap-1.5">
              {/* 시그널 */}
              <svg viewBox="0 0 18 12" className="w-[18px] h-3 fill-gray-400">
                <rect x="0" y="8" width="3" height="4" rx="0.5" />
                <rect x="5" y="5" width="3" height="7" rx="0.5" />
                <rect x="10" y="2" width="3" height="10" rx="0.5" />
                <rect x="15" y="0" width="3" height="12" rx="0.5" />
              </svg>
              {/* 와이파이 */}
              <svg viewBox="0 0 16 12" className="w-4 h-3 fill-gray-400">
                <path d="M8 11.5l-2-2.5h4z" />
                <path d="M8 7.5c-1.5 0-2.7.5-3.6 1.4L3 7.5c1.4-1.4 3.2-2.3 5-2.3s3.6.9 5 2.3l-1.4 1.4C10.7 8 9.5 7.5 8 7.5z" />
                <path d="M8 3.3c-2.5 0-4.8 1-6.5 2.7L0 4.5C2 2.5 4.9 1.3 8 1.3s6 1.2 8 3.2l-1.5 1.5C12.8 4.3 10.5 3.3 8 3.3z" />
              </svg>
              {/* 배터리 */}
              <div className="flex items-center">
                <div className="w-[22px] h-[10px] rounded-[2.5px] border border-gray-400 relative">
                  <div className="absolute inset-[1.5px] bg-gray-400 rounded-[1px]" style={{ width: '15px' }} />
                </div>
                <div className="w-[1.5px] h-[4px] bg-gray-400 rounded-r" />
              </div>
            </div>
          </div>
          {/* 콘텐츠 영역 — 폰 화면 내부 가용 공간 모두 사용, 넘치면 스크롤 */}
          <div className="flex-1 pt-2 overflow-y-auto">
            {children}
          </div>
          {/* 하단 홈 인디케이터 */}
          <div className="h-6 flex items-center justify-center shrink-0">
            <div className="w-[120px] h-[5px] bg-gray-400 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckGrid({
  options,
  value,
  onChange,
}: {
  options: readonly string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (o: string) => {
    if (value.includes(o)) onChange(value.filter((v) => v !== o))
    else onChange([...value, o])
  }
  return (
    <div className="space-y-1.5">
      {/* 선택 카운터 — 운영자가 얼마나 골랐는지 한눈에 */}
      <div className="text-[11px] text-gray-500 dark:text-gray-400">
        선택 <strong className={value.length > 0 ? 'text-brand-600' : ''}>{value.length}</strong> / {options.length}
      </div>
      <div className="flex flex-wrap gap-1.5 text-sm">
        {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            type="button"
            key={o}
            onClick={() => toggle(o)}
            className={`px-2.5 py-1 rounded-md border text-xs transition ${
              on
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {o}
          </button>
        )
      })}
      </div>
    </div>
  )
}

/* ───────────────── 차단 관리 패널 ───────────────── */

interface BlockItem {
  id: number
  member_id: number
  member_mb_id: string | null
  member_name: string | null
  member_phone: string | null
  reason: string | null
  blocked_by_mb_id: string | null
  created_at: string
}

function BlockPanel({ counselorId }: { counselorId: number }) {
  const [blocks, setBlocks] = useState<BlockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api<BlockItem[]>(`/admin/members/counselors/${counselorId}/blocks`)
      .then((r) => { setBlocks(r); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [counselorId])

  const onAdd = async () => {
    if (!phone.trim()) { setError('휴대폰번호를 입력해주세요.'); return }
    setAdding(true); setError(null); setSuccess(null)
    try {
      await api(`/admin/members/counselors/${counselorId}/blocks`, {
        method: 'POST',
        body: JSON.stringify({ member_phone: phone.trim(), reason: reason.trim() || undefined }),
      })
      setPhone(''); setReason('')
      setSuccess('차단 추가 완료')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '차단 추가 실패')
    } finally {
      setAdding(false)
    }
  }

  const onRemove = async (memberId: number) => {
    if (!window.confirm('차단을 해제하시겠습니까?')) return
    try {
      await api(`/admin/members/counselors/${counselorId}/blocks/${memberId}`, { method: 'DELETE' })
      setSuccess('차단 해제 완료')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '해제 실패')
    }
  }

  return (
    <Section title="차단 관리" subtitle="차단된 회원은 이 상담사를 목록에서 볼 수 없습니다" icon={<span className="text-lg">🚫</span>}>
      <div className="space-y-4">
        {/* 추가 폼 */}
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">회원 휴대폰번호</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="01012345678"
              className="w-40 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">사유 (선택)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 욕설·괴롭힘"
              className="w-48 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800"
            />
          </div>
          <button
            onClick={onAdd}
            disabled={adding}
            className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {adding ? '추가 중…' : '차단 추가'}
          </button>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}

        {/* 차단 목록 */}
        {loading ? (
          <p className="text-sm text-gray-400">로딩 중...</p>
        ) : blocks.length === 0 ? (
          <p className="text-sm text-gray-400">차단된 회원이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                  <th className="text-left py-2 pr-3 whitespace-nowrap">회원 ID (이름)</th>
                  <th className="text-left py-2 pr-3 whitespace-nowrap">전화번호</th>
                  <th className="text-left py-2 pr-3 whitespace-nowrap">사유</th>
                  <th className="text-left py-2 pr-3 whitespace-nowrap">날짜</th>
                  <th className="text-left py-2 whitespace-nowrap">해제</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">{b.member_mb_id ?? '-'} ({b.member_name ?? '-'})</td>
                    <td className="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">{b.member_phone ?? '-'}</td>
                    <td className="py-2 pr-3 text-xs text-gray-500">{b.reason ?? '-'}</td>
                    <td className="py-2 pr-3 text-xs text-gray-400 whitespace-nowrap">{new Date(b.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="py-2">
                      <button
                        onClick={() => onRemove(b.member_id)}
                        className="px-3 py-1 text-xs rounded border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 whitespace-nowrap"
                      >
                        차단 해제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  )
}
