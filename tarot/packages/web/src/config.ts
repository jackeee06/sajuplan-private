// 라이브 동기화 서버 주소 해석.
//   - 기본: 같은 오리진(nginx가 /api/tarot, /ws 프록시) → tarot.sajuplan.com
//   - dev/test: ?api=http://localhost:8790 로 오버라이드(ws도 자동 파생)

function rawApi(): string {
  const p = new URLSearchParams(window.location.search).get('api');
  return p ? p.replace(/\/$/, '') : ''; // '' = 같은 오리진
}

export function httpBase(): string {
  return rawApi();
}

export function wsUrlFor(code: string, role: string): string {
  const api = rawApi();
  const base = api
    ? api.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return `${base}/ws?code=${encodeURIComponent(code)}&role=${encodeURIComponent(role)}`;
}

export async function createRoom(): Promise<string> {
  const res = await fetch(`${httpBase()}/api/tarot/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error('방 생성 실패');
  const json = (await res.json()) as { code: string };
  return json.code;
}
