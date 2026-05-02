import { useParams } from 'react-router-dom'
import CounselorDetailLayout from '../components/CounselorDetailLayout'
import { MOCK_DETAILS } from '../data/counselorDetails'

/**
 * 상담사 상세 — 소개 탭 (Figma 76:4852)
 * 라우트: /counselors/:id
 *
 * 본문은 단일 텍스트만 노출. 헤더·프로필·탭·CTA는 CounselorDetailLayout이 담당.
 */
export default function CounselorDetail() {
  const { id = '3' } = useParams<{ id: string }>()
  const data = MOCK_DETAILS[id] ?? MOCK_DETAILS['3']

  return (
    <CounselorDetailLayout data={data} activeTab="intro">
      <p className="text-[14px] leading-[140%] text-[#4A5565] whitespace-pre-line">
        {data.introText}
      </p>
    </CounselorDetailLayout>
  )
}
