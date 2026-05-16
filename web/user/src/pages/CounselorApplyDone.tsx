import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'

/**
 * 상담사 신청 완료 페이지.
 *
 * CounselorApplyNew 에서 submit 성공 시 navigate 로 이동.
 * location.state.applyType: 'application' | 'inquiry' | 'other' 에 따라 안내 문구 다르게.
 *  - application: 관리자 검토 1~3 영업일, SMS 알림, 승인 후 새 아이디로 로그인
 *  - inquiry / other: 빠른 시일 내 답변, 휴대폰/이메일로 회신
 */
export default function CounselorApplyDone() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()

  const applyType = (location.state as { applyType?: string } | null)?.applyType ?? 'application'
  const isApplication = applyType === 'application'

  return (
    <div className="mobile-frame flex flex-col pb-[40px] relative">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712] text-center">
          신청 완료
        </h1>
      </header>

      <main className="flex-1 px-4 pt-6">
        {/* 큰 체크 아이콘 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#F3EEFE] flex items-center justify-center mb-4">
            <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" aria-hidden>
              <circle cx="24" cy="24" r="20" stroke="#8259F5" strokeWidth="2.5" />
              <path d="M15 24L21.5 30.5L33 18" stroke="#8259F5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-[20px] font-semibold leading-[130%] text-[#030712] text-center">
            {isApplication ? '상담사 신청이 접수되었습니다' : '문의가 접수되었습니다'}
          </h2>
          <p className="mt-2 text-[14px] leading-[150%] text-[#6A7282] text-center break-keep">
            {isApplication
              ? '소중한 시간을 내어 신청해주셔서 감사합니다.'
              : '소중한 시간을 내어 문의 주셔서 감사합니다.'}
          </p>
        </div>

        {/* 다음 단계 안내 */}
        <div className="rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-4">
          <p className="text-[13px] font-semibold text-[#8259F5] mb-3">
            다음 단계
          </p>
          <ol className="space-y-3">
            {isApplication ? (
              <>
                <Step n={1} title="관리자 검토" desc="영업일 기준 1~3일 정도 소요됩니다." />
                <Step n={2} title="SMS 알림 발송" desc="결과가 나오면 등록하신 휴대폰으로 알려드립니다." />
                <Step n={3} title="상담사 로그인" desc="승인되면 가입 시 정하신 아이디·비밀번호로 상담사 사이트에 로그인하실 수 있습니다." />
                <Step n={4} title="반려 시" desc="반려 사유와 함께 SMS 가 발송됩니다. 보완 후 재신청 가능합니다." />
              </>
            ) : (
              <>
                <Step n={1} title="담당자 확인" desc="빠른 시일 내에 담당자가 문의 내용을 확인합니다." />
                <Step n={2} title="회신" desc="등록하신 휴대폰 또는 이메일로 답변드립니다." />
                <Step n={3} title="추가 문의" desc="추가로 궁금하신 점이 생기면 다시 문의해주세요." />
              </>
            )}
          </ol>
        </div>

        {/* 주의사항 */}
        {isApplication && (
          <div className="mt-4 rounded-[10px] bg-[#FFF8E1] border border-[#FFE08A] px-3 py-2.5 flex items-start gap-2">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0 mt-0.5" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9.5" stroke="#B45309" strokeWidth="1.6" />
              <path d="M12 7.5V13" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="16.5" r="1.1" fill="#B45309" />
            </svg>
            <p className="text-[12.5px] leading-[150%] text-[#92591F]">
              <span className="font-semibold">아직 상담사 로그인은 불가능합니다.</span> 관리자가 승인할 때까지 기다려주세요.
            </p>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full h-[52px] rounded-full text-[16px] font-medium text-white bg-[#9B7AF7]"
          >
            홈으로
          </button>
          {isLoggedIn && (
            <button
              type="button"
              onClick={() => navigate('/mypage/counselor-apply')}
              className="w-full h-[52px] rounded-full text-[16px] font-medium text-[#8259F5] bg-white border border-[#9B7AF7]"
            >
              내 신청 내역 보기
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-[#F3EEFE] text-[#8259F5] text-[12px] font-semibold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] leading-[140%] font-semibold text-[#030712]">{title}</p>
        <p className="mt-0.5 text-[13px] leading-[150%] text-[#6A7282] break-keep">{desc}</p>
      </div>
    </li>
  )
}
