import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ShareBottomSheet from '../components/ShareBottomSheet'
import { appVersionApi } from '../lib/api'

/**
 * 공개 쿠폰 이벤트 페이지 — 라우트 `/event`
 *
 * 직원·가족·지인이 "그냥 좀 뿌려줘" 호의로 공유할 때 쓰는 로그인·앱 불필요 공개 페이지.
 *  - 보상/추적 없음(코드 없음) — 친구는 가입 시 만원 자동 지급(원래 누구나 받는 보상).
 *  - 누구나 열어서 [카카오톡으로 공유] 하면 쿠폰 카드가 나간다. 링크 복붙도 OK.
 *  - WebAppGate 예외(앱 없는 사람이 보는 화면).
 *
 * ※ 보상받는 모집인은 /s/{code}(추적·적립) 또는 회원 마이페이지 친구초대를 쓴다.
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

export default function SignupCouponEvent() {
  const navigate = useNavigate()
  const [aos, setAos] = useState(FALLBACK_AOS)
  const [ios, setIos] = useState(FALLBACK_IOS)
  const [shareOpen, setShareOpen] = useState(false)

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
      <main className="flex-1 flex flex-col items-center px-7 pt-12 pb-10 text-center">
        {/* 쿠폰 카드 */}
        <div className="w-full rounded-[20px] overflow-hidden bg-gradient-to-br from-[#9b7af7] to-[#ec4899] text-white px-6 py-9 shadow-[0_10px_28px_rgba(155,122,247,0.28)]">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-[12px] font-medium">
            🎁 신규가입 선물
          </div>
          <div className="mt-4 text-[34px] font-extrabold leading-[115%]">
            만원 무료코인 쿠폰
          </div>
          <p className="mt-3 text-[14px] leading-[165%] text-white/90">
            사주플랜에 지금 가입하면
            <br />
            <b>10,000 코인</b>을 무료로 드려요
          </p>
        </div>

        <p className="mt-6 text-[14px] leading-[165%] text-[#6A7282]">
          전화·채팅으로 만나는 믿을 수 있는
          <br />
          사주·타로·신점 상담 🐈
        </p>

        {/* 액션 */}
        <div className="mt-8 w-full flex flex-col gap-3">
          <a href={storeUrl} className="block">
            <button
              type="button"
              className="w-full h-[52px] rounded-[14px] bg-[#9b7af7] text-white text-[15px] font-semibold"
            >
              앱 설치하고 가입하기
            </button>
          </a>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="w-full h-[52px] rounded-[14px] bg-[#FEE500] text-[#3C1E1E] text-[15px] font-bold flex items-center justify-center gap-2"
          >
            <span aria-hidden>💬</span>
            카카오톡으로 쿠폰 공유하기
          </button>
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="w-full h-12 rounded-[14px] border border-[#9b7af7] text-[#9b7af7] text-[15px] font-semibold"
          >
            가입하러 가기
          </button>
        </div>

        <p className="mt-6 text-[12px] leading-[160%] text-[#9CA3AF]">
          가입만 하면 누구나 만원 무료코인을 받아요.
        </p>
      </main>

      <ShareBottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl="https://sajuplan.com/event"
        title="🎁 사주플랜 만원 무료코인 쿠폰"
        description="지금 가입하면 만원이 공짜!"
        imageUrl="/img/coupon-invite-v3.png"
      />
    </div>
  )
}
