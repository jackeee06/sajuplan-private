import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save } from 'lucide-react'
import { api } from '../lib/api'

// ───────────────────────────────────────────────
// 타입
// ───────────────────────────────────────────────
type SettingsByNs = Record<string, Record<string, string>>

// 화면에 노출되는 탭 (4개로 통합 — 2026-05-17)
type TabKey = 'general' | 'grade' | 'ops' | 'legal'
// 데이터는 여전히 6개 namespace 로 분리 (DB 호환).
// 'general' 탭은 아래 6개 namespace 를 섹션으로 묶어서 한 화면에 그리드로 표시.
type Namespace = 'site' | 'member' | 'review' | 'social' | 'security' | 'footer' | 'grade' | 'ops'
type FieldKind = 'text' | 'textarea' | 'number' | 'bool' | 'password' | 'select' | 'multiselect'
interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  hint?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  /**
   * 그리드 폭 오버라이드. 기본:
   *  - textarea / multiselect → true (행 전체)
   *  - 그 외 → false (1칸)
   * 짧은 내용 textarea (IP 목록 등) 는 false 로 명시해 좁게 표시.
   */
  wide?: boolean
}

// ───────────────────────────────────────────────
// 탭별 필드 정의 (마이그레이션의 setting 시드 키와 1:1)
// ───────────────────────────────────────────────
const NS_FIELDS: Record<Namespace, { title: string; fields: FieldDef[] }> = {
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
      {
        key: 'use',
        label: '소셜로그인 전체 사용',
        kind: 'bool',
        hint: '꺼두면 모든 소셜로그인 버튼이 사용자 로그인 화면에서 사라집니다.',
      },
      {
        key: 'service_list',
        label: '활성 서비스 선택',
        kind: 'multiselect',
        hint: '체크된 서비스만 로그인 화면에 노출. 미체크 시 키 값을 입력해도 화면에서 안 보임.',
        options: [
          { value: 'naver', label: '네이버' },
          { value: 'kakao', label: '카카오' },
        ],
      },
      {
        key: 'naver_client_id',
        label: '🟢 네이버 Client ID',
        kind: 'text',
        hint: '네이버 개발자센터 (developers.naver.com) > 내 애플리케이션 > Application 정보',
      },
      {
        key: 'naver_secret',
        label: '🟢 네이버 Client Secret',
        kind: 'password',
        hint: '네이버 개발자센터 같은 화면 — Client Secret 항목 (보안)',
      },
      {
        key: 'kakao_rest_key',
        label: '🟡 카카오 REST API Key',
        kind: 'text',
        hint: '카카오 디벨로퍼스 (developers.kakao.com) > 내 애플리케이션 > 앱 키 > REST API 키',
      },
      {
        key: 'kakao_client_secret',
        label: '🟡 카카오 Client Secret',
        kind: 'password',
        hint: '카카오 디벨로퍼스 > 카카오 로그인 > 보안 > Client Secret (필요 시 발급)',
      },
      {
        key: 'kakao_js_apikey',
        label: '🟡 카카오 JS API Key (공유 기능용)',
        kind: 'text',
        hint: '카카오 디벨로퍼스 > 내 애플리케이션 > 앱 키 > JavaScript 키. 카톡 공유하기에 사용.',
      },
    ],
  },
  security: {
    title: '보안',
    fields: [
      { key: 'possible_ip', label: '접속 허용 IP', kind: 'textarea', wide: false, hint: '개행 구분, 비우면 전체 허용' },
      { key: 'intercept_ip', label: '접속 차단 IP', kind: 'textarea', wide: false, hint: '개행 구분' },
      { key: 'prohibit_id', label: '금지 아이디', kind: 'textarea', wide: false, hint: '콤마(,) 구분 — 예: admin, root, test' },
      { key: 'prohibit_email', label: '금지 이메일 도메인', kind: 'textarea', wide: false, hint: '콤마(,) 구분 — 예: spam.com, badmail.org' },
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
}

// 'general' 탭에서 한 번에 노출되는 섹션 순서
const GENERAL_SECTIONS: Namespace[] = ['site', 'member', 'review', 'social', 'security', 'footer']

const TAB_ORDER: TabKey[] = ['general', 'grade', 'ops', 'legal']

// ───────────────────────────────────────────────
// 페이지
// ───────────────────────────────────────────────
export default function Settings() {
  const [data, setData] = useState<SettingsByNs | null>(null)
  const [tab, setTab] = useState<TabKey>('general')
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

  const setField = (ns: Namespace, key: string, value: string) => {
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

  // 탭별 타이틀 — 헤더와 탭 버튼에 사용
  const TAB_TITLES: Record<TabKey, string> = useMemo(() => ({
    general: '기본환경',
    grade: '등급/단가',
    ops: '운영알림',
    legal: '약관/처리방침',
  }), [])

  if (!data) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
        {error ? `오류: ${error}` : '로딩...'}
      </div>
    )
  }

  return (
    // 정보 밀도 최대화 — 와이드 모니터에서 한 화면에 많이 보이게
    <div className="space-y-4 max-w-[1600px]">
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
              {TAB_TITLES[k]}
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
      ) : tab === 'general' ? (
        // 6개 namespace 를 섹션 카드로 묶어서 한 화면에 노출
        <div className="space-y-6">
          {GENERAL_SECTIONS.map((ns) => (
            <SettingsSection
              key={ns}
              title={NS_FIELDS[ns].title}
              fields={NS_FIELDS[ns].fields}
              values={data[ns] ?? {}}
              onChange={(key, value) => setField(ns, key, value)}
            />
          ))}
        </div>
      ) : (
        // ops 등 단일 namespace 탭 — 그리드 레이아웃
        <SettingsSection
          title={NS_FIELDS[tab as Namespace].title}
          fields={NS_FIELDS[tab as Namespace].fields}
          values={data[tab as Namespace] ?? {}}
          onChange={(key, value) => setField(tab as Namespace, key, value)}
          hideHeader
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 섹션 카드 — 제목 + 그리드 필드 (한 줄에 2개, textarea 는 풀폭)
// ─────────────────────────────────────────────────────────────────

function SettingsSection({
  title,
  fields,
  values,
  onChange,
  hideHeader,
}: {
  title: string
  fields: FieldDef[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  hideHeader?: boolean
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {!hideHeader && (
        <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/60">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{title}</div>
        </div>
      )}
      {/* 정보 밀도 높이기 — 4열 (lg) / 3열 (md) / 1열 (mobile). textarea 는 풀폭 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 p-3">
        {fields.map((f) => {
          const value = values[f.key] ?? ''
          // wide 오버라이드 우선. 없으면 textarea/multiselect 만 풀폭, 나머지 1칸.
          const wide = f.wide ?? (f.kind === 'textarea' || f.kind === 'multiselect')
          return (
            <div key={f.key} className={wide ? 'md:col-span-3 lg:col-span-4' : ''}>
              <label
                htmlFor={`field-${f.key}`}
                className="block text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                {f.label}
              </label>
              {f.hint && (
                <div className="text-[10px] text-gray-400 mt-0.5 mb-1 leading-tight">{f.hint}</div>
              )}
              <div className={f.hint ? '' : 'mt-1'}>
                <FieldInput
                  id={`field-${f.key}`}
                  def={f}
                  value={value}
                  onChange={(v) => onChange(f.key, v)}
                />
              </div>
            </div>
          )
        })}
      </div>
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
  const inputBase =
    'px-2 py-1.5 border rounded text-sm bg-white dark:bg-gray-700 dark:border-gray-600'

  // 락/재산정 정책 잠금 — 매출 직결 정책 보호 (기본 잠금)
  const [policyUnlocked, setPolicyUnlocked] = useState(false)
  const togglePolicyLock = () => {
    if (!policyUnlocked) {
      const ok = window.confirm(
        '⚠ 이 정책은 매출/정산에 직접 영향을 줍니다.\n잘못 변경하면 전체 상담사 정산 사고로 이어질 수 있습니다.\n\n정말 수정하시겠습니까?',
      )
      if (!ok) return
    }
    setPolicyUnlocked((v) => !v)
  }

  return (
    // max-w 로 좌측 정렬 — 와이드 모니터에서 화면 끝까지 늘어나지 않게
    <div className="space-y-6 max-w-[1080px]">
      {/* 전체 정책 안내 — 오랜만에 보는 운영자 친절 가이드 */}
      <details className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-xs leading-relaxed">
        <summary className="cursor-pointer font-medium text-blue-800 dark:text-blue-200 select-none">
          ℹ️ 등급/단가 시스템이 어떻게 작동하나요? (오랜만에 보시면 펼쳐서 확인)
        </summary>
        <div className="mt-3 space-y-2 text-gray-700 dark:text-gray-300">
          <p>
            <b>전체 흐름</b>: 상담사는 시간이 누적되면 등급이 오릅니다. 각 등급마다 선택 가능한
            <b> 단가 옵션</b>이 정해져 있고, 상담사가 본인 마이페이지에서 그중 하나를 고를 수 있습니다.
            매월 1일에 직전 한 달 통화 시간을 합산해 등급이 자동 재산정되고, 등급이 바뀌면 단가 옵션도
            바뀝니다.
          </p>
          <p>
            <b>정산</b>: 상담사 수익 = (통화 결제 금액 - 환불) × 정산률. 등급이 높을수록 정산률을
            높여 전속 상담사를 우대합니다.
          </p>
          <p>
            <b>안전장치</b>: 단가 변경은 매월 1일에만 1회 가능 (월 1일 락). 등급은 한 달에 최대
            <b> N단계만 강등</b> (특정 달에 통화 못한 사정 고려). 모든 변경은 이력이 남아 분쟁 시
            추적 가능합니다.
          </p>
        </div>
      </details>

      {/* 매트릭스 표 — 등급별 옵션/정산률/임계값 한 화면 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/60">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">등급별 정책 (6 등급)</div>
          <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">
            <b>단가 옵션</b>: 상담사가 마이페이지에서 선택 가능한 30초당 단가 (원). 정책 외 값은 상담사 본인이 선택 불가 — 어드민은 강제 수정 가능.<br />
            <b>정산률</b>: 상담사 수익 비율. 0.35 = 35% (결제 금액의 35% 가 상담사 몫). 등급 ↑ → 정산률 ↑ 권장.<br />
            <b>임계값</b>: 직전 1개월 통화 시간이 이 값 이상이면 해당 등급으로 승급. 예) 파트너2 임계값=40 → 40시간 이상 통화 시 파트너2.
          </div>
        </div>
        <table className="text-sm">
          <thead className="bg-gray-50/60 dark:bg-gray-800/30 text-xs text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-24">등급</th>
              <th className="px-3 py-2 text-left font-medium w-[640px]">
                단가 옵션 <span className="text-gray-400 font-normal">(원 / 30초)</span>
              </th>
              <th className="px-3 py-2 text-left font-medium w-32">
                정산률 <span className="text-gray-400 font-normal">(0~1)</span>
              </th>
              <th className="px-3 py-2 text-left font-medium w-32">
                임계값 <span className="text-gray-400 font-normal">(시간)</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {GRADE_ROWS.map((g) => (
              <tr key={g.key}>
                <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{g.label}</td>
                <td className="px-3 py-2">
                  <PriceOptionsEditor
                    value={values[`options.${g.key}`] ?? ''}
                    onChange={(v) => onChange(`options.${g.key}`, v)}
                  />
                </td>
                <td className="px-3 py-2">
                  <RateInput
                    value={values[`revenue_rate.${g.key}`] ?? ''}
                    onChange={(v) => onChange(`revenue_rate.${g.key}`, v)}
                  />
                </td>
                <td className="px-3 py-2">
                  {g.key === 'preliminary' ? (
                    <span className="text-xs text-gray-400">— (기본값)</span>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={values[`thresholds.${g.key}`] ?? ''}
                        onChange={(e) => onChange(`thresholds.${g.key}`, e.target.value)}
                        placeholder="20"
                        className={`${inputBase} tabular-nums w-16`}
                      />
                      <span className="text-xs text-gray-400">시간</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 기타 정책 4개 — 잠금 보호 + 카드별 친절 설명 */}
      <div
        className={`bg-white dark:bg-gray-900 border rounded-xl ${
          policyUnlocked
            ? 'border-rose-300 dark:border-rose-700 ring-2 ring-rose-100 dark:ring-rose-900/30'
            : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/60 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
              락 / 재산정 정책
              {policyUnlocked ? (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-semibold">
                  🔓 수정 가능
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-semibold">
                  🔒 잠금
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              매출/정산 직결 정책. 사고 방지 위해 기본 잠금 — 클릭해서 해제 후 수정.
            </div>
          </div>
          <button
            type="button"
            onClick={togglePolicyLock}
            className={`px-3 py-1.5 rounded text-xs font-medium shrink-0 ${
              policyUnlocked
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100'
            }`}
          >
            {policyUnlocked ? '🔒 잠금 (수정 종료)' : '🔓 잠금 해제 (수정하기)'}
          </button>
        </div>
        <fieldset
          disabled={!policyUnlocked}
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 transition-opacity ${
            !policyUnlocked ? 'opacity-50 cursor-not-allowed select-none' : ''
          }`}
        >
          <PolicyCell
            label="월 1일 락"
            hint="상담사가 단가를 변경할 수 있는 시점 제한. true 면 매월 1일에만 1회 변경 가능 (등급 재산정 직후). false 면 언제든 변경 가능 — 단가 사고 위험 있어 비추천. 신규 가입자는 정책 무관 가입 즉시 1회 선택 가능."
          >
            <select
              value={values['lock_until_first_day'] ?? 'true'}
              onChange={(e) => onChange('lock_until_first_day', e.target.value)}
              className={`${inputBase} w-full`}
            >
              <option value="true">true · 월 1일에만 변경 (권장)</option>
              <option value="false">false · 즉시 언제든 변경</option>
            </select>
          </PolicyCell>

          <PolicyCell
            label="재산정 일자"
            hint="매월 며칠에 등급 재산정 크론을 자동 실행할지. 보통 1 (월초). 그 날 0시(KST)에 직전 1개월 통화 시간을 합산해 새 등급을 결정. 1~28 입력 가능 (29~31은 월 따라 없을 수 있어 제외)."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="28"
                value={values['recalc_day_of_month'] ?? ''}
                onChange={(e) => onChange('recalc_day_of_month', e.target.value)}
                className={`${inputBase} tabular-nums w-24`}
              />
              <span className="text-xs text-gray-500">일</span>
            </div>
          </PolicyCell>

          <PolicyCell
            label="재산정 시각 (KST)"
            hint="위 일자의 몇 시(0~23)에 재산정 크론이 실행될지. 권장 0 (자정) — 통화가 적은 시간에 처리. 너무 늦은 시각이면 그 날 단가 변경 시도하는 상담사에게 혼란 발생 가능."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="23"
                value={values['recalc_hour_kst'] ?? ''}
                onChange={(e) => onChange('recalc_hour_kst', e.target.value)}
                className={`${inputBase} tabular-nums w-24`}
              />
              <span className="text-xs text-gray-500">시</span>
            </div>
          </PolicyCell>

          <PolicyCell
            label="강등 최대 단계"
            hint="등급 재산정 시 한 번에 최대 몇 단계까지 강등 가능한지. 1 = 한 단계씩만 (권장 — 갑작스러운 강등 방지). 5 = 즉시 적정 등급으로 떨어짐 (예: 파트너5가 0시간 통화하면 1번에 예비파트너). 승급은 이 제약과 무관 (한 번에 여러 단계 가능)."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="5"
                value={values['demote_step_max'] ?? ''}
                onChange={(e) => onChange('demote_step_max', e.target.value)}
                className={`${inputBase} tabular-nums w-24`}
              />
              <span className="text-xs text-gray-500">단계</span>
            </div>
          </PolicyCell>
        </fieldset>
      </div>
    </div>
  )
}

/**
 * 단가 옵션 개별 칸 편집기.
 *  - DB 저장 형식: "800,1000,1200" (콤마 구분 문자열) — 기존 스키마 그대로
 *  - UI 는 칸당 한 숫자 + 추가/삭제 버튼
 *  - 잘못된 입력(빈값/0 이하/비숫자) 은 저장 시 자동 제외
 *
 *  변경 정책:
 *    - 빈 값 입력 OK (편집 중 임시 상태). 빈 값/0/NaN 은 join 할 때 자동 제거.
 *    - 추가: + 버튼 → 빈 칸 추가
 *    - 삭제: 칸 옆 × 버튼
 *    - 최소 1개 유지 (전부 삭제 방지)
 */
function PriceOptionsEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  // 입력 중에는 raw 문자열 상태로 유지 — 사용자가 지웠다가 다시 쓸 수 있게
  const initial = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const [items, setItems] = useState<string[]>(initial.length > 0 ? initial : [''])

  // 부모 value 가 다른 출처(예: 저장 후 새로 받은 데이터)로 바뀌면 동기화
  useEffect(() => {
    const next = value.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    const joined = items.join(',')
    if (joined !== value && next.join(',') !== joined) {
      setItems(next.length > 0 ? next : [''])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const propagate = (next: string[]) => {
    // 부모에게는 valid 한 숫자만 콤마 결합해 전달
    const valid = next
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && Number(s) > 0)
    onChange(valid.join(','))
  }

  const updateAt = (i: number, v: string) => {
    // 숫자/빈문자만 허용 — 콤마 입력으로 데이터 깨지는 사고 방지
    if (v && !/^\d+$/.test(v)) return
    const next = [...items]
    next[i] = v
    setItems(next)
    propagate(next)
  }

  const addItem = () => {
    const next = [...items, '']
    setItems(next)
    // 빈 값 추가는 외부 value 에 영향 없음 (propagate 가 빈 값 제거)
  }

  const removeAt = (i: number) => {
    if (items.length <= 1) return // 최소 1개 유지
    const next = items.filter((_, idx) => idx !== i)
    setItems(next)
    propagate(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((v, i) => (
        <div key={i} className="relative inline-flex items-center">
          <input
            type="text"
            inputMode="numeric"
            value={v}
            onChange={(e) => updateAt(i, e.target.value)}
            placeholder="0"
            className="w-24 px-2 py-1.5 pr-7 border rounded text-sm tabular-nums bg-white dark:bg-gray-700 dark:border-gray-600"
          />
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-rose-200 text-gray-500 hover:text-rose-700 text-[11px] leading-none flex items-center justify-center"
              aria-label="삭제"
              title="삭제"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="w-7 h-7 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-brand-600 hover:border-brand-400 text-sm leading-none flex items-center justify-center"
        aria-label="단가 추가"
        title="단가 추가"
      >
        +
      </button>
    </div>
  )
}

/**
 * 정산률 입력 (0~1 decimal).
 *   입력은 그대로 0.35 형식. 우측에 "(=35%)" 자동 변환 표시 — 직관성 보강.
 */
function RateInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const n = Number(value)
  const pct = Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 10 : null
  return (
    <div className="inline-flex items-center gap-1.5">
      <input
        type="number"
        step="0.01"
        min="0"
        max="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.50"
        className="w-20 px-2 py-1.5 border rounded text-sm tabular-nums bg-white dark:bg-gray-700 dark:border-gray-600"
      />
      <span className="text-xs text-gray-400 tabular-nums min-w-[44px]">
        {pct !== null ? `= ${pct}%` : ''}
      </span>
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
    <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 bg-gray-50/40 dark:bg-gray-800/30">
      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">{label}</div>
      {hint && (
        <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
          {hint}
        </div>
      )}
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
        <Link to="/contents" className="underline font-medium">내용 관리 페이지</Link> 에서 사용하세요.
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
