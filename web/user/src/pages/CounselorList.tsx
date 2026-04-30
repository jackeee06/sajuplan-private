import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import CounselorCard, { Counselor } from '../components/CounselorCard'
import FilterDropdown from '../components/FilterDropdown'
import Pagination from '../components/Pagination'

type Category = '전체' | '사주' | '타로' | '신점'
const CATEGORIES: Category[] = ['전체', '사주', '타로', '신점']

const FIELD_OPTIONS = ['연애운', '재물운', '신년운세', '직장운', '가족운', '종합운']
const STYLE_OPTIONS = ['직설적', '따뜻한', '자세한', '명료한']
const GENDER_OPTIONS = ['남성', '여성']

interface CounselorMock extends Counselor {
  hideChat?: boolean
  style?: string
  gender?: '남성' | '여성'
}

/**
 * 상담사 리스트 — Figma 74:3194 (03전체리스트_전체 상담사 리스트)
 *
 * 인터랙션:
 *  - main_tab01: 전체/사주/타로/신점 텍스트 탭 (활성 #8259F5)
 *  - filter_select × 3 (분야/스타일/성별): FilterDropdown 컴포넌트 사용
 *    선택 시 칩 활성화(bg #F3EEFE / text #8259F5 / border #9B7AF7)
 *  - 상담가능만 보기 체크 → phone/chat 둘 중 하나 available 만 노출
 *  - 페이지네이션 1-5 (32×32, 활성 #9B7AF7 원형)
 */

const MOCK_COUNSELORS: CounselorMock[] = [
  { id: 1, name: '강타로',   code: '335912', badge: '타로', tagline: '상대방의 진심이 궁금하다면?', pricePerSec: 1200, phoneState: 'available', chatState: 'available', hashtags: ['연애궁합운', '재회'], rating: 4.9, reviewCount: 326, liked: false, imgUrl: '/img/sample_img01.jpg', style: '직설적', gender: '여성' },
  { id: 2, name: '김선녀',   code: '224587', badge: '신점', tagline: '마음을 읽는 신점',           pricePerSec: 1500, phoneState: 'available', chatState: 'available', hashtags: ['삼재상담', '연애운'], rating: 4.8, reviewCount: 92,  liked: false, imgUrl: '/img/sample_img02.jpg', hideChat: true, style: '따뜻한', gender: '여성' },
  { id: 3, name: '사주선녀', code: '165791', badge: '사주', tagline: '속 시원하게 풀어드립니다',  pricePerSec: 1000, phoneState: 'busy',      chatState: 'busy',      hashtags: ['신년운세', '금전운'], rating: 4.7, reviewCount: 106, liked: false, imgUrl: '/img/sample_img03.jpg', style: '자세한', gender: '여성' },
  { id: 4, name: '신비',     code: '863143', badge: '타로', tagline: '카드가 들려주는 이야기',     pricePerSec: 1400, phoneState: 'busy',      chatState: 'busy',      hashtags: ['오늘의운세', '가족운'], rating: 4.8, reviewCount: 237, liked: false, imgUrl: '/img/sample_img04.jpg', hideChat: true, style: '명료한', gender: '남성' },
  { id: 5, name: '강타로',   code: '335912', badge: '타로', tagline: '상대방의 진심이 궁금하다면?', pricePerSec: 1200, phoneState: 'available', chatState: 'available', hashtags: ['연애궁합운', '재회'], rating: 4.9, reviewCount: 326, liked: false, imgUrl: '/img/sample_img01.jpg', style: '직설적', gender: '여성' },
  { id: 6, name: '김선녀',   code: '224587', badge: '신점', tagline: '마음을 읽는 신점',           pricePerSec: 1500, phoneState: 'available', chatState: 'available', hashtags: ['삼재상담', '연애운'], rating: 4.8, reviewCount: 92,  liked: false, imgUrl: '/img/sample_img02.jpg', hideChat: true, style: '따뜻한', gender: '여성' },
  { id: 7, name: '사주선녀', code: '165791', badge: '사주', tagline: '속 시원하게 풀어드립니다',  pricePerSec: 1000, phoneState: 'busy',      chatState: 'busy',      hashtags: ['신년운세', '금전운'], rating: 4.7, reviewCount: 106, liked: false, imgUrl: '/img/sample_img03.jpg', style: '자세한', gender: '여성' },
  { id: 8, name: '신비',     code: '863143', badge: '타로', tagline: '카드가 들려주는 이야기',     pricePerSec: 1400, phoneState: 'busy',      chatState: 'busy',      hashtags: ['오늘의운세', '가족운'], rating: 4.8, reviewCount: 237, liked: false, imgUrl: '/img/sample_img04.jpg', hideChat: true, style: '명료한', gender: '남성' },
]

