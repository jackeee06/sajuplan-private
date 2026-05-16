import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ApiError, attendanceApi, authApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'

type SocialProvider = 'kakao' | 'naver' | 'apple'

/**
 * 로그인 페이지 — Figma node 6:2246 (01로그인_로그인 390x844)
 *
 * 핵심 스펙 (Figma JSON 기반)
 * - 폰트: Pretendard 400/500/600
 * - 입력: w358 h40, bg #f9fafb, border #f3f4f6, fully pill (r=1000)
 * - 로그인 버튼: w358 h48, bg #8259F5, fully pill (r=9999), text 16/500 white
 * - 카카오 버튼: w358 h48, bg #fee500, fully pill, text 15/600 black
 * - 네이버 버튼: w358 h48, bg #03a94d, fully pill, text 15/600 white
 * - 체크박스: 22x22, r=6, checked #8259F5
 * - 본문 가로 패딩: 16px (390 - 358 = 32 / 2)
 * - 헤더: h60, 좌측에 ← 아이콘(30x30) + 12gap + 로그인 타이틀(18/600)
 *
 * 자산: /img/logo.svg, /img/icon-kakao.svg, /img/icon-naver.svg (Figma export)
 */
export default function Login() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [keepLogin, setKeepLogin] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enabledProviders, setEnabledProviders] = useState<SocialProvider[]>([
    'kakao',
    'naver',
    'apple',
  ])

  // 로그인 후 복귀 경로 (?redirect=/...). open redirect 차단을 위해 내부 경로만 허용.
  const redirect = (() => {
    const r = searchParams.get('redirect') || '/'
    return r.startsWith('/') && !r.startsWith('//') ? r : '/'
  })()

  // 관리자 설정에 따라 소셜 버튼 활성화 결정
  // — use=false 면 통째 숨김
  // — providers 배열에 'kakao'/'naver' 포함된 것만 노출
  // — 응답 형식이 깨지거나 fetch 실패 시 default 유지(둘 다 노출)
  useEffect(() => {
    let alive = true
    authApi.socialConfig().then(
      (cfg) => {
        if (!alive) return
        if (!cfg || cfg.use === false) {
          setEnabledProviders([])
          return
        }
        if (!Array.isArray(cfg.providers)) return
        const next: SocialProvider[] = []
        if (cfg.providers.includes('kakao')) next.push('kakao')
        if (cfg.providers.includes('naver')) next.push('naver')
        if (cfg.providers.includes('apple')) next.push('apple')
        setEnabledProviders(next)
      },
      () => {
        /* 설정 조회 실패 → default(둘 다) 유지 */
      },
    )
    return () => {
      alive = false
    }
  }, [])

  // ─────────────────────────────────────────────
  // 앱(RN/네이티브) ↔ 웹 브릿지
  //  — 웹→앱: window.AndroidBridge.postMessage / iOSBridge.postMessage
  //           payload = { type: 'sns_login', data: { provider } }
  //  — 앱→웹: window.dispatchEvent(new CustomEvent('native_sns_login_result',
  //                                                  { detail: { provider, token, success } }))
  //  네이티브 SDK 가 받은 access_token 을 백엔드 /user/auth/social/kakao/native 로 POST
  //  → sjm_user (기존회원) 또는 sjm_social_pending (신규) 쿠키 발급 후 SPA 라우팅.
  //
  //  ※ 프로토콜은 브리지스톤 앱과 동일 — 같은 RN/네이티브 코드를 재사용 가능.
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{
        provider?: string
        token?: string
        success?: boolean
        error?: string
      }>).detail
      if (!detail || !['kakao', 'naver', 'apple'].includes(detail.provider ?? '')) return
      // 네이티브 SDK 성공시엔 RN 이 webview 를 GET native_callback URL 로 이동시켜
      // 서버가 쿠키를 발급한다 → 이 listener 는 실패/취소 케이스만 처리.
      // (kakao 만 쓰던 시점의 POST /native API 호환을 위해 token 전달 분기는 보존.)
      const provName =
        detail.provider === 'naver' ? '네이버' :
        detail.provider === 'apple' ? '애플' : '카카오'
      if (!detail.success || !detail.token) {
        setSubmitting(false)
        if (detail.error) setError(`${provName} 로그인 실패: ${detail.error}`)
        return
      }
      // apple: identityToken을 POST /apple/native 로 전달 (extra: name/email은 RN이 detail에 함께 넣어주면 OK)
      if (detail.provider === 'apple') {
        try {
          const extra = detail as unknown as { name?: string; email?: string }
          const r = await authApi.socialAppleNative(detail.token, {
            name: extra.name,
            email: extra.email,
          })
          if (r.needs_signup) {
            navigate('/signup?social=apple', { replace: true })
          } else {
            await refresh()
            const target =
              redirect && redirect !== '/'
                ? redirect
                : r.member.role === 'counselor'
                  ? '/counselor/mypage'
                  : '/'
            navigate(target, { replace: true })
          }
        } catch (err) {
          setSubmitting(false)
          const m =
            err instanceof ApiError
              ? err.message
              : '애플 로그인 중 오류가 발생했습니다.'
          setError(m)
        }
        return
      }
      // (legacy) kakao 만 POST /native 사용 — naver 는 GET native_callback 으로 처리되므로 여긴 안 옴
      if (detail.provider !== 'kakao') {
        setSubmitting(false)
        return
      }
      try {
        const r = await authApi.socialKakaoNative(detail.token)
        if (r.needs_signup) {
          navigate('/signup?social=kakao', { replace: true })
        } else {
          await refresh()
          const target =
            redirect && redirect !== '/'
              ? redirect
              : r.member.role === 'counselor'
                ? '/counselor/mypage'
                : '/'
          navigate(target, { replace: true })
        }
      } catch (err) {
        setSubmitting(false)
        const m =
          err instanceof ApiError
            ? err.message
            : '카카오 로그인 중 오류가 발생했습니다.'
        setError(m)
      }
    }
    window.addEventListener('native_sns_login_result', handler as EventListener)
    return () =>
      window.removeEventListener('native_sns_login_result', handler as EventListener)
    // refresh / navigate / redirect 는 안정적 — 한 번만 등록
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(null)

    const id = username.trim()
    if (!id || !password) {
      setError('아이디와 비밀번호를 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const r = await authApi.login(id, password, keepLogin)
      // AuthContext 갱신 → 다른 페이지에서 즉시 로그인 상태 인식
      await refresh()

      // 출석체크 (2026-05-16) — 로그인 직후 자동 처리. 실패해도 로그인은 성공으로 본다.
      // 결과는 sessionStorage 로 다음 화면에 전달 → 토스트/모달 노출.
      try {
        const att = await attendanceApi.checkin()
        if (att.attended_now && att.total_added > 0) {
          sessionStorage.setItem('attendance.justChecked', JSON.stringify({
            consecutive_days: att.consecutive_days,
            base_coin: att.base_coin,
            bonus_coin: att.bonus_coin,
            coupon_amount: att.coupon_amount,
            total_added: att.total_added,
          }))
        }
      } catch { /* 출석 실패는 로그인 흐름 막지 않음 */ }

      // 명시적 redirect 가 있으면 그 경로 (예: ?redirect=/charge), 없으면 role 기반 분기
      const target = redirect && redirect !== '/' ? redirect : (r.member.role === 'counselor' ? '/counselor/mypage' : '/')
      navigate(target, { replace: true })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : '로그인 중 오류가 발생했습니다.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const goSocial = (provider: SocialProvider) => {
    // 앱(WebView) 안이면 네이티브 SDK 로 분기 — kauth/nid 가 webview 정책으로 막히는 문제 회피.
    if (isInNativeApp()) {
      setError(null)
      setSubmitting(true)
      callNativeSnsLogin(provider)
      return
    }
    window.location.href = authApi.socialStartUrl(provider, redirect)
  }

  return (
    <div className="mobile-frame flex flex-col">
      {/* 헤더 — Figma hd5 (60×390, padding 0/16, gap 12, blur 7) */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => navigate('/', { replace: true })}
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-7 h-7" />
        </button>
        <h1 className="text-[18px] font-semibold text-[#030712] leading-[120%]">
          로그인
        </h1>
      </header>

      {/* 본문 — Figma Frame 530 (x=16 y=80 w=358, gap 28) */}
      <main className="flex-1 px-4">
        <div className="pt-5 flex flex-col items-stretch gap-7">
          {/* 로고 — Figma logo_b (가운데 정렬, h ~46) */}
          <div className="flex justify-center">
            <img src="/img/logo_b.svg" alt="사주문" className="h-[46px] w-auto" />
          </div>

          {/* Frame 528: 폼 그룹 + 로그인 버튼 (gap 24) */}
          <form className="flex flex-col gap-6" onSubmit={onSubmit}>
            {/* Frame 527: 입력 2개 + 체크박스 (gap 16) */}
            <div className="flex flex-col gap-4">
              {/* Frame 526: 입력 2개 (gap 10) */}
              <div className="flex flex-col gap-2.5">
                <InputField
                  type="text"
                  value={username}
                  onChange={setUsername}
                  placeholder="아이디를 입력해주세요."
                  autoComplete="username"
                  disabled={submitting}
                  onClear={() => setUsername('')}
                />
                <InputField
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  placeholder="비밀번호를 입력해주세요."
                  autoComplete="current-password"
                  disabled={submitting}
                  onClear={() => setPassword('')}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="w-6 h-6 flex items-center justify-center transition hover:opacity-70"
                      aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보이기'}
                    >
                      <img src={showPw ? '/img/ic_input_eye.svg' : '/img/ic_input_eye_closed.svg'} alt="" className="w-6 h-6" />
                    </button>
                  }
                />
              </div>

              {/* 로그인 상태 유지 체크박스 (22x22 r=6, label 15/400 #364153) */}
              <label className="flex items-center gap-1 select-none cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={keepLogin}
                  onChange={(e) => setKeepLogin(e.target.checked)}
                />
                <span className="text-[15px] text-[#364153] ml-1">로그인 상태 유지</span>
              </label>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 로그인 버튼 — pill, h48, bg #8259F5 */}
            <button
              type="submit"
              disabled={submitting}
              className="h-12 w-full flex items-center justify-center gap-1 rounded-full bg-[#8259F5] hover:bg-brand-500 active:bg-brand-600 text-white text-[16px] font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* Frame 529: 회원가입 | 아이디/비번 찾기 (gap 16, divider Line) */}
          <div className="flex items-center justify-center gap-4 text-[15px] leading-[120%] text-[#4A5565]">
            <Link to="/signup" className="hover:text-gray-900 transition">
              회원가입
            </Link>
            <span className="w-px h-[14px] bg-[#D1D5DC]" />
            <Link to="/find" className="hover:text-gray-900 transition">
              아이디/비밀번호 찾기
            </Link>
          </div>
        </div>

        {/* Frame 533: SNS 영역 (gap 20) — 관리자에서 소셜 로그인을 끄면 통째로 숨김 */}
        {enabledProviders.length > 0 && (
          <div className="mt-12 flex flex-col gap-5">
            {/* Frame 531: 분리선 + "SNS 계정으로 로그인" + 분리선 (gap 10) */}
            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-px bg-[#E5E7EB]" />
              <span className="text-[15px] leading-[120%] text-[#99A1AF]">SNS 계정으로 로그인</span>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>
            {/* Frame 532: 카카오 + 네이버 (gap 10) */}
            <div className="flex flex-col gap-2.5">
              {enabledProviders.includes('kakao') && (
                <button
                  type="button"
                  onClick={() => goSocial('kakao')}
                  disabled={submitting}
                  className="h-12 w-full flex items-center justify-center gap-2 rounded-full bg-[#FEE500] hover:brightness-95 active:brightness-90 text-black/85 text-[15px] leading-[150%] font-semibold transition disabled:opacity-60"
                >
                  <img src="/img/icon-kakao.svg" alt="" className="w-[18px] h-[18px]" />
                  카카오 로그인
                </button>
              )}
              {enabledProviders.includes('naver') && (
                <button
                  type="button"
                  onClick={() => goSocial('naver')}
                  disabled={submitting}
                  className="h-12 w-full flex items-center justify-center gap-2 rounded-full bg-[#03A94D] hover:brightness-95 active:brightness-90 text-white text-[15px] leading-[150%] font-semibold transition disabled:opacity-60"
                >
                  <img src="/img/icon-naver.svg" alt="" className="w-[18px] h-[18px]" />
                  네이버 로그인
                </button>
              )}
              {enabledProviders.includes('apple') && (
                <button
                  type="button"
                  onClick={() => goSocial('apple')}
                  disabled={submitting}
                  className="h-12 w-full flex items-center justify-center gap-2 rounded-full bg-black hover:brightness-110 active:brightness-90 text-white text-[15px] leading-[150%] font-semibold transition disabled:opacity-60"
                >
                  <img src="/img/icon-apple.svg" alt="" className="w-[15px] h-[19px] -mt-0.5" />
                  Apple로 로그인
                </button>
              )}
            </div>
          </div>
        )}

        <div className="h-10" />
      </main>
    </div>
  )
}

