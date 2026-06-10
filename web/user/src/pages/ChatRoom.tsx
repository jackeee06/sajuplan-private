import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, chatApi, counselorGradeApi, type ChatMessage, type ChatRoomDetail } from '../lib/api'
import { GRADE_UPGRADE_STORAGE_KEY } from '../components/GradeUpgradeToast'
import { useAuth } from '../lib/auth-context'
import { useChatSocket } from '../hooks/useChatSocket'
import UploadedImage from '../components/UploadedImage'
import { API_BASE } from '../lib/runtime-env'

/**
 * 채팅 상담방 — Figma 109:8613 (05채팅방)
 * 라우트: /chat/:id  (id = chat_room.id PK)
 *
 * 진입 경로 두 가지:
 *  1) ConsultModal → navigate('/chat/{id}', { state: { roomid, memberToken, wssUrl, ... } })
 *     — 신규/재입장 직후. wss 즉시 접속.
 *  2) MyChats 카드 → navigate('/chat/{id}')   (state 없음)
 *     — 이미 종료된 방 다시보기. 메시지만 조회, wss 미접속.
 *
 * 디자인 충실도: Figma 시안 그대로 유지. mock/하드코딩 부분만 실제 API/WebSocket 으로 교체.
 *  - 헤더: 뒤로가기 + 상대방명 + 타이머(보라 #ec4899) + 상담종료 outline 버튼
 *  - 메시지 영역: bg #fdf2f8, date divider, system pill, mine/other 버블
 *  - 입력창: textarea auto-grow 최대 5줄, 입력 있을 때만 전송 버튼 노출
 *  - 모달: 상담종료 컨펌 / 포인트 부족 알럿
 *
 * 잔여시간 (타이머):
 *  - chat_room 의 unit_seconds/unit_cost 기반 자체 카운트다운.
 *  - 매뉴얼 §4.5: 실제 차감은 m2net 측 처리. webhook (`END_CHAT`/`INSUFFICIENT_CONN`) 도착 시
 *    상태 동기화로 종료 표기.
 *  - 정확한 잔여시간은 미정인 경우(legacy 방 진입 등) 표시 생략.
 */

type ChatStatus = 'active' | 'ended' | 'ended-points'

/**
 * 채팅방 unmount 시 즉시 leave 호출하지 않고 30초 grace 동안 보류한다.
 *  - 라우트 이동(back) 후 빠르게 같은 방에 재진입 → grace 안이면 leave 취소
 *  - grace 만료 또는 다른 방 진입 시 → 실제 leave 실행
 *
 * 모듈 스코프 단일 슬롯이라 한 번에 한 방만 grace 상태로 둘 수 있다 (브라우저 탭당 1개로 충분).
 * Effect B(컴포넌트 unmount cleanup) 가 schedulePendingLeave 를 호출, 다음 마운트의
 * Effect 1(getRoom) 진입 시 cancelPendingLeave(roomId) 를 호출하면 같은 방이면 취소된다.
 */
let pendingLeave: { roomId: number; timer: number; fire: () => void } | null = null

function cancelPendingLeave(roomId: number): boolean {
  if (pendingLeave && pendingLeave.roomId === roomId) {
    window.clearTimeout(pendingLeave.timer)
    pendingLeave = null
    return true
  }
  return false
}

/** beforeunload/pagehide 처럼 즉시 종료가 필요한 케이스용 — grace 무시. */
function flushPendingLeaveImmediate() {
  if (pendingLeave) {
    window.clearTimeout(pendingLeave.timer)
    try { pendingLeave.fire() } catch { /* swallow */ }
    pendingLeave = null
  }
}

interface NavState {
  roomid?: string
  memberToken?: string
  wssUrl?: string
  isRejoin?: boolean
  counselor?: {
    id: number | string
    name: string
    avatarUrl: string | null
    avatarUrlWebp: string | null
  }
}

const MAX_INPUT_ROWS = 5

interface DisplayMessage {
  id: string
  type: 'mine' | 'other' | 'date' | 'system'
  sender?: { name: string; avatar: string | null }
  text: string
  /** 이미지 URL (text 가 [img]경로 형태 또는 message_type=2 일 때) */
  isImage?: boolean
  /** HTML innerHTML 렌더 — m2net HtmlFlag=true */
  isHtml?: boolean
  time?: string
  read?: boolean
  /** ISO timestamp for ordering (DB row 또는 wss 수신 시점) */
  ts: number
  /** 보낸 사람 member.id — 'other' 메시지 아바타 결정용 */
  senderId?: number | null
  /** [2026-05-27] 5분 알림 시스템 메시지 표시 — true 면 채팅창에 강조 + 큰 모달 트리거 */
  isFiveMinAlert?: boolean
}

/**
 * sample/counsel/chat.php 1064~1075 정답:
 *  - msg 가 '[img]경로' 로 시작하면 이미지로 렌더 (G5_DATA_URL/chat/{경로})
 *  - htmlFlag=true 면 HTML innerHTML 그대로
 *  - 그 외엔 일반 텍스트
 */
function parseMessageContent(raw: string, htmlFlag?: boolean): { text: string; isImage: boolean; isHtml: boolean } {
  if (typeof raw === 'string' && raw.startsWith('[img]')) {
    const path = raw.substring(5).trim()
    const url = /^https?:\/\//.test(path) ? path : `/data/chat/${path}`
    return { text: url, isImage: true, isHtml: false }
  }
  if (htmlFlag) {
    return { text: raw, isImage: false, isHtml: true }
  }
  return { text: raw, isImage: false, isHtml: false }
}

