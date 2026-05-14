import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * m2net (PassCall AG9) 채팅 WebSocket 직결 훅.
 *
 * 매뉴얼 §4.5 + sample/chat_test/cn.php 의 메시지 프로토콜:
 *
 *   접속:        wss://passcall.co.kr:28729/wscp/{token}
 *   register:    { CmdTp: 'regist' }
 *   regist 응답: { CmdTp: 'cli_connect_ok', Tid, MembId, CsrId, RoomId, Cid }
 *   메시지(텍스트): { CmdTp: 'conv_msg', Msg, HtmlFlag: false }
 *   메시지(이미지): { CmdTp: 'conv_msg', Msg: <base64>, HtmlFlag: true }
 *   퇴장:        { CmdTp: 'room_out_req' }
 *   서버 → 클라 메시지: { CmdTp: 'conv_msg', FromCid, JoMsg: { Msg }, SendTime, ... }
 *
 * 호환: 매뉴얼 2023.11.15 변경분 — `cmd → msg` 변수명 변경 가능성 있음. 양쪽 다 인식.
 *
 * 재연결: 모바일 백그라운드/네트워크 단절 시 1.5s 후 자동 재시도 (최대 5회).
 *  재시도 시 onMissed 콜백을 호출해 누락 메시지 fetch 트리거 (since=lastSendTime).
 */

export type ChatSocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export interface IncomingMessage {
  /** 보낸이 m2net 부여 Cid (회원 또는 상담사). 본인이면 isMine=true */
  fromCid?: string
  /** 받는이 Cid — sample/counsel/chat.php 의 ToCid (상담 진행 트리거에 사용) */
  toCid?: string
  msg: string
  /** 'YYYY-MM-DD HH:mm:ss' (m2net) — ISO 시 변환 시도 */
  sendTime?: string
  htmlFlag?: boolean
  /** 본인 발신 여부 — 클라이언트 본인 Cid 와 비교 후 채움 */
  isMine?: boolean
  /** 시스템 공지 (FromCid<0) */
  isAnnouncement?: boolean
  /** 원본 페이로드 (디버그용) */
  raw: Record<string, unknown>
}

export interface PeerLeftEvent {
  /** 나간 사람의 CsrId (m2net 부여). */
  csrId?: string
  /** 나간 사람의 MembId */
  membId?: string
  /**
   * m2net 이 알려주는 actor 역할 — sample 의 IdTp.
   *  'csr'  → 상담사가 나감/입장
   *  'memb' → 회원이 나감/입장
   *  undefined → CsrId/MembId 만으로 추론 필요
   */
  idTp?: 'csr' | 'memb'
  /** 시스템 메시지 표시용 시간 (m2net SendTime, 없으면 클라 시각) */
  sendTime?: string
  /** 원본 페이로드 — 호출자에서 actor 식별 등에 사용 */
  raw: Record<string, unknown>
}

export interface UseChatSocketOptions {
  wssUrl: string
  memberToken: string
  /** 메시지 수신 콜백 — DB 백업 INSERT 호출은 호출자 책임 */
  onMessage: (msg: IncomingMessage) => void
  /** 재연결로 누락 가능성이 생긴 시점 */
  onReconnected?: () => void
  /** 서버 종료 통지 (room_closed / room_out_resp) — 방이 완전히 닫힘 */
  onServerEnd?: (reason?: string) => void
  /** 상대가 방에서 나감(이탈) 통지 — m2net room_out_noti. 방 자체가 종료된 건 아님. */
  onPeerLeft?: (evt: PeerLeftEvent) => void
  /** 상대 입장/재입장 통지 — m2net room_in_noti. */
  onPeerJoined?: (evt: PeerLeftEvent) => void
  /** 활성화 토글 — 종료 후엔 false 로 두면 재연결 안 함 */
  enabled: boolean
  /**
   * 강제 재연결 트리거 — 이 값이 바뀌면 effect 재실행으로 옛 ws 를 닫고 새 connection 을 연다.
   * m2net 측 세션이 어긋난 케이스(재진입, 토큰 동일 재발급 등) 에 명시적 신호로 사용.
   */
  reconnectKey?: number
}

