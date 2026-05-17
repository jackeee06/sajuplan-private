import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { api } from '../lib/api'
import { openPostcode } from '../lib/daumPostcode'
import PointAdjustPanel from '../components/PointAdjustPanel'

interface CustomerPayload {
  mb_id: string
  password: string
  name: string
  nickname: string
  email: string
  phone: string
  gender: 'M' | 'F' | ''
  birth_date: string
  point: number | ''
  acquisition_source: string
  intercept_until: string  // YYYY-MM-DDTHH:mm or ''
  left_at: string          // YYYY-MM-DDTHH:mm or '' (빈 값 = 활동중)
  zip: string
  addr1: string
  addr2: string
  addr_jibeon: string
}

const empty = (): CustomerPayload => ({
  mb_id: '', password: '',
  name: '', nickname: '', email: '', phone: '',
  gender: '',
  birth_date: '',
  point: 0,
  acquisition_source: '',
  intercept_until: '',
  left_at: '',
  zip: '', addr1: '', addr2: '', addr_jibeon: '',
})

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [data, setData] = useState<CustomerPayload>(empty())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    api<Record<string, unknown>>(`/admin/members/customers/${id}`)
      .then((r) => {
        setData((d) => ({
          ...d,
          mb_id: String(r.mb_id ?? ''),
          name: String(r.name ?? ''),
          nickname: String(r.nickname ?? ''),
          email: String(r.email ?? ''),
          phone: String(r.phone ?? ''),
          gender: (r.gender as 'M' | 'F') ?? '',
          birth_date: r.birth_date ? String(r.birth_date).slice(0, 10) : '',
          point: Number(r.point ?? 0),
          acquisition_source: String(r.acquisition_source ?? ''),
          intercept_until: r.intercept_until ? toLocalInput(String(r.intercept_until)) : '',
          left_at: r.left_at ? toLocalInput(String(r.left_at)) : '',
          zip: String(r.zip ?? ''),
          addr1: String(r.addr1 ?? ''),
          addr2: String(r.addr2 ?? ''),
          addr_jibeon: String(r.addr_jibeon ?? ''),
        }))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof CustomerPayload>(k: K, v: CustomerPayload[K]) =>
    setData((d) => ({ ...d, [k]: v }))

  const onSubmit = async () => {
    setError(null)
    setSuccess(null)
    if (isNew) {
      if (!data.mb_id) return setError('아이디를 입력하세요.')
      if (!data.password) return setError('비밀번호를 입력하세요.')
    }
    if (!data.name) return setError('이름을 입력하세요.')

    setSaving(true)
    try {
      const payload = {
        ...data,
        point: data.point === '' ? 0 : Number(data.point),
        birth_date: data.birth_date || null,
        intercept_until: data.intercept_until ? new Date(data.intercept_until).toISOString() : null,
        left_at: data.left_at ? new Date(data.left_at).toISOString() : null,
        password: !isNew && !data.password ? undefined : data.password,
      }
      if (isNew) {
        const res = await api<{ id: number }>('/admin/members/customers', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setSuccess('등록이 완료되었습니다.')
        navigate(`/members/customers/${res.id}`, { replace: true })
      } else {
        await api(`/admin/members/customers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
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
    <div className="space-y-4 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/members/customers')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {isNew ? '고객 추가' : `고객 수정 #${id}`}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">일반 회원 정보 관리</p>
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

      <Section title="계정 정보">
        <Row label="아이디" required>
          <input type="text" value={data.mb_id} disabled={!isNew} onChange={(e) => set('mb_id', e.target.value)} className={inputCls} />
        </Row>
        <Row label="비밀번호" required={isNew} hint={!isNew ? '비워두면 변경 안 함' : undefined}>
          <input type="password" autoComplete="new-password" value={data.password} onChange={(e) => set('password', e.target.value)} className={inputCls} />
        </Row>
      </Section>

      <Section title="기본 정보">
        <Row label="이름" required>
          <input type="text" value={data.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
        </Row>
        <Row label="닉네임">
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
        <Row label="생년월일">
          <input type="date" value={data.birth_date} onChange={(e) => set('birth_date', e.target.value)} className={inputCls} />
        </Row>
        <Row label="포인트" hint={isNew ? '초기 지급 포인트' : '직접 수정 불가 — 포인트 조정 기능으로 변경 (이력 기록)'}>
          <input
            type="text"
            inputMode="numeric"
            value={data.point}
            disabled={!isNew}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9]/g, '')
              set('point', cleaned === '' ? '' : Number(cleaned))
            }}
            className={inputCls}
          />
        </Row>
        <Row label="가입출처" hint="신규앱 / web / kakao 등">
          <input type="text" value={data.acquisition_source} onChange={(e) => set('acquisition_source', e.target.value)} className={inputCls} />
        </Row>
      </Section>

      <Section title="주소" cols={3}>
        <Row label="우편번호" hint="다음 우편번호 검색으로 자동 입력" fullWidth>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={data.zip}
              readOnly
              placeholder="우편번호"
              className={`${inputCls} max-w-[140px] bg-gray-50 dark:bg-gray-800/60`}
            />
            <button
              type="button"
              onClick={() =>
                openPostcode((d) => {
                  setData((prev) => ({
                    ...prev,
                    zip: d.zonecode,
                    addr1: d.address,
                    addr_jibeon: d.jibunAddress,
                  }))
                }).catch((e) => setError(e instanceof Error ? e.message : '주소 검색 실패'))
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-md bg-brand-500 hover:bg-brand-600 text-white whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5" />
              주소 검색
            </button>
            {data.zip && (
              <button
                type="button"
                onClick={() => setData((p) => ({ ...p, zip: '', addr1: '', addr_jibeon: '' }))}
                className="px-3 py-2 text-xs rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 whitespace-nowrap"
              >
                초기화
              </button>
            )}
          </div>
        </Row>
        <Row label="기본 주소">
          <input
            type="text"
            value={data.addr1}
            readOnly
            placeholder="주소 검색 후 자동 입력"
            className={`${inputLong} bg-gray-50 dark:bg-gray-800/60`}
          />
        </Row>
        <Row label="상세 주소">
          <input
            type="text"
            value={data.addr2}
            onChange={(e) => set('addr2', e.target.value)}
            placeholder="동/호수 등"
            className={inputLong}
          />
        </Row>
        {data.addr_jibeon && (
          <Row label="지번 주소" hint="참고용">
            <input type="text" value={data.addr_jibeon} readOnly className={`${inputLong} bg-gray-50 dark:bg-gray-800/60 text-xs`} />
          </Row>
        )}
      </Section>

      <Section title="상태">
        <Row label="현재 상태" fullWidth>
          <StatusBadge leftAt={data.left_at} interceptUntil={data.intercept_until} />
        </Row>
        <Row label="탈퇴일시" hint="값이 있으면 탈퇴 회원. 비우면 활동중으로 복구됩니다.">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={data.left_at}
              onChange={(e) => set('left_at', e.target.value)}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => set('left_at', toLocalInput(new Date().toISOString()))}
              className="px-3 py-2 text-xs rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/30 whitespace-nowrap"
            >
              오늘로 지정
            </button>
            <button
              type="button"
              onClick={() => set('left_at', '')}
              disabled={!data.left_at}
              className="px-3 py-2 text-xs rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              탈퇴 해제
            </button>
          </div>
        </Row>
        <Row label="차단 만료일시" hint="비워두면 차단 해제. 지정하면 해당 시간까지 접속 차단.">
          <input type="datetime-local" value={data.intercept_until} onChange={(e) => set('intercept_until', e.target.value)} className={inputCls} />
        </Row>
      </Section>

      {!isNew && (
        <PointAdjustPanel
          memberId={Number(id)}
          currentPoint={typeof data.point === 'number' ? data.point : 0}
          onAdjusted={(newBalance) => {
            setData((d) => ({ ...d, point: newBalance }))
            setSuccess(`포인트 조정 완료. 변경 후 잔액: ${newBalance.toLocaleString()}P`)
          }}
        />
      )}
    </div>
  )
}

// ─── 헬퍼 ─────────────────────────────────────
const inputBase = 'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-gray-50 disabled:text-gray-500'
const inputCls = `w-full max-w-[140px] ${inputBase}`
const inputLong = `w-full max-w-[400px] ${inputBase}`

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

function toLocalInput(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function Section({ title, children, cols = 4 }: { title: string; children: React.ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  // cols prop 은 호환 유지용. 실제 레이아웃은 flex-wrap 으로 좌측 응집.
  const inner = cols === 1 ? 'p-4 space-y-3' : 'p-4 flex flex-wrap gap-x-5 gap-y-3'
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </div>
      <div className={inner}>{children}</div>
    </div>
  )
}

function StatusBadge({ leftAt, interceptUntil }: { leftAt: string; interceptUntil: string }) {
  let label = '활동중'
  let cls = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (leftAt) {
    label = `탈퇴 (${leftAt.replace('T', ' ')})`
    cls = 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  } else if (interceptUntil && new Date(interceptUntil) > new Date()) {
    label = `차단중 (~${interceptUntil.replace('T', ' ')})`
    cls = 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
  }
  return <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${cls}`}>{label}</span>
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
    <div className={`grid grid-cols-[90px_auto] gap-1.5 md:gap-2 items-start ${fullWidth ? 'w-full' : ''}`}>
      <div className="md:pt-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}
