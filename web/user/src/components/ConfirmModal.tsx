import { useDismissOnBack } from '../lib/use-dismiss-on-back'

/**
 * ConfirmModal — Figma 06마이페이지(비회원) > 상담사 신청 모달 3종 (141:17189 / 142:21334 / 142:21292)
 *                + 07마이페이지(회원) > 로그아웃·비번컨펌·비번완료·회원탈퇴 모달
 *
 * 공통 구조:
 *  - 회색 dim 오버레이 (rgba(0,0,0,0.4))
 *  - 흰 박스 라운드 24px, 가운데 정렬, 좌우 패딩 24px
 *  - 보라/빨강 원형 아이콘 (52×52) — alert(!) 또는 success(✓)
 *  - 메시지(h3 16/600/150%) + 선택적 서브메시지(14/400/150% gray)
 *  - 버튼 1개(풀폭) 또는 2개(취소+액션)
 *
 * tone — 'primary'(보라, 기본) / 'danger'(빨강, 회원탈퇴)
 * iconVariant — 'alert'(!) / 'success'(✓, 비번 수정 완료)
 * singleButton — true면 actionLabel만 단일 풀폭(취소 비노출)
 */
interface Props {
  open: boolean
  message: string
  /** 보조 메시지 — 비번 완료/회원탈퇴 안내문 */
  subMessage?: string
  /** 액션 버튼 라벨 (예: "삭제", "로그아웃", "수정", "확인", "탈퇴") */
  actionLabel: string
  /** 취소 버튼 라벨 (기본 "취소") — singleButton=true일 땐 무시 */
  cancelLabel?: string
  /** 색조 — 'primary'(기본) / 'danger'(회원탈퇴) */
  tone?: 'primary' | 'danger'
  /** 아이콘 — 'alert'(!) 기본 / 'success'(✓) */
  iconVariant?: 'alert' | 'success'
  /** true면 actionLabel만 풀폭 단일 버튼 */
  singleButton?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmModal({
  open,
  message,
  subMessage,
  actionLabel,
  cancelLabel = '취소',
  tone = 'primary',
  iconVariant = 'alert',
  singleButton = false,
  onCancel,
  onConfirm,
}: Props) {
  useDismissOnBack(open, onCancel)
  if (!open) return null

  const accent = tone === 'danger' ? '#FB2C36' : '#9B7AF7'
  const actionBg = tone === 'danger' ? '#FB2C36' : '#9B7AF7'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0, 0, 0, 0.4)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[320px] bg-white rounded-[24px] px-6 py-7 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center"
          style={{ border: `1.6px solid ${accent}` }}
        >
          {iconVariant === 'alert' ? (
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
              <path d="M12 7.5V13.5" stroke={accent} strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="17" r="1.2" fill={accent} />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
              <path
                d="M7 12.5L10.5 16L17 9"
                stroke={accent}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <p className="mt-4 text-[16px] leading-[150%] font-semibold text-[#030712] text-center whitespace-pre-line">
          {message}
        </p>
        {subMessage && (
          <p className="mt-1 text-[14px] leading-[150%] font-normal text-[#99A1AF] text-center whitespace-pre-line">
            {subMessage}
          </p>
        )}
        <div className={`mt-6 w-full flex ${singleButton ? '' : 'gap-2'}`}>
          {!singleButton && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-[44px] rounded-full border border-[#E5E7EB] bg-white text-[15px] font-medium text-[#4A5565]"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`${singleButton ? 'mx-auto px-10' : 'flex-1'} h-[44px] rounded-full text-[15px] font-medium text-white`}
            style={{ background: actionBg }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
