import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'
import { api } from '../lib/api'
import BottomNav from '../components/BottomNav'

interface ReferralItem {
  id: number
  referee_mb_id: string | null
  referee_nickname: string | null
  registered_at: string
  expires_at: string
  months_snapshot: number
  rate_snapshot: number
  status: 'active' | 'expired' | 'suspended'
  total_paid: number
}

interface ReferredByItem {
  id: number
  referrer_mb_id: string | null
  referrer_nickname: string | null
  registered_at: string
  expires_at: string
  months_snapshot: number
  rate_snapshot: number
  status: string
  total_deducted: number
}

interface ReferralData {
  referral_code: string | null
  referrals: ReferralItem[]
  total_paid_all: number
  referred_by: ReferredByItem[]
}

function statusLabel(s: string): string {
  if (s === 'active')    return '진행 중'
  if (s === 'expired')   return '만료'
  if (s === 'suspended') return '정지'
  return s
}

function statusColor(s: string): string {
  if (s === 'active')  return 'text-emerald-600 bg-emerald-50'
  if (s === 'expired') return 'text-gray-400 bg-gray-100'
  return 'text-rose-500 bg-rose-50'
}

export default function CounselorMyReferral() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get<ReferralData>('/user/settlements/referral')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const copy = async () => {
    if (!data?.referral_code) return
    await navigator.clipboard.writeText(data.referral_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareKakao = () => {
    if (!data?.referral_code) return
    const Kakao = (window as unknown as Record<string, unknown>).Kakao as {
      isInitialized: () => boolean
      Share: { sendDefault: (o: unknown) => void }
    } | undefined
    if (!Kakao?.isInitialized()) {
      alert('카카오 SDK 로딩 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }
    Kakao.Share.sendDefault({
      objectType: 'text',
      text: `사주플랜 상담사로 활동해보세요!\n추천 코드 [${data.referral_code}]로 신청하시면 수익금의 일부를 함께 나눌 수 있습니다.\n\n📱 앱스토어 / 구글플레이에서 '사주플랜' 검색 → 설치 → 상담사 신청 시 추천 코드 입력`,
      link: { mobileWebUrl: 'https://sajuplan.com', webUrl: 'https://sajuplan.com' },
    })
  }

  const ratePct = data?.referrals[0]?.rate_snapshot
    ? Math.round(data.referrals[0].rate_snapshot * 100)
    : null

  return (
    <div className="mobile-frame flex flex-col pb-24">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <Link to="/counselor/mypage" className="w-[30px] h-[30px] flex items-center justify-center">
          <img src="/img/ic_hd_back.svg" alt="뒤로" className="w-7 h-7" />
        </Link>
        <h1 className="flex-1 text-[18px] font-semibold text-[#030712]">추천 현황</h1>
      </header>

      <div className="px-4 py-5 space-y-5">
        {/* 내 추천 코드 카드 */}
        <div className="rounded-2xl border border-[#F3F4F6] bg-white p-5">
          <p className="text-[13px] text-[#6A7282] mb-2">내 추천 코드</p>
          {loading ? (
            <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ) : data?.referral_code ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-[26px] font-bold tracking-widest text-[#1E2939]">
                  {data.referral_code}
                </span>
                <button onClick={copy} className="w-9 h-9 rounded-full bg-[#f3f0ff] flex items-center justify-center">
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-[#8259F5]" />}
                </button>
              </div>
              <p className="text-[12px] text-[#99A1AF] mt-1">
                신청서에 내 아이디를 입력하면 수익금의 {ratePct ?? 1}%를 나눠 받을 수 있습니다.
              </p>
              <button
                onClick={shareKakao}
                className="mt-3 w-full h-11 rounded-xl bg-[#FEE500] text-[#3A1D1D] text-[14px] font-semibold flex items-center justify-center gap-2"
              >
                <img src="/img/kakao_logo.png" alt="카카오" className="w-5 h-5" onError={(e) => (e.currentTarget.style.display = 'none')} />
                카카오로 공유하기
              </button>
            </>
          ) : (
            <p className="text-[14px] text-gray-400">추천 코드가 아직 발급되지 않았습니다.</p>
          )}
        </div>

        {/* 누적 수당 요약 */}
        {data && (
          <div className="rounded-2xl border border-[#F3F4F6] bg-[#fdf2f8] px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-[12px] text-[#ec4899]">누적 추천 수당</p>
              <p className="text-[22px] font-bold text-[#1E2939] tabular-nums">
                {data.total_paid_all.toLocaleString()}<span className="text-[14px] font-normal text-[#6A7282] ml-1">원</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-[#6A7282]">추천한 상담사</p>
              <p className="text-[18px] font-bold text-[#1E2939]">{data.referrals.length}명</p>
            </div>
          </div>
        )}

        {/* 추천 목록 */}
        <div>
          <p className="text-[13px] font-semibold text-[#1E2939] mb-3">추천한 상담사</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : data?.referrals.length === 0 ? (
            <div className="text-center py-10 text-[14px] text-gray-400">
              아직 추천한 상담사가 없습니다.<br />
              코드를 공유해서 함께 혜택을 받아보세요!
            </div>
          ) : (
            <div className="space-y-2">
              {data?.referrals.map((r) => (
                <div key={r.id} className="rounded-xl border border-[#F3F4F6] bg-white px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-medium text-[#1E2939]">
                      {r.referee_nickname ?? r.referee_mb_id ?? '(알 수 없음)'}
                    </p>
                    <p className="text-[11px] text-[#99A1AF] mt-0.5">
                      승인 {r.registered_at.slice(0, 10)} · 만료 {r.expires_at.slice(0, 10)}
                      {' · '}{Math.round(r.rate_snapshot * 100)}% · {r.months_snapshot}개월
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                    <p className="text-[13px] font-semibold text-[#8259F5] tabular-nums">
                      +{r.total_paid.toLocaleString()}원
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 나를 추천한 상담사 */}
        {!loading && data && data.referred_by.length > 0 && (
          <div>
            <p className="text-[13px] font-semibold text-[#1E2939] mb-3">나를 추천한 상담사</p>
            <div className="space-y-2">
              {data.referred_by.map((r) => {
                const now = new Date()
                const start = new Date(r.registered_at)
                const end = new Date(r.expires_at)
                const totalMonths = r.months_snapshot
                const elapsed = Math.min(
                  totalMonths,
                  Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30))
                )
                const pct = Math.round(r.rate_snapshot * 100)
                return (
                  <div key={r.id} className="rounded-xl border border-[#F3F4F6] bg-[#fafafa] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-medium text-[#1E2939]">
                          {r.referrer_nickname ?? r.referrer_mb_id ?? '(알 수 없음)'}
                        </p>
                        <p className="text-[11px] text-[#99A1AF] mt-0.5">
                          {elapsed}개월/{totalMonths}개월 진행 중 · 수익금의 {pct}% 차감
                        </p>
                        <p className="text-[11px] text-[#99A1AF]">
                          만료: {end.toISOString().slice(0, 10)}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                        {r.total_deducted > 0 && (
                          <p className="text-[12px] text-[#FB2C36] tabular-nums">
                            -{r.total_deducted.toLocaleString()}원 차감됨
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
