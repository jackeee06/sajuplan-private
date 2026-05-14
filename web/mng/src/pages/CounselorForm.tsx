import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Link2 } from 'lucide-react'
import { api } from '../lib/api'
import { API_BASE, FILE_BASE as FILE_ORIGIN } from '../lib/runtime-env'

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
  use_phone: true, use_chat: true, is_rising: false,
  admin_memo: '',
  register_m2net: true,
  profile_headline: '',
  profile_hashtag1: '', profile_hashtag2: '',
  profile_specialty: [], profile_traits: [],
  profile_bio: '', profile_notice: '', profile_intro: '',
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

const SPECIALTY_OPTIONS = ['운세', '속마음', '연애', '짝사랑', '재회', '궁합', '금전', '건강', '취업', '합격', '사업', '택일', '이사', '작명/개명', '불륜/이혼', '삼재', '고민', '꿈해몽'] as const
const TRAIT_OPTIONS = ['경청하는', '소통하는', '깊이있는', '공감하는', '긍정적인', '현실조언', '카리스마', '솔직담백', '부드러운', '친근한(반말체)', '차분한', '편안한', '조곤조곤', '또박또박'] as const

export default function CounselorForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [data, setData] = useState<CounselorPayload>(empty())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
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
        }))
        setFiles(Array.isArray(r.files) ? (r.files as CounselorFile[]) : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof CounselorPayload>(k: K, v: CounselorPayload[K]) =>
    setData((d) => ({ ...d, [k]: v }))

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
        // 수정 시 비밀번호 비어있으면 미전송
        password: !isNew && !data.password ? undefined : data.password,
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/members/counselors')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {isNew ? '상담사 추가' : `상담사 수정 #${id}`}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isNew ? '신규 등록 시 엠투넷(m2net)에 자동 연동됩니다.' : '엠투넷 ID는 신규 등록 시 자동 발급됩니다.'}
            </p>
          </div>
        </div>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
        >
          {saving ? '저장 중...' : isNew ? '등록' : '저장'}
        </button>
      </div>

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

      {/* 1) 계정 정보 */}
      <Section title="계정 정보">
        <Row label="아이디" required>
          <input type="text" value={data.mb_id} disabled={!isNew} onChange={(e) => set('mb_id', e.target.value)} className={inputCls} />
        </Row>
        <Row label="비밀번호" required={isNew} hint={!isNew ? '비워두면 변경 안 함' : undefined}>
          <input type="password" autoComplete="new-password" value={data.password} onChange={(e) => set('password', e.target.value)} className={inputCls} />
        </Row>
      </Section>

      {/* 2) 기본 정보 */}
      <Section title="기본 정보">
        <Row label="이름" required>
          <input type="text" value={data.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
        </Row>
        <Row label="닉네임" required hint="엠투넷에 csrnm으로 전송됩니다.">
          <input type="text" value={data.nickname} onChange={(e) => set('nickname', e.target.value)} className={inputCls} />
        </Row>
        <Row label="휴대폰">
          <input
            type="tel"
            inputMode="tel"
            value={data.phone}
            onChange={(e) => set('phone', formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            maxLength={13}
            className={inputCls}
          />
        </Row>
        <Row label="이메일">
          <input type="email" value={data.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
        </Row>
        <Row label="성별">
          <select value={data.gender} onChange={(e) => set('gender', e.target.value as 'M' | 'F' | '')} className={inputCls}>
            <option value="">미지정</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </Row>
        <Row label="분야">
          <select value={data.counselor_category} onChange={(e) => set('counselor_category', e.target.value)} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Row>
      </Section>

      {/* 3) 상담사 운영 */}
      <Section title="상담사 운영">
        <Row label="상담사연결번호 (dtmfno)" hint="회원이 ARS에서 누르는 상담사 연결 번호. 비워두면 1부터 비어있는 가장 작은 숫자로 자동 부여됩니다.">
          <input
            type="text"
            inputMode="numeric"
            value={data.dtmfno}
            onChange={(e) => set('dtmfno', digitsOnly(e.target.value))}
            placeholder="비워두면 자동 부여"
            className={inputCls}
          />
        </Row>
        <Row label="상담사 ID (csrid)" hint="엠투넷이 자동 발급한 상담사 고유 ID. 등록/재연동 시 채워짐 — 수정 불가">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={data.csrid}
              readOnly
              disabled
              placeholder={isNew ? '등록 시 자동 발급' : '미등록'}
              className={inputCls + ' font-mono bg-gray-50 dark:bg-gray-800/60 text-gray-500'}
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
        <Row label="실제 연결 전화번호" hint="070 발신 시 실제 연결될 번호 — 자동 포맷">
          <input
            type="tel"
            inputMode="tel"
            value={data.telno}
            onChange={(e) => set('telno', formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            maxLength={13}
            className={inputCls}
          />
        </Row>
        <Row label="연결순위" hint="작은 숫자가 우선">
          <NumInput value={data.counselor_priority} onChange={(v) => set('counselor_priority', v)} className={inputCls} />
        </Row>
        <Row label="회원차감 단위시간 (초)">
          <NumInput value={data.call_unit_seconds} onChange={(v) => set('call_unit_seconds', v)} className={inputCls} />
        </Row>
        <Row label="선불여부">
          <select value={data.preflag} onChange={(e) => set('preflag', e.target.value as 'P' | 'Y' | '')} className={inputCls}>
            <option value="P">둘다</option>
            <option value="Y">선불</option>
            <option value="">후불</option>
          </select>
        </Row>
        <Row label="070 단가 (원)">
          <NumInput value={data.call_070_unit_cost} onChange={(v) => set('call_070_unit_cost', v)} className={inputCls} />
        </Row>
        <Row label="060 단가 (원)">
          <NumInput value={data.call_060_unit_cost} onChange={(v) => set('call_060_unit_cost', v)} className={inputCls} />
        </Row>
        <Row label="채팅 단위시간 (초)">
          <NumInput value={data.chat_unit_seconds} onChange={(v) => set('chat_unit_seconds', v)} className={inputCls} />
        </Row>
        <Row label="채팅 단가 (원)">
          <NumInput value={data.chat_unit_cost} onChange={(v) => set('chat_unit_cost', v)} className={inputCls} />
        </Row>
        <Row label="유료 로열티 (%)">
          <NumInput value={data.paid_royalty_pct} onChange={(v) => set('paid_royalty_pct', v)} className={inputCls} />
        </Row>
        <Row label="무료 로열티 (%)">
          <NumInput value={data.free_royalty_pct} onChange={(v) => set('free_royalty_pct', v)} className={inputCls} />
        </Row>
        <Row label="상담사 상태">
          <select value={data.state} onChange={(e) => set('state', e.target.value)} className={inputCls}>
            <option value="IDLE">상담가능</option>
            <option value="ABSE">부재중</option>
            <option value="CONN">상담중</option>
            <option value="CRDY">상담준비</option>
            <option value="RESV">예약</option>
          </select>
        </Row>
        <Row label="상담 상태">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-2 min-w-0">
              <span className="text-gray-600 dark:text-gray-300 shrink-0">전화상담</span>
              <select
                value={data.use_phone ? '1' : '0'}
                onChange={(e) => set('use_phone', e.target.value === '1')}
                className={inputCls}
              >
                <option value="1">사용</option>
                <option value="0">미사용</option>
              </select>
            </label>
            <label className="flex items-center gap-2 min-w-0">
              <span className="text-gray-600 dark:text-gray-300 shrink-0">채팅상담</span>
              <select
                value={data.use_chat ? '1' : '0'}
                onChange={(e) => set('use_chat', e.target.value === '1')}
                className={inputCls}
              >
                <option value="1">사용</option>
                <option value="0">미사용</option>
              </select>
            </label>
          </div>
        </Row>
        <Row label="옵션">
          <div className="flex flex-wrap gap-4 text-sm">
            <Toggle label="급상승" checked={data.is_rising} onChange={(v) => set('is_rising', v)} />
            {isNew && (
              <Toggle label="엠투넷 자동 등록" checked={data.register_m2net} onChange={(v) => set('register_m2net', v)} />
            )}
          </div>
        </Row>
      </Section>

      {/* 4) 프로필 */}
      <Section title="프로필 정보">
        <Row label="한줄소개" hint="최대 25자" fullWidth>
          <input
            type="text"
            maxLength={25}
            value={data.profile_headline}
            onChange={(e) => set('profile_headline', e.target.value)}
            placeholder="25자 이내"
            className={inputCls}
          />
        </Row>
        <Row label="해시태그" hint="각 5자 이내, 최대 2개" fullWidth>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-1">
              <span className="text-gray-400">#</span>
              <input
                type="text"
                maxLength={5}
                value={data.profile_hashtag1}
                onChange={(e) => set('profile_hashtag1', e.target.value)}
                placeholder="태그1"
                className={inputCls}
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
                className={inputCls}
              />
            </div>
          </div>
        </Row>
        <Row label="전문분야" fullWidth>
          <CheckGrid
            options={SPECIALTY_OPTIONS as readonly string[]}
            value={data.profile_specialty}
            onChange={(v) => set('profile_specialty', v)}
          />
        </Row>
        <Row label="스타일" fullWidth>
          <CheckGrid
            options={TRAIT_OPTIONS as readonly string[]}
            value={data.profile_traits}
            onChange={(v) => set('profile_traits', v)}
          />
        </Row>
        <Row label="상담사 약력" hint="최대 1000자" fullWidth>
          <textarea
            rows={4}
            maxLength={1000}
            value={data.profile_bio}
            onChange={(e) => set('profile_bio', e.target.value)}
            className={inputCls}
          />
        </Row>
        <Row label="상담사 공지" hint="고객에게 보일 짧은 공지 (HTML 가능)" fullWidth>
          <textarea
            rows={4}
            value={data.profile_notice}
            onChange={(e) => set('profile_notice', e.target.value)}
            placeholder="<p>공지 내용 …</p>"
            className={inputCls + ' font-mono text-xs'}
          />
        </Row>
        <Row label="상담사 소개" hint="프로필 상세 본문 (HTML — 이미지/서식 가능)" fullWidth>
          <textarea
            rows={8}
            value={data.profile_intro}
            onChange={(e) => set('profile_intro', e.target.value)}
            placeholder="<p>소개 본문 …</p>"
            className={inputCls + ' font-mono text-xs'}
          />
        </Row>
      </Section>

      {/* 5) 계좌 */}
      <Section title="계좌 정보">
        <Row label="예금주">
          <input type="text" value={data.bank_holder} onChange={(e) => set('bank_holder', e.target.value)} className={inputCls} />
        </Row>
        <Row label="은행명">
          <input type="text" value={data.bank_name} onChange={(e) => set('bank_name', e.target.value)} className={inputCls} />
        </Row>
        <Row label="계좌번호">
          <input
            type="text"
            inputMode="numeric"
            value={data.bank_account}
            onChange={(e) => set('bank_account', e.target.value.replace(/[^0-9-]/g, ''))}
            className={inputCls + ' font-mono'}
          />
        </Row>
      </Section>

      {/* 6) 첨부파일 + 메모 — 신규 등록 시 임시 보관, 저장 시 자동 업로드 */}
      <Section title="첨부파일 / 메모">
          <Row label="프로필 사진" hint="JPG/PNG/GIF/WEBP · 5MB 이하 · 권장 사이즈 200×200" fullWidth>
            <FileSlot
              kind="profile"
              accept="image/*"
              files={files.filter((f) => f.kind === 'profile')}
              uploading={uploading === 'profile'}
              onUpload={(file) => uploadFile('profile', file)}
              onDelete={(fileId) => removeFile(fileId)}
            />
          </Row>
          <Row label="와이드 사진" hint="JPG/PNG/GIF/WEBP · 5MB 이하 · 권장 사이즈 780×384 (실제 노출 390×192의 2배수, 비율 ≈ 65:32)" fullWidth>
            <FileSlot
              kind="wide"
              accept="image/*"
              files={files.filter((f) => f.kind === 'wide')}
              uploading={uploading === 'wide'}
              onUpload={(file) => uploadFile('wide', file)}
              onDelete={(fileId) => removeFile(fileId)}
            />
          </Row>
          <Row label="계약서" hint="PDF/JPG/PNG, 10MB 이하 — 여러 장 가능" fullWidth>
            <FileSlot
              kind="contract"
              accept="application/pdf,image/*"
              files={files.filter((f) => f.kind === 'contract')}
              uploading={uploading === 'contract'}
              onUpload={(file) => uploadFile('contract', file)}
              onDelete={(fileId) => removeFile(fileId)}
              multipleSlot
            />
          </Row>
          <Row label="관리자 메모" hint="회원에게 노출되지 않는 내부 메모" fullWidth>
            <textarea
              rows={3}
              value={data.admin_memo}
              onChange={(e) => set('admin_memo', e.target.value)}
              placeholder="특이사항, 연락 이력 등"
              className={inputCls}
            />
          </Row>
        </Section>
    </div>
  )

  async function uploadFile(kind: 'profile' | 'contract' | 'wide', file: File) {
    setError(null)

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
const inputBase = 'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-gray-50 disabled:text-gray-500'
const inputCls = `w-full ${inputBase}`

/** 숫자만 허용. IME 한글 입력은 무시 */
function digitsOnly(s: string): string {
  return s.replace(/[^0-9]/g, '')
}
/**
 * 한국 전화번호 자동 포맷.
 *  - 숫자만 추출 후 최대 11자리
 *  - 010/011/016~019 (휴대폰): 3-4-4
 *  - 02 (서울)            : 2-3-4 또는 2-4-4
 *  - 0XX (지역 3자리)     : 3-3-4 또는 3-4-4
 */
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

function Section({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: 1 | 2 }) {
  const inner =
    cols === 2
      ? 'p-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4'
      : 'p-5 space-y-4'
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </div>
      <div className={inner}>{children}</div>
    </div>
  )
}

function Row({
  label,
  required,
  hint,
  children,
  fullWidth,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
  fullWidth?: boolean
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-4 ${fullWidth ? 'lg:col-span-2' : ''}`}>
      <div className="pt-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

/** 숫자 전용 입력 — IME 한글 입력 차단, 빈 값은 ''로 보존 */
function NumInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number | ''
  onChange: (v: number | '') => void
  className?: string
  placeholder?: string
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        const cleaned = digitsOnly(e.target.value)
        onChange(cleaned === '' ? '' : Number(cleaned))
      }}
      className={className ?? inputCls}
    />
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
}: {
  kind: 'profile' | 'contract' | 'wide'
  accept: string
  files: CounselorFile[]
  uploading: boolean
  onUpload: (f: File) => void | Promise<void>
  onDelete: (id: number) => void | Promise<void>
  multipleSlot?: boolean
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
            className="inline-block"
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
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 text-sm">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            type="button"
            key={o}
            onClick={() => toggle(o)}
            className={`px-2 py-1.5 rounded-md border text-xs transition ${
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
  )
}
