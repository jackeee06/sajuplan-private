import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MOCK_DETAILS } from '../data/counselorDetails'

/**
 * 채팅 상담방 — Figma 109:8613 (05채팅방)
 * 라우트: /chat/:id
 *
 * 한 페이지로 다음 상태를 모두 처리:
 *  - 기본 대화 (Figma 101:5324)
 *  - 입력 시 (101:6462) — input에 텍스트 있을 때 전송 버튼 노출
 *  - 여러줄 입력 (101:6533) — textarea가 최대 5줄까지 자동 확장
 *  - 날짜 넘어간 경우 (101:6329) — 새 날짜 divider 자동 노출
 *  - 이탈 알림 (147:12457) — system 메시지로 노출
 *  - 상담종료 (101:6956) — ?status=ended / "상담종료" 버튼 → 종료 컨펌 모달 → 종료
 *  - 상담종료 컨펌 모달 (101:7022)
 *  - 포인트 소진 알럿 (101:7108) — ?modal=points-alert
 *  - 포인트 소진 종료 (107:7691) — ?status=ended-points
 *
 * 구조:
 *  [hd7 헤더] ← + 상담사명 + 타이머(보라 #8259F5) + 상담종료 outline 버튼
 *  [메시지 영역] bg #F3EEFE, scroll-y, 가운데 날짜·system pill, 좌/우 정렬 버블
 *  [채팅 입력] bg white, textarea(rounded full~28) + 전송 버튼(텍스트 있을 때만)
 */

type ChatMessageType = 'other' | 'mine' | 'date' | 'system'

interface ChatMessage {
  id: number
  type: ChatMessageType
  /** other 첫 메시지에 표시할 보낸 사람 이름·아바타 */
  sender?: { name: string; avatar: string }
  /** 본문 (단일/복수 줄 문자열) */
  text: string
  /** 시각 "23:56". date·system 일 땐 미사용 */
  time?: string
  /** mine 메시지의 읽음 여부 */
  read?: boolean
}

const MAX_INPUT_ROWS = 5

const MOCK_MESSAGES: ChatMessage[] = [
  { id: 1, type: 'date', text: '2026년 4월 12일 일요일' },
  {
    id: 2,
    type: 'other',
    sender: { name: '사주선녀', avatar: '/img/sample_img03.jpg' },
    text: '안녕하세요, 정통 명리학의 깊이로 인생의 운로(運路)를 밝혀드리는 사주선녀입니다.',
    time: '23:56',
  },
  {
    id: 3,
    type: 'other',
    text: '성함, 생년월일, 태어난 시간과 함께 어떤 고민이 있으신지 보내주세요~',
    time: '23:56',
  },
  { id: 4, type: 'mine', text: '김고객, 88년 1월 30일, 오후 2시', time: '23:56' },
  { id: 5, type: 'mine', text: '올해 재물운이 궁금합니다.', time: '23:56', read: true },
  {
    id: 6,
    type: 'other',
    sender: { name: '사주선녀', avatar: '/img/sample_img03.jpg' },
    text: '네 잠시만 기다려주세요~',
    time: '23:56',
  },
  // ─── 이탈/재입장 시스템 메시지 (Figma 147:12457)
  // Figma는 기본 상태(101:5324)와 이탈 예시(147:12457)를 분리해놨지만,
  // 한 화면에서 두 UI 상태를 모두 검증할 수 있도록 user 승인 하에 mock 기본에 포함.
  // 운영 연동 시 백엔드 이벤트로 동적 삽입.
  { id: 7, type: 'system', text: '사주선녀님이 잠시 이탈했습니다.' },
  { id: 8, type: 'system', text: '사주선녀님이 재입장했습니다.' },
  { id: 9, type: 'system', text: '김고객님이 잠시 이탈했습니다.' },
  { id: 10, type: 'system', text: '김고객님이 재입장했습니다.' },
]

type ChatStatus = 'active' | 'ended' | 'ended-points'