const MAX_RETRY = 5
const RETRY_DELAY_MS = 1500
// m2net wss idle timeout (약 30초 추정) 회피용 heartbeat 주기.
// 25초마다 빈 conv_msg 또는 ping 송신 — 메시지 안 보내도 연결 유지되어
// 회원이 채팅창을 켜두기만 해도 30초 후 강제 종료되는 현상 차단.
const HEARTBEAT_MS = 25_000

export function useChatSocket(opts: UseChatSocketOptions) {
  const [status, setStatus] = useState<ChatSocketStatus>('idle')
  const wsRef = useRef<WebSocket | null>(null)
  const cidRef = useRef<string | null>(null)
  const tidRef = useRef<string | null>(null)
  const retryRef = useRef(0)
  const stoppedRef = useRef(false)
  const onMessageRef = useRef(opts.onMessage)
  const onReconnectedRef = useRef(opts.onReconnected)
  const onServerEndRef = useRef(opts.onServerEnd)
  const onPeerLeftRef = useRef(opts.onPeerLeft)
  const onPeerJoinedRef = useRef(opts.onPeerJoined)
  // cli_connect_ok 수신 전 sendText 호출 시 메시지 큐에 쌓고, 수신 직후 flush.
  // m2net 이 regist 처리 전 conv_msg 를 받으면 broadcast 가 안 되는 케이스가 있어
  // 한 번 cid 가 발급된 뒤 보내는 게 안전.
  const pendingSendsRef = useRef<string[]>([])
  const heartbeatRef = useRef<number | null>(null)
  onMessageRef.current = opts.onMessage
  onReconnectedRef.current = opts.onReconnected
  onServerEndRef.current = opts.onServerEnd
  onPeerLeftRef.current = opts.onPeerLeft
  onPeerJoinedRef.current = opts.onPeerJoined
  // forceReconnect 가 effect 내부의 connect 를 호출할 수 있도록 ref 로 노출.
  const connectRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!opts.enabled || !opts.wssUrl || !opts.memberToken) return
    stoppedRef.current = false

    const connect = () => {
      if (stoppedRef.current) return
      const url = `${opts.wssUrl.replace(/\/$/, '')}/${opts.memberToken}`
      setStatus('connecting')
      let ws: WebSocket
      try {
        ws = new WebSocket(url)
      } catch {
        setStatus('error')
        scheduleRetry()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('open')
        retryRef.current = 0
        // regist 송신 — sample/chat_test/cn.php 와 동일하게 Token 동봉.
        // URL 의 token path 로도 m2net 가 식별하지만, sample 라이브 동작 보장을 위해 body 에도 포함.
        try {
          ws.send(JSON.stringify({ CmdTp: 'regist', Token: opts.memberToken }))
        } catch {
          /* swallow */
        }
        // heartbeat — 25초 주기로 ping. m2net idle timeout 으로 인한 강제 종료 차단.
        // 이미 돌고 있는 타이머가 있으면 정리하고 새로 시작.
        if (heartbeatRef.current !== null) {
          window.clearInterval(heartbeatRef.current)
        }
        heartbeatRef.current = window.setInterval(() => {
          const cur = wsRef.current
          if (!cur || cur.readyState !== WebSocket.OPEN) return
          try {
            // m2net 가 인식하는 무해한 핑 페이로드 — `CmdTp: 'ping'` 으로 송신.
            // 응답이 없어도 OK (socket 활동 자체만으로 idle 타이머 리셋).
            cur.send(JSON.stringify({ CmdTp: 'ping' }))
          } catch { /* swallow */ }
        }, HEARTBEAT_MS)
      }

      ws.onmessage = (ev) => {
        let data: Record<string, unknown> | null = null
        try {
          data = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as Record<string, unknown>
        } catch {
          return
        }
        if (!data || typeof data !== 'object') return

        const cmd = String(data.CmdTp ?? '')
        // m2net 의 응답 본문은 거의 모든 케이스 JoMsg / jomsg 안에 들어옴 (sample/chat_test/cn.php).
        // 일부 라이브 변형은 최상위 키로 보내기도 해서 양쪽 모두 본다.
        const jo: Record<string, unknown> | null =
          data.JoMsg && typeof data.JoMsg === 'object'
            ? (data.JoMsg as Record<string, unknown>)
            : data.jomsg && typeof data.jomsg === 'object'
              ? (data.jomsg as Record<string, unknown>)
              : null
        const pickString = (...vals: unknown[]): string | undefined => {
          for (const v of vals) if (typeof v === 'string' && v.length > 0) return v
          return undefined
        }
        // Cid/FromCid 는 m2net 응답에 따라 number 또는 string. 비교를 위해 string 으로 정규화.
        const pickId = (...vals: unknown[]): string | undefined => {
          for (const v of vals) {
            if (typeof v === 'string' && v.length > 0) return v
            if (typeof v === 'number' && Number.isFinite(v)) return String(v)
          }
          return undefined
        }

        if (cmd === 'cli_connect_ok') {
          // sample: cid = js.JoMsg.Cid, tid = js.JoMsg.Tid. m2net 은 number 로 보낼 수 있음.
          const cid = pickId(jo?.Cid, data.Cid)
          const tid = pickId(jo?.Tid, data.Tid)
          if (cid) cidRef.current = cid
          if (tid) tidRef.current = tid
          // 큐에 쌓아둔 메시지 flush (cli_connect_ok 전에 sendText 가 호출된 케이스)
          if (pendingSendsRef.current.length > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            for (const text of pendingSendsRef.current) {
              try {
                wsRef.current.send(JSON.stringify({ CmdTp: 'conv_msg', Msg: text, HtmlFlag: false }))
              } catch { /* swallow */ }
            }
            pendingSendsRef.current = []
          }
          // 재연결/첫연결 모두 onReconnected 한 번 호출 — 호출자가 since 기반 누락분 fetch
          onReconnectedRef.current?.()
          return
        }
        if (cmd === 'conv_msg') {
          // sample/counsel/chat.php 정답: FromCid/ToCid 는 최상위. JoMsg.{Msg,HtmlFlag,SendTime}
          const fromCid = pickId(data.FromCid, jo?.FromCid)
          const toCid = pickId(data.ToCid, jo?.ToCid)
          const sendTime = pickString(jo?.SendTime, data.SendTime)
          const htmlFlag = jo?.HtmlFlag === true || jo?.HtmlFlag === 'true'
          const msg = pickString(jo?.Msg, jo?.msg)
          if (!msg) return
          const fromNum = Number(fromCid)
          const isAnnouncement = Number.isFinite(fromNum) && fromNum < 0
          const isMine =
            !isAnnouncement &&
            cidRef.current !== null &&
            fromCid !== undefined &&
            String(cidRef.current) === String(fromCid)
          onMessageRef.current({ fromCid, toCid, msg, sendTime, htmlFlag, isMine, isAnnouncement, raw: data })
          return
        }
        // actor 식별 헬퍼 — sample chat.php resolveActorFromEvt 동등.
        // IdTp 우선, 없으면 CsrId/MembId 존재 여부로 판정.
        const resolveIdTp = (): 'csr' | 'memb' | undefined => {
          const raw = pickString(jo?.IdTp, data.IdTp)
          if (raw) {
            const v = raw.toLowerCase()
            if (v === 'csr') return 'csr'
            if (v === 'memb' || v === 'user') return 'memb'
          }
          const csr = pickString(jo?.CsrId, data.CsrId)
          const memb = pickString(jo?.MembId, data.MembId)
          if (csr && !memb) return 'csr'
          if (!csr && memb) return 'memb'
          return undefined
        }

        // 상대가 방을 나간 통지 (sample/counsel/chat.php case 'room_out_noti').
        if (cmd === 'room_out_noti') {
          const csrId = pickString(jo?.CsrId, data.CsrId)
          const membId = pickString(jo?.MembId, data.MembId)
          const sendTime = pickString(jo?.SendTime, data.SendTime)
          onPeerLeftRef.current?.({ csrId, membId, idTp: resolveIdTp(), sendTime, raw: data })
          return
        }
        // 상대가 방에 입장 통지 (sample case 'room_in_noti').
        if (cmd === 'room_in_noti') {
          const csrId = pickString(jo?.CsrId, data.CsrId)
          const membId = pickString(jo?.MembId, data.MembId)
          const sendTime = pickString(jo?.SendTime, data.SendTime)
          onPeerJoinedRef.current?.({ csrId, membId, idTp: resolveIdTp(), sendTime, raw: data })
          return
        }
        // 방이 명시적으로 종료됨 (sample case 'room_closed', 'room_out_resp' 도 동일 의미)
        if (cmd === 'room_closed' || cmd === 'room_out_resp' || cmd === 'room_close') {
          const reason = pickString(jo?.Reason, data.Reason)
          onServerEndRef.current?.(reason)
          return
        }
      }

      ws.onclose = () => {
        // 연결이 끊겼으니 heartbeat 정리 — 재연결 시 ws.onopen 에서 새로 시작.
        if (heartbeatRef.current !== null) {
          window.clearInterval(heartbeatRef.current)
          heartbeatRef.current = null
        }
        if (stoppedRef.current) {
          setStatus('closed')
          return
        }
        setStatus('closed')
        scheduleRetry()
      }
      ws.onerror = () => {
        setStatus('error')
      }
    }

    const scheduleRetry = () => {
      if (stoppedRef.current) return
      if (retryRef.current >= MAX_RETRY) return
      retryRef.current += 1
      const delay = RETRY_DELAY_MS * retryRef.current
      window.setTimeout(connect, delay)
    }

    // 외부 forceReconnect 에서 호출하도록 ref 에 노출.
    connectRef.current = connect

    connect()

    return () => {
      stoppedRef.current = true
      connectRef.current = () => {}
      if (heartbeatRef.current !== null) {
        window.clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      const ws = wsRef.current
      wsRef.current = null
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.close()
        } catch {
          /* swallow */
        }
      }
    }
    // wss/token 이 바뀌면 재연결. enabled false 로 가면 정리.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.wssUrl, opts.memberToken, opts.enabled, opts.reconnectKey])

  /**
   * 텍스트 메시지 송신 — 성공 시 true.
   * useCallback 으로 참조 안정화: 호출 측 useEffect deps 에 들어갈 수 있어
   * 매 렌더마다 함수 ID 가 바뀌면 effect 가 끊임없이 cleanup 되어 부작용 발생.
   */
  const sendText = useCallback((text: string): boolean => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // wss 미접속 — 큐잉. cli_connect_ok 또는 재연결 후 flush.
      pendingSendsRef.current.push(text)
      return false
    }
    // 아직 cli_connect_ok 응답 전이면 큐잉 — m2net 이 regist 처리 전 conv_msg 받으면
    // broadcast 안 되는 케이스가 있어 cid 가 발급된 뒤에 전송한다.
    if (!cidRef.current) {
      pendingSendsRef.current.push(text)
      return false
    }
    try {
      ws.send(JSON.stringify({ CmdTp: 'conv_msg', Msg: text, HtmlFlag: false }))
      return true
    } catch {
      return false
    }
  }, [])

  /**
   * room_out_req 송신 — sample/chat_test/cn.php sendRoomOut2Srv 와 동일하게 Cid+Tid 동봉.
   * Cid/Tid 가 없으면(아직 cli_connect_ok 미수신) 빈 페이로드 폴백.
   * useCallback 으로 참조 안정화 — sendText 와 동일한 이유.
   */
  const sendRoomOut = useCallback((): boolean => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try {
      const payload: Record<string, unknown> = { CmdTp: 'room_out_req' }
      if (cidRef.current) {
        const n = Number(cidRef.current)
        payload.Cid = Number.isFinite(n) ? n : cidRef.current
      }
      if (tidRef.current) payload.Tid = tidRef.current
      ws.send(JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }, [])

  /**
   * 강제 재연결 — 토큰이 같더라도 옛 wss 를 닫고 새 WebSocket 을 연다.
   * 상대가 강제종료/재진입 했을 때 m2net 세션 상태가 어긋나면 우리 토큰이 같아도
   * 메시지 라우팅이 안 되는 케이스를 우회. cli_connect_ok 로 새 cid 를 받으면
   * 큐잉된 메시지가 자동 flush.
   */
  const forceReconnect = useCallback((): void => {
    if (stoppedRef.current) return
    const ws = wsRef.current
    cidRef.current = null
    tidRef.current = null
    retryRef.current = 0
    if (ws) {
      try { ws.close() } catch { /* swallow */ }
    }
    wsRef.current = null
    // 즉시 새 connect 호출 — onclose 의 scheduleRetry 와 race 가 있을 수 있지만
    // wsRef 가 새 WebSocket 으로 덮여지므로 마지막 호출이 살아남는다.
    setTimeout(() => {
      if (stoppedRef.current) return
      connectRef.current()
    }, 100)
  }, [])

  return { status, sendText, sendRoomOut, forceReconnect, myCid: cidRef.current }
}
