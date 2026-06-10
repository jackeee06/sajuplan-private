import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ReadOnlyForSuper, SuperOnlySection } from '../components/SuperOnlySection'

// ───────────────────────────────────────────────
// 타입
// ───────────────────────────────────────────────
type SettingsByNs = Record<string, Record<string, string>>

// 화면에 노출되는 탭 (2026-05-21: payout 추가)
type TabKey = 'general' | 'grade' | 'payout' | 'ops' | 'legal' | 'counselor'
// 데이터는 namespace 로 분리 (DB 호환).
// 'general' 탭은 아래 6개 namespace 를 섹션으로 묶어서 한 화면에 그리드로 표시.
type Namespace = 'site' | 'member' | 'review' | 'social' | 'security' | 'footer' | 'grade' | 'ops' | 'payout' | 'maintenance' | 'counselor'
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
      { key: 'company_name', label: '회사명 (상호)', kind: 'text', placeholder: '예: 주식회사 사주플랜' },
      { key: 'ceo', label: '대표자', kind: 'text' },
      { key: 'address', label: '주소', kind: 'text', placeholder: '예: 서울특별시 강남구 ...' },
      { key: 'business_no', label: '사업자등록번호', kind: 'text', placeholder: 'XXX-XX-XXXXX' },
      { key: 'ecommerce_no', label: '통신판매업신고번호', kind: 'text' },
      { key: 'privacy_officer', label: '개인정보보호책임자', kind: 'text' },
      { key: 'phone', label: '대표 전화번호', kind: 'text' },
      { key: 'fax', label: '팩스번호', kind: 'text' },
      { key: 'email', label: '대표 이메일', kind: 'text' },
      { key: 'business_hours', label: '운영시간 안내', kind: 'text', placeholder: '예: 평일 10:00 ~ 18:00' },
      { key: 'copyright', label: '저작권 문구', kind: 'text', placeholder: '예: COPYRIGHT © 사주플랜 ALL RIGHTS RESERVED' },
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
  payout: {
    title: '선지급',
    fields: [
      {
        key: 'policy_text',
        label: '선지급 정책 안내문',
        kind: 'textarea',
        hint: '선지급 관리 페이지(상단 "정책 보기" 펼침)에 그대로 노출됩니다. 운영자가 처음 봐도 처리 흐름을 한 번에 이해할 수 있도록 작성하세요. 비워두면 시스템 기본 안내문이 표시됩니다.',
      },
      {
        key: 'fee_rate',
        label: '수수료율 (%)',
        kind: 'text',
        placeholder: '예: 5',
        hint: '🔒 슈퍼어드민만 변경 가능. 신청금에서 공제되는 서비스 수수료 비율. 5 = 5%. 변경 시 새 신청건부터 적용됩니다 (기존 신청건은 신청 시점 값을 그대로 사용).',
      },
      {
        key: 'withholding_rate',
        label: '원천세율 (%)',
        kind: 'text',
        placeholder: '예: 3.3',
        hint: '🔒 슈퍼어드민만 변경 가능. 사업소득 원천징수율. 한국 세법 기준 3.3% (소득세 3% + 지방세 0.3%). 세법 개정이 없는 한 유지하세요.',
      },
    ],
  },
  maintenance: {
    title: '🔧 점검 안내 배너',
    fields: [
      {
        key: 'banner_active',
        label: '배너 활성',
        kind: 'bool',
        hint: '켜면 모든 사용자(비로그인 포함) 의 홈 상단에 노란 점검 배너가 노출됩니다. 점검 시작 전 켜고, 종료 후 끄세요.',
      },
      {
        key: 'banner_title',
        label: '제목',
        kind: 'text',
        placeholder: '예: 점검 안내',
        hint: '배너 좌측에 표시. 짧고 명확하게.',
      },
      {
        key: 'banner_body',
        label: '본문',
        kind: 'text',
        placeholder: '예: 5월 30일 새벽 2~4시 서비스 점검이 예정되어 있어요',
        hint: '배너 본문 한 줄. 점검 시간과 영향을 명확히.',
      },
      {
        key: 'banner_link',
        label: '클릭 시 이동 URL (선택)',
        kind: 'text',
        placeholder: '예: /notices/123 또는 https://example.com',
        hint: '비우면 배너 클릭 비활성. 내부 페이지는 "/notices/123" 형식, 외부 사이트는 "https://example.com" 형식. (스킴 없이 "www.example.com" 도 자동 처리)',
      },
    ],
  },
  ops: {
    title: '운영알림',
    fields: [
      {
        key: 'admin_alert.enabled',
        label: '운영자 알림 활성',
        kind: 'bool',
        hint: '시스템에 사고가 발생하면 등록된 휴대폰으로 카카오 알림톡을 자동 발송합니다. 끄면 알림이 오지 않습니다. 평상시 켜둔 채로 두세요.',
      },
      // admin_alert.recipients / admin_alert.recipient_labels 는 RecipientsEditor 가 별도 렌더 — 여기 fields 에서 제외
      {
        key: 'admin_alert.template_code',
        label: '알림톡 템플릿 코드',
        kind: 'text',
        placeholder: 'ops_admin_alert',
        hint: '⚠️ 기본값 그대로 두세요. 카카오 알림톡은 미리 등록한 양식으로만 보낼 수 있습니다. 여기 적힌 이름이 알림톡 발송 회사(비즈엠)에 등록된 양식 이름이에요. 함부로 바꾸면 알림이 멈춥니다. 새 양식을 등록한 경우에만 개발자에게 알려 바꾸세요.',
      },
      {
        key: 'admin_alert.cooldown_sec',
        label: '대기 시간(초)',
        kind: 'number',
        placeholder: '300',
        hint: '같은 사고가 짧은 시간에 여러 번 일어날 때, 카톡이 도배되지 않도록 막는 시간이에요. 예: 300(=5분) 으로 두면, 같은 사고가 5분 안에 100번 일어나도 카톡은 처음 1번만 옵니다. 단위는 "초". 기본 300 권장.',
      },
    ],
  },
}

