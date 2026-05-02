import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { MOCK_APPLY_POSTS } from '../data/myPageMockData'

const PAGE_SIZE = 10

/**
 * 상담사 신청 메인 — Figma 120:6769 (06마이페이지_추가메뉴_상담사 신청)
 *
 * 구조:
 *  - 헤더 + 우측 검색·알림
 *  - 상단 광고 배너 (Figma 시안: SUMMER FESTA 이미지 — 디자이너가 광고 placeholder로 동일 자산 사용)
 *  - 고객센터 카드 (전화번호 + 운영시간 + 1:1 문의 / 상담사 신청 작성 버튼)
 *  - 카운터 + 게시판 리스트 (공지 3 + 일반 글, 일반 글은 자물쇠)
 *  - 페이지네이션
 */
export default function CounselorApply() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(MOCK_APPLY_POSTS.length / PAGE_SIZE))
  const pageItems = MOCK_APPLY_POSTS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
                onClick={() => navigate('/mypage/inquiry/new')}
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
            전체 <span className="text-[#8259F5] font-medium">{MOCK_APPLY_POSTS.length}</span>건{' '}
            <span className="text-[#8259F5] font-medium">{page}</span>페이지
          </p>
        </section>

        <ul className="flex flex-col">
          {pageItems.map((p) => (
            <li
              key={p.id}
              className={
                p.pinned
                  ? 'border-b border-[#F3F4F6] bg-[#F3EEFE]'
                  : 'border-b border-[#F3F4F6] bg-white'
              }
            >
              <Link to={`/mypage/counselor-apply/${p.id}`} className="block px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="flex-1 text-[15px] leading-[140%] font-semibold text-[#030712]">
                    {p.title}
                  </span>
                  {p.isNew && (
                    <span className="shrink-0 inline-flex items-center h-[22px] px-2 rounded-full bg-[#FF6467] text-[12px] leading-none font-medium text-white">
                      New
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {p.pinned ? (
                    <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-white border border-[#9B7AF7] text-[12px] leading-none font-medium text-[#8259F5]">
                      공지
                    </span>
                  ) : (
                    p.locked && (
                      <img src="/img/ic_secret_g.svg" alt="비밀글" className="w-4 h-4" />
                    )
                  )}
                  <span className="text-[13px] leading-[140%] text-[#99A1AF]">
                    {p.customerName} · {p.date}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
