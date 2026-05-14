import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { api } from '../lib/api'

// ───────────────────────────────────────────────
// 타입
// ───────────────────────────────────────────────
type SettingsByNs = Record<string, Record<string, string>>

type TabKey = 'site' | 'member' | 'review' | 'social' | 'security' | 'footer'
type FieldKind = 'text' | 'textarea' | 'number' | 'bool' | 'password' | 'select' | 'multiselect'
interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  hint?: string
  placeholder?: string
  options?: { value: string; label: string }[]
}

// ───────────────────────────────────────────────
// 탭별 필드 정의 (마이그레이션의 setting 시드 키와 1:1)
// ───────────────────────────────────────────────
const TAB_FIELDS: Record<TabKey, { title: string; fields: FieldDef[] }> = {
  site: {
    title: '기본환경',
    fields: [
      { key: 'title', label: '홈페이지 제목', kind: 'text' },
      { key: 'admin_email', label: '관리자 메일 주소', kind: 'text' },
      { key: 'admin_email_name', label: '관리자 메일 발송이름', kind: 'text' },
      {
        key: 'kakao_channel_url',
        label: '카카오 1:1 채널 URL',
        kind: 'text',
        placeholder: 'https://pf.kakao.com/_xxxxx/chat',
        hint: '사용자 화면의 카카오 1:1 상담 버튼이 이 URL로 연결됩니다.',
      },
      {
        key: 'stat_recent_consultations_override',
        label: '메인: 최근 상담 건수',
        kind: 'text',
        placeholder: '예: 2570923',
        hint: '메인 페이지 카드에 표시될 숫자',
      },
      {
        key: 'stat_online_counselors_override',
        label: '메인: 현재 접속중인 상담사',
        kind: 'text',
        placeholder: '예: 241',
        hint: '메인 페이지 카드에 표시될 숫자',
      },
      { key: 'add_meta', label: '추가 meta 태그', kind: 'textarea' },
      { key: 'add_script', label: '<head> 추가 스크립트', kind: 'textarea' },
      { key: 'analytics', label: '애널리틱스 코드', kind: 'textarea', hint: 'GA / 네이버 등' },
    ],
  },
  member: {
    title: '회원가입',
    fields: [
      {
        key: 'register_level',
        label: '가입 시 기본 등급',
        kind: 'select',
        options: [
          { value: '2', label: '회원' },
          { value: '5', label: '상담사' },
        ],
        hint: '신규 가입자에게 부여되는 기본 등급',
      },
      { key: 'register_point', label: '가입 시 적립 포인트', kind: 'number' },
      { key: 'login_point', label: '로그인 적립 포인트', kind: 'number' },
      { key: 'use_email_certify', label: '이메일 인증 사용', kind: 'bool' },
      { key: 'nick_modify', label: '닉네임 수정 제한일', kind: 'number' },
      { key: 'leave_day', label: '탈퇴 처리 유예일', kind: 'number' },
      { key: 'use_recommend', label: '추천인 사용', kind: 'bool' },
      { key: 'recommend_point', label: '추천인 포인트', kind: 'number' },
      { key: 'use_homepage', label: '홈페이지 입력란 사용', kind: 'bool' },
      { key: 'req_homepage', label: '홈페이지 필수', kind: 'bool' },
      { key: 'use_tel', label: '전화번호 사용', kind: 'bool' },
      { key: 'req_tel', label: '전화번호 필수', kind: 'bool' },
      { key: 'use_hp', label: '휴대폰 사용', kind: 'bool' },
      { key: 'req_hp', label: '휴대폰 필수', kind: 'bool' },
      { key: 'use_addr', label: '주소 사용', kind: 'bool' },
      { key: 'req_addr', label: '주소 필수', kind: 'bool' },
    ],
  },
  review: {
    title: '후기 포인트',
    fields: [
      {
        key: 'payout_enabled',
        label: '후기 포인트 지급',
        kind: 'bool',
        hint: '꺼두면 후기를 작성해도 포인트가 지급되지 않습니다.',
      },
      {
        key: 'payout_amount',
        label: '후기 작성 시 지급 포인트',
        kind: 'number',
        placeholder: '500',
        hint: '후기 1건당 회원에게 적립할 포인트 (기본 500P).',
      },
      {
        key: 'payout_min_used',
        label: '지급 조건 — 최소 사용 포인트',
        kind: 'number',
        placeholder: '0',
        hint: '해당 상담에서 사용한 포인트가 이 값 이상이어야 후기 포인트가 지급됩니다. 0이면 조건 없음.',
      },
    ],
  },
  social: {
    title: '소셜로그인',
    fields: [
      { key: 'use', label: '소셜로그인 사용', kind: 'bool' },
      {
        key: 'service_list',
        label: '활성 서비스',
        kind: 'multiselect',
        hint: '체크된 서비스만 로그인 화면에 노출됩니다.',
        options: [
          { value: 'naver', label: '네이버' },
          { value: 'kakao', label: '카카오' },
        ],
      },
      { key: 'naver_client_id', label: 'Naver Client ID', kind: 'text' },
      { key: 'naver_secret', label: 'Naver Client Secret', kind: 'password' },
      { key: 'kakao_rest_key', label: 'Kakao REST API Key', kind: 'text' },
      { key: 'kakao_client_secret', label: 'Kakao Client Secret', kind: 'password' },
      { key: 'kakao_js_apikey', label: 'Kakao JS API Key (공유)', kind: 'text' },
    ],
  },
  security: {
    title: '보안',
    fields: [
      { key: 'possible_ip', label: '접속 허용 IP', kind: 'textarea', hint: '개행 구분, 비우면 전체 허용' },
      { key: 'intercept_ip', label: '접속 차단 IP', kind: 'textarea' },
      { key: 'prohibit_id', label: '금지 아이디', kind: 'textarea', hint: '콤마(,) 구분 — 예: admin, root, test. 회원가입 시 이 ID 거부' },
      { key: 'prohibit_email', label: '금지 이메일 도메인', kind: 'textarea', hint: '콤마(,) 구분 — 예: spam.com, badmail.org. 회원가입 시 이 도메인 거부' },
    ],
  },
  footer: {
    title: '푸터(회사정보)',
    fields: [
      { key: 'company_name', label: '회사명 (상호)', kind: 'text', placeholder: '예: 주식회사 사주문' },
      { key: 'ceo', label: '대표자', kind: 'text' },
      { key: 'address', label: '주소', kind: 'text', placeholder: '예: 서울특별시 강남구 ...' },
      { key: 'business_no', label: '사업자등록번호', kind: 'text', placeholder: 'XXX-XX-XXXXX' },
      { key: 'ecommerce_no', label: '통신판매업신고번호', kind: 'text' },
      { key: 'privacy_officer', label: '개인정보보호책임자', kind: 'text' },
      { key: 'phone', label: '대표 전화번호', kind: 'text' },
      { key: 'fax', label: '팩스번호', kind: 'text' },
      { key: 'email', label: '대표 이메일', kind: 'text' },
      { key: 'business_hours', label: '운영시간 안내', kind: 'text', placeholder: '예: 평일 10:00 ~ 18:00' },
      { key: 'copyright', label: '저작권 문구', kind: 'text', placeholder: '예: COPYRIGHT © 사주문 ALL RIGHTS RESERVED' },
      { key: 'extra_info', label: '기타 안내 문구', kind: 'textarea', hint: '푸터 하단에 추가 노출되는 내용' },
    ],
  },
}

