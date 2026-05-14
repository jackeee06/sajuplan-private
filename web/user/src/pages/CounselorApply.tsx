import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { counselorApplyApi, settingsApi, type CounselorApplyListItem } from '../lib/api'

const PAGE_SIZE = 10

const STATUS_LABEL: Record<string, string> = {
  pending: '검토중',
  accepted: '승인',
  rejected: '반려',
  cancelled: '취소',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'border-[#9B7AF7] text-[#8259F5]',
  accepted: 'border-[#16A34A] text-[#16A34A]',
  rejected: 'border-[#FB2C36] text-[#FB2C36]',
  cancelled: 'border-[#9CA3AF] text-[#6A7282]',
}

function formatDate(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/**
 * 상담사 신청 메인 — Figma 120:6769 (06마이페이지_추가메뉴_상담사 신청)
 * GET /api/user/counselor-apply 로 본인 신청 + 공지 동시 조회.
 */
export default function CounselorApply() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<CounselorApplyListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kakaoChannelUrl, setKakaoChannelUrl] = useState<string>('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    counselorApplyApi
      .list(page, PAGE_SIZE)
      .then((r) => {
        if (!mounted) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [page])

  // 카카오 채널 URL — settings 의 site.kakao_channel_url. 1회 로드.
  useEffect(() => {
    let mounted = true
    settingsApi.public()
      .then((s) => {
        if (!mounted) return
        const url = s['site.kakao_channel_url'] || s['kakao_channel_url'] || ''
        if (url) setKakaoChannelUrl(url)
      })
      .catch(() => {
        /* 로드 실패해도 1:1 문의 버튼은 비활성 안 시킴 — 클릭 시 안내 */
      })
    return () => { mounted = false }
  }, [])

  const handleKakaoInquiry = () => {
    if (kakaoChannelUrl) {
      // 외부 새 창/탭으로 카카오 채널 1:1 문의 열기
      window.open(kakaoChannelUrl, '_blank', 'noopener,noreferrer')
    } else {
      alert('카카오 채널이 설정되지 않았습니다. 운영자에게 문의해주세요.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
          상담사 신청
        </h1>
        <div className="flex items-center gap-3">
          <Link to="/search" aria-label="검색" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_search.svg" alt="" className="w-7 h-7" />
          </Link>
          <Link to="/notifications" aria-label="알림" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_push.svg" alt="" className="w-7 h-7" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 pt-2">
          <div className="w-full aspect-[335/96] rounded-[16px] overflow-hidden bg-[#F3F4F6]">
            <img
              src="/img/event_summer_festa.png"
              alt="SUMMER FESTA 이벤트 광고"
              className="w-full h-full object-cover"
            />
          </div>
        </section>

        <section className="px-4 mt-3">
          <div className="rounded-[16px] bg-[#F9FAFB] p-4">
            <div className="flex items-center gap-3">
              <img src="/img/ic_my_phone.svg" alt="" className="w-9 h-9" />
              <div className="flex flex-col">
                <span className="text-[15px] leading-[140%] font-bold text-[#8259F5]">
                  고객센터 <span className="text-[#030712]">010-8702-9996</span>
                </span>
                <span className="text-[12px] leading-[140%] text-[#4A5565]">
                  운영시간: 9시~18시 (주말 및 공휴일 휴무)
                </span>
                <span className="text-[12px] leading-[140%] text-[#4A5565]">
                  점심시간: 12시~13시
                </span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleKakaoInquiry}
                className="flex-[0.45] h-[40px] rounded-full border border-[#9B7AF7] bg-white flex items-center justify-center gap-1 text-[14px] font-medium text-[#8259F5]"
              >
                <img src="/img/ic_write_p.svg" alt="" className="w-4 h-4" />
                1:1 문의
              </button>
              <button
                type="button"
                onClick={() => navigate('/mypage/counselor-apply/new')}
                className="flex-[0.55] h-[40px] rounded-full bg-[#9B7AF7] text-[14px] font-medium text-white"
              >
                상담사 신청 작성
              </button>
            </div>
          </div>
        </section>

        <section className="px-4 pt-4 pb-2">
          <p className="text-[13px] leading-[140%] text-[#6A7282]">
            전체 <span className="text-[#8259F5] font-medium">{total.toLocaleString()}</span>건{' '}
            <span className="text-[#8259F5] font-medium">{page}</span>페이지
          </p>
        </section>

        {loading && (
          <p className="px-4 py-10 text-center text-[13px] text-[#99A1AF]">불러오는 중…</p>
        )}
        {!loading && error && (
          <p className="px-4 py-10 text-center text-[13px] text-[#FB2C36]">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-[#99A1AF]">
            아직 신청 내역이 없습니다.
          </p>
        )}

        <ul className="flex flex-col">
          {items.map((p) => {
            const isNotice = p.category === 'notice'
            return (
              <li
                key={p.id}
                className={
                  isNotice
                    ? 'border-b border-[#F3F4F6] bg-[#F3EEFE]'
                    : 'border-b border-[#F3F4F6] bg-white'
                }
              >
                <Link to={`/mypage/counselor-apply/${p.id}`} className="block px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-[15px] leading-[140%] font-semibold text-[#030712]">
                      {p.title}
                    </span>
                    {!isNotice && p.is_mine && (
                      <span
                        className={`shrink-0 inline-flex items-center h-[22px] px-2 rounded-full bg-white border text-[12px] leading-none font-medium ${
                          STATUS_COLOR[p.status] ?? STATUS_COLOR.pending
                        }`}
                      >
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {isNotice ? (
                      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-white border border-[#9B7AF7] text-[12px] leading-none font-medium text-[#8259F5]">
                        공지
                      </span>
                    ) : (
                      p.mine_only_lock && (
                        <img src="/img/ic_secret_g.svg" alt="비밀글" className="w-4 h-4" />
                      )
                    )}
                    <span className="text-[13px] leading-[140%] text-[#99A1AF]">
                      {p.author_nickname ?? '회원'} · {formatDate(p.created_at)}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