export default function ChatRoom() {
  const { id = '3' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const counselor = MOCK_DETAILS[id] ?? MOCK_DETAILS['3']

  // URL 쿼리 파라미터로 초기 상태 결정
  const initialStatus: ChatStatus = useMemo(() => {
    const s = searchParams.get('status')
    if (s === 'ended') return 'ended'
    if (s === 'ended-points') return 'ended-points'
    return 'active'
  }, [searchParams])
  const initialModal = searchParams.get('modal') // 'end-confirm' | 'points-alert' | null

  const [input, setInput] = useState('')
  const [messages] = useState<ChatMessage[]>(MOCK_MESSAGES)
  const [chatStatus, setChatStatus] = useState<ChatStatus>(initialStatus)
  const [endConfirmOpen, setEndConfirmOpen] = useState(initialModal === 'end-confirm')
  const [pointsAlertOpen, setPointsAlertOpen] = useState(initialModal === 'points-alert')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 메시지 추가 시 자동 하단 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  // textarea auto-grow (최대 5줄)
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 22
    const maxHeight = lineHeight * MAX_INPUT_ROWS
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`
  }, [input])

  const onSend = () => {
    if (!input.trim()) return
    // TODO: 실제 API 연동 — 지금은 mock 입력만 비움
    setInput('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="mobile-frame flex flex-col h-screen bg-[#F3EEFE]">
      {/* 헤더 — hd7. 종료 상태에서는 타이머·상담종료 버튼 미노출 (Figma 101:6956 / 107:7691) */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-white">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          {counselor.name}
        </h1>
        {chatStatus === 'active' && (
          <>
            <span className="text-[18px] leading-[120%] font-medium text-[#8259F5] tabular-nums">
              00:30:43
            </span>
            <button
              type="button"
              onClick={() => setEndConfirmOpen(true)}
              className="h-8 px-3 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[14px] font-medium"
            >
              상담종료
            </button>
          </>
        )}
      </header>

      {/* 메시지 영역. 종료 상태 시 마지막에 종료 안내 pill 추가 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.map((m) => (
          <MessageItem key={m.id} message={m} />
        ))}
        {chatStatus === 'ended' && (
          <SystemPill text="상담이 종료되었습니다." />
        )}
        {chatStatus === 'ended-points' && (
          <SystemPill text="포인트 소진으로 상담이 종료되었습니다." />
        )}
      </div>

      {/* 입력창 */}
      <div className="bg-white px-4 py-2 flex items-end gap-2">
        <div className="flex-1 bg-[#F9FAFB] rounded-[24px] px-4 py-2.5 flex items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="메세지를 입력하세요"
            rows={1}
            className="flex-1 bg-transparent text-[14px] leading-[22px] text-[#1E2939] placeholder:text-[#99A1AF] resize-none outline-none overflow-y-auto"
            style={{ maxHeight: `${22 * MAX_INPUT_ROWS}px` }}
          />
        </div>
        {input.trim() && (
          <button
            type="button"
            onClick={onSend}
            aria-label="전송"
            className="w-9 h-9 rounded-full bg-[#9B7AF7] flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
              <path
                d="M5 12L19 12M19 12L13 6M19 12L13 18"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* 상담종료 컨펌 모달 — Figma 101:7022 */}
      {endConfirmOpen && (
        <CenterModal onBackdropClick={() => setEndConfirmOpen(false)}>
          <AlertIcon />
          <h3 className="text-[18px] leading-[130%] font-semibold text-[#030712] text-center">
            상담을 종료하시겠습니까?
          </h3>
          <div className="flex items-center gap-2 mt-4 w-full">
            <button
              type="button"
              onClick={() => setEndConfirmOpen(false)}
              className="flex-1 h-11 rounded-full bg-white border border-[#E5E7EB] text-[#1E2939] text-[14px] font-medium"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                setChatStatus('ended')
                setEndConfirmOpen(false)
              }}
              className="flex-1 h-11 rounded-full bg-[#9B7AF7] text-white text-[14px] font-medium"
            >
              상담종료
            </button>
          </div>
        </CenterModal>
      )}

      {/* 포인트 부족 알럿 모달 — Figma 101:7108 */}
      {pointsAlertOpen && (
        <CenterModal onBackdropClick={() => setPointsAlertOpen(false)}>
          <AlertIcon />
          <h3 className="text-[18px] leading-[130%] font-semibold text-[#030712] text-center">
            상담이 종료되었습니다.
          </h3>
          <p className="text-[14px] leading-[140%] text-[#6A7282] text-center">
            충전된 포인트가 모두 소진되어<br />상담이 종료되었습니다.
          </p>
          <button
            type="button"
            onClick={() => {
              setChatStatus('ended-points')
              setPointsAlertOpen(false)
            }}
            className="mt-4 h-11 px-10 rounded-full bg-[#9B7AF7] text-white text-[14px] font-medium"
          >
            확인
          </button>
        </CenterModal>
      )}
    </div>
  )
}

/* ───────────── 공용: 시스템 pill ───────────── */

function SystemPill({ text }: { text: string }) {
  return (
    <div className="flex justify-center">
      <div
        className="px-4 py-1.5 rounded-full text-[14px] leading-[130%] text-[#6A7282]"
        style={{ background: 'rgba(255, 255, 255, 0.6)' }}
      >
        {text}
      </div>
    </div>
  )
}

/* ───────────── 공용: 중앙 모달 (! 아이콘 포함) ───────────── */

function CenterModal({
  children,
  onBackdropClick,
}: {
  children: React.ReactNode
  onBackdropClick: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-9"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onBackdropClick}
    >
      <div
        className="w-full max-w-[358px] bg-white rounded-[16px] px-6 py-7 flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

/** 보라 원 + ! — 모달 헤더 아이콘 */
function AlertIcon() {
  return (
    <div className="w-12 h-12 rounded-full border-2 border-[#9B7AF7] flex items-center justify-center">
      <span className="text-[26px] leading-[100%] font-bold text-[#9B7AF7] mt-0.5">!</span>
    </div>
  )
}

/* ───────────── 메시지 아이템 ───────────── */

function MessageItem({ message: m }: { message: ChatMessage }) {
  if (m.type === 'date' || m.type === 'system') {
    return (
      <div className="flex justify-center">
        <div
          className="px-4 py-1.5 rounded-full text-[14px] leading-[130%] text-[#6A7282]"
          style={{ background: 'rgba(255, 255, 255, 0.6)' }}
        >
          {m.text}
        </div>
      </div>
    )
  }

  if (m.type === 'other') {
    return (
      <div className="flex flex-col gap-1.5">
        {m.sender && (
          <div className="flex items-center gap-2 ml-[4px]">
            <img
              src={m.sender.avatar}
              alt=""
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
            <span className="text-[14px] leading-[130%] font-medium text-[#1E2939]">
              {m.sender.name}
            </span>
          </div>
        )}
        <div className={`flex items-end gap-2 ${m.sender ? 'pl-[52px]' : 'pl-[52px]'}`}>
          <div className="bg-white rounded-[16px] px-4 py-3 max-w-[70%]">
            <p className="text-[14px] leading-[140%] text-[#1E2939] whitespace-pre-line">
              {m.text}
            </p>
          </div>
          {m.time && (
            <span className="text-[14px] leading-[110%] text-[#99A1AF] mb-1">{m.time}</span>
          )}
        </div>
      </div>
    )
  }

  // mine
  return (
    <div className="flex items-end justify-end gap-2">
      {m.read && (
        <div className="flex flex-col items-end mb-1 gap-0.5">
          <span className="text-[12px] leading-[110%] text-[#99A1AF]">읽음</span>
          {m.time && (
            <span className="text-[14px] leading-[110%] font-medium text-[#4A5565]">
              {m.time}
            </span>
          )}
        </div>
      )}
      {!m.read && m.time && (
        <span className="text-[14px] leading-[110%] text-[#99A1AF] mb-1">{m.time}</span>
      )}
      <div className="bg-[#9B7AF7] rounded-[16px] px-4 py-3 max-w-[70%]">
        <p className="text-[14px] leading-[140%] text-white whitespace-pre-line">{m.text}</p>
      </div>
    </div>
  )
}