const TAB_ORDER: TabKey[] = ['site', 'member', 'review', 'social', 'security', 'footer']

// ───────────────────────────────────────────────
// 페이지
// ───────────────────────────────────────────────
export default function Settings() {
  const [data, setData] = useState<SettingsByNs | null>(null)
  const [tab, setTab] = useState<TabKey>('site')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ data: SettingsByNs }>('/admin/settings')
      .then((res) => alive && setData(res.data))
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [])

  const setField = (ns: TabKey, key: string, value: string) => {
    setData((d) => {
      if (!d) return d
      const next = { ...d, [ns]: { ...(d[ns] ?? {}), [key]: value } }
      return next
    })
  }

  const onSave = async () => {
    if (!data) return
    setSaving(true)
    setError(null)
    try {
      await api('/admin/settings', { method: 'PATCH', body: JSON.stringify(data) })
      setSavedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const fields = useMemo(() => TAB_FIELDS[tab].fields, [tab])

  if (!data) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
        {error ? `오류: ${error}` : '로딩...'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">기본환경설정</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            사이트 운영 전반의 기본값을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-xs text-gray-400">
              {savedAt.toLocaleTimeString('ko-KR')} 저장됨
            </span>
          )}
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* 탭 */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex flex-wrap gap-1 -mb-px">
          {TAB_ORDER.map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === k
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {TAB_FIELDS[k].title}
            </button>
          ))}
        </nav>
      </div>

      {/* 필드 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {fields.map((f) => {
              const value = data[tab]?.[f.key] ?? ''
              return (
                <tr key={f.key}>
                  <th className="text-left align-top px-4 py-3 w-56 font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/50">
                    <label htmlFor={`${tab}-${f.key}`}>{f.label}</label>
                    {f.hint && (
                      <div className="text-[11px] text-gray-400 mt-0.5 font-normal">{f.hint}</div>
                    )}
                  </th>
                  <td className="px-4 py-3">
                    <FieldInput
                      id={`${tab}-${f.key}`}
                      def={f}
                      value={value}
                      onChange={(v) => setField(tab, f.key, v)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FieldInput({
  id,
  def,
  value,
  onChange,
}: {
  id: string
  def: FieldDef
  value: string
  onChange: (v: string) => void
}) {
  const cls =
    'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

  if (def.kind === 'bool') {
    const checked = value === '1' || value === 'true'
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? '1' : '0')}
          className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-xs text-gray-500">{checked ? '사용' : '미사용'}</span>
      </label>
    )
  }
  if (def.kind === 'textarea') {
    return (
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder}
        rows={4}
        className={cls + ' font-mono text-xs'}
      />
    )
  }
  if (def.kind === 'select') {
    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
      >
        {def.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }
  if (def.kind === 'multiselect') {
    // 콤마 구분 문자열을 set으로 다루고, 체크박스 변경 시 다시 콤마 문자열로 저장
    const selected = new Set(
      String(value || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    const toggle = (v: string, on: boolean) => {
      if (on) selected.add(v)
      else selected.delete(v)
      const next = (def.options ?? [])
        .map((o) => o.value)
        .filter((k) => selected.has(k))
        .join(',')
      onChange(next)
    }
    return (
      <div className="flex flex-wrap gap-3">
        {def.options?.map((opt) => (
          <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={selected.has(opt.value)}
              onChange={(e) => toggle(opt.value, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    )
  }
  return (
    <input
      id={id}
      type={def.kind === 'number' ? 'number' : def.kind === 'password' ? 'password' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={def.placeholder}
      className={cls}
      autoComplete={def.kind === 'password' ? 'new-password' : 'off'}
    />
  )
}
