import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import { MOCK_MEMBER, type Calendar, type Gender } from '../data/memberProfile'

/**
 * 회원 정보 수정 — Figma 07마이페이지(회원) > 회원 정보 수정 (137:9729)
 *
 * 이 프로젝트에는 design.css 카탈로그(input-field/btn-primary 등) 클래스가
 * 적용돼 있지 않으므로 인라인 Tailwind 유틸로 동일 룩 표현.
 *
 * 변형 2종:
 *  1) 기본 — 모든 필드 + 비번 수정 영역
 *  2) 정보 수정 완료 토스트 (137:9729 변형, 상단 검정 토스트)
 *
 * 모달 흐름:
 *  - "비밀번호 수정" 버튼 → 비번 컨펌 → 비번 완료 (success 아이콘, 단일 버튼)
 *  - "회원탈퇴" 링크 → 회원탈퇴 (danger tone)
 *  - "정보 수정" 버튼 → 토스트 (모달 아님)
 */

const INPUT_BASE =
  'w-full h-12 px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#9B7AF7]'
const INPUT_READONLY =
  'w-full h-12 px-4 rounded-full bg-[#F3F4F6] border border-[#F3F4F6] text-[14px] text-[#6A7282] focus:outline-none'

export default function MemberEdit() {
  const navigate = useNavigate()

  const [pw, setPw] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  const [gender, setGender] = useState<Gender>(MOCK_MEMBER.gender)
  const [nickname, setNickname] = useState(MOCK_MEMBER.nickname)
  const [email, setEmail] = useState(MOCK_MEMBER.email)
  const [phone, setPhone] = useState(MOCK_MEMBER.phone)
  const [calendar, setCalendar] = useState<Calendar>(MOCK_MEMBER.calendar)
  const [birth, setBirth] = useState(MOCK_MEMBER.birth)
  const [zipcode] = useState(MOCK_MEMBER.zipcode)
  const [address] = useState(MOCK_MEMBER.address)
  const [addressDetail, setAddressDetail] = useState(MOCK_MEMBER.addressDetail)
  const [source, setSource] = useState(MOCK_MEMBER.source)
  const [captcha, setCaptcha] = useState('')
  const [emailMarketing, setEmailMarketing] = useState(MOCK_MEMBER.emailMarketing)
  const [smsMarketing, setSmsMarketing] = useState(MOCK_MEMBER.smsMarketing)

  const [pwConfirmOpen, setPwConfirmOpen] = useState(false)
  const [pwDoneOpen, setPwDoneOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const handlePwModify = () => {
    setPwConfirmOpen(false)
    setPwDoneOpen(true)
  }

  const handlePwDone = () => {
    setPwDoneOpen(false)
    setPw('')
    setPwConfirm('')
    navigate('/login')
  }

  const handleWithdraw = () => {
    setWithdrawOpen(false)
    navigate('/mypage')
  }

  const handleSubmit = () => {
    setToast(true)
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
        <Field label="아이디">
          <input type="text" value={MOCK_MEMBER.userId} readOnly className={INPUT_READONLY} />
        </Field>

        <Field label="비밀번호">
          <PasswordInput
            value={pw}
            onChange={setPw}
            placeholder="비밀번호를 입력해주세요."
            visible={showPw}
            onToggle={() => setShowPw((v) => !v)}
          />
        </Field>

        <Field label="비밀번호 확인">
          <PasswordInput
            value={pwConfirm}
            onChange={setPwConfirm}
            placeholder="비밀번호를 한번 더 입력해주세요."
            visible={showPwConfirm}
            onToggle={() => setShowPwConfirm((v) => !v)}
          />
        </Field>

        <button
          type="button"
          onClick={() => setPwConfirmOpen(true)}
          className="w-full h-12 rounded-full bg-white border border-[#9B7AF7] text-[15px] font-medium text-[#8259F5]"
        >
          비밀번호 수정
        </button>

        <Field label="이름">
          <input type="text" value={MOCK_MEMBER.name} readOnly className={INPUT_READONLY} />
        </Field>

        <Field label="성별">
          <div className="grid grid-cols-2 gap-2">
            {(['남자', '여자'] as Gender[]).map((g) => {
              const on = gender === g
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`h-12 rounded-full text-[15px] font-medium border ${
                    on
                      ? 'bg-[#9B7AF7] text-white border-transparent'
                      : 'bg-white text-[#9B7AF7] border-[#9B7AF7]'
                  }`}
                >
                  {g}
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
            className={INPUT_BASE}
          />
        </Field>

        <Field label="이메일">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_BASE}
          />
        </Field>

        <Field label="휴대폰번호">
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${INPUT_BASE} flex-1`}
            />
            <button
              type="button"
              className="h-12 px-4 rounded-full border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#4A5565] shrink-0"
            >
              인증번호 전송
            </button>
          </div>
        </Field>

        <Field label="생년월일">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {(['양력', '음력'] as Calendar[]).map((c) => {
                const on = calendar === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCalendar(c)}
                    className={`h-12 rounded-full text-[15px] font-medium border ${
                      on
                        ? 'bg-[#9B7AF7] text-white border-transparent'
                        : 'bg-white text-[#9B7AF7] border-[#9B7AF7]'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
            <div className="relative">
              <input
                type="text"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                className={`${INPUT_BASE} pr-12`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <img src="/img/ic_input_date.svg" alt="" className="w-6 h-6" />
              </span>
            </div>
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
              />
              <button
                type="button"
                className="h-12 px-4 rounded-full border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#4A5565] shrink-0"
              >
                주소검색
              </button>
            </div>
            <input type="text" value={address} readOnly className={INPUT_READONLY} />
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
          />
        </Field>

        <button
          type="button"
          className="h-12 rounded-full bg-[#FEE500] flex items-center justify-center gap-2 text-[15px] font-medium text-[#030712]"
        >
          <img src="/img/icon-kakao.svg" alt="" className="w-5 h-5" />
          카카오 로그인 연결
        </button>
        <button
          type="button"
          className="h-12 rounded-full bg-[#03C75A] flex items-center justify-center gap-2 text-[15px] font-medium text-white"
        >
          <img src="/img/icon-naver.svg" alt="" className="w-5 h-5" />
          네이버 로그인 연결
        </button>

        <Field label="자동등록방지" required>
          <div className="flex items-center gap-2">
            <div className="h-12 flex-1 rounded-[14px] bg-[#F3F4F6] flex items-center justify-center">
              <span
                className="text-[20px] font-bold tracking-[2px] text-[#9B7AF7] select-none"
                style={{ fontFamily: 'cursive', textDecoration: 'line-through' }}
              >
                3hY7g5
              </span>
            </div>
            <button
              type="button"
              aria-label="자동등록방지 새로고침"
              className="w-12 h-12 rounded-full border border-[#E5E7EB] bg-white flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
                <path d="M3 12C3 7 7 3 12 3C15 3 17.5 4.5 19 7M21 4V8H17M21 12C21 17 17 21 12 21C9 21 6.5 19.5 5 17M3 20V16H7" stroke="#4A5565" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            value={captcha}
            onChange={(e) => setCaptcha(e.target.value)}
            className={`${INPUT_BASE} mt-2`}
            placeholder="자동등록방지 문자 입력"
          />
        </Field>

        <div className="flex flex-col gap-2 mt-1">
          <CheckRow checked={emailMarketing} onChange={setEmailMarketing} label="이메일 수신 동의" />
          <CheckRow checked={smsMarketing} onChange={setSmsMarketing} label="문자 수신 동의" />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="mt-3 w-full h-12 rounded-full bg-[#9B7AF7] text-[16px] font-medium text-white"
        >
          정보 수정
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
          회원 정보 수정이 완료되었습니다.
        </div>
      )}

      <ConfirmModal
        open={pwConfirmOpen}
        message="비밀번호를 수정하시겠습니까?"
        actionLabel="수정"
        onCancel={() => setPwConfirmOpen(false)}
        onConfirm={handlePwModify}
      />
      <ConfirmModal
        open={pwDoneOpen}
        message="비밀번호 수정이 완료되었습니다."
        subMessage="변경하신 비밀번호로 다시 로그인해주세요."
        actionLabel="확인"
        iconVariant="success"
        singleButton
        onCancel={handlePwDone}
        onConfirm={handlePwDone}
      />
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
