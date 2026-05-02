import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CONSULT_MEMO_CATEGORIES,
  CONSULT_MEMO_TOPICS,
  COUNSELOR_DISPLAY_NAME,
  MOCK_COUNSELOR_CALLS,
  MOCK_COUNSELOR_CHATS,
  type ConsultLog,
} from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_전화상담 메모 작성 / 채팅상담 메모 작성
 * Figma node-id: 165:11772 (전화) / 163:25453 (채팅)
 *
 * 두 시안의 차이는 상단 카드의 "과금 포인트" 행 유무뿐.
 * URL 패턴으로 type 분기:
 *  - /counselor/mypage/calls/:id/memo  → type=phone
 *  - /counselor/mypage/chats/:id/memo  → type=chat
 *
 * 폼: 상담분류(셀렉트) / 상담주제(셀렉트) / 메모(텍스트에어리어) / 작성완료
 */
export default function CounselorMyConsultMemo() {
  const navigate = useNavigate()
  const { id = '1', type = 'phone' } = useParams<{ id: string; type: string }>()
  const isChat = type === 'chat'

  const log: ConsultLog | undefined = (isChat ? MOCK_COUNSELOR_CHATS : MOCK_COUNSELOR_CALLS).find(
    (it) => it.id === Number(id),
  )

  const [category, setCategory] = useState('')
  const [topic, setTopic] = useState('')
  const [memo, setMemo] = useState('')

  if (!log) {
    return (
      <div className="mobile-frame px-4 py-10 text-center text-[14px] text-[#6A7282]">
        상담 정보가 없습니다.
      </div>
    )
  }

  return (
    <div className="mobile-frame flex flex-col pb-6">
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
          {isChat ? '채팅상담 메모' : '전화상담 메모'}
        </h1>
      </header>

      <main className="flex-1 px-4 pt-2 flex flex-col gap-5">
        {/* 상단 회색 카드 */}
        <section className="rounded-[12px] bg-[#F9FAFB] px-5 py-4">
          <p className="text-[16px] font-bold text-[#030712]">{log.customerName}</p>
          <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
            <li className="flex items-center justify-between">
              <span className="text-[#6A7282]">상담사</span>
              <span className="text-[#1E2939]">{COUNSELOR_DISPLAY_NAME}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[#6A7282]">시작시간</span>
              <span className="text-[#1E2939]">{log.startedAt}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[#6A7282]">완료시간</span>
              <span className="text-[#1E2939]">{log.endedAt}</span>
            </li>
            {isChat && (
              <li className="flex items-center justify-between">
                <span className="text-[#6A7282]">과금 포인트</span>
                <span className="text-[#1E2939]">{(log.pointPaid ?? 0).toLocaleString()}P</span>
              </li>
            )}
          </ul>
        </section>

        <Field label="상담분류" required>
          <SimpleSelect
            value={category}
            options={CONSULT_MEMO_CATEGORIES}
            placeholder="상담분류 선택"
            onChange={setCategory}
          />
        </Field>

        <Field label="상담주제" required>
          <SimpleSelect
            value={topic}
            options={CONSULT_MEMO_TOPICS}
            placeholder="상담주제 선택"
            onChange={setTopic}
          />
        </Field>

        <div>
          <p className="text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">메모</p>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="고객 상담 메모를 작성해보세요."
            rows={6}
            className="w-full px-4 py-3 rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] leading-[150%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none resize-none"
          />
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-2 w-full h-[52px] rounded-full bg-[#9B7AF7] text-white text-[16px] font-semibold"
        >
          작성완료
        </button>
      </main>
    </div>
  )
}

/* ─────────── 폼 헬퍼 ─────────── */

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">
        {label}
        {required && <span className="text-[#FF6467] ml-0.5">*</span>}
      </p>
      {children}
    </div>
  )
}

function SimpleSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string
  options: readonly string[]
  placeholder: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-between text-[15px]"
      >
        <span className={value ? 'text-[#1E2939]' : 'text-[#99A1AF]'}>{value || placeholder}</span>
        <svg viewBox="0 0 16 16" className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" aria-hidden>
          <path d="M4 6L8 10L12 6" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-[260px] overflow-y-auto bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_8px_20px_rgba(16,24,40,0.08)] py-1"
        >
          {options.map((opt) => {
            const selected = value === opt
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={`w-full px-4 py-2.5 text-left text-[15px] leading-5 ${
                    selected ? 'text-[#8259F5] font-medium bg-[#F3EEFE]' : 'text-[#1E2939] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {opt}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
