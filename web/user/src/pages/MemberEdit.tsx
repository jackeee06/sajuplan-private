import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import HtmlEditor, { type HtmlEditorHandle } from '../components/HtmlEditor'
import UploadedImage from '../components/UploadedImage'
import { ApiError, authApi, captchaApi, counselorMypageApi, settingsApi, smsApi, type MeProfile } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { openExternalUrl } from '../lib/native-bridge'
import { FILE_BASE } from '../lib/runtime-env'

// readOnly 필드(아이디/이름/상담사 닉네임) 옆에 노출하는 카카오 1:1 문의 안내.
// kakaoUrl 미설정 시 사주문 라이브 채널로 폴백 — Help 페이지와 동일 정책.
const KAKAO_FALLBACK = 'https://pf.kakao.com/_gLTVX'

function resolveImageUrl(u: string | null): string | null {
  if (!u) return null
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

/**
 * 회원 정보 수정 — Figma 07마이페이지(회원) > 회원 정보 수정 (137:9729)
 *
 * 백엔드 연동:
 *   GET    /user/auth/me/profile      → prefill
 *   PATCH  /user/auth/me/profile      → 정보 수정 (captcha 검증)
 *   POST   /user/auth/me/password     → 비밀번호 변경
 *   DELETE /user/auth/me              → 회원탈퇴
 *   POST   /user/sms/send + /verify   → 휴대폰 변경 시 인증
 *   GET    /user/captcha              → 자동등록방지 발급
 */

const INPUT_BASE =
  'w-full h-12 px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#9B7AF7]'
const INPUT_READONLY =
  'w-full h-12 px-4 rounded-full bg-[#F3F4F6] border border-[#F3F4F6] text-[14px] text-[#6A7282] focus:outline-none'

type Gender = 'M' | 'F'
type Calendar = 'SOLAR' | 'LUNAR'

export default function MemberEdit() {
  const navigate = useNavigate()
  const { isCounselor } = useAuth()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<MeProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 상담사 본인 소개 — 상담사 회원만 노출. post_counselor.intro 직접 수정.
  // 별도 저장 버튼 없이 "정보 수정" 클릭 시 함께 PATCH.
  const introEditorRef = useRef<HtmlEditorHandle>(null)
  const [intro, setIntro] = useState<string>('')
  const [introLoaded, setIntroLoaded] = useState(false)
  const [introError, setIntroError] = useState<string | null>(null)

  // 비밀번호
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showNewPwConfirm, setShowNewPwConfirm] = useState(false)

  // 폼 상태
  const [gender, setGender] = useState<Gender>('M')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneVerifying, setPhoneVerifying] = useState(false)
  const [phoneSent, setPhoneSent] = useState(false)
  const [calendar, setCalendar] = useState<Calendar>('SOLAR')
  const [birth, setBirth] = useState('')
  const [zipcode, setZipcode] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [source, setSource] = useState('')
  const [emailMarketing, setEmailMarketing] = useState(false)
  const [smsMarketing, setSmsMarketing] = useState(false)

  // 캡차
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaSvg, setCaptchaSvg] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')

  // 모달/토스트
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneSendBusy, setPhoneSendBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // 주소 검색 인라인 임베드
  const [postcodeOpen, setPostcodeOpen] = useState(false)
  const postcodeRef = useRef<HTMLDivElement | null>(null)

  // 프로필 사진
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [profileImageWebp, setProfileImageWebp] = useState<string | null>(null)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 카카오 1:1 문의 채널 URL (어드민 site.kakao_channel_url, 없으면 폴백)
  const [kakaoUrl, setKakaoUrl] = useState<string>('')
  useEffect(() => {
    let alive = true
    settingsApi
      .public()
      .then((s) => {
        if (alive) setKakaoUrl(s['site.kakao_channel_url'] ?? '')
      })
      .catch(() => {
        /* 무시 — 폴백 URL 사용 */
      })
    return () => {
      alive = false
    }
  }, [])
  const handleInquiry = () => {
    openExternalUrl(kakaoUrl || KAKAO_FALLBACK)
  }

  // 초기 prefill
  useEffect(() => {
    let alive = true
    Promise.all([authApi.meProfile(), captchaApi.issue()])
      .then(([p, c]) => {
        if (!alive) return
        setProfile(p)
        setNickname(p.nickname)
        setEmail(p.email ?? '')
        setPhone(p.phone ?? '')
        setGender((p.gender as Gender) || 'M')
        setBirth(p.birth_date ?? '')
        setCalendar((p.calendar_type as Calendar) || 'SOLAR')
        setZipcode(p.zip ?? '')
        setAddress(p.addr1 ?? '')
        setAddressDetail(p.addr2 ?? '')
        setSource(p.acquisition_source ?? '')
        setEmailMarketing(p.agree_email)
        setSmsMarketing(p.agree_sms)
        setProfileImage(resolveImageUrl(p.profile_image))
        setProfileImageWebp(resolveImageUrl(p.profile_image_webp))
        setCaptchaToken(c.token)
        setCaptchaSvg(c.svg)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login', { replace: true, state: { from: '/mypage/member/edit' } })
          return
        }
        setError(e instanceof Error ? e.message : '회원 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [navigate])

  // 상담사 본인 소개 prefill — 별도 fetch (상담사 회원만).
  useEffect(() => {
    if (!isCounselor) return
    let alive = true
    counselorMypageApi
      .getIntro()
      .then((r) => {
        if (!alive) return
        setIntro(r.intro ?? '')
        setIntroLoaded(true)
      })
      .catch(() => {
        // 본인 소개 fetch 실패는 치명적이지 않음 — 빈 본문으로 시작 가능.
        if (alive) setIntroLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [isCounselor])

  // 토스트 자동 종료
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // 비밀번호 변경 성공 메시지 자동 종료
  useEffect(() => {
    if (!pwSuccess) return
    const t = setTimeout(() => setPwSuccess(null), 3000)
    return () => clearTimeout(t)
  }, [pwSuccess])

  const onPickProfileFile = () => {
    fileInputRef.current?.click()
  }

  const onProfileFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setProfileError(null)
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('5MB 이하 이미지만 업로드 가능합니다.')
      return
    }
    setProfileBusy(true)
    try {
      const r = await authApi.uploadProfileImage(file)
      setProfileImage(resolveImageUrl(r.profile_image))
      setProfileImageWebp(resolveImageUrl(r.profile_image_webp))
      setToast('프로필 사진이 변경되었습니다.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
    } finally {
      setProfileBusy(false)
    }
  }

  const onDeleteProfileImage = async () => {
    setProfileError(null)
    setProfileBusy(true)
    try {
      await authApi.deleteProfileImage()
      setProfileImage(null)
      setProfileImageWebp(null)
      setToast('프로필 사진이 삭제되었습니다.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setProfileBusy(false)
    }
  }

  const refreshCaptcha = async () => {
    try {
      const c = await captchaApi.issue()
      setCaptchaToken(c.token)
      setCaptchaSvg(c.svg)
      setCaptchaInput('')
    } catch {
      // 무시 — 다음 시도에 다시 발급
    }
  }

  const sendPhoneCode = async () => {
    setPhoneError(null)
    if (!phone.trim()) {
      setPhoneError('휴대폰 번호를 입력해주세요.')
      return
    }
    setPhoneSendBusy(true)
    try {
      await smsApi.send(phone)
      setPhoneSent(true)
      setToast('인증번호를 발송했습니다.')
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : '인증번호 발송에 실패했습니다.')
    } finally {
      setPhoneSendBusy(false)
    }
  }

  const verifyPhoneCode = async () => {
    setPhoneError(null)
    if (!phoneCode.trim()) {
      setPhoneError('인증번호를 입력해주세요.')
      return
    }
    setPhoneVerifying(true)
    try {
      await smsApi.verify(phone, phoneCode)
      setPhoneVerified(true)
      setToast('휴대폰 인증이 완료되었습니다.')
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : '인증번호가 일치하지 않습니다.')
    } finally {
      setPhoneVerifying(false)
    }
  }

  const phoneChanged = !!profile && (phone || '') !== (profile.phone || '')

  const handlePwModify = async () => {
    setPwError(null)
    setPwSuccess(null)
    if (!currentPw) {
      setPwError('현재 비밀번호를 입력해주세요.')
      return
    }
    if (!newPw || newPw.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (newPw !== newPwConfirm) {
      setPwError('새 비밀번호가 일치하지 않습니다.')
      return
    }
    if (currentPw === newPw) {
      setPwError('새 비밀번호가 현재 비밀번호와 동일합니다.')
      return
    }
    setPwSubmitting(true)
    try {
      await authApi.changePassword(currentPw, newPw)
      setCurrentPw('')
      setNewPw('')
      setNewPwConfirm('')
      setPwSuccess('비밀번호가 변경되었습니다.')
    } catch (e) {
      setPwError(e instanceof Error ? e.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setPwSubmitting(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawOpen(false)
    try {
      await authApi.withdrawMe()
      navigate('/login')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '회원탈퇴에 실패했습니다.')
    }
  }

  const handleSubmit = async () => {
    if (!profile) return
    setSubmitError(null)
    setIntroError(null)
    if (phoneChanged && !phoneVerified) {
      setSubmitError('휴대폰 번호 변경 시 인증을 완료해주세요.')
      return
    }
    if (!captchaInput.trim()) {
      setSubmitError('자동등록방지 문자를 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const updated = await authApi.updateMeProfile({
        // 상담사는 닉네임을 카드 노출명으로 쓰므로 본인 변경 불가 — 백엔드도 동일하게 무시.
        nickname: isCounselor ? undefined : (nickname.trim() || undefined),
        email: email.trim() || null,
        ...(phoneChanged ? { phone, phone_code: phoneCode } : {}),
        gender,
        birth_date: birth.trim() || null,
        calendar_type: calendar,
        zip: zipcode || undefined,
        addr1: address || undefined,
        addr2: addressDetail || undefined,
        acquisition_source: source || undefined,
        agree_email: emailMarketing,
        agree_sms: smsMarketing,
        captcha_token: captchaToken,
        captcha_input: captchaInput,
      })
      setProfile(updated)
      setPhoneVerified(false)
      setPhoneSent(false)
      setPhoneCode('')

      // 상담사 회원이면 본인 소개도 같이 저장 — 본인 소개 저장 실패는 전체 실패로 취급하지 않음.
      if (isCounselor && introLoaded) {
        const html = (introEditorRef.current?.getHTML() ?? intro).trim()
        const isEmpty = !html || html === '<p><br></p>'
        if (!isEmpty) {
          try {
            const r = await counselorMypageApi.setIntro(html)
            setIntro(r.intro)
          } catch (e) {
            setIntroError(e instanceof Error ? e.message : '본인 소개 저장에 실패했습니다.')
          }
        }
      }

      await refreshCaptcha()
      setToast('회원 정보 수정이 완료되었습니다.')
    } catch (e) {
      if (e instanceof ApiError) {
        setSubmitError(e.message)
        if (/자동등록방지/.test(e.message)) {
          await refreshCaptcha()
        }
      } else {
        setSubmitError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 카카오 우편번호 — 인라인 embed (앱 웹뷰 호환을 위해 팝업 대신 같은 페이지에 펼침)
  const togglePostcode = () => {
    if (postcodeOpen) {
      setPostcodeOpen(false)
      return
    }
    setPostcodeOpen(true)
    // 다음 렌더 사이클에 ref 가 마운트된 후 embed
    setTimeout(() => embedPostcode(), 0)
  }

  const embedPostcode = () => {
    type PostcodeData = {
      zonecode?: string
      address?: string
      roadAddress?: string
      jibunAddress?: string
    }
    type PostcodeOpts = {
      oncomplete: (data: PostcodeData) => void
      width?: string | number
      height?: string | number
    }
    type PostcodeInstance = { embed: (el: HTMLElement) => void }
    const w = window as unknown as {
      daum?: { Postcode: new (opts: PostcodeOpts) => PostcodeInstance }
    }
    if (!postcodeRef.current) return
    if (!w.daum?.Postcode) {
      // 스크립트 동적 로드 후 다시 시도
      const s = document.createElement('script')
      s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      s.onload = () => embedPostcode()
      document.head.appendChild(s)
      return
    }
    // 매번 새로 embed (이전 자식 정리)
    postcodeRef.current.innerHTML = ''
    new w.daum.Postcode({
      oncomplete: (data) => {
        setZipcode(data.zonecode ?? '')
        setAddress(data.roadAddress || data.jibunAddress || data.address || '')
        setPostcodeOpen(false)
      },
      width: '100%',
      height: '100%',
    }).embed(postcodeRef.current)
  }

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-[14px] text-[#99A1AF]">불러오는 중…</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="mobile-frame flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
        <p className="text-[15px] text-[#4A5565]">{error ?? '회원 정보를 불러올 수 없습니다.'}</p>
        <button
          type="button"
          onClick={() => navigate('/mypage')}
          className="h-10 px-5 rounded-full border border-[#E5E7EB] text-[14px] text-[#364153]"
        >
          마이페이지로
        </button>
      </div>
    )
  }

  return (
    <div className="mobile-frame flex flex-col pb-[40px] relative">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          회원 정보 수정
        </h1>
      </header>

      <main className="flex-1 px-4 pt-2 flex flex-col gap-5">
        {/* 프로필 사진 */}
        <section className="flex flex-col items-center gap-3 pt-2">
          <div className="relative">
            <div className="w-[100px] h-[100px] rounded-full bg-[#F3F4F6] overflow-hidden flex items-center justify-center">
              {profileImage ? (
                <UploadedImage
                  src={profileImage}
                  srcWebp={profileImageWebp}
                  alt="프로필 사진"
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" aria-hidden>
                  <circle cx="24" cy="18" r="8" stroke="#99A1AF" strokeWidth="2" />
                  <path d="M8 40c2.5-7 9-11 16-11s13.5 4 16 11" stroke="#99A1AF" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <button
              type="button"
              onClick={onPickProfileFile}
              disabled={profileBusy}
              aria-label="프로필 사진 변경"
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#9B7AF7] border-2 border-white flex items-center justify-center disabled:opacity-60"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden>
                <path d="M3.5 6.5h2.2l1-1.5h6.6l1 1.5h2.2c.6 0 1 .4 1 1V15c0 .6-.4 1-1 1H3.5c-.6 0-1-.4-1-1V7.5c0-.6.4-1 1-1z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
                <circle cx="10" cy="11" r="3" stroke="white" strokeWidth="1.4" />
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={onProfileFileChange}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPickProfileFile}
              disabled={profileBusy}
              className="text-[14px] font-medium text-[#8259F5] disabled:opacity-60"
            >
              {profileBusy ? '처리 중…' : profileImage ? '사진 변경' : '사진 등록'}
            </button>
            {profileImage && (
              <>
                <span className="text-[#E5E7EB]" aria-hidden>|</span>
                <button
                  type="button"
                  onClick={onDeleteProfileImage}
                  disabled={profileBusy}
                  className="text-[14px] font-medium text-[#FB2C36] disabled:opacity-60"
                >
                  사진 삭제
                </button>
              </>
            )}
          </div>
          {profileError && (
            <p className="text-[13px] text-[#FB2C36] text-center">{profileError}</p>
          )}
          <p className="text-[12px] text-[#99A1AF]">
            JPG · PNG · GIF · WEBP, 5MB 이하
          </p>
        </section>

        <Field label="아이디">
          <input
            type="text"
            value={profile.mb_id ?? '소셜 가입 (아이디 없음)'}
            readOnly
            className={INPUT_READONLY}
          />
          <p className="mt-1 text-[12px] text-[#6A7282]">
            변경이 필요하시면{' '}
            <button type="button" onClick={handleInquiry} className="underline text-[#8259F5]">
              카카오톡 1:1 문의
            </button>
            로 요청해주세요.
          </p>
        </Field>

        {profile.mb_id && (
          <>
            <Field label="현재 비밀번호">
              <PasswordInput
                value={currentPw}
                onChange={(v) => {
                  setCurrentPw(v)
                  if (pwError) setPwError(null)
                }}
                placeholder="현재 비밀번호를 입력해주세요."
                visible={showCurrentPw}
                onToggle={() => setShowCurrentPw((v) => !v)}
              />
            </Field>

            <Field label="새 비밀번호">
              <PasswordInput
                value={newPw}
                onChange={(v) => {
                  setNewPw(v)
                  if (pwError) setPwError(null)
                }}
                placeholder="새 비밀번호를 입력해주세요. (6자 이상)"
                visible={showNewPw}
                onToggle={() => setShowNewPw((v) => !v)}
              />
            </Field>

            <Field label="새 비밀번호 확인">
              <PasswordInput
                value={newPwConfirm}
                onChange={(v) => {
                  setNewPwConfirm(v)
                  if (pwError) setPwError(null)
                }}
                placeholder="새 비밀번호를 한번 더 입력해주세요."
                visible={showNewPwConfirm}
                onToggle={() => setShowNewPwConfirm((v) => !v)}
              />
              {newPw && newPwConfirm && newPw !== newPwConfirm && (
                <p className="text-[13px] text-[#FB2C36] mt-1">비밀번호가 다릅니다.</p>
              )}
            </Field>

            {pwError && <p className="text-[13px] text-[#FB2C36]">{pwError}</p>}
            {pwSuccess && <p className="text-[13px] text-[#0EA47A]">{pwSuccess}</p>}

            <button
              type="button"
              onClick={handlePwModify}
              disabled={pwSubmitting}
              className="w-full h-12 rounded-full bg-white border border-[#9B7AF7] text-[15px] font-medium text-[#8259F5] disabled:opacity-60"
            >
              {pwSubmitting ? '수정 중…' : '비밀번호 수정'}
            </button>
          </>
        )}

        <Field label="이름">
          <input type="text" value={profile.name} readOnly className={INPUT_READONLY} />
          <p className="mt-1 text-[12px] text-[#6A7282]">
            변경이 필요하시면{' '}
            <button type="button" onClick={handleInquiry} className="underline text-[#8259F5]">
              카카오톡 1:1 문의
            </button>
            로 요청해주세요.
          </p>
        </Field>

        <Field label="성별">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { v: 'M' as Gender, label: '남자' },
                { v: 'F' as Gender, label: '여자' },
              ]
            ).map((g) => {
              const on = gender === g.v
              return (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => setGender(g.v)}
                  className={`h-12 rounded-full text-[15px] font-medium border ${
                    on
                      ? 'bg-[#9B7AF7] text-white border-transparent'
                      : 'bg-white text-[#9B7AF7] border-[#9B7AF7]'
                  }`}
                >
                  {g.label}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="닉네임">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={isCounselor ? INPUT_READONLY : INPUT_BASE}
            maxLength={40}
            readOnly={isCounselor}
          />
          {isCounselor && (
            <p className="mt-1 text-[12px] text-[#6A7282]">
              상담사 닉네임은 카드/리스트에 노출되는 표시명입니다. 변경이 필요하시면{' '}
              <button type="button" onClick={handleInquiry} className="underline text-[#8259F5]">
                카카오톡 1:1 문의
              </button>
              로 요청해주세요.
            </p>
          )}
        </Field>

        <Field label="이메일">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_BASE}
            placeholder="example@domain.com"
          />
        </Field>

        <Field label="휴대폰번호">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setPhoneVerified(false)
                  setPhoneSent(false)
                  setPhoneError(null)
                }}
                className={`${INPUT_BASE} flex-1`}
                placeholder="010-0000-0000"
                inputMode="tel"
              />
              <button
                type="button"
                onClick={sendPhoneCode}
                disabled={!phoneChanged || phoneSendBusy}
                className={`h-12 px-4 rounded-full border text-[14px] font-medium shrink-0 ${
                  phoneChanged && !phoneSendBusy
                    ? 'border-[#9B7AF7] bg-white text-[#8259F5]'
                    : 'border-[#E5E7EB] bg-white text-[#99A1AF] cursor-not-allowed'
                }`}
              >
                {phoneSendBusy ? '전송 중…' : phoneSent ? '재전송' : '인증번호 전송'}
              </button>
            </div>
            {!phoneChanged && (
              <p className="text-[12px] text-[#99A1AF] leading-[140%]">
                휴대폰 번호를 변경하시려면 새 번호를 입력해주세요.
              </p>
            )}
            {phoneChanged && phoneSent && !phoneVerified && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  className={`${INPUT_BASE} flex-1`}
                  placeholder="인증번호 6자리"
                  maxLength={6}
                  inputMode="numeric"
                />
                <button
                  type="button"
                  onClick={verifyPhoneCode}
                  disabled={phoneVerifying}
                  className="h-12 px-4 rounded-full bg-[#9B7AF7] text-white text-[14px] font-medium shrink-0 disabled:opacity-60"
                >
                  {phoneVerifying ? '확인 중…' : '확인'}
                </button>
              </div>
            )}
            {phoneError && (
              <p className="text-[13px] text-[#FB2C36] leading-[140%]">{phoneError}</p>
            )}
            {phoneVerified && (
              <p className="text-[13px] text-[#0EA47A]">✓ 휴대폰 인증이 완료되었습니다.</p>
            )}
          </div>
        </Field>

        <Field label="생년월일">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { v: 'SOLAR' as Calendar, label: '양력' },
                  { v: 'LUNAR' as Calendar, label: '음력' },
                ]
              ).map((c) => {
                const on = calendar === c.v
                return (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setCalendar(c.v)}
                    className={`h-12 rounded-full text-[15px] font-medium border ${
                      on
                        ? 'bg-[#9B7AF7] text-white border-transparent'
                        : 'bg-white text-[#9B7AF7] border-[#9B7AF7]'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
            <input
              type="date"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className={INPUT_BASE}
            />
          </div>
        </Field>

        <Field label="주소">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={zipcode}
                readOnly
                className={`${INPUT_READONLY} flex-1`}
                placeholder="우편번호"
              />
              <button
                type="button"
                onClick={togglePostcode}
                className="h-12 px-4 rounded-full border border-[#9B7AF7] bg-white text-[14px] font-medium text-[#8259F5] shrink-0"
              >
                {postcodeOpen ? '닫기' : '주소검색'}
              </button>
            </div>
            {/* 인라인 주소 검색 패널 — 앱 웹뷰 호환 (팝업 대신 같은 페이지에 노출) */}
            {postcodeOpen && (
              <div className="rounded-[14px] border border-[#E5E7EB] overflow-hidden bg-white">
                <div ref={postcodeRef} style={{ width: '100%', height: 380 }} />
              </div>
            )}
            <input type="text" value={address} readOnly className={INPUT_READONLY} placeholder="기본 주소" />
            <input
              type="text"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              className={INPUT_BASE}
              placeholder="상세주소"
            />
          </div>
        </Field>

        <Field label="유입경로">
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={INPUT_BASE}
            placeholder="예: 지인 추천, 네이버 검색, 인스타그램"
          />
        </Field>

        {/* 상담사 본인 소개 — "정보 수정" 버튼에 통합되어 함께 저장됨. */}
        {isCounselor && (
          <section className="flex flex-col gap-2">
            <label className="text-[16px] leading-[130%] font-semibold text-[#1E2939]">
              본인 소개
            </label>
            <p className="text-[12px] leading-[140%] text-[#99A1AF]">
              상담사 상세 페이지 "소개" 탭에 노출되는 본문입니다. 이미지·서식 포함 가능.
            </p>
            {introLoaded ? (
              <div className="rounded-[12px] overflow-hidden border border-[#F3F4F6]">
                <HtmlEditor ref={introEditorRef} initialHtml={intro} height="360px" />
              </div>
            ) : (
              <div className="h-[120px] rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-center text-[13px] text-[#99A1AF]">
                불러오는 중…
              </div>
            )}
            {introError && (
              <p className="text-[13px] text-[#FB2C36]">{introError}</p>
            )}
          </section>
        )}

        <Field label="자동등록방지" required>
          <div className="flex items-center gap-2">
            <div
              className="h-12 flex-1 rounded-[14px] bg-[#F3F4F6] flex items-center justify-center overflow-hidden"
              dangerouslySetInnerHTML={{ __html: captchaSvg }}
            />
            <button
              type="button"
              onClick={refreshCaptcha}
              aria-label="자동등록방지 새로고침"
              className="w-12 h-12 rounded-full border border-[#E5E7EB] bg-white flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
                <path
                  d="M3 12C3 7 7 3 12 3C15 3 17.5 4.5 19 7M21 4V8H17M21 12C21 17 17 21 12 21C9 21 6.5 19.5 5 17M3 20V16H7"
                  stroke="#4A5565"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <input
            type="text"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            className={`${INPUT_BASE} mt-2`}
            placeholder="자동등록방지 문자 입력"
          />
        </Field>

        <div className="flex flex-col gap-2 mt-1">
          <CheckRow checked={emailMarketing} onChange={setEmailMarketing} label="이메일 수신 동의" />
          <CheckRow checked={smsMarketing} onChange={setSmsMarketing} label="문자 수신 동의" />
        </div>

        {submitError && <p className="text-[13px] text-[#FB2C36]">{submitError}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-3 w-full h-12 rounded-full bg-[#9B7AF7] text-[16px] font-medium text-white disabled:opacity-60"
        >
          {submitting ? '저장 중…' : '정보 수정'}
        </button>

        <button
          type="button"
          onClick={() => setWithdrawOpen(true)}
          className="mx-auto text-[14px] font-medium text-[#FB2C36] underline underline-offset-2"
        >
          회원탈퇴
        </button>
      </main>

      {toast && (
        <div className="fixed top-[80px] left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-[12px] bg-[#1F2937] text-white text-[14px] leading-[140%] shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          {toast}
        </div>
      )}

      <ConfirmModal
        open={withdrawOpen}
        message="회원탈퇴 하시겠습니까?"
        subMessage={'회원 정보가 모두 삭제되며,\n다시 복구할 수 없습니다.'}
        actionLabel="탈퇴"
        tone="danger"
        onCancel={() => setWithdrawOpen(false)}
        onConfirm={handleWithdraw}
      />
    </div>
  )
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  visible: boolean
  onToggle: () => void
}) {
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${INPUT_BASE} pr-12`}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center"
      >
        <img
          src={visible ? '/img/ic_input_eye.svg' : '/img/ic_input_eye_closed.svg'}
          alt=""
          className="w-6 h-6"
        />
      </button>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[16px] leading-[130%] font-semibold text-[#1E2939]">
        {label}
        {required && <span className="text-[#FB2C36] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-[22px] h-[22px]"
      />
      <span className="text-[14px] text-[#6A7282]">{label}</span>
    </label>
  )
}
