import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ConfirmModal from '../components/ConfirmModal'
import FloatingActions from '../components/FloatingActions'
import { MOCK_APPLY_DETAILS } from '../data/myPageMockData'

/**
 * 상담사 신청 상세 — Figma 136:16353
 *
 *  - 헤더: 뒤로가기 + "상담 신청 상세" + 우측 휴지통(빨강) + 연필(보라)
 *  - 본문: 제목 + 작성자/시각 + 정보 테이블 + 본인소개(텍스트 + 사진)
 *  - 하단: "목록으로" 버튼
 *  - 휴지통 클릭 → 삭제 컨펌 모달(141:17189)
 */
export default function CounselorApplyDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const data = id ? MOCK_APPLY_DETAILS[id] : undefined

  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!data) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px]">
        <header className="h-[60px] px-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
          </button>
          <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
            상담 신청 상세
          </h1>
        </header>
        <p className="text-center text-[14px] text-[#99A1AF] py-10">
          존재하지 않는 신청입니다.
        </p>
        <BottomNav />
      </div>
    )
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
          상담 신청 상세
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="삭제"
            onClick={() => setDeleteOpen(true)}
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <img src="/img/ic_trash_r.svg" alt="" className="w-6 h-6" />
          </button>
          <button
            type="button"
            aria-label="수정"
            onClick={() => navigate(`/mypage/counselor-apply/${data.id}/edit`)}
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <img src="/img/ic_hd_edit.svg" alt="" className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-2">
        <h2 className="text-[18px] leading-[140%] font-bold text-[#030712]">
          {data.title}
        </h2>
        <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
          {data.customerName} · {data.postedAt}
        </p>

        <div className="mt-4 border-t border-[#F3F4F6] pt-4">
          <dl className="flex flex-col gap-2">
            <Row label="이름" value={data.realName} />
            <Row label="예명" value={data.penName} />
            <Row label="지역" value={data.region} />
            <Row label="핸드폰 번호" value={data.phone} />
            <Row label="이메일" value={data.email} />
            <Row label="상담분야" value={data.field} />
            <Row label="전문 상담분야" value={data.specialties.join(', ')} />
          </dl>
        </div>

        <div className="mt-5 border-t border-[#F3F4F6] pt-4">
          <p className="text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">
            본인소개
          </p>
          <p className="text-[15px] leading-[160%] text-[#364153] whitespace-pre-line">
            {data.intro}
          </p>
          <img
            src={data.photoUrl}
            alt=""
            className="mt-3 w-full rounded-[12px]"
          />
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/mypage/counselor-apply')}
            className="h-[44px] px-7 rounded-full border border-[#9B7AF7] text-[15px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
      </main>

      <ConfirmModal
        open={deleteOpen}
        message="정말 삭제 하시겠습니까?"
        actionLabel="삭제"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false)
          navigate('/mypage/counselor-apply')
        }}
      />

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-[80px] shrink-0 text-[14px] leading-[140%] text-[#6A7282]">
        {label}
      </dt>
      <dd className="flex-1 text-[14px] leading-[140%] text-[#030712]">{value}</dd>
    </div>
  )
}
