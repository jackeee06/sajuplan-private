import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { chargeApi, type ChargePackageDto } from '../lib/api'

// webview에서 hard navigation으로 진입한 경우 location.state가 비어 있어 sessionStorage 폴백
function getInitialPackageId(stateValue?: number | null): number | null {
  if (typeof stateValue === 'number') return stateValue
  try {
    const v = sessionStorage.getItem('chargeCardRegisterPackageId')
    return v ? Number(v) : null
  } catch {
    return null
  }
}

/**
 * 사주플랜페이(자동결제) 카드 등록 페이지.
 * sample/coin/coin_fill_auto_card.php 동등.
 *
 * 입력 5필드: 카드번호 / 만료(MM/YY) / 생년월일(YYMMDD) / 카드 비번(앞 2자리) / 자동결제 패키지.
 * 서버에서 AES-128-CBC 암호화 후 AG9 PATCH gnrc_autopay_regist 호출.
 */
export default function ChargeCardRegister() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialPackageId = getInitialPackageId(
    (location.state as { packageId?: number } | null)?.packageId ?? null,
  )

  const [packages, setPackages] = useState<ChargePackageDto[]>([])
  const [packageId, setPackageId] = useState<number | null>(initialPackageId)
  const [cardno, setCardno] = useState('')
  const [expMonth, setExpMonth] = useState('')
  const [expYear, setExpYear] = useState('')
  const [socno, setSocno] = useState('')
  const [pass, setPass] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    chargeApi.packages().then((pkgs) => {
      setPackages(pkgs)
      if (!packageId && pkgs.length > 0) setPackageId(pkgs[Math.min(2, pkgs.length - 1)].id)
    })
  }, [packageId])

  const formatCardno = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 16)
    return d.replace(/(.{4})/g, '$1-').replace(/-$/, '')
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const cardnoDigits = cardno.replace(/\D/g, '')
    if (cardnoDigits.length !== 15 && cardnoDigits.length !== 16) {
      setError('카드번호 15~16자리를 정확히 입력해주세요.')
      return
    }
    if (!/^\d{2}$/.test(expMonth) || Number(expMonth) < 1 || Number(expMonth) > 12) {
      setError('만료월(01~12)을 입력해주세요.')
      return
    }
    if (!/^\d{2}$/.test(expYear)) {
      setError('만료년 2자리를 입력해주세요.')
      return
    }
    if (!/^\d{6}$/.test(socno)) {
      setError('생년월일 6자리(YYMMDD)를 입력해주세요.')
      return
    }
    if (!/^\d{2}$/.test(pass)) {
      setError('카드 비밀번호 앞 2자리를 입력해주세요.')
      return
    }
    if (!packageId) {
      setError('자동결제 시 사용할 패키지를 선택해주세요.')
      return
    }

    try {
      setSubmitting(true)
      await chargeApi.autopayRegister({
        cardno: cardnoDigits,
        expMonth,
        expYear,
        socno,
        pass,
        packageId,
      })
      try {
        sessionStorage.removeItem('chargeCardRegisterPackageId')
      } catch {}
      // webview 호환 hard navigation
      window.location.href = '/mypage/charge'
    } catch (e) {
      setError(`등록 실패: ${(e as Error).message}`)
      setSubmitting(false)
    }
  }

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
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
          사주플랜페이 카드 등록
        </h1>
      </header>

      <form onSubmit={onSubmit} className="flex-1 flex flex-col px-4 pt-4 gap-4" autoComplete="off">
        <Field label="카드번호">
          <input
            type="text"
            inputMode="numeric"
            placeholder="0000-0000-0000-0000"
            value={cardno}
            onChange={(e) => setCardno(formatCardno(e.target.value))}
            autoComplete="off"
            name="sjm-cardno"
            className="w-full h-12 px-4 rounded-[12px] border border-[#E5E7EB] focus:border-[#f472b6] outline-none text-[15px]"
          />
        </Field>

        <div className="flex gap-3">
          <Field label="만료월(MM)" className="flex-1">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="MM"
              value={expMonth}
              onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
              autoComplete="off"
              name="sjm-exp-month"
              className="w-full h-12 px-4 rounded-[12px] border border-[#E5E7EB] focus:border-[#f472b6] outline-none text-[15px]"
            />
          </Field>
          <Field label="만료년(YY)" className="flex-1">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="YY"
              value={expYear}
              onChange={(e) => setExpYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
              autoComplete="off"
              name="sjm-exp-year"
              className="w-full h-12 px-4 rounded-[12px] border border-[#E5E7EB] focus:border-[#f472b6] outline-none text-[15px]"
            />
          </Field>
        </div>

        <Field label="생년월일 6자리 (YYMMDD)">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="YYMMDD"
            value={socno}
            onChange={(e) => setSocno(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="off"
            name="sjm-socno"
            className="w-full h-12 px-4 rounded-[12px] border border-[#E5E7EB] focus:border-[#f472b6] outline-none text-[15px]"
          />
        </Field>

        <Field label="카드 비밀번호 앞 2자리">
          <input
            type="password"
            inputMode="numeric"
            maxLength={2}
            placeholder="**"
            value={pass}
            onChange={(e) => setPass(e.target.value.replace(/\D/g, '').slice(0, 2))}
            autoComplete="new-password"
            name="sjm-pass"
            className="w-full h-12 px-4 rounded-[12px] border border-[#E5E7EB] focus:border-[#f472b6] outline-none text-[15px]"
          />
        </Field>

        <Field label="자동결제 패키지">
          <select
            value={packageId ?? ''}
            onChange={(e) => setPackageId(Number(e.target.value) || null)}
            className="w-full h-12 px-4 rounded-[12px] border border-[#E5E7EB] focus:border-[#f472b6] outline-none text-[15px] bg-white"
          >
            <option value="">패키지 선택</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.totalPoint.toLocaleString()} 코인 / {p.payAmount.toLocaleString()}원
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-[13px] text-[#FF6467]">{error}</p>}

        <p className="text-[12px] text-[#99A1AF] leading-[150%]">
          입력하신 카드정보는 서버에서 AES-128-CBC 암호화 후 PG사로 전송되며, 서비스 DB에는 마스킹 카드번호와 빌링키만
          보존됩니다.
        </p>

        <div className="mt-auto pt-6">
          <button
            type="submit"
            disabled={submitting}
            className={`w-full h-[52px] rounded-[16px] text-[16px] font-semibold ${
              submitting ? 'bg-[#D1D5DB] text-white' : 'bg-[#f472b6] text-white'
            }`}
          >
            {submitting ? '등록 중...' : '카드 등록하기'}
          </button>
        </div>
      </form>
      <BottomNav />
      </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[13px] font-medium text-[#4A5565] mb-1.5">{label}</label>
      {children}
    </div>
  )
}
