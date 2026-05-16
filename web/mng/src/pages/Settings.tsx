import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { api } from '../lib/api'

// ───────────────────────────────────────────────
// 타입
// ───────────────────────────────────────────────
type SettingsByNs = Record<string, Record<string, string>>

type TabKey = 'site' | 'member' | 'review' | 'social' | 'security' | 'footer' | 'grade' | 'ops' | 'legal'
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
  grade: {
    title: '등급/단가',
    fields: [
      // ── 등급별 단가 옵션 (30초당, 콤마 구분) ──
      { key: 'options.preliminary', label: '예비파트너 단가 옵션', kind: 'text', placeholder: '예: 800,1000', hint: '30초당 단가, 콤마 구분. 상담사가 선택 가능한 옵션.' },
      { key: 'options.partner1',    label: '파트너1 단가 옵션',    kind: 'text', placeholder: '예: 800,1000,1200' },
      { key: 'options.partner2',    label: '파트너2 단가 옵션',    kind: 'text', placeholder: '예: 1000,1200,1300' },
      { key: 'options.partner3',    label: '파트너3 단가 옵션',    kind: 'text', placeholder: '예: 1000,1200,1300' },
      { key: 'options.partner4',    label: '파트너4 단가 옵션',    kind: 'text', placeholder: '예: 1000,1200,1300,1400,1500' },
      { key: 'options.partner5',    label: '파트너5 단가 옵션',    kind: 'text', placeholder: '예: 1000,1200,1300,1400,1500' },

      // ── 정산률 (상담사 수익 비율) ──
      { key: 'revenue_rate.preliminary', label: '예비파트너 정산률', kind: 'text', placeholder: '예: 0.35', hint: '0.35 = 35%. 상담료 × 비율 = 상담사 수익.' },
      { key: 'revenue_rate.partner1',    label: '파트너1 정산률',    kind: 'text', placeholder: '예: 0.45' },
      { key: 'revenue_rate.partner2',    label: '파트너2 정산률',    kind: 'text', placeholder: '예: 0.55' },
      { key: 'revenue_rate.partner3',    label: '파트너3 정산률',    kind: 'text', placeholder: '예: 0.60' },
      { key: 'revenue_rate.partner4',    label: '파트너4 정산률',    kind: 'text', placeholder: '예: 0.65' },
      { key: 'revenue_rate.partner5',    label: '파트너5 정산률',    kind: 'text', placeholder: '예: 0.70' },

      // ── 등급 임계값 (시간 단위, 직전 1개월) ──
      { key: 'thresholds.partner1', label: '파트너1 임계값(h)', kind: 'number', placeholder: '20', hint: '직전 1개월 통화 시간이 이 시간 이상이면 해당 등급.' },
      { key: 'thresholds.partner2', label: '파트너2 임계값(h)', kind: 'number', placeholder: '40' },
      { key: 'thresholds.partner3', label: '파트너3 임계값(h)', kind: 'number', placeholder: '70' },
      { key: 'thresholds.partner4', label: '파트너4 임계값(h)', kind: 'number', placeholder: '90' },
      { key: 'thresholds.partner5', label: '파트너5 임계값(h)', kind: 'number', placeholder: '120' },

      // ── 락/재산정/강등 정책 ──
      { key: 'lock_until_first_day', label: '월 1일 단가 변경 락', kind: 'bool', hint: 'true 면 매월 1일에만 단가 변경 가능. 신규 가입자는 가입 즉시 예외.' },
      { key: 'recalc_day_of_month',  label: '등급 재산정 일자',     kind: 'number', placeholder: '1', hint: '매월 N일 KST 0시에 등급 재산정 (보통 1).' },
      { key: 'recalc_hour_kst',      label: '등급 재산정 시각(KST)', kind: 'number', placeholder: '0' },
      { key: 'demote_step_max',      label: '강등 최대 단계',        kind: 'number', placeholder: '1', hint: '한 번에 강등 가능 단계 수. 1 = 한 단계씩만.' },
    ],
  },
  ops: {
    title: '운영알림',
    fields: [
      {
        key: 'admin_alert.enabled',
        label: '운영자 알림 활성',
        kind: 'bool',
        hint: '크론 실패/M2NET 차감 실패/자동충전 사고 시 카카오 알림톡 발송 여부.',
      },
      {
        key: 'admin_alert.recipients',
        label: '수신 휴대폰 번호',
        kind: 'text',
        placeholder: '01012345678,01087654321',
        hint: '콤마 구분. 등록된 번호 전원에게 동일 메시지 발송. 빈 값이면 발송 안 함.',
      },
      {
        key: 'admin_alert.template_code',
        label: '알림톡 템플릿 코드',
        kind: 'text',
        placeholder: 'ops_admin_alert',
        hint: 'BizM 콘솔에 사전 등록된 템플릿 코드. 변경 시 alimtalk_template 테이블에도 동일 코드의 행 필요.',
      },
      {
        key: 'admin_alert.cooldown_sec',
        label: '쿨다운(초)',
        kind: 'number',
        placeholder: '300',
        hint: '같은 카테고리 알림이 N초 이내 반복되면 발송 차단. 알림 폭주 방지.',
      },
    ],
  },
  legal: {
    // 'legal' 탭은 page 테이블 (terms/privacy) 을 편집하는 특수 탭.
    // FieldDef 기반이 아닌 커스텀 컴포넌트가 렌더됨 — fields 는 메타 표시용 빈 배열.
    title: '약관/처리방침',
    fields: [],
  },
}