// 'general' 탭에서 한 번에 노출되는 섹션 순서
const GENERAL_SECTIONS: Namespace[] = ['maintenance', 'site', 'member', 'review', 'social', 'security', 'footer']

const TAB_ORDER: TabKey[] = ['general', 'grade', 'payout', 'ops', 'legal', 'counselor']

// ───────────────────────────────────────────────
// 페이지
// ───────────────────────────────────────────────
export default function Settings() {
  const [data, setData] = useState<SettingsByNs | null>(null)
  // URL ?tab=grade 같은 파라미터로 초기 탭 지정 (다른 페이지에서 딥링크 진입 지원).
  // 유효 값: general / grade / payout / ops / legal. 그 외엔 'general' fallback.
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabKey) || 'general'
  const validTab: TabKey = (['general', 'grade', 'payout', 'ops', 'legal', 'counselor'] as TabKey[]).includes(initialTab) ? initialTab : 'general'
  const [tab, setTabState] = useState<TabKey>(validTab)
  const setTab = (next: TabKey) => {
    setTabState(next)
    // URL 도 같이 갱신 (사장님이 새로고침해도 같은 탭 유지)
    const sp = new URLSearchParams(searchParams)
    if (next === 'general') sp.delete('tab')
    else sp.set('tab', next)
    setSearchParams(sp, { replace: true })
  }
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
    payout: '선지급',
    ops: '운영알림',
    legal: '약관/처리방침',
    counselor: '상담사 설정',
  }), [])

  // 헤더에 표시할 페이지 제목/부제 — 탭별 동적
  const TAB_HEADERS: Record<TabKey, { title: string; subtitle: string }> = useMemo(() => ({
    general:   { title: '기본환경설정', subtitle: '사이트 운영 전반의 기본값을 관리합니다.' },
    grade:     { title: '등급/단가 설정', subtitle: '상담사 등급별 단가 옵션·정산률·임계값을 관리합니다.' },
    payout:    { title: '선지급 설정', subtitle: '선지급 정책 안내문과 수수료율·원천세율을 관리합니다.' },
    ops:       { title: '운영알림 설정', subtitle: '시스템 사고 알림 수신자와 발송 정책을 관리합니다.' },
    legal:     { title: '약관/처리방침', subtitle: '회원가입약관·개인정보처리방침 본문을 관리합니다.' },
    counselor: { title: '상담사 설정', subtitle: '상담사 스타일 선택지 등 상담사 관련 옵션을 관리합니다.' },
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
    <div className="space-y-4 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{TAB_HEADERS[tab].title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {TAB_HEADERS[tab].subtitle}
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
        // 6개 namespace 를 표준 폼으로 (선지급 탭과 동일 톤)
        <GeneralSettingsForm
          data={data}
          onChange={(ns, key, value) => setField(ns, key, value)}
        />
      ) : tab === 'ops' ? (
        // 운영알림 — 관리자 이해용 안내 박스 + 설정 그리드
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-base dark:border-blue-800 dark:bg-blue-950/40">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-3">📋 운영자 알림이란?</h3>
            <p className="text-blue-800 dark:text-blue-300 mb-4 leading-relaxed">
              사주플랜 시스템이 자동으로 도는 5개 작업(<b>크론</b>) 또는 결제·상담 처리 중
              사고가 발생하면 등록된 운영자 휴대폰으로 <b>카카오 알림톡</b>이 즉시 발송됩니다.
            </p>

            <p className="text-base font-bold text-blue-900 dark:text-blue-200 mt-4 mb-2">⏰ 사주플랜이 자동으로 도는 5가지 작업</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-blue-200 dark:border-blue-800">
                  <th className="text-left py-2 pr-3 font-semibold text-blue-900 dark:text-blue-200 w-[35%]">시간</th>
                  <th className="text-left py-2 font-semibold text-blue-900 dark:text-blue-200">하는 일</th>
                </tr>
              </thead>
              <tbody className="text-blue-800 dark:text-blue-300">
                <tr className="border-b border-blue-100 dark:border-blue-900/50">
                  <td className="py-2 pr-3">매월 1일 00:05</td>
                  <td className="py-2">상담사 등급 자동 재계산</td>
                </tr>
                <tr className="border-b border-blue-100 dark:border-blue-900/50">
                  <td className="py-2 pr-3">매월 1일 04:00</td>
                  <td className="py-2">지난달 정산 자동 계산</td>
                </tr>
                <tr className="border-b border-blue-100 dark:border-blue-900/50">
                  <td className="py-2 pr-3">10분마다</td>
                  <td className="py-2">채팅 정산 실패 건 재시도</td>
                </tr>
                <tr className="border-b border-blue-100 dark:border-blue-900/50">
                  <td className="py-2 pr-3">10분마다</td>
                  <td className="py-2">충전 적립 실패 건 재시도</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">매시간</td>
                  <td className="py-2">DB 사고 자동 감지 (18가지 점검)</td>
                </tr>
              </tbody>
            </table>

            <p className="text-base font-bold text-blue-900 dark:text-blue-200 mt-5 mb-2">🚨 어떤 사고일 때 알림이 오나?</p>
            <ul className="list-disc pl-6 text-blue-800 dark:text-blue-300 space-y-1 leading-relaxed">
              <li><b>크론 실패</b>: 위 5가지 자동 작업 중 하나가 에러로 멈춤</li>
              <li><b>M2NET 차감/적립 실패</b>: 통화·채팅 종료 후 회원 포인트 차감 또는 상담사 수익 적립이 안 됨</li>
              <li><b>자동충전 사고</b>: 회원 자동충전 처리 실패</li>
              <li><b>DB 사고</b>: 매시간 점검에서 음수 잔액·환불 불일치 등 발견</li>
              <li><b>위조 시도</b>: 정상이 아닌 IP 에서 결제/통화 콜백 도착</li>
            </ul>

            <p className="text-base font-bold text-blue-900 dark:text-blue-200 mt-5 mb-2">📱 알림이 도착했을 때 어떻게?</p>
            <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
              운영팀에 카톡 내용을 전달하시면 됩니다. 운영팀이 코드 기반 매뉴얼(<code className="text-sm bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">_OPS_RUNBOOK.md</code>)
              에 따라 즉시 점검·복구합니다.
            </p>

            <p className="text-blue-700 dark:text-blue-400 mt-4 italic">
              💡 평소에 알림이 안 오면 = 모든 자동 작업 정상. 안심하셔도 됩니다.
            </p>
          </div>

          <RecipientsEditor
            recipients={(data.ops ?? {})['admin_alert.recipients'] ?? ''}
            labels={(data.ops ?? {})['admin_alert.recipient_labels'] ?? ''}
            onChange={(rec, lab) => {
              setField('ops', 'admin_alert.recipients', rec)
              setField('ops', 'admin_alert.recipient_labels', lab)
            }}
          />

          <SettingsSection
            title={NS_FIELDS[tab as Namespace].title}
            fields={NS_FIELDS[tab as Namespace].fields}
            values={data[tab as Namespace] ?? {}}
            onChange={(key, value) => setField(tab as Namespace, key, value)}
            hideHeader
          />
        </div>
      ) : tab === 'payout' ? (
        <PayoutSettingsForm
          values={data.payout ?? {}}
          onChange={(key, value) => setField('payout', key, value)}
        />
      ) : tab === 'counselor' ? (
        <CounselorStyleEditor
          values={data.counselor ?? {}}
          onChange={(key, value) => setField('counselor', key, value)}
        />
      ) : (
        // 그 외 단일 namespace 탭 — 그리드 레이아웃
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
// 선지급 탭 전용 폼 — 표준 폼 레이아웃 (라벨 좌측 + 입력 우측 가로)
//   - 정책 안내문 = textarea (max-w-[800px], 8행)
//   - 수수료율 / 원천세율 = 짧은 입력 (max-w-[140px]) + 🔒 부연
// ─────────────────────────────────────────────────────────────────
function PayoutSettingsForm({
  values,
  onChange,
}: {
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="space-y-5">
      {/* 정책 안내문 — wide textarea */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-start gap-3">
          <label className="w-[110px] shrink-0 pt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            정책 안내문
          </label>
          <div className="flex-1 max-w-[800px]">
            <textarea
              rows={10}
              value={values.policy_text ?? ''}
              onChange={(e) => onChange('policy_text', e.target.value)}
              placeholder="예: 선지급은 매일 1회, 1만원 단위로 신청 가능합니다. 수수료 5%·원천세 3.3% 공제 후 영업일 기준 1일 내 지급됩니다…"
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 outline-none transition"
            />
            <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
              선지급 관리 페이지(상단 "정책 보기" 펼침)에 그대로 노출됩니다. 비워두면 시스템 기본 안내문이 표시됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* 수수료율 · 원천세율 — 슈퍼 전용 read-only (일반은 disabled, 안내 없음) */}
      <ReadOnlyForSuper
        title="👁️ 정책 공개 영역 (일반관리자는 보기만 가능)"
        subtitle="상담사도 아는 정산 정책입니다. 슈퍼관리자만 수정 가능합니다."
      >
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
            <PayoutRateRow
              label="수수료율 (%)"
              value={values.fee_rate ?? ''}
              onChange={(v) => onChange('fee_rate', v)}
              placeholder="예: 5"
              hint="신청금에서 공제되는 서비스 수수료. 5 = 5%. 변경은 새 신청건부터 적용 (기존 신청건은 신청 시점 값 유지)."
            />
            <PayoutRateRow
              label="원천세율 (%)"
              value={values.withholding_rate ?? ''}
              onChange={(v) => onChange('withholding_rate', v)}
              placeholder="예: 3.3"
              hint="한국 세법 기준 사업소득 원천징수율 3.3% (소득세 3% + 지방세 0.3%). 세법 개정 없는 한 유지."
            />
          </div>
        </section>
      </ReadOnlyForSuper>
    </div>
  )
}

function PayoutRateRow({
  label, value, onChange, placeholder, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <label className="w-[110px] shrink-0 pt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
      </label>
      <div className="flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full max-w-[140px] h-9 px-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 outline-none transition tabular-nums"
        />
        {hint && (
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed max-w-[420px]">{hint}</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 기본환경 탭 전용 폼 — 6개 namespace 를 표준 폼 톤으로
//   - 섹션별 카드 (제목 + 부제)
//   - 라벨 좌측(110px) + 입력 우측
//   - 짧은 입력(text/number/bool/select)은 2열 그리드, textarea/multiselect 는 풀폭
// ─────────────────────────────────────────────────────────────────

const GENERAL_SECTION_SUBTITLE: Record<string, string> = {
  site: '사이트 제목·관리자 메일·메인 카드 노출값 등 사이트 전반 기본값.',
  member: '회원가입 시 적용되는 기본 등급·필수 입력·적립 포인트 정책.',
  review: '후기 작성 시 회원에게 지급되는 포인트 정책.',
  social: '카카오·네이버 소셜로그인 활성/키 관리.',
  security: '접속 허용/차단 IP, 금지 아이디·이메일 도메인.',
  footer: '푸터에 노출되는 회사정보(상호·대표·주소·사업자번호 등).',
}

function GeneralSettingsForm({
  data,
  onChange,
}: {
  data: SettingsByNs
  onChange: (ns: Namespace, key: string, value: string) => void
}) {
  return (
    <div className="space-y-5">
      {GENERAL_SECTIONS.map((ns) => {
        const section = NS_FIELDS[ns]
        const values = data[ns] ?? {}
        return (
          <section
            key={ns}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
          >
            {/* 섹션 헤더 */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{section.title}</div>
              {GENERAL_SECTION_SUBTITLE[ns] && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {GENERAL_SECTION_SUBTITLE[ns]}
                </div>
              )}
            </div>
            {/* 섹션 본문 — 짧은 필드 2열, 긴 필드 풀폭 */}
            <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                {section.fields.map((f) => {
                  const wide = f.wide ?? (f.kind === 'textarea' || f.kind === 'multiselect')
                  return (
                    <div key={f.key} className={wide ? 'lg:col-span-2' : ''}>
                      <GeneralFieldRow
                        def={f}
                        value={values[f.key] ?? ''}
                        onChange={(v) => onChange(ns, f.key, v)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}

function GeneralFieldRow({
  def, value, onChange,
}: {
  def: FieldDef
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <label
        htmlFor={`field-${def.key}`}
        className="w-[110px] shrink-0 pt-2 text-sm font-medium text-gray-700 dark:text-gray-200"
      >
        {def.label}
      </label>
      <div className="flex-1 min-w-0">
        <FieldInput
          id={`field-${def.key}`}
          def={def}
          value={value}
          onChange={onChange}
        />
        {def.hint && (
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed max-w-[520px]">{def.hint}</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 운영자 알림 — 수신자 (이름 + 휴대폰 번호) 행 단위 추가/삭제 UI
//   백엔드 호환: admin_alert.recipients (번호 콤마 구분, 백엔드 사용)
//               admin_alert.recipient_labels (이름 콤마 구분, UI 표시용)
// ─────────────────────────────────────────────────────────────────

type Recipient = { name: string; phone: string }

function parseRecipients(rec: string, labels: string): Recipient[] {
  const phones = (rec || '').split(',').map((s) => s.trim()).filter(Boolean)
  const names = (labels || '').split(',').map((s) => s.trim())
  return phones.map((phone, i) => ({ name: names[i] ?? '', phone }))
}

function serializeRecipients(rows: Recipient[]): { recipients: string; labels: string } {
  const valid = rows.filter((r) => r.phone.replace(/\D/g, '').length >= 10)
  return {
    recipients: valid.map((r) => r.phone.replace(/\D/g, '')).join(','),
    labels: valid.map((r) => r.name.trim()).join(','),
  }
}

function RecipientsEditor({
  recipients,
  labels,
  onChange,
}: {
  recipients: string
  labels: string
  onChange: (recipients: string, labels: string) => void
}) {
  // 자체 state — 빈 행 추가/이름만 입력한 중간 상태도 보존 (부모에는 valid 만 전달)
  const [rows, setRows] = useState<Recipient[]>(() => {
    const parsed = parseRecipients(recipients, labels)
    return parsed.length === 0 ? [{ name: '', phone: '' }] : parsed
  })

  const update = (next: Recipient[]) => {
    setRows(next)
    const s = serializeRecipients(next)
    onChange(s.recipients, s.labels)
  }

  const visibleRows = rows

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-base font-bold text-gray-800 dark:text-gray-200">수신자 목록</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
            사고 알림을 받을 사람의 이름과 휴대폰 번호. <b>비워두면 알림 발송 안 됨.</b>
          </p>
        </div>
        <button
          type="button"
          onClick={() => update([...visibleRows, { name: '', phone: '' }])}
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md bg-brand-600 hover:bg-brand-700 text-white"
        >
          + 추가
        </button>
      </div>

      <div className="space-y-2">
        {visibleRows.map((r, i) => {
          const digits = r.phone.replace(/\D/g, '')
          const phoneInvalid = r.phone.length > 0 && !/^01[0-9]{8,9}$/.test(digits)
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={r.name}
                onChange={(e) => {
                  const next = [...visibleRows]
                  next[i] = { ...next[i], name: e.target.value }
                  update(next)
                }}
                placeholder="이름 (예: 사장님)"
                className="w-[30%] px-3 py-2.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <input
                type="text"
                inputMode="numeric"
                value={r.phone}
                onChange={(e) => {
                  const next = [...visibleRows]
                  next[i] = { ...next[i], phone: e.target.value }
                  update(next)
                }}
                placeholder="휴대폰 (01012345678)"
                className={`flex-1 px-3 py-2.5 rounded-md border bg-white dark:bg-gray-800 text-base focus:ring-2 focus:ring-brand-500 outline-none ${
                  phoneInvalid
                    ? 'border-rose-300 dark:border-rose-700'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  const next = visibleRows.filter((_, idx) => idx !== i)
                  update(next.length === 0 ? [{ name: '', phone: '' }] : next)
                }}
                className="px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md"
                aria-label="삭제"
              >
                삭제
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 leading-relaxed">
        💡 하이픈(-) 없이 11자리 숫자만 입력. 형식이 맞지 않으면 입력란이 빨갛게 표시됩니다.
        이름은 누가 누구인지 관리용 (실제 알림에는 영향 없음).
      </p>
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
                className="block text-sm font-semibold text-gray-800 dark:text-gray-200"
              >
                {f.label}
              </label>
              {f.hint && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-2 leading-relaxed">{f.hint}</div>
              )}
              <div className={f.hint ? '' : 'mt-1.5'}>
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
  const { admin } = useAuth()
  const isSuper = !!admin?.is_super
  const inputBase =
    'px-2 py-1.5 border rounded text-sm bg-white dark:bg-gray-700 dark:border-gray-600'

  // 락/재산정 정책 잠금 — 슈퍼만 사용 (일반은 fieldset disabled 로 자동 비활성)
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

      {/* 매트릭스 표 — 등급별 옵션/정산률/(슈퍼: 임계값) 한 화면 */}
      <ReadOnlyForSuper>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/60">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">등급별 정책 (6 등급)</div>
            <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              <b>단가 옵션</b>: 상담사가 마이페이지에서 선택 가능한 30초당 단가 (원).<br />
              <b>정산률</b>: 상담사 수익 비율. 0.35 = 35% (결제 금액의 35% 가 상담사 몫). 등급 ↑ → 정산률 ↑ 권장.
              {isSuper && (
                <>
                  <br /><b>임계값</b>: 직전 1개월 통화 시간이 이 값 이상이면 해당 등급으로 승급.
                </>
              )}
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
                {isSuper && (
                  <th className="px-3 py-2 text-left font-medium w-40 border-t-2 border-l-2 border-r-2 border-rose-400 bg-rose-100/70 dark:bg-rose-900/30 dark:border-rose-700">
                    <div className="flex items-center gap-1 text-rose-800 dark:text-rose-200">
                      🔒 임계값 <span className="text-gray-500 font-normal">(시간)</span>
                    </div>
                    <div className="text-[10px] text-rose-700 dark:text-rose-300 font-normal mt-0.5 leading-tight">
                      슈퍼 전용 — 일반 안 보임
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {GRADE_ROWS.map((g, idx) => {
                const isLast = idx === GRADE_ROWS.length - 1
                return (
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
                  {isSuper && (
                    <td className={`px-3 py-2 border-l-2 border-r-2 border-rose-400 bg-rose-100/50 dark:bg-rose-900/20 dark:border-rose-700 ${isLast ? 'border-b-2' : ''}`}>
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
                  )}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ReadOnlyForSuper>

      {/* 락 / 재산정 / 강등 정책 — 슈퍼관리자에게만 노출 */}
      <SuperOnlySection
        title="🔒 슈퍼관리자 전용 — 락 / 재산정 / 강등 정책"
        subtitle="일반관리자에게는 이 영역이 보이지 않습니다. 매출 직결 핵심 정책이라 슈퍼만 접근 가능합니다."
      >
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

          <PolicyCell
            label="신규 가입 기본 단가"
            hint="상담사 신청 승인 시 자동으로 박히는 30초당 기본 단가 (원). 사용자 화면에 '0원'으로 노출되는 것을 방지. 상담사는 마이페이지에서 등급별 옵션 중 다른 값으로 변경 가능. 기본값 1,000원 권장 (예비파트너 옵션 800/1000 중 합리적 값)."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100000"
                step="100"
                value={values['default_new_unit_cost'] ?? ''}
                onChange={(e) => onChange('default_new_unit_cost', e.target.value)}
                className={`${inputBase} tabular-nums w-32`}
              />
              <span className="text-xs text-gray-500">원 / 30초</span>
            </div>
          </PolicyCell>
        </fieldset>
      </div>
      </SuperOnlySection>
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

// ─────────────────────────────────────────────────────────────────
// 상담사 스타일 선택지 관리 컴포넌트
// ─────────────────────────────────────────────────────────────────
function CounselorStyleEditor({
  values,
  onChange,
}: {
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const raw = values['style_options'] ?? '[]'
  const options: string[] = (() => {
    try { return JSON.parse(raw) as string[] } catch { return [] }
  })()

  const [newItem, setNewItem] = useState('')

  const commit = (next: string[]) => {
    onChange('style_options', JSON.stringify(next))
  }

  const add = () => {
    const t = newItem.trim()
    if (!t || options.includes(t)) return
    commit([...options, t])
    setNewItem('')
  }

  const remove = (opt: string) => {
    commit(options.filter((o) => o !== opt))
  }

  return (
    <div className="space-y-6 max-w-[600px]">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">상담사 스타일 선택지</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            상담사 가입 신청서 및 마이페이지에서 선택할 수 있는 스타일 목록입니다.<br />
            상담사 상세 프로필 페이지에 표시됩니다.
          </p>
        </div>

        {/* 현재 목록 */}
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          {options.length === 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 self-center">등록된 스타일이 없습니다.</span>
          )}
          {options.map((opt) => (
            <span
              key={opt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border border-brand-200 dark:border-brand-800"
            >
              {opt}
              <button
                type="button"
                onClick={() => remove(opt)}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-brand-200 dark:hover:bg-brand-800 text-brand-500 font-bold text-xs leading-none"
                aria-label={`${opt} 삭제`}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {/* 추가 입력 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="새 스타일 입력 (예: 차분한)"
            className="flex-1 h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            type="button"
            onClick={add}
            disabled={!newItem.trim() || options.includes(newItem.trim())}
            className="h-9 px-4 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-40"
          >
            추가
          </button>
        </div>
        <p className="text-xs text-gray-400">
          ※ 추가/삭제 후 우측 상단 <b>저장</b> 버튼을 눌러야 반영됩니다.
        </p>
      </div>
    </div>
  )
}
