import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileHeader from '../components/MobileHeader'
import BottomNav from '../components/BottomNav'
import ShareBottomSheet from '../components/ShareBottomSheet'
import { useAuth } from '../lib/auth-context'
import { promoterApi } from '../lib/api'
import { API_BASE } from '../lib/runtime-env'

/**
 * 친구 초대 (회원 → 친구) — 라우트 `/mypage/invite`
 *
 * 카톡으로 "신규가입 만원 무료코인 쿠폰"을 친구에게 **선물**한다.
 *  - 친구가 가입하면 만원 코인 자동 지급(원래 누구나 받는 가입 보상).
 *  - 친구가 추천코드 입력 후 실제로 충전해서 쓰면, 그 유료 사용분의 3% 가 나에게 코인으로 적립.
 *    (친구 1명당 가입 후 3개월간 — 모집인 정책 재활용. 화면엔 작게 표기, 혜택을 전면에.)
 *  - 백엔드: 회원을 "코인형 모집인"으로 보장(ensureCoinPromoterForMember), 적립은 모집인 로직 재활용.
 *
 * UX 의도(2026-06-20 사장님 피드백):
 *  - "내가 받는 쿠폰"이 아니라 "친구에게 주는 선물" 느낌이 나게 상단 프레이밍.
 *  - 코드 입력 강조 안내를 카톡 버튼 "위"에 배치(보내기 전에 읽도록).
 * ⚠️ 인증 로딩 가드: loading 동안엔 판단 보류(메모장 콜드로드 /login 바운스 사고 재발 방지).
 */