/* ───────────────────────────────────────────────
 * 내부 서브 컴포넌트
 * ─────────────────────────────────────────────── */

interface InputFieldProps {
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  onClear?: () => void
  rightSlot?: React.ReactNode
}

/**
 * Figma input — w358 h40, bg #f9fafb, border #f3f4f6, fully pill,
 * pad 4/16/4/16, placeholder 15/400 #99a1af, value 15/400 #1e2939
 * 우측 영역: ic_del (값 있을 때) + rightSlot (선택)
 */
function InputField({
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  onClear,
  rightSlot,
}: InputFieldProps) {
  const showClear = !!value && !!onClear && !disabled
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className="w-full h-10 rounded-full bg-[#f9fafb] border border-[#f3f4f6] focus:border-brand-400 focus:bg-white pl-4 pr-16 text-[15px] text-[#1e2939] placeholder-[#99a1af] focus:outline-none transition disabled:opacity-50"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            className="w-5 h-5 rounded-full bg-[#4a5565] hover:bg-[#1e2939] transition flex items-center justify-center"
            aria-label="입력 지우기"
          >
            <ClearIcon />
          </button>
        )}
        {rightSlot}
      </div>
    </div>
  )
}

function ClearIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2 2L8 8M8 2L2 8"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ───────────────────────────────────────────────
 * 네이티브 앱(RN webview) 브릿지
 *  - 사주문은 react-native-webview 기반 — Web→RN 은 window.ReactNativeWebView.postMessage
 *  - RN→Web 은 webView.injectJavaScript 로 'native_sns_login_result' CustomEvent dispatch
 *  - 메시지 페이로드(JSON string):
 *      Web→RN: { type: 'SNS_LOGIN', provider: 'kakao' }
 *      RN→Web: window.dispatchEvent(new CustomEvent('native_sns_login_result',
 *                                    { detail: { provider, token, success, error } }))
 *
 *  ※ 브리지스톤 앱은 동일한 'native_sns_login_result' 이벤트명을 쓰므로
 *     RN/네이티브 측 로직만 그쪽 코드를 참고해 옮기면 됩니다.
 * ─────────────────────────────────────────────── */

interface NativeWindow {
  ReactNativeWebView?: { postMessage: (msg: string) => void }
}

function isInNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as NativeWindow).ReactNativeWebView
}

function callNativeSnsLogin(provider: 'kakao' | 'naver' | 'apple') {
  if (typeof window === 'undefined') return
  const w = window as unknown as NativeWindow
  if (!w.ReactNativeWebView) return
  w.ReactNativeWebView.postMessage(
    JSON.stringify({ type: 'SNS_LOGIN', provider }),
  )
}