export default function ChatRoom() {
  const { id: idParam = '0' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navState = (location.state as NavState | null) ?? null
  const { member, loading: authLoading } = useAuth()

  const chatRoomId = Number(idParam)

  // 로그인 가드 — 알림톡 등 외부 진입 케이스에서 비로그인 상태로 들어오면
  // /login?redirect=/chat/{id} 로 보내 로그인 후 자동 복귀. 채팅방 본문은 로그인된 회원만
  // 의미가 있으므로(권한 검증 + wss 토큰 발급) 비로그인은 즉시 차단.
  useEffect(() => {
    if (authLoading) return
    if (!member) {
      const target = `/chat/${chatRoomId}`
      navigate(`/login?redirect=${encodeURIComponent(target)}`, { replace: true })
    }
  }, [authLoading, member, chatRoomId, navigate])

  // URL 쿼리 — 시안 미리보기 용도(개발자 테스트). 실 운영은 webhook 으로 동기화.
  const initialStatus: ChatStatus = useMemo(() => {
    const s = searchParams.get('status')
    if (s === 'ended') return 'ended'
    if (s === 'ended-points') return 'ended-points'
    return 'active'
  }, [searchParams])
  const initialModal = searchParams.get('modal')

  const [room, setRoom] = useState<ChatRoomDetail | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [chatStatus, setChatStatus] = useState<ChatStatus>(initialStatus)
  // [2026-05-27] 5분 잔여 안내 모달 — 시스템 메시지 [ALERT_5MIN] 감지 시 1회 표시
  // [엄격검증 3차 fix 2026-05-27 T-3] sessionStorage 기반 seen — 페이지 이동 후 복귀 시 중복 발화 방지
  const [fiveMinAlertOpen, setFiveMinAlertOpen] = useState(false)
  const fiveMinSeenKey = `chat5min_seen_${chatRoomId}`
  const fiveMinAlertSeenRef = useRef<Set<string>>(
    typeof window === 'undefined'
      ? new Set()
      : new Set(
          (() => {
            try {
              const raw = sessionStorage.getItem(fiveMinSeenKey)
              return raw ? (JSON.parse(raw) as string[]) : []
            } catch { return [] }
          })()
        ),
  )
  const [endConfirmOpen, setEndConfirmOpen] = useState(initialModal === 'end-confirm')
  const [pointsAlertOpen, setPointsAlertOpen] = useState(initialModal === 'points-alert')
  // 일반 종료 알럿 (포인트 소진 외) — chatStatus='ended' 로 전환되는 순간 자동 표시
  const [endedAlertOpen, setEndedAlertOpen] = useState(false)
  // 첫 진입이 이미 종료 상태였는지 — true 면 단순 채팅 다시보기라 알럿 띄우지 않음.
  const initiallyEndedRef = useRef(initialStatus !== 'active')
  const [error, setError] = useState<string | null>(null)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  /**
   * 상담사 입장 알림 — m2net START_CHAT push 도착 (= chat_room.status STAY→CNCH 전환) 시 1회 표시.
   * 매뉴얼(상담서비스_API매뉴얼-V1.3 §4.5): "채팅시작 push reason=START_CHAT" 시점이 곧 상담사 실제 입장.
   * 본 화면에선 status 폴링이 'CNCH' 전환을 감지하는 순간 시스템 메시지로 회원에게만 노출.
   */
  const [counselorEntered, setCounselorEntered] = useState(false)
  // [2026-05-23] 5분 전 경고 — remainingSec 가 300초 이하 도달 시 1회 표시
  const [fiveMinuteWarning, setFiveMinuteWarning] = useState(false)
  const fiveMinuteShownRef = useRef(false)
  // [2026-05-30] 짧은 alloc(1분 등) 대응 — 알림 본문이 "30초" 또는 "5분" 가변.
  //   백엔드 chat.service 가 alloc<5분 시 "잔여 시간 30초 안내" 로 INSERT.
  //   메시지 검출 시 본문에서 라벨 추출해 모달/SystemPill/TTS 모두 동적 표시.
  const [fiveMinAlertLabel, setFiveMinAlertLabel] = useState<'30초' | '5분'>('5분')
  // 백엔드 getRoom 이 발급한 wss 토큰 — navState 가 없을 때(새로고침/다시보기 진입) fallback.
  const [wssFallback, setWssFallback] = useState<{ url: string; token: string; role: 'member' | 'counselor' } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastSinceRef = useRef<string | null>(null)
  // 상담사 입장(=chat_room.status='CNCH') 추적. 초기 진입에서 이미 CNCH 면 true 로 시작,
  // STAY → CNCH 전환은 5초 폴링에서 감지하여 입장 시스템 메시지 1회 노출.
  const counselorJoinedRef = useRef(false)
  const deadlineRef = useRef<number | null>(null)
  const lastTickAtRef = useRef<number>(0)
  // 본인 = 이 방의 상담사인지 여부. polling effect 가 변경 deps 없이도 최신값을 보도록 ref.
  const isMeCounselorRef = useRef(false)
  const isMeCounselor = room != null && member?.id != null && room.counselor_id === member.id
  isMeCounselorRef.current = isMeCounselor

  /**
   * 입장 이벤트 추적 — 첫 입장이면 "입장", 같은 actor 의 두 번째 이상이면 "재입장".
   * room_in_noti 페이로드의 IdTp ('csr'|'memb') 또는 CsrId/MembId 기반으로 set 에 누적.
   */
  const joinedActorsRef = useRef<Set<string>>(new Set())
  // wss 강제 재연결 트리거 — 이 값이 바뀌면 useChatSocket 이 ws 를 닫고 새로 연결.
  // 재진입(상대가 강제종료 후 재접속) 등 m2net 측 세션이 어긋난 케이스에 명시적 신호.
  const [reconnectKey, setReconnectKey] = useState(0)
  /**
   * 마지막으로 본 chat_room.rejoin_last_at — 폴링 응답이 이 값보다 새로우면 상대가 막
   * 재입장한 것으로 보고 wss 를 강제 재연결한다. 강제종료→재진입 시 회원 wss 가 옛
   * m2net 세션과 어긋난 채 굳는 케이스 방어.
   */
  const lastRejoinAtRef = useRef<string | null>(null)

  // [2026-05-23] 모바일 키보드 올라올 때 fixed 헤더가 화면 위로 밀려 올라가는 안드로이드 웹뷰
  //   pan 모드 회피 — visualViewport.offsetTop 만큼 헤더 top 을 동적 보정해 항상 viewport
  //   상단에 붙어있게 강제. (interactive-widget 메타와 이중 안전망)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const update = () => {
      if (headerRef.current) {
        headerRef.current.style.top = `${vv.offsetTop}px`
      }
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // 1) 방 + 메시지 초기 로드
  useEffect(() => {
    if (!Number.isFinite(chatRoomId) || chatRoomId <= 0) return
    // 인증 미확인/비로그인 동안 API 호출 보류 — 위 가드가 /login 으로 리다이렉트한다.
    if (authLoading || !member) return
    // 직전 unmount 가 30 초 grace leave 를 예약했을 수 있다 — 같은 방이면 취소.
    cancelPendingLeave(chatRoomId)
    let cancelled = false
    // sample act='rejoin' 동등 — 본인 try_out 플래그 해제 + 진짜 재입장이면 시스템 메시지 INSERT.
    // ⚠️ getRoom 보다 먼저 await 해야 INSERT 된 시스템 메시지가 messages 응답에 포함된다.
    // (이전엔 fire-and-forget 이라 본인 입장 메시지가 화면에 안 보이는 버그 발생)
    chatApi
      .rejoin(chatRoomId)
      .catch(() => { /* swallow */ })
      .then(() => chatApi.getRoom(chatRoomId))
      .then((res) => {
        if (cancelled) return
        setRoom(res.room)
        const ms = res.messages.map(toDisplay)
        // 머지: 새로 받은 DB 메시지(ms) + 메모리에만 있던 비-DB 메시지(임시 시스템 pill 등) 합본.
        // - 첫 마운트: cur=[], ms 그대로 set
        // - 재마운트/getRoom 재호출: 새 ms 가 진실의 원천이라 기존 db- 항목을 ms 로 교체.
        // - peer-/peerin-/peerout- 같은 옛 임시 항목은 더 이상 만들지 않지만 잔여가 있으면
        //   같은 텍스트가 DB 에 있으면 제거.
        // 메시지의 단일 원천 = DB. DB id (db-{N}) 만 기준으로 머지하고 그 외는 보존하지 않는다.
        // → 시스템 메시지 로그가 절대 사라지거나 변경되지 않는다 (DB INSERT 후 immutable).
        setMessages(ms)
        if (ms.length > 0) lastSinceRef.current = res.messages[res.messages.length - 1].created_at
        // 서버 진실 기준: 'STAY'(상담사 대기) / 'CNCH'(상담 진행) 만 활성. 그 외는 종료.
        // (단순히 status==='DISCONNECT' 만 보면 null/이상값 일 때 무한 "상담중" 표시 버그)
        const serverStatus = res.room.status
        if (serverStatus !== 'STAY' && serverStatus !== 'CNCH') {
          // 첫 진입부터 이미 종료 상태 — 다시보기 케이스라 종료 팝업은 띄우지 않는다.
          initiallyEndedRef.current = true
          setChatStatus('ended')
        }
        // 진입 시점에 이미 CNCH 면 상담사가 이미 입장한 상태 — 대기 안내 숨김, 입장 알림은 표시 안 함
        // (입장 알림은 STAY→CNCH 전환을 본 회원에게만 1회 노출되는 게 자연스러움)
        if (serverStatus === 'CNCH') {
          counselorJoinedRef.current = true
        }
        if (res.wss) {
          setWssFallback(res.wss)
          // ⚠️ mount 직후 forceReconnect 자동 호출 금지 — m2net 측 wss 가 onclose 이벤트로
          // room_out_noti 를 broadcast 해서 시스템 메시지가 무한 발화되는 버그가 발생함.
          // useChatSocket 의 deps(opts.memberToken/wssUrl) 변경에만 의존해 재연결.
        }
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError) {
          setError(e.message)
          if (e.status === 404) setTimeout(() => navigate(-1), 1500)
        } else setError('채팅방을 불러오지 못했습니다.')
      })
    return () => {
      cancelled = true
    }
  }, [chatRoomId, navigate, authLoading, member])

  // 2) wss 직결 — 백엔드 getRoom 의 role-aware 토큰을 **무조건 우선**.
  //    ConsultModal 의 navState 는 회원 토큰만 담고 있어 상담사가 같은 페이지를 열면
  //    회원 토큰으로 접속해 버린다 → 양쪽 cid 동일 → 모든 메시지 isMine. 백엔드는 본인 role
  //    (member/counselor) 을 보고 정확한 토큰(membtoken/csrtoken) 을 발급하므로 그것만 사용.
  const effectiveWssUrl = wssFallback?.url ?? navState?.wssUrl ?? ''
  const effectiveToken = wssFallback?.token ?? navState?.memberToken ?? ''
  const wssEnabled = chatStatus === 'active' && Boolean(effectiveToken && effectiveWssUrl)
  const { sendText, sendRoomOut } = useChatSocket({
    wssUrl: effectiveWssUrl,
    memberToken: effectiveToken,
    enabled: wssEnabled,
    reconnectKey,
    onMessage: (_msg) => {
      // 메시지의 단일 원천 = DB(chat_message). wss echo 자체를 화면에 그리지 않고
      // listMessagesSince 만 트리거해 DB 에서 가져온 row 를 표시한다.
      // → 중복(wss + DB) 방지 + 모든 발신/수신 메시지가 동일한 id/시각 키로 정렬됨.
      const since = lastSinceRef.current
      chatApi
        .listMessagesSince(chatRoomId, since ?? undefined)
        .then((res) => {
          if (res.items.length === 0) return
          setMessages((cur) => mergeIncoming(cur, res.items))
          lastSinceRef.current = res.items[res.items.length - 1].created_at
          // [2026-05-23] 본인이 방 화면을 보고 있는 상태 → 상대 메시지 자동 read 마킹
          chatApi.markRead(chatRoomId).catch(() => { /* swallow */ })
        })
        .catch(() => { /* swallow */ })
    },
    onReconnected: () => {
      // 재연결 후 누락 메시지 fetch
      const since = lastSinceRef.current
      if (!since) return
      chatApi
        .listMessagesSince(chatRoomId, since)
        .then((res) => {
          if (res.items.length === 0) return
          setMessages((cur) => mergeIncoming(cur, res.items))
          lastSinceRef.current = res.items[res.items.length - 1].created_at
        })
        .catch(() => {
          /* swallow — 다음 재연결 때 재시도 */
        })
    },
    onServerEnd: () => {
      setChatStatus('ended')
    },
    /**
     * 상대가 방을 나간 통지 — sample/counsel/chat.php 'room_out_noti' 동등.
     *  - 회원 화면: "[상담사]님이 잠시 이탈했습니다." (방은 살아있음 — 재접속 가능)
     *  - 상담사 화면: "[회원]님이 잠시 이탈했습니다."
     *  - 단, 동시에 getStatus 가 'DISCONNECT' 면 onServerEnd 가 ended 처리한다.
     */
    /**
     * 상대가 방을 나간 통지 — m2net evt.idTp 로 actor 식별.
     *  - 방 나감(잠시 이탈)과 상담 종료는 다른 상태:
     *    - chat_room.status 가 'DISCONNECT' 면 "상담을 종료했습니다."
     *    - 그 외엔 "채팅방을 나갔습니다." (재입장 가능)
     *  - 본인 wss 가 닫힐 때 m2net 가 echo 로 자기 자신 이벤트를 보낼 수 있어 본인 actor 는 무시.
     */
    /**
     * 상대 이탈/입장 이벤트 — wss 가 actor 식별 정보를 주면 backend 에 전달.
     * backend 가 try_out 마킹 + 시스템 메시지 INSERT (단일 원천). 응답 받은 후
     * listMessagesSince 로 새 메시지를 가져온다.
     */
    // peer-left 무시 정책 (2026-05-13):
    //  m2net WSS 가 inactivity(약 30초) 만으로 peer_left 를 발화해 사용자에게
    //  "상대가 나갔다" 라고 잘못 표시되는 문제. 명시적 leave/close 는 백엔드 markLeave
    //  경로로 별도 처리되므로 wss peer-left 이벤트는 신뢰하지 않는다.
    //  → 콜백을 비워둔다 (no-op). rejoin/입장 메시지는 onPeerJoined 가 정상 처리.
    onPeerLeft: () => { /* no-op */ },
    onPeerJoined: (evt) => {
      const myRole: 'csr' | 'memb' = isMeCounselorRef.current ? 'csr' : 'memb'
      const actor: 'csr' | 'memb' | undefined = evt.idTp
      if (actor && actor === myRole) return
      const seenKey = actor ?? 'peer'
      joinedActorsRef.current.add(seenKey)
      if (actor === 'csr' && !isMeCounselorRef.current) {
        counselorJoinedRef.current = false
      }
      const actorParam: 'counselor' | 'member' = actor === 'csr' ? 'counselor' : 'member'
      chatApi.peerEvent(chatRoomId, 'rejoin', actorParam)
        .then(() => {
          const since = lastSinceRef.current
          if (!since) return
          return chatApi.listMessagesSince(chatRoomId, since).then((r) => {
            if (r.items.length === 0) return
            setMessages((cur) => mergeIncoming(cur, r.items))
            lastSinceRef.current = r.items[r.items.length - 1].created_at
          })
        })
        .catch(() => { /* swallow */ })
    },
  })

  // ─────────────────────────────────────────────
  // 3) 잔여시간 카운트다운 — sample/counsel/chat.php 공식 그대로 이식.
  //
  //  상태머신:
  //   - status==='STAY'  : 상담사 미입장 → 정적 표시 (tick 안 함)
  //   - status==='CNCH'  : 상담사 입장 → deadline = now + remain*1000, 1초마다 tick
  //   - remain<=0        : ended-points 전환
  //   - status==='DISCONNECT' : ended 전환
  //
  //  서버 동기화:
  //   - 5초마다 getStatus 폴링 (충전·상담사입장·종료 모두 반영)
  //   - 10초마다 tick API 호출 (서버 use_seconds 누적, 잔여<10 이면 자동 DISCONNECT)
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (chatStatus !== 'active' || !wssEnabled) {
      setRemainingSec(null)
      deadlineRef.current = null
      counselorJoinedRef.current = false
      return
    }

    let cancelled = false

    const fetchStatus = async () => {
      try {
        const s = await chatApi.getStatus(chatRoomId)
        if (cancelled) return
        // 종료 상태 동기화 — 'STAY' / 'CNCH' 외엔 모두 종료로 간주.
        if (s.status !== 'STAY' && s.status !== 'CNCH') {
          setChatStatus('ended')
          return
        }
        // 상대가 재입장 시 chat_room.rejoin_last_at 가 갱신됨.
        // 변경 감지 → (1) getRoom 으로 새 토큰 확보 (2) reconnectKey 증가로 wss 재연결
        // (3) 누락된 시스템 메시지 listMessagesSince.
        if (s.rejoin_last_at && s.rejoin_last_at !== lastRejoinAtRef.current) {
          const prev = lastRejoinAtRef.current
          lastRejoinAtRef.current = s.rejoin_last_at
          if (prev !== null) {
            counselorJoinedRef.current = false
            // 새 wss 토큰 받고 강제 재연결 — m2net 세션 어긋남 보정.
            chatApi.getRoom(chatRoomId).then((res) => {
              if (cancelled) return
              if (res.wss) setWssFallback(res.wss)
              setReconnectKey((k) => k + 1)
              const since = lastSinceRef.current
              if (since) {
                chatApi.listMessagesSince(chatRoomId, since).then((r) => {
                  if (cancelled) return
                  if (r.items.length === 0) return
                  setMessages((cur) => mergeIncoming(cur, r.items))
                  lastSinceRef.current = r.items[r.items.length - 1].created_at
                }).catch(() => { /* swallow */ })
              }
            }).catch(() => { /* swallow */ })
          }
        }
        // 상담사 입장 직후엔 deadline 셋업 + (회원 화면에 한해) "상담사가 입장하였습니다." 알림 1회
        if (s.counselor_joined && !counselorJoinedRef.current) {
          counselorJoinedRef.current = true
          deadlineRef.current = Date.now() + s.remain_seconds * 1000
          // 본인이 회원일 때만 입장 알림. 상담사 본인은 자기가 들어온 거라 안내가 어색하므로 생략.
          if (!isMeCounselorRef.current) {
            setCounselorEntered(true)
            // m2net START_CHAT push 가 백엔드에 도착하면 backend 가 DB 에 "상담사가 입장하였습니다."
            // 시스템 메시지(message_type=3)를 INSERT 한다. 폴링이 CNCH 전환을 감지한 이 순간
            // 즉시 listMessagesSince 로 그 시스템 메시지를 가져와 화면에 표시한다.
            // (이전엔 다음 wss 메시지가 도착할 때까지 기다려야 보였던 버그를 차단.)
            const since = lastSinceRef.current
            chatApi
              .listMessagesSince(chatRoomId, since ?? undefined)
              .then((r) => {
                if (cancelled || r.items.length === 0) return
                setMessages((cur) => mergeIncoming(cur, r.items))
                lastSinceRef.current = r.items[r.items.length - 1].created_at
              })
              .catch(() => { /* swallow */ })
          }
        } else if (s.counselor_joined && deadlineRef.current) {
          // 이미 진행 중 — 폴링과 tick 차이로 서버 remain_seconds 가 매번 5~10초 단위로 점프한다.
          // 따라서 클라이언트 카운트와 비교해 **충전 반영(서버가 더 큼)** 또는 **현격한 어긋남
          // (>=15초)** 인 경우에만 재정렬. 작은 드리프트는 클라이언트 카운트 그대로 유지해
          // UX 상 매끄러운 카운트다운 보장.
          const clientRemain = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000))
          const diff = s.remain_seconds - clientRemain
          if (diff >= 5) {
            // 서버가 회원이 충전을 했거나 alloc 가 늘었음 → 즉시 반영
            deadlineRef.current = Date.now() + s.remain_seconds * 1000
          } else if (diff <= -15) {
            // 클라이언트가 너무 앞서감 — 서버 값으로 강제 정렬 (안전판)
            deadlineRef.current = Date.now() + s.remain_seconds * 1000
          }
          // 그 외 -14 ~ 4초 범위 차이는 무시 → 매 5초마다 점프 안 함.
        }
        // 상담사 미입장 — 정적 표시
        if (!s.counselor_joined) {
          setRemainingSec(s.remain_seconds)
          return
        }
        // 진행 중 — deadline 기반 표시
        if (deadlineRef.current) {
          const left = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000))
          setRemainingSec(left)
        }
      } catch {
        // 일시적 실패는 무시 — 다음 폴링에서 재시도
      }
    }

    // 1초 tick (UI 표시용)
    const uiInterval = window.setInterval(() => {
      if (cancelled) return
      if (deadlineRef.current && counselorJoinedRef.current) {
        const left = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000))
        setRemainingSec(left)
        // [2026-05-23] 5분 전(300초) 도달 시 1회 경고 시스템 메시지
        if (!fiveMinuteShownRef.current && left > 0 && left <= 300) {
          fiveMinuteShownRef.current = true
          setFiveMinuteWarning(true)
        }
        if (left === 0) {
          setChatStatus('ended-points')
          deadlineRef.current = null
        }
      }
    }, 1000)

    // 폴링 (서버 상태) — 상담사 입장 전엔 1.5초 간격으로 빠르게 (입장 즉시 시스템 메시지 표시),
    // 입장 후엔 5초로 완화. 매 tick 마다 counselorJoinedRef 를 보고 다음 주기 결정.
    fetchStatus()
    let pollInterval: number | null = null
    const schedulePoll = () => {
      const delay = counselorJoinedRef.current ? 5000 : 1500
      pollInterval = window.setTimeout(async () => {
        if (cancelled) return
        await fetchStatus()
        if (cancelled) return
        // [2026-05-23] 안 읽음 read_at 동기화 — 5초 polling 안에 전체 메시지 재조회.
        //   since 없이 호출해 옛 본인 메시지의 read_at 도 가져옴 → mergeIncoming 이 "1" 제거.
        //   counselor 입장 후에만 실행. 운영 규모상 비용 무관.
        if (counselorJoinedRef.current) {
          chatApi.listMessagesSince(chatRoomId)
            .then((res) => {
              if (cancelled || res.items.length === 0) return
              setMessages((cur) => mergeIncoming(cur, res.items))
            })
            .catch(() => { /* swallow */ })
        }
        schedulePoll()
      }, delay)
    }
    schedulePoll()

    // 10초 tick (서버 use_seconds 누적) — 상담사 입장 후 + **회원 화면에서만** 호출.
    //   양쪽이 동시에 호출하면 use_seconds 가 20초/10초로 누적되어 잔여시간이 2배로 줄어들고
    //   회원/상담사 화면 동기화도 깨진다. 회원 화면 1곳에서만 호출하면 서버는 단일 소스.
    const tickInterval = isMeCounselorRef.current
      ? null
      : window.setInterval(async () => {
          if (cancelled || !counselorJoinedRef.current) return
          const now = Date.now()
          if (now - lastTickAtRef.current < 9000) return // 안전 가드
          lastTickAtRef.current = now
          try {
            const r = await chatApi.tick(chatRoomId)
            if (cancelled) return
            if (!r.success && r.reason === 'no_remain') {
              setChatStatus('ended-points')
              deadlineRef.current = null
            }
          } catch {
            /* swallow */
          }
        }, 10_000)

    return () => {
      cancelled = true
      window.clearInterval(uiInterval)
      if (pollInterval !== null) window.clearTimeout(pollInterval)
      if (tickInterval !== null) window.clearInterval(tickInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRoomId, chatStatus, wssEnabled])

  // 자동 하단 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  // ─────────────────────────────────────────────
  // 자동 종료 처리 (Issue 1)
  //
  //  진입 후 다음 케이스에서는 채팅을 자동으로 종료한다:
  //   (a) 페이지 unmount (back 버튼 / 라우트 이동)            ← Effect B
  //   (b) 탭/앱 종료 (beforeunload, pagehide)                ← Effect A
  //   (c) 앱이 백그라운드로 5분 이상 머무름 (visibilitychange) ← Effect A
  //
  //  처리:
  //   - wss room_out_req 송신 (m2net 측 정상 종료 트리거)
  //   - chatApi.leave 로 자체 DB chat_room.status='DISCONNECT' 마킹 (sendBeacon 폴백 포함)
  //
  //  주의: 단일 effect 로 묶으면 deps(특히 sendRoomOut, wssEnabled) 변경 시마다
  //  cleanup 이 fireEnd 를 호출해 진입 직후 방이 즉시 종료되어 버린다. 따라서
  //  - Effect A: 활성 상태에서만 lifecycle 리스너 등록/해제 (cleanup 은 listener 만 정리)
  //  - Effect B: 컴포넌트 unmount 한 번만 leave (deps=[] + 최신값 ref)
  //  로 명확히 분리한다.
  // ─────────────────────────────────────────────
  const sendRoomOutRef = useRef<() => void>(() => {})
  const chatStatusRef = useRef<ChatStatus>(chatStatus)
  const chatRoomIdRef = useRef<number>(chatRoomId)
  const wssEnabledRef = useRef<boolean>(wssEnabled)
  sendRoomOutRef.current = () => sendRoomOut()
  chatStatusRef.current = chatStatus
  chatRoomIdRef.current = chatRoomId
  wssEnabledRef.current = wssEnabled

  /**
   * 종료 트리거 — 뒤로가기/탭종료/백그라운드 시 호출 (회원에 한함).
   *
   * 정책 변경(2026-05): m2net END_CHAT push 가 누락되어 정산이 일어나지 않는 사각지대가
   * 빈번해서, 회원이 채팅창을 벗어나는 순간 mode='close' 로 즉시 종료+정산한다.
   * sample 은 'soft'+m2net push 모델이지만 우리는 push 의존성을 끊고 자체 정산을 신뢰한다.
   * (settleChatRoomLocal 은 consultation.roomid 멱등 가드로 중복 정산 안전.)
   *
   * 명시적 "상담종료" 버튼도 동일한 mode='close' 경로를 사용한다.
   */
  const fireEndRef = useRef<(useBeacon: boolean) => void>(() => {})
  fireEndRef.current = (useBeacon: boolean) => {
    if (chatStatusRef.current !== 'active') return
    if (!wssEnabledRef.current) return
    const id = chatRoomIdRef.current
    // ⚠️ sendRoomOut(wss room_out_req) 호출 금지 — m2net 측 세션 즉시 종료는 backend
    //    markLeave(close) 가 END_CHAT push 와 동등하게 동작하므로 wss 메시지 별도로 보낼 필요 없음.
    const body = JSON.stringify({ mode: 'close' })
    if (useBeacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const url = `${API_BASE}/user/chat/rooms/${id}/leave`
      try {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      } catch {
        /* swallow */
      }
    } else {
      chatApi.leave(id, 'close').catch(() => { /* swallow */ })
    }
  }

  // Effect A — lifecycle 이벤트 리스너 (cleanup 에선 listener 만 제거, leave 호출 X)
  useEffect(() => {
    if (chatStatus !== 'active' || !wssEnabled) return

    let bgTimer: number | null = null
    const BG_GRACE_MS = 5 * 60 * 1000 // 5분

    // 탭/앱 종료 — grace 무시하고 즉시 leave (sendBeacon).
    // [2026-05-30] STAY 상태(상담사 미입장)에선 즉시 leave 호출 X — autoCancelStaleChats(3분)가 처리.
    //   refresh / pagehide / beforeunload 가 모두 같은 이벤트로 발화되는데, 사용자가 단순 새로고침한
    //   경우에도 종료되는 사고가 발생 (사장님 보고 2026-05-30). F 정책(상담사 입장 전 차감 0) 과 일관.
    const maybeFireEnd = (immediate: boolean) => {
      if (counselorJoinedRef.current || isMeCounselor) {
        fireEndRef.current(immediate)
      }
      // STAY + 회원 = 종료 호출 안 함. 3분 cron 이 자동 취소.
    }
    const onPageHide = () => { flushPendingLeaveImmediate(); maybeFireEnd(true) }
    const onBeforeUnload = () => { flushPendingLeaveImmediate(); maybeFireEnd(true) }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // [2026-05-23] 상담사 미입장(STAY) 상태에서 회원이 다른 화면 이동 시 즉시 soft leave.
        //   → 백엔드 try_out=TRUE 마킹 → 상담사가 입장해도 use_seconds 누적 차단 →
        //     회원 모르는 사이 차감되는 사고 차단.
        //   상담사 입장 후(CNCH)에는 기존 5분 grace 유지 (잠깐 다른 앱 봐도 진행).
        if (!counselorJoinedRef.current && !isMeCounselor) {
          const id = chatRoomIdRef.current
          chatApi.leave(id, 'soft').catch(() => { /* swallow */ })
        } else {
          bgTimer = window.setTimeout(() => fireEndRef.current(false), BG_GRACE_MS)
        }
      } else if (document.visibilityState === 'visible') {
        if (bgTimer) {
          window.clearTimeout(bgTimer)
          bgTimer = null
        }
        // [2026-05-23] STAY 상태에서 visible 복귀 시 rejoin → try_out=FALSE 복원.
        if (!counselorJoinedRef.current && !isMeCounselor) {
          const id = chatRoomIdRef.current
          chatApi.rejoin(id).catch(() => { /* swallow */ })
        }
      }
    }

    // [2026-05-30] RN WebView 에서 visibilitychange 가 발화 안 되는 케이스 보완 안전망.
    //   사용자가 다른 앱으로 이탈 시 blur 는 발화 가능성 높음 → soft leave 호출.
    //   거짓 양성 (키보드 포커스 변경) 위험 있지만 soft leave 는 멱등이고
    //   focus 복귀 시 rejoin 으로 자동 복원되므로 부작용 미미.
    const onBlur = () => {
      if (!counselorJoinedRef.current && !isMeCounselor) {
        const id = chatRoomIdRef.current
        chatApi.leave(id, 'soft').catch(() => { /* swallow */ })
      }
    }
    const onFocus = () => {
      if (!counselorJoinedRef.current && !isMeCounselor) {
        const id = chatRoomIdRef.current
        chatApi.rejoin(id).catch(() => { /* swallow */ })
      }
    }

    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      if (bgTimer) window.clearTimeout(bgTimer)
      // ⚠️ leave 는 호출하지 않는다. Effect B 의 unmount cleanup 이 일괄 처리.
    }
  }, [chatStatus, wssEnabled])

  // Effect B — unmount(라우트 이동/back) 시 leave 처리.
  //
  // 정책:
  //  - 회원: 30초 grace 로 leave 예약 (짧게 이탈 후 복귀 시 끊기지 않게).
  //  - 상담사: leave 를 호출하지 않는다. 상담사는 명시적 '상담종료' 버튼으로만 종료.
  //    뒤로가기/앞닫기 는 wss 만 끊고 DB 상태(STAY/CNCH) 유지 → 같은 방 재접속 가능.
  //    이렇게 해야 상담사가 잠시 다른 화면 갔다가 돌아와도 메시지 전송이 막히지 않음.
  useEffect(() => {
    return () => {
      const id = chatRoomIdRef.current
      // 상담사는 unmount 시 leave 안 함.
      if (isMeCounselorRef.current) return
      if (chatStatusRef.current !== 'active' || !wssEnabledRef.current) return
      // unmount cleanup 시 close 정산 트리거. m2net END_CHAT push 누락에 따른 정산 사각지대
      // 차단을 위해 회원이 채팅창에서 벗어나는 순간 즉시 settleChatRoomLocal 호출.
      // (재입장이 필요한 케이스는 ConsultModal → 새 chat_room 생성 흐름으로 대응.)
      chatApi.leave(id, 'close').catch(() => { /* swallow */ })
    }
  }, [])

  // active → ended/ended-points 전환 시 자동으로 종료 팝업 띄우기.
  // 처음 진입부터 종료 상태였던 다시보기 케이스는 initiallyEndedRef 가 true 라 안 띄움.
  useEffect(() => {
    if (initiallyEndedRef.current) return
    if (chatStatus === 'ended') setEndedAlertOpen(true)
    if (chatStatus === 'ended-points') setPointsAlertOpen(true)

    // [2026-06-07] 상담 종료 직후 상담사 등급 승급 확인 (출석 토스트 패턴).
    // 상담사가 상담을 마친 직후 → 미확인 승급 있으면 sessionStorage → GradeUpgradeToast 가 1회 표시.
    if (isMeCounselor && (chatStatus === 'ended' || chatStatus === 'ended-points')) {
      counselorGradeApi.pendingUpgrade().then((r) => {
        if (r?.upgrade) {
          sessionStorage.setItem(GRADE_UPGRADE_STORAGE_KEY, JSON.stringify({
            grade_label: r.upgrade.grade_label,
            hours: r.upgrade.hours,
          }))
        }
      }).catch(() => { /* 승급 확인 실패 — 무시 */ })
    }
  }, [chatStatus, isMeCounselor])

  // 상담사 백키 가드 — 상담사가 활성 채팅 중일 때 브라우저/앱 백키를 그대로 두면
  // wss 가 끊기고 m2net 측 세션과 어긋나 재진입 시 채팅이 안 된다.
  // 따라서 popstate 이벤트를 가로채 "상담을 종료하시겠습니까?" 컨펌을 띄우고,
  // 종료 의사가 명확할 때만 handleEnd 로 진행한다.
  useEffect(() => {
    if (!isMeCounselor) return
    if (chatStatus !== 'active') return
    if (!wssEnabled) return

    // history 에 dummy state 를 하나 푸시해 두면, 백키 시 popstate 가 발생하고
    // URL 은 그대로 유지된다. 컨펌에서 '취소' 면 다시 pushState 로 dummy 보충.
    window.history.pushState({ __chatGuard: true }, '')

    const onPopState = (_e: PopStateEvent) => {
      // 상담사가 종료할 의사가 없으면 dummy state 복원 → 화면 유지.
      // 컨펌 모달을 띄우고, 종료 클릭 시 handleEnd 가 명시적으로 navigate(-2) 처리.
      window.history.pushState({ __chatGuard: true }, '')
      setEndConfirmOpen(true)
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [isMeCounselor, chatStatus, wssEnabled])

  // textarea auto-grow
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 24 // 2026-05-30 폰트 16px / 줄높이 24px 로 동기
    const maxHeight = lineHeight * MAX_INPUT_ROWS
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`
  }, [input])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    if (chatStatus !== 'active') return

    setInput('')
    // wss 송신 — 상대방 화면이 즉시 onMessage 받아 listMessagesSince 트리거.
    sendText(text)
    // DB INSERT (단일 진실 원천) — 응답으로 받은 row 를 즉시 mine 으로 화면에 추가.
    try {
      const inserted = await chatApi.sendMessage(chatRoomId, text)
      lastSinceRef.current = inserted.created_at
      const ts = new Date(inserted.created_at).getTime() || Date.now()
      setMessages((cur) => {
        const dbId = `db-${inserted.id}`
        if (cur.some((m) => m.id === dbId)) return cur
        return [
          ...cur,
          {
            id: dbId,
            type: 'mine',
            text,
            isImage: false,
            isHtml: false,
            time: formatTime(inserted.created_at),
            ts,
          },
        ]
      })
    } catch {
      /* DB INSERT 실패 — 메시지는 wss 로 갔지만 우리 화면엔 안 보임. 사용자가 재전송 가능. */
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void onSend()
    }
  }

  const handleEnd = async () => {
    setEndConfirmOpen(false)
    // 명시적 상담종료 — m2net 측 wss 세션 정상 종료 (room_out_req) + 백엔드는 mode='close' 로 호출
    // (status='DISCONNECT' + 정산 발동).
    try {
      sendRoomOut()
    } catch { /* swallow */ }
    try {
      await chatApi.leave(chatRoomId, 'close')
    } catch {
      /* swallow */
    }
    setChatStatus('ended')
  }

  // 헤더 타이틀 — 회원이 보면 상담사명, 상담사가 보면 회원명.
  const headerName = isMeCounselor
    ? room?.member_nickname ?? room?.member_name ?? '회원'
    : room?.counselor_nickname ?? room?.counselor_name ?? navState?.counselor?.name ?? '상담사'
  // 헤더의 상대방 역할 라벨 — 본인이 상담사면 상대는 회원, 본인이 회원이면 상대는 상담사
  const headerRoleLabel = isMeCounselor ? '회원' : '상담사'
  const timerText = remainingSec !== null ? formatTimer(remainingSec) : null
  // 상담사 미입장(STAY) 상태에서만 대기 안내 표시. CNCH 로 전환되는 순간 자동으로 사라진다.
  const counselorWaiting = chatStatus === 'active' && !counselorJoinedRef.current && wssEnabled
  // 회원 관점이면 "상담사가 입장하면…", 상담사 본인 관점이면 "회원이 대기중입니다."
  // 후자는 매뉴얼 정의는 아니지만 상담사 화면에 "상담사가 입장하면…" 이 나오는 모순을 막기 위함.
  const waitingText = isMeCounselor
    ? '회원이 대기중입니다. 인사말로 상담을 시작해주세요.'
    : '상담사가 입장하면 상담이 시작됩니다.'

  // [2026-05-27] 5분 잔여 알림 감지 — 새 [ALERT_5MIN] 시스템 메시지 등장 시 1회 모달 + 사운드/진동/TTS
  useEffect(() => {
    const seen = fiveMinAlertSeenRef.current
    const newAlert = messages.find((m) => m.isFiveMinAlert && !seen.has(m.id))
    if (!newAlert) return
    seen.add(newAlert.id)
    // [엄격검증 3차 fix 2026-05-27 T-3] 페이지 이동 후 복귀 시 중복 발화 방지
    try { sessionStorage.setItem(fiveMinSeenKey, JSON.stringify(Array.from(seen))) } catch { /* ignore */ }
    // [2026-05-30] 본문에서 라벨 추출 — alloc<5분(1분 테스트 등)이면 "30초", 평소 "5분"
    const label: '30초' | '5분' = newAlert.text.includes('30초') ? '30초' : '5분'
    setFiveMinAlertLabel(label)
    setFiveMinAlertOpen(true)
    // 사운드 (Web Audio API 짧은 beep — mp3 자산 없이 즉시 효과)
    // [엄격검증 6차 fix 2026-05-27] iOS Safari: suspended → resume() fallback
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      const ctx = new Ctx()
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { /* iOS pre-interaction 차단 */ })
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.value = 0.15
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      setTimeout(() => { osc.stop(); ctx.close().catch(() => {}) }, 350)
    } catch { /* AudioContext unsupported */ }
    // TTS — Web Speech API 한국어 음성
    // [엄격검증 2차 fix 2026-05-27] 상담사는 충전 X — 마무리 안내 멘트로 분리.
    try {
      if ('speechSynthesis' in window) {
        const ttsBody = isMeCounselorRef.current
          ? `${label} 남았어요. 마무리 멘트를 안내해주세요.`
          : `${label} 남았어요. 충전하시면 끊김 없이 계속 상담 가능합니다.`
        const utt = new SpeechSynthesisUtterance(ttsBody)
        utt.lang = 'ko-KR'
        utt.rate = 1.0
        utt.pitch = 1.0
        window.speechSynthesis.speak(utt)
      }
    } catch { /* TTS unsupported */ }
    // 진동 — 200ms ON / 100 OFF / 200 ON 패턴
    try {
      if ('vibrate' in navigator) (navigator as Navigator & { vibrate: (p: number[]) => boolean }).vibrate([200, 100, 200])
    } catch { /* vibrate unsupported */ }
  }, [messages])

  // 5분 알림 모달의 충전 버튼 — 결제 후 자동 채팅 복귀 위해 sessionStorage 에 chatRoomId 저장
  // [엄격검증 4차 fix 2026-05-27 Q-3] timestamp 같이 저장 → ChargeComplete 30분 TTL
  const handleChargeFromAlert = () => {
    try {
      sessionStorage.setItem('chatReturnRoomId', String(chatRoomId))
      sessionStorage.setItem('chatReturnRoomIdAt', String(Date.now()))
    } catch { /* storage unsupported */ }
    setFiveMinAlertOpen(false)
    navigate('/mypage/charge')
  }

  // 로그인 가드 — 인증 미확인/비로그인 동안엔 본문 렌더 보류 (위 useEffect 가 redirect 한다).
  if (authLoading || !member) {
    return (
      <div className="mobile-frame flex items-center justify-center h-screen bg-white">
        <p className="text-[14px] text-[#99A1AF]">불러오는 중…</p>
      </div>
    )
  }

  return (
    // [2026-05-23] sticky 가 모바일 웹뷰에서 밀려 올라가는 이슈 → header 를 fixed 로 강제 고정.
    //                fixed 는 viewport 기준이라 mobile-frame max-w(560px) 와 동일한 폭으로
    //                left-1/2 + -translate-x-1/2 가운데 정렬. 메시지 영역엔 pt-[60px] 추가.
    <div className="mobile-frame flex flex-col h-[100dvh] bg-[#fdf2f8]">
      {/* 헤더 — fixed top-0 으로 viewport 상단에 강제 고정.
          + visualViewport.offsetTop 동적 보정 (안드로이드 키보드 pan 모드 회피) */}
      <header ref={headerRef} className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] h-[60px] px-4 flex items-center gap-3 z-30 bg-white border-b border-[#F3F4F6]">
        <button
          type="button"
          onClick={() => {
            // 활성 채팅 중에 헤더 뒤로가기 누르면 종료 컨펌을 띄운다.
            //  - 회원: 잠시 이탈일 수도 있지만, 뒤로가기 = 종료 의도일 가능성이 더 크므로
            //    "상담을 종료하시겠습니까?" 알럿을 한 번 확인. 취소 시 채팅 유지.
            //  - 상담사: 명시적 종료 정책 그대로 (뒤로가기 ≠ 자동 종료).
            // 이미 종료/비활성 상태면 컨펌 없이 바로 뒤로.
            if (chatStatus === 'active' && wssEnabled) {
              setEndConfirmOpen(true)
              return
            }
            navigate(-1)
          }}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712] flex items-center gap-1.5">
          <span>{headerName}</span>
          <span className="text-[14px] font-medium text-[#ec4899]">{headerRoleLabel}</span>
        </h1>
        {/*
          잔여시간 표시는 회원에게만 (상담사는 받는 주체 — 본인 포인트 아님).
          tick API 도 회원만 호출 (양쪽 동시 호출 시 use_seconds 2배 차감).
          상담종료 버튼은 회원/상담사 양쪽 노출:
            - 회원: 자기 의지로 종료 (포인트 절약)
            - 상담사: 명시적 종료 — 뒤로가기 ≠ 종료 정책이라 명시 버튼이 필요.
        */}
        {/* [2026-05-23] 상담사도 동일한 타이머 표시 — 회원 잔액 기반 카운트다운.
            "남은 시간" 라벨 + 시간으로 명확한 안내. */}
        {chatStatus === 'active' && timerText && (
          <span className="inline-flex items-baseline gap-1">
            <span className="text-[12px] font-medium text-[#6A7282]">남은 시간</span>
            <span className="text-[18px] leading-[120%] font-medium text-[#ec4899] tabular-nums">
              {timerText}
            </span>
          </span>
        )}
        {chatStatus === 'active' && (
          <button
            type="button"
            onClick={() => setEndConfirmOpen(true)}
            className="h-8 px-3 rounded-full bg-white border border-[#f472b6] text-[#ec4899] text-[14px] font-medium"
          >
            상담종료
          </button>
        )}
      </header>

      {/* 메시지 영역 — [2026-05-23] flex-end 정렬로 키보드 올라와도 초기 메시지 가려지지 않음.
          줄간 간격 압축. fixed 헤더 가림 방지 pt-[60px].
          배경 워터마크는 메시지 컨테이너 밑(absolute 자식)으로 분리 → flex-end 와 무관하게 보임. */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-4 pt-[60px] pb-[88px] flex flex-col justify-end gap-1 [&>*:not([aria-hidden])]:relative [&>*:not([aria-hidden])]:z-10"
      >
        {/* 배경 워터마크 — viewport 기준 fixed 로 4개만 지그재그 배치.
            스크롤해도 항상 같은 4점에 보임 (텍스처 느낌 + 답답함 X). */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] z-0"
          style={{
            backgroundImage:
              "url('/img/logo_b.svg'), url('/img/logo_b.svg'), url('/img/logo_b.svg'), url('/img/logo_b.svg')",
            backgroundPosition: '10% 18%, 90% 40%, 10% 62%, 90% 84%',
            backgroundSize: '150px auto, 150px auto, 150px auto, 150px auto',
            backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
            opacity: 0.08,
          }}
        />
        {error && (
          <div className="flex justify-center">
            <span className="text-[13px] text-[#FB2C36]">{error}</span>
          </div>
        )}
        {counselorWaiting && <SystemPill text={waitingText} />}
        {/* [2026-05-23] 회원 대기 정보 안내 — 자동 차감 시작 + 3분 미응답 자동 취소.
            회원이 다른 화면 이동 시 자동 이탈 감지로 차감 차단됨 (안전).
            상담사 본인은 노출 X. 상담사 입장(CNCH) 시 자동 사라짐. */}
        {counselorWaiting && !isMeCounselor && (
          <div className="mx-2 my-1 rounded-[16px] bg-[#fdf2f8] border border-[#fbcfe8] p-4">
            <p className="text-[14px] font-semibold text-[#9d174d] leading-[150%] mb-2">
              ⏱ 상담사를 기다리는 중...
            </p>
            <p className="text-[13px] font-semibold text-[#9d174d] leading-[160%] mb-1">
              ✓ 지금은 코인이 차감되지 않습니다.
            </p>
            <p className="text-[12.5px] leading-[180%] text-[#9d174d]">
              상담사가 입장하면 그때부터 채팅이 시작되며 코인이 차감됩니다.<br />
              <span className="text-[11.5px] text-[#be185d]">
                · 3분 이내 응답이 없으면 요청이 자동 취소됩니다.<br />
                · 상담 중 다른 화면으로 이동하시면 차감이 자동 중지됩니다.<br />
                · 비정상적으로 채팅방을 벗어나셔도 3분 안에 돌아오시면 계속 가능합니다.<br />
                · 종료 버튼을 누르시면 즉시 종료됩니다.
              </span>
            </p>
          </div>
        )}
        {/* 매뉴얼 §4.5 START_CHAT push 시점 = 상담사 실제 입장.
            폴링이 status STAY→CNCH 전환을 감지한 순간 회원 화면에만 1회 표시. */}
        {counselorEntered && !isMeCounselor && (
          <SystemPill text="상담사가 입장하였습니다." />
        )}
        {/* [2026-05-23] 5분 전 경고 — 회원/상담사 모두 표시 (양쪽 인지) */}
        {fiveMinuteWarning && (
          <SystemPill text={`⏰ 상담 종료 ${fiveMinAlertLabel} 남았습니다.`} />
        )}
        {/* 메시지 렌더 — other 타입은 senderId 기반 상대방 아바타/이름 채워 넘김.
            상담사 화면에서는 회원 프로필 사진, 회원 화면에서는 상담사 프로필 사진.
            프로필 미등록 시 기본 사주플랜 아바타(/img/sample_img03.jpg) 사용.
            연속 발화 그룹화는 일부러 안 함 — 매 메시지마다 sender 정보 채워서 항상 표시. */}
        {messages.map((m) => {
          let withSender = m
          if (m.type === 'other') {
            // senderId 가 있으면 그것 기준, 없으면 본인 역할의 반대로 추정.
            // (sender_id 가 NULL 인 시스템 메시지는 위에서 type='system' 분기됨)
            let fromCounselor: boolean
            if (m.senderId != null && room) {
              fromCounselor = m.senderId === room.counselor_id
            } else {
              fromCounselor = !isMeCounselor // 회원 본인 화면이면 상대는 상담사
            }
            const senderName = fromCounselor
              ? (room?.counselor_nickname ?? room?.counselor_name ?? '상담사')
              : (room?.member_nickname ?? room?.member_name ?? '회원')
            const profileImg = fromCounselor
              ? room?.counselor_profile_image
              : room?.member_profile_image
            // 프로필 미등록 회원은 기본 사람 아이콘으로 표시 (엑박 방지)
            const avatar = profileImg && profileImg.length > 0
              ? profileImg
              : '/img/avatar_default.svg'
            withSender = { ...m, sender: { name: senderName, avatar } }
          }
          return <MessageItem key={m.id} message={withSender} />
        })}
        {chatStatus === 'ended' && <SystemPill text="상담이 종료되었습니다." />}
        {chatStatus === 'ended-points' && (
          <SystemPill text="코인 소진으로 상담이 종료되었습니다." />
        )}
      </div>

      {/* 입력창 — 2026-05-30 가독성 강화 (사장님 보고: 키보드 자동완성과 겹쳐 보임)
          - 폰트 16px (모바일 표준) + 줄높이 24px
          - 흰 배경 + 진한 보더로 자동완성 영역과 시각 분리
          - 최소 높이 48px (터치 영역 충분히)
          - 상단 보더로 메시지 영역과 분리
          [2026-05-30] fixed bottom-0 — 메시지 흐름에 밀리지 않고 viewport 하단 강제 고정 (헤더와 동일 패턴).
          사장님 보고: 상대방 글이 계속 오면 입력창이 밀려나서 못 보임. fixed 로 항상 같은 위치. */}
      {chatStatus === 'active' && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-white px-4 py-3 flex items-end gap-2 border-t border-[#F3F4F6] z-20">
          <div className="flex-1 bg-white border-2 border-[#E5E7EB] rounded-[20px] px-4 py-2.5 flex items-end min-h-[48px] focus-within:border-[#f472b6] transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="메세지를 입력하세요"
              rows={1}
              className="flex-1 bg-transparent text-[16px] leading-[24px] text-[#1E2939] placeholder:text-[#99A1AF] resize-none outline-none overflow-y-auto"
              style={{ maxHeight: `${24 * MAX_INPUT_ROWS}px` }}
            />
          </div>
          {input.trim() && (
            <button
              type="button"
              onClick={() => void onSend()}
              aria-label="전송"
              className="w-9 h-9 rounded-full bg-[#f472b6] flex items-center justify-center shrink-0"
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
      )}

      {/* [2026-05-30] 종료 상태 — 입력창 자리에 풀폭 "채팅방 나가기" 버튼.
          알럿을 외부 클릭으로 닫거나 다시 진입한 경우에도 출구가 항상 보이도록.
          사장님 보고: 테스터가 종료 후 헤더 작은 화살표 외 출구를 못 찾음. */}
      {chatStatus !== 'active' && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-white px-4 py-3 border-t border-[#F3F4F6] z-20">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full h-12 rounded-full bg-[#f472b6] text-white text-[15px] font-bold"
          >
            채팅방 나가기
          </button>
        </div>
      )}

      {/* [2026-05-27] 5분 잔여 알림 모달 — 채팅 시간 5분 진입 시 1회 표시.
          [엄격검증 2차 fix 2026-05-27] 상담사는 코인 충전 X — 마무리 안내 + [확인] 1버튼만. */}
      {fiveMinAlertOpen && (
        <CenterModal onBackdropClick={() => setFiveMinAlertOpen(false)}>
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#fdf2f8] flex items-center justify-center text-[36px]">
            ⏰
          </div>
          <h3 className="text-[20px] leading-[130%] font-bold text-[#030712] text-center">
            {isMeCounselor ? `회원 ${fiveMinAlertLabel} 남았어요` : `${fiveMinAlertLabel} 남았어요`}
          </h3>
          <p className="mt-2 text-[14px] leading-[150%] text-[#4A5565] text-center">
            {isMeCounselor ? (
              <>마무리 멘트<br />안내 부탁드립니다</>
            ) : (
              <>충전하시면 끊김 없이<br />계속 상담 가능합니다</>
            )}
          </p>
          <div className="flex items-center gap-2 mt-5 w-full">
            {isMeCounselor ? (
              <button
                type="button"
                onClick={() => setFiveMinAlertOpen(false)}
                className="flex-1 h-12 rounded-full bg-[#f472b6] text-white text-[15px] font-bold"
              >
                확인
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setFiveMinAlertOpen(false)}
                  className="flex-1 h-12 rounded-full bg-white border border-[#E5E7EB] text-[#1E2939] text-[14px] font-medium"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleChargeFromAlert}
                  className="flex-1 h-12 rounded-full bg-[#f472b6] text-white text-[15px] font-bold"
                >
                  💳 충전하기
                </button>
              </>
            )}
          </div>
        </CenterModal>
      )}

      {/* 상담종료 컨펌 모달 */}
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
              onClick={() => void handleEnd()}
              className="flex-1 h-11 rounded-full bg-[#f472b6] text-white text-[14px] font-medium"
            >
              상담종료
            </button>
          </div>
        </CenterModal>
      )}

      {/*
        상담 종료 알럿 — 본문 텍스트가 케이스에 따라 분기:
          - 포인트 소진(ended-points / pointsAlertOpen)  → "충전된 코인이 모두 소진되어\n상담이 종료되었습니다."
          - 그 외 일반 종료(ended / endedAlertOpen)      → 부제 없이 "상담이 종료되었습니다." 만
        [2026-05-30] 2버튼화 — 사장님 보고: 테스터가 종료 후 나갈 방법을 못 찾음.
          [내용 다시 보기] 알럿만 닫고 채팅 화면 유지 (메시지 스크롤 가능)
          [채팅방 나가기] navigate(-1) 로 즉시 이탈
      */}
      {(pointsAlertOpen || endedAlertOpen) && (
        <CenterModal
          onBackdropClick={() => {
            setPointsAlertOpen(false)
            setEndedAlertOpen(false)
          }}
        >
          <AlertIcon />
          <h3 className="text-[18px] leading-[130%] font-semibold text-[#030712] text-center">
            상담이 종료되었습니다.
          </h3>
          {pointsAlertOpen && (
            <p className="text-[14px] leading-[140%] text-[#6A7282] text-center">
              충전된 코인이 모두 소진되어
              <br />
              상담이 종료되었습니다.
            </p>
          )}
          <div className="flex items-center gap-2 mt-4 w-full">
            <button
              type="button"
              onClick={() => {
                setPointsAlertOpen(false)
                setEndedAlertOpen(false)
              }}
              className="flex-1 h-11 rounded-full bg-white border border-[#E5E7EB] text-[#1E2939] text-[14px] font-medium"
            >
              내용 다시 보기
            </button>
            <button
              type="button"
              onClick={() => {
                setPointsAlertOpen(false)
                setEndedAlertOpen(false)
                navigate(-1)
              }}
              className="flex-1 h-11 rounded-full bg-[#f472b6] text-white text-[14px] font-medium"
            >
              채팅방 나가기
            </button>
          </div>
        </CenterModal>
      )}
    </div>
  )
}

/* ───────────── 헬퍼 ───────────── */

function toDisplay(m: ChatMessage): DisplayMessage {
  const ts = new Date(m.created_at).getTime() || Date.now()
  // message_type=3 = 시스템 메시지 (sample storeChat mbid='SYSTEM').
  if (m.message_type === 3) {
    const raw = m.message ?? ''
    // [2026-05-27] 5분 알림 prefix 감지 → 별도 flag + prefix 제거.
    // [2026-05-30] 본문 동적 — 짧은 alloc(예: 1분 테스트) 시 백엔드가 "30초 안내" 로 INSERT.
    //   prefix 떼고 본문 그대로 사용해 30초 / 5분 자동 분기.
    if (raw.startsWith('[ALERT_5MIN]')) {
      const body = raw.substring('[ALERT_5MIN]'.length).trim() || '잔여 시간 5분 안내'
      return {
        id: `db-${m.id}`,
        type: 'system',
        text: `⏰ ${body}`,
        ts,
        isFiveMinAlert: true,
      }
    }
    // dedup_key prefix `[evt-actor-id-window]` 만 제거. 사용자 닉네임 [홍길동] 같은 건 보존.
    // 패턴1: 영문 prefix - 영문/숫자 - 숫자 (선택) - 숫자 시간 슬롯  (leave/rejoin/peer*)
    // 패턴2: csr-entered-{chatRoomId}                               (m2net START_CHAT 시스템 메시지)
    const stripped = raw
      .replace(/^\[(leave|rejoin|peerin|peerout|peer)-[a-zA-Z]+(?:-\d+)?-\d+\]\s*/, '')
      .replace(/^\[csr-entered-\d+\]\s*/, '')
    return {
      id: `db-${m.id}`,
      type: 'system',
      text: stripped,
      ts,
    }
  }
  // [img] prefix 또는 message_type=2 면 이미지로
  const raw = m.message ?? ''
  const parsed = parseMessageContent(raw, m.message_type === 2)
  return {
    id: `db-${m.id}`,
    type: m.is_mine ? 'mine' : 'other',
    text: parsed.text,
    isImage: parsed.isImage,
    isHtml: parsed.isHtml,
    time: formatTime(m.created_at),
    ts,
    senderId: m.sender_id ?? null,
    // [2026-05-23] 안 읽음 표시 — read_at IS NULL 이면 read=false → "1" 표시
    read: !!m.read_at,
  }
}

function mergeIncoming(cur: DisplayMessage[], incoming: ChatMessage[]): DisplayMessage[] {
  // [2026-05-23] 같은 id 메시지의 read_at 갱신 — 본인 메시지의 "1" 자동 제거.
  const incomingMap = new Map<string, ChatMessage>()
  for (const m of incoming) incomingMap.set(`db-${m.id}`, m)
  cur = cur.map((c) => {
    const inc = incomingMap.get(c.id)
    if (!inc) return c
    const newRead = !!inc.read_at
    if (c.read === newRead) return c
    return { ...c, read: newRead }
  })

  const ids = new Set(cur.map((c) => c.id))
  // wss echo (wss-* id) 와 DB row (db-* id) 가 같은 메시지를 중복 표시하는 케이스를 막기 위해
  // (type, normalized text, ts ±5s) 키로도 dedup. wss echo 의 ts 는 클라이언트가 정한 값이라
  // DB created_at 과 정확히 같지 않을 수 있으므로 ±5초 윈도우.
  const norm = (s: string) => s.replace(/^\[[^\]]+\]\s*/, '').trim()
  const sigOf = (m: DisplayMessage): string =>
    `${m.type}|${norm(m.text)}|${Math.floor(m.ts / 5000)}`
  const sigs = new Set(cur.map(sigOf))
  const add: DisplayMessage[] = []
  for (const m of incoming) {
    const id = `db-${m.id}`
    if (ids.has(id)) continue
    const dm = toDisplay(m)
    if (sigs.has(sigOf(dm))) continue
    add.push(dm)
    sigs.add(sigOf(dm))
  }
  return [...cur, ...add]
}

function formatTime(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  // [2026-05-23] 1시간 미만이면 mm:ss (14:59 형식), 1시간 이상이면 h:mm:ss
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/* ───────────── 공용 ───────────── */

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

function AlertIcon() {
  return (
    <div className="w-12 h-12 rounded-full border-2 border-[#f472b6] flex items-center justify-center">
      <span className="text-[26px] leading-[100%] font-bold text-[#f472b6] mt-0.5">!</span>
    </div>
  )
}

function MessageItem({ message: m }: { message: DisplayMessage }) {
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
      // [2026-05-23] 줄간 간격 압축 — gap-1.5 → gap-0.5, 버블 px-4 py-3 → px-3 py-2
      <div className="flex flex-col gap-0.5">
        {m.sender && (
          <div className="flex items-center gap-2 ml-[4px]">
            <div className="w-8 h-8 rounded-full bg-[#E5E7EB] overflow-hidden shrink-0">
              <ChatAvatar src={m.sender.avatar} alt={m.sender.name} />
            </div>
            <span className="text-[14px] leading-[120%] font-medium text-[#1E2939]">
              {m.sender.name}
            </span>
          </div>
        )}
        <div className="flex items-end gap-2 pl-[44px]">
          <div className="bg-white rounded-[14px] px-3 py-2 max-w-[70%]">
            <MessageBody m={m} mine={false} />
          </div>
          {m.time && (
            <span className="text-[12px] leading-[110%] text-[#99A1AF] mb-0.5">{m.time}</span>
          )}
        </div>
      </div>
    )
  }

  // mine — [2026-05-23] 패딩 + 글자 크기 압축
  return (
    <div className="flex items-end justify-end gap-1.5">
      {m.read && (
        <div className="flex flex-col items-end mb-0.5 gap-0.5">
          <span className="text-[11px] leading-[100%] text-[#99A1AF]">읽음</span>
          {m.time && (
            <span className="text-[12px] leading-[110%] font-medium text-[#4A5565]">
              {m.time}
            </span>
          )}
        </div>
      )}
      {!m.read && (
        <div className="flex flex-col items-end mb-0.5 gap-0.5">
          {/* [2026-05-23] 안 읽음 표시 — 카톡 패턴의 "1" */}
          <span className="text-[11px] leading-[100%] text-[#FB2C36] font-bold">1</span>
          {m.time && (
            <span className="text-[12px] leading-[110%] text-[#99A1AF]">{m.time}</span>
          )}
        </div>
      )}
      <div className="bg-[#f472b6] rounded-[14px] px-3 py-2 max-w-[70%]">
        <MessageBody m={m} mine={true} />
      </div>
    </div>
  )
}

/**
 * sample/counsel/chat.php 의 msgOut/msgOutHtml 동등.
 *  - isImage (msg=[img]경로) → <img> 태그로 렌더
 *  - isHtml (HtmlFlag=true) → dangerouslySetInnerHTML
 *  - 그 외 → whitespace-pre-line 텍스트
 */
function MessageBody({ m, mine }: { m: DisplayMessage; mine: boolean }) {
  const textColor = mine ? 'text-white' : 'text-[#1E2939]'
  if (m.isImage) {
    return (
      <img
        src={m.text}
        alt="이미지"
        className="rounded-[8px] max-w-full max-h-[300px] object-contain"
      />
    )
  }
  if (m.isHtml) {
    return (
      <div
        className={`text-[16px] leading-[150%] ${textColor} whitespace-pre-line break-words`}
        dangerouslySetInnerHTML={{ __html: m.text }}
      />
    )
  }
  return (
    <p className={`text-[16px] leading-[150%] ${textColor} whitespace-pre-line break-words`}>
      {m.text}
    </p>
  )
}

/**
 * 채팅 메시지 좌측 아바타.
 * - 업로드 이미지가 있으면 UploadedImage (api 도메인 prefix + webp 처리)
 * - 없거나 깨졌으면 /img/avatar_default.svg (정적 자산, prefix 없이 그대로)
 */
function ChatAvatar({ src, alt }: { src: string | null | undefined; alt: string }) {
  const isDefault = !src || src.startsWith('/img/')
  const [failed, setFailed] = React.useState(false)
  if (isDefault || failed) {
    return (
      <img
        src="/img/avatar_default.svg"
        alt={alt}
        className="w-full h-full object-cover"
      />
    )
  }
  return (
    <UploadedImage
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}
