import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PrimaryButton, { OutlineButton } from '../components/PrimaryButton'
import SupporterAppChrome from '../components/SupporterAppChrome'
import { appVersionApi, promoterApi } from '../lib/api'

/**
 * 모집인(서포터즈) QR/링크 랜딩 — 라우트 `/s/:code`
 *
 * QR/링크로 진입한 (앱이 없는) 피모집자가 보는 첫 화면.
 *  - 코드 유효성 확인(GET /promoter/by-code/:code)
 *  - 유효하면 localStorage 에 추천 코드를 심어두고(가입 시 자동 적용),
 *    앱 설치 또는 가입 페이지로 유도.
 *
 * 이 경로는 WebAppGate 를 적용하지 않는다(앱이 없는 사람이 보는 화면).
 */

const FALLBACK_AOS = 'https://play.google.com/store/apps/details?id=com.dmonster.sajumoon'
const FALLBACK_IOS = 'https://apps.apple.com/kr/app/id6761353255'

function detectOS(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

export default function RecruiterLanding() {
  const navigate = useNavigate()
  const { code = '' } = useParams<{ code: string }>()

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading')
  const [aos, setAos] = useState(FALLBACK_AOS)
  const [ios, setIos] = useState(FALLBACK_IOS)

  // 코드 유효성 확인 + 유효하면 추천 코드 저장
  useEffect(() => {
    let alive = true
    if (!code.trim()) {
      setStatus('invalid')
      return
    }
    promoterApi.byCode(code).then(
      (res) => {
        if (!alive) return
        if (res.exists && res.active) {
          try {
            localStorage.setItem('promoter_ref', code)
            localStorage.setItem('promoter_ref_entry', 'qr')
          } catch {
            /* ignore */
          }
          setStatus('valid')
        } else {
          setStatus('invalid')
        }
      },
      () => {
        if (!alive) return
        setStatus('invalid')
      },
    )
    return () => {
      alive = false
    }
  }, [code])

  // 스토어 링크 — WebAppGate 와 동일 출처(/api/app/version)
  useEffect(() => {
    appVersionApi
      .get()
      .then((v) => {
        if (v.aos_store_url) setAos(v.aos_store_url)
        if (v.ios_store_url) setIos(v.ios_store_url)
      })
      .catch(() => undefined)
  }, [])

  const os = detectOS()
  const storeUrl = os === 'ios' ? ios : aos

  return (
    <div className="mobile-frame flex flex-col min-h-screen bg-gradient-to-b from-[#f5f2ff] via-white to-white">
      <main className="flex-1 flex flex-col items-center px-7 pt-14 pb-10 text-center">
        <img
          src="/img/android-chrome-512x512.png"
          alt="사주플랜"
          className="w-[92px] h-[92px] rounded-[22px] shadow-[0_10px_28px_rgba(155,122,247,0.28)]"
        />
        <h1 className="text-[22px] font-bold text-[#030712] mt-5 leading-[140%]">
          사주플랜에 오신 걸<br />환영합니다 🐈
        </h1>
        <p className="text-[14px] leading-[160%] text-[#6A7282] mt-2.5">
          전화·채팅으로 만나는 믿을 수 있는
          <br />
          사주·타로·신점 상담
        </p>

        {status === 'loading' && (
          <div className="mt-10 text-[14px] text-[#6A7282]">코드를 확인하는 중...</div>
        )}

        {status === 'valid' && (
          <>
            <div className="mt-8 w-full rounded-[20px] bg-white border border-[#F3F4F6] shadow-[0_4px_18px_rgba(0,0,0,0.06)] px-5 py-6 flex flex-col items-center">
              <span className="text-[13px] font-medium text-[#6A7282]">추천 코드</span>
              <span className="mt-2 text-[28px] font-bold tracking-[0.05em] text-[#ec4899] break-all">
                {code}
              </span>
              <p className="mt-3 text-[13px] leading-[160%] text-[#6A7282]">
                앱 설치 후 가입할 때
                <br />
                이 코드를 입력하세요
              </p>
            </div>

            <div className="mt-8 w-full flex flex-col gap-3">
              <a href={storeUrl} className="block">
                <PrimaryButton type="button">앱 설치하기</PrimaryButton>
              </a>
              <OutlineButton
                type="button"
                className="w-full h-12 text-[15px]"
                onClick={() => navigate('/signup')}
              >
                가입하러 가기
              </OutlineButton>
            </div>
          </>
        )}

        {status === 'invalid' && (
          <>
            <div className="mt-8 w-full rounded-[20px] bg-white border border-[#F3F4F6] shadow-[0_4px_18px_rgba(0,0,0,0.06)] px-5 py-7 flex flex-col items-center">
              <span className="text-[15px] font-semibold text-[#030712]">
                유효하지 않은 코드예요
              </span>
              <p className="mt-2 text-[13px] leading-[160%] text-[#6A7282]">
                추천 코드 없이도 가입하실 수 있어요.
              </p>
            </div>

            <div className="mt-8 w-full flex flex-col gap-3">
              <a href={storeUrl} className="block">
                <PrimaryButton type="button">앱 설치하기</PrimaryButton>
              </a>
              <OutlineButton
                type="button"
                className="w-full h-12 text-[15px]"
                onClick={() => navigate('/signup')}
              >
                가입하러 가기
              </OutlineButton>
            </div>
          </>
        )}

        <div className="mt-10 w-full flex flex-col gap-3">
          <SupporterAppChrome />
        </div>
      </main>
    </div>
  )
}