export default function InviteFriends() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()

  const [code, setCode] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [friendCount, setFriendCount] = useState(0)
  const [totalCoins, setTotalCoins] = useState(0)
  const [timeline, setTimeline] = useState<
    { maskedName: string; usedAmount: number; rewardAmount: number; status: string; createdAt: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!member) navigate('/login?redirect=/mypage/invite', { replace: true })
  }, [authLoading, member, navigate])

  // 진입 즉시 코인형 모집인 보장 → 코드 발급(화면에 바로 표시) + 현황 조회
  useEffect(() => {
    if (authLoading || !member) return
    let alive = true
    ;(async () => {
      try {
        const en = await promoterApi.enableInvite()
        if (alive) {
          setCode(en.code)
          setShareUrl(en.shareUrl)
        }
      } catch {
        /* 코드 발급 실패 — 현황만 시도 */
      }
      try {
        const d = await promoterApi.inviteDashboard()
        if (alive) {
          if (d.code) setCode(d.code)
          if (d.shareUrl) setShareUrl(d.shareUrl)
          setFriendCount(d.friendCount)
          setTotalCoins(d.totalCoins)
          setTimeline(d.timeline ?? [])
        }
      } catch {
        /* ignore */
      }
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [authLoading, member])

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // 코드 박힌 정사각형 쿠폰 이미지(서버 즉석 합성) — 카톡 공유/OG 용. ?v 로 디자인 변경 시 카카오 캐시 회피.
  const couponImgUrl = code ? `${API_BASE}/promoter/coupon-image/${encodeURIComponent(code)}.png?v=2` : null

  if (authLoading || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[14px] text-[#6A7282]">
        불러오는 중...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-[90px]">
      <MobileHeader title="친구 초대" />

      <main className="px-4">
        {/* 내 쿠폰 미리보기 — 앱에선 가로로 긴 쿠폰(폰 화면에 자연스럽게). 코드 큼직하게. */}
        <section className="mt-2">
          <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#9b7af7] to-[#ec4899] text-white px-5 py-5 shadow-[0_10px_28px_rgba(155,122,247,0.28)]">
            <div className="flex items-center gap-2">
              <img src="/img/android-chrome-512x512.png" alt="" className="w-7 h-7 rounded-[8px]" />
              <span className="text-[15px] font-extrabold">사주플랜</span>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-medium">🎁 신규가입 선물</span>
            </div>
            <div className="mt-3 text-[26px] font-extrabold leading-tight">만원 무료코인 쿠폰</div>
            <div className="mt-1 text-[12px] text-white/90">지금 가입하면 10,000 코인 공짜!</div>
            <div className="mt-3.5 bg-white rounded-[12px] px-4 py-2.5 flex items-center justify-between">
              <span className="text-[12px] font-bold text-[#9b7af7]">추천코드</span>
              <span className="text-[28px] font-extrabold tracking-[0.12em] text-[#ec4899]">{code ?? '...'}</span>
            </div>
          </div>
          <p className="mt-2 text-center text-[12px] text-[#9CA3AF]">
            카톡으로 보내면 <b className="text-[#ec4899]">코드 {code ?? '...'}</b>가 박힌 쿠폰이 전달돼요.
          </p>
          <button
            type="button"
            onClick={copyCode}
            disabled={!code}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] bg-[#F9FAFB] border border-[#F3F4F6] text-[13px] font-medium text-[#4A5565] disabled:opacity-50"
          >
            {copied ? '✓ 코드 복사됐어요' : `코드 복사 (${code ?? '...'})`}
          </button>
        </section>

        {/* 내 보상 — 혜택을 전면에, 기간은 작게 */}
        <section className="mt-4 rounded-[16px] bg-[#fdf2f8] border border-[#fbcfe8] px-4 py-4">
          <p className="text-[14px] leading-[170%] text-[#9d174d]">
            친구가 코인을 <b>충전해서 쓸 때마다</b>, 그 금액의 <b className="text-[#ec4899]">3%</b>를{' '}
            <b>무료코인으로 계속</b> 받아가세요!
          </p>
          <p className="mt-1.5 text-[11px] text-[#c4708f]">ⓘ 친구 1명당 가입 후 3개월간 적립돼요 · 친구 수 제한 없음</p>
        </section>

        {/* 이렇게 안내해주세요 — 카톡 버튼 "위"에 배치(보내기 전에 읽도록) */}
        <section className="mt-3 rounded-[16px] border border-dashed border-[#fbcfe8] bg-white px-4 py-4">
          <h3 className="text-[14px] font-semibold text-[#030712]">친구에게 꼭 알려주세요 💡</h3>
          <ul className="mt-2.5 flex flex-col gap-2 text-[13px] leading-[160%] text-[#4A5565]">
            <li>
              ✅ <b>"가입할 때 추천코드 {code ?? 'XXXX'} 꼭 입력해줘"</b> 라고 알려주세요.
            </li>
            <li>
              📲 친구가 링크만 보고 <b>앱을 새로 설치</b>하면 코드가 자동으로 안 붙을 수 있어요. 코드를 꼭
              불러주세요.
            </li>
            <li>
              🔁 친구가 깜빡했다면 — <b>가입 후 7일 안에</b> 친구 마이페이지에서 코드를 입력하면 돼요.
            </li>
          </ul>
        </section>

        {/* 공유 버튼 */}
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          disabled={!shareUrl}
          className="mt-3 w-full h-[52px] rounded-[14px] bg-[#FEE500] text-[#3C1E1E] text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <span aria-hidden>💬</span>
          카카오톡으로 쿠폰 선물하기
        </button>

        {/* 내 초대 현황 */}
        <section className="mt-7">
          <h2 className="text-[15px] font-semibold text-[#030712]">내 초대 현황</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-[14px] border border-[#F3F4F6] bg-[#F9FAFB] px-4 py-4 text-center">
              <div className="text-[12px] text-[#6A7282]">초대한 친구</div>
              <div className="mt-1 text-[22px] font-bold text-[#8259F5]">
                {friendCount.toLocaleString()}
                <span className="text-[13px] font-medium text-[#6A7282] ml-0.5">명</span>
              </div>
            </div>
            <div className="rounded-[14px] border border-[#F3F4F6] bg-[#F9FAFB] px-4 py-4 text-center">
              <div className="text-[12px] text-[#6A7282]">받은 코인</div>
              <div className="mt-1 text-[22px] font-bold text-[#ec4899]">
                {totalCoins.toLocaleString()}
                <span className="text-[13px] font-medium text-[#6A7282] ml-0.5">코인</span>
              </div>
            </div>
          </div>

          {/* 적립 타임라인 */}
          <div className="mt-4">
            {loading ? (
              <div className="py-8 text-center text-[13px] text-[#6A7282]">불러오는 중...</div>
            ) : timeline.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#9CA3AF] leading-[170%]">
                아직 적립 내역이 없어요.
                <br />
                친구를 초대하고 첫 코인을 받아보세요!
              </div>
            ) : (
              <ul className="flex flex-col">
                {timeline.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] text-[#030712]">
                        {t.maskedName} 님 {t.usedAmount.toLocaleString()}코인 사용
                      </div>
                      <div className="text-[12px] text-[#9CA3AF] mt-0.5">
                        {(t.createdAt ?? '').slice(0, 10).replace(/-/g, '.')}
                        {t.status === 'voided' && ' · 환불됨'}
                      </div>
                    </div>
                    <div className="text-[14px] font-semibold text-[#ec4899] shrink-0 ml-2">
                      +{t.rewardAmount.toLocaleString()}코인
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <ShareBottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={shareUrl ?? 'https://sajuplan.com'}
        title={code ? `🎁 추천코드 ${code} · 만원 무료코인 쿠폰` : '🎁 사주플랜 만원 무료코인 쿠폰 선물'}
        description={code ? `가입할 때 추천코드 【${code}】 꼭 입력해야 적용! 지금 가입하면 만원 공짜 🎁` : '지금 가입하면 만원이 공짜!'}
        imageUrl={couponImgUrl ?? '/img/coupon-invite-v3.png'}
      />

      <BottomNav />
    </div>
  )
}