const TAB_ORDER: TabKey[] = ['site', 'member', 'review', 'social', 'security', 'footer', 'grade', 'ops', 'legal']

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

      {/* 탭별 렌더 — legal/grade 는 커스텀, 나머지는 standard FieldDef */}
      {tab === 'legal' ? (
        <LegalEditor />
      ) : tab === 'grade' ? (
        <GradeMatrixEditor
          values={data.grade ?? {}}
          onChange={(key, value) => setField('grade', key, value)}
        />
      ) : (
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
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 등급/단가 매트릭스 편집기 — 6 등급 × 3 지표 한눈에
// 변경은 부모 data.grade 에 setField 로 반영 → 우상단 '저장' 일괄
// ─────────────────────────────────────────────────────────────────

const GRADE_ROWS: Array<{ key: 'preliminary' | 'partner1' | 'partner2' | 'partner3' | 'partner4' | 'partner5'; label: string }> = [
  { key: 'preliminary', label: '예비파트너' },
  { key: 'partner1', label: '파트너1' },
  { key: 'partner2', label: '파트너2' },
  { key: 'partner3', label: '파트너3' },
  { key: 'partner4', label: '파트너4' },
  { key: 'partner5', label: '파트너5' },
]

function GradeMatrixEditor({
  values,
  onChange,
}: {
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const cellInputCls =
    'w-full px-2 py-1.5 border rounded text-sm bg-white dark:bg-gray-700 dark:border-gray-600'

  return (
    <div className="space-y-6">
      {/* 매트릭스 표 — 등급별 옵션/정산률/임계값 한 화면 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/60">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">등급별 정책 (6 등급)</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            단가 옵션: 30초당 단가, 콤마 구분 (상담사가 선택 가능) · 정산률: 0~1 (예 0.35 = 35%) · 임계값: 직전 1개월 통화 시간(시)
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50/60 dark:bg-gray-800/30 text-xs text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-28">등급</th>
              <th className="px-3 py-2 text-left font-medium">단가 옵션</th>
              <th className="px-3 py-2 text-left font-medium w-32">정산률</th>
              <th className="px-3 py-2 text-left font-medium w-32">임계값 (h)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {GRADE_ROWS.map((g) => (
              <tr key={g.key}>
                <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{g.label}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={values[`options.${g.key}`] ?? ''}
                    onChange={(e) => onChange(`options.${g.key}`, e.target.value)}
                    placeholder="예: 800,1000"
                    className={cellInputCls + ' font-mono'}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={values[`revenue_rate.${g.key}`] ?? ''}
                    onChange={(e) => onChange(`revenue_rate.${g.key}`, e.target.value)}
                    placeholder="0.50"
                    className={cellInputCls + ' tabular-nums'}
                  />
                </td>
                <td className="px-3 py-2">
                  {g.key === 'preliminary' ? (
                    <span className="text-xs text-gray-400">— (기본값)</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      value={values[`thresholds.${g.key}`] ?? ''}
                      onChange={(e) => onChange(`thresholds.${g.key}`, e.target.value)}
                      placeholder="20"
                      className={cellInputCls + ' tabular-nums'}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 기타 정책 4개 — grid 로 한 줄 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/60">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">락 / 재산정 정책</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
          <PolicyCell
            label="월 1일 락"
            hint="true: 매월 1일만 단가 변경 / false: 즉시 변경"
          >
            <select
              value={values['lock_until_first_day'] ?? 'true'}
              onChange={(e) => onChange('lock_until_first_day', e.target.value)}
              className={cellInputCls}
            >
              <option value="true">true (월 1일 락)</option>
              <option value="false">false (즉시 변경)</option>
            </select>
          </PolicyCell>
          <PolicyCell label="재산정 일자" hint="매월 N일에 등급 재산정">
            <input
              type="number"
              min="1"
              max="28"
              value={values['recalc_day_of_month'] ?? ''}
              onChange={(e) => onChange('recalc_day_of_month', e.target.value)}
              className={cellInputCls + ' tabular-nums'}
            />
          </PolicyCell>
          <PolicyCell label="재산정 시각 (KST)" hint="0~23 시">
            <input
              type="number"
              min="0"
              max="23"
              value={values['recalc_hour_kst'] ?? ''}
              onChange={(e) => onChange('recalc_hour_kst', e.target.value)}
              className={cellInputCls + ' tabular-nums'}
            />
          </PolicyCell>
          <PolicyCell label="강등 최대 단계" hint="1=한 번에 한 단계만 강등">
            <input
              type="number"
              min="1"
              max="5"
              value={values['demote_step_max'] ?? ''}
              onChange={(e) => onChange('demote_step_max', e.target.value)}
              className={cellInputCls + ' tabular-nums'}
            />
          </PolicyCell>
        </div>
      </div>
    </div>
  )
}

function PolicyCell({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</div>
      {hint && <div className="text-[10px] text-gray-400 mb-1.5 mt-0.5">{hint}</div>}
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 약관/처리방침 편집기 (page 테이블 slug='terms', 'privacy')
// 부가 기능(use_html / mobile_content / head_html / tail_html) 은
// 별도 페이지(/mng/contents) 에서 처리.
// ─────────────────────────────────────────────────────────────────

interface LegalPage {
  id: number
  slug: string
  title: string
  content: string | null
}

function LegalEditor() {
  const [terms, setTerms] = useState<LegalPage | null>(null)
  const [privacy, setPrivacy] = useState<LegalPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState<'terms' | 'privacy' | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api<{ items: LegalPage[] }>('/admin/contents?limit=200')
      .then((res) => {
        if (!alive) return
        const items = res.items ?? []
        setTerms(items.find((p) => p.slug === 'terms') ?? null)
        setPrivacy(items.find((p) => p.slug === 'privacy') ?? null)
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const saveOne = async (page: LegalPage | null, kind: 'terms' | 'privacy') => {
    if (!page) return
    setSaving(kind)
    setError(null)
    try {
      // mobile_content 도 동일값으로 갱신 — 모바일/PC 분리 안 함 (탭 정책)
      await api(`/admin/contents/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: page.title,
          content: page.content ?? '',
          mobile_content: page.content ?? '',
        }),
      })
      setSavedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">로딩...</div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="p-3 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 text-xs">
        ℹ 여기서는 제목 + 본문만 편집합니다. HTML 모드 / 모바일 본문 분리 / 활성화 토글 등 부가 기능은{' '}
        <a href="/contents" className="underline font-medium">내용 관리 페이지</a> 에서 사용하세요.
        {savedAt && (
          <span className="ml-2 text-emerald-700 dark:text-emerald-300">
            · 마지막 저장: {savedAt.toLocaleTimeString('ko-KR')}
          </span>
        )}
      </div>

      {/* terms */}
      <LegalCard
        label="회원가입약관"
        page={terms}
        kind="terms"
        saving={saving === 'terms'}
        onTitleChange={(v) => terms && setTerms({ ...terms, title: v })}
        onContentChange={(v) => terms && setTerms({ ...terms, content: v })}
        onSave={() => saveOne(terms, 'terms')}
      />

      {/* privacy */}
      <LegalCard
        label="개인정보처리방침"
        page={privacy}
        kind="privacy"
        saving={saving === 'privacy'}
        onTitleChange={(v) => privacy && setPrivacy({ ...privacy, title: v })}
        onContentChange={(v) => privacy && setPrivacy({ ...privacy, content: v })}
        onSave={() => saveOne(privacy, 'privacy')}
      />
    </div>
  )
}

function LegalCard({
  label,
  page,
  saving,
  onTitleChange,
  onContentChange,
  onSave,
}: {
  label: string
  page: LegalPage | null
  kind: 'terms' | 'privacy'
  saving: boolean
  onTitleChange: (v: string) => void
  onContentChange: (v: string) => void
  onSave: () => void
}) {
  if (!page) {
    return (
      <div className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <div className="font-medium mb-2">{label}</div>
        <div className="text-xs text-gray-500">
          page 테이블에 해당 slug 행 없음. 내용 관리 페이지에서 신규 생성 필요.
        </div>
      </div>
    )
  }
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-gray-800 dark:text-gray-100">{label}</div>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">제목</label>
          <input
            type="text"
            value={page.title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded text-sm bg-white dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">본문 (줄바꿈은 그대로 표시됩니다)</label>
          <textarea
            value={page.content ?? ''}
            onChange={(e) => onContentChange(e.target.value)}
            rows={14}
            className="w-full mt-1 px-3 py-2 border rounded text-sm font-mono bg-white dark:bg-gray-700"
          />
        </div>
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
