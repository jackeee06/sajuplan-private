// 🔮 @tarot/api — 라이브 동기화 서버.
//   방코드(4자리) 페어링 + WebSocket 중계. 엔진(reduce)을 권위 상태로 두어 재접속도 복구.
//   - POST /api/tarot/rooms  { session? } → { code }
//       session 없음: 랜덤 4자리 방코드 생성(수동 페어링)
//       session 있음: 상담 ID 기반 방 찾거나 생성 → 같은 session이면 같은 방(자동 페어링, 코드 불필요)
//   - GET  /api/tarot/health      → 상태
//   - WS   /ws?code=1234&role=... → 입장. 접속 즉시 현재 스냅샷(sync) 수신, 이후 이벤트 중계
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { initialState, reduce, type TarotEvent, type TarotState } from '@tarot/engine';

interface Room {
  code: string;
  state: TarotState;
  clients: Set<WebSocket>;
  lastTouch: number;
}

const rooms = new Map<string, Room>();
const sessionToCode = new Map<string, string>(); // session → room code
const ROOM_TTL_MS = 1000 * 60 * 60 * 2; // 2시간 유휴 시 정리
const PORT = Number(process.env.PORT) || 8790;

function genCode(): string {
  let code = '';
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(code));
  return code;
}

function createRoom(code?: string): Room {
  const finalCode = code ?? genCode();
  const room: Room = { code: finalCode, state: initialState, clients: new Set(), lastTouch: Date.now() };
  rooms.set(finalCode, room);
  return room;
}

// 세션 ID 기반 방 조회·생성(자동 페어링 — 코드 불필요)
function getOrCreateBySession(session: string): Room {
  const existing = sessionToCode.get(session);
  if (existing) {
    const room = rooms.get(existing);
    if (room) return room;
  }
  const room = createRoom();
  sessionToCode.set(session, room.code);
  return room;
}

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/tarot/rooms') {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      let session = '';
      try { session = (JSON.parse(body) as { session?: string }).session ?? ''; } catch { /* ignore */ }
      const room = session ? getOrCreateBySession(session) : createRoom();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: room.code }));
    });
    return;
  }
  if (url.pathname === '/api/tarot/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const code = url.searchParams.get('code') || '';
  const room = rooms.get(code);
  if (!room) {
    ws.send(JSON.stringify({ t: 'error', msg: 'room_not_found' }));
    ws.close();
    return;
  }
  room.clients.add(ws);
  room.lastTouch = Date.now();

  // 접속 즉시 현재 상태 동기화(재접속 복구)
  ws.send(JSON.stringify({ t: 'sync', state: room.state }));

  ws.on('message', (data) => {
    let ev: TarotEvent;
    try {
      ev = JSON.parse(String(data)) as TarotEvent;
    } catch {
      return;
    }
    if (ev.t === 'sync') return; // 클라가 보낸 sync는 무시(서버가 권위)
    room.state = reduce(room.state, ev);
    room.lastTouch = Date.now();
    const msg = JSON.stringify(ev);
    for (const c of room.clients) {
      if (c.readyState === WebSocket.OPEN) c.send(msg);
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
  });
});

// 유휴 방 정리
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.clients.size === 0 && now - room.lastTouch > ROOM_TTL_MS) rooms.delete(code);
  }
}, 1000 * 60 * 10).unref();

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[tarot-api] listening on :${PORT}`);
});