/** 분야 필터: 선택값이 카드의 hashtag 들 중 어느 하나라도 포함되면 매칭 */
const matchesField = (c: CounselorMock, field: string | null) => {
  if (!field) return true
  return c.hashtags.some((tag) => tag.includes(field))
}

export default function CounselorList() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<Category>('전체')
  const [field, setField] = useState<string | null>(null)
  const [style, setStyle] = useState<string | null>(null)
  const [gender, setGender] = useState<string | null>(null)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [counselors, setCounselors] = useState(MOCK_COUNSELORS)

  const onLikeToggle = (id: Counselor['id']) =>
    setCounselors((prev) => prev.map((c) => (c.id === id ? { ...c, liked: !c.liked } : c)))

  const filtered = useMemo(
    () =>
      counselors.filter((c) => {
        if (category !== '전체' && c.badge !== category) return false
        if (!matchesField(c, field)) return false
        if (style && c.style !== style) return false
        if (gender && c.gender !== gender) return false
        if (availableOnly && c.phoneState !== 'available' && c.chatState !== 'available') return false
        return true
      }),
    [counselors, category, field, style, gender, availableOnly],
  )

  const resetPage = () => setPage(1)

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      {/* 헤더 — hd2 (Figma 1:465) */}
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
          상담사 리스트
        </h1>
      </header>

      <main className="flex-1">
        {/* main_tab01 — 4 카테고리 텍스트 탭 */}
        <section className="px-4 pt-4 pb-3 flex gap-6">
          {CATEGORIES.map((c) => {
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c)
                  resetPage()
                }}
                className={`text-[20px] leading-[120%] font-semibold transition ${
                  active ? 'text-[#8259F5]' : 'text-[#6A7282]'
                }`}
              >
                {c}
              </button>
            )
          })}
        </section>

        {/* filter_select 행 — 분야 / 스타일 / 성별 + sliders */}
        <section className="px-4 pt-1 pb-3 flex gap-1 items-center">
          <FilterDropdown
            label="분야"
            options={FIELD_OPTIONS}
            value={field}
            onChange={(v) => {
              setField(v)
              resetPage()
            }}
          />
          <FilterDropdown
            label="스타일"
            options={STYLE_OPTIONS}
            value={style}
            onChange={(v) => {
              setStyle(v)
              resetPage()
            }}
          />
          <FilterDropdown
            label="성별"
            options={GENDER_OPTIONS}
            value={gender}
            onChange={(v) => {
              setGender(v)
              resetPage()
            }}
          />
          <button
            type="button"
            aria-label="필터 열기"
            className="w-9 h-9 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-center shrink-0"
          >
            <img src="/img/ic_filter.svg" alt="" className="w-4 h-4" />
          </button>
        </section>

        {/* 정렬 + 체크박스 행 — border-bottom */}
        <section className="px-4 py-3 flex items-center justify-between border-b border-[#F3F4F6]">
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => {
                setAvailableOnly(e.target.checked)
                resetPage()
              }}
              className="w-[22px] h-[22px]"
            />
            <span className="text-[15px] leading-[120%] text-[#364153]">상담가능만 보기</span>
          </label>
          <button type="button" className="flex items-center gap-1 text-[15px] leading-[130%] text-[#364153]">
            <img src="/img/ic_filter.svg" alt="" className="w-4 h-4" />
            최신순
          </button>
        </section>

        {/* 카드 리스트 */}
        <section className="flex flex-col">
          {filtered.length === 0 ? (
            <p className="text-center text-[14px] text-[#99A1AF] py-10">
              해당 조건의 상담사가 없습니다.
            </p>
          ) : (
            filtered.map((c) => (
              <CounselorCard
                key={c.id}
                counselor={c}
                onLikeToggle={onLikeToggle}
                hideChat={c.hideChat}
              />
            ))
          )}
        </section>

        <Pagination currentPage={page} totalPages={5} onPageChange={setPage} />
      </main>

      <FloatingGoTop />

      <BottomNav />
    </div>
  )
}

function FloatingGoTop() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="위로 가기"
      className="fixed right-4 bottom-[100px] z-40 w-[50px] h-[50px] rounded-full border border-[#F9FAFB] backdrop-blur-[6px] flex items-center justify-center"
      style={{ background: 'rgba(243, 244, 246, 0.8)' }}
    >
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#030712" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
