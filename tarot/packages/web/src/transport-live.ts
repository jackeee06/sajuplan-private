import type { TarotEvent, TarotTransport } from '@tarot/engine';

export interface LiveTransport extends TarotTransport {
  close(): void;
}

// 라이브 상담 모드 — WebSocket으로 상담사↔고객 같은 상태. 끊기면 자동 재연결+재동기화.
export function createLiveTransport(wsUrl: string): LiveTransport {
  let ws: WebSocket | null = null;
  let handlers: Array<(ev: TarotEvent) => void> = [];
  let queue: TarotEvent[] = [];
  let closed = false;
  let retries = 0;

  function connect() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      retries = 0;
      const pending = queue;
      queue = [];
      for (const ev of pending) ws?.send(JSON.stringify(ev));
    };
    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(String(e.data)) as TarotEvent;
        for (const h of handlers) h(ev);
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      // 끊기면 재연결(서버가 sync 재전송으로 복구). 단 방없음 등 영구실패는 6회까지만.
      if (!closed && retries++ < 6) setTimeout(connect, 1000);
    };
  }
  connect();

  return {
    send(ev) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(ev));
      else queue.push(ev);
    },
    subscribe(handler) {
      handlers.push(handler);
      return () => {
        handlers = handlers.filter((h) => h !== handler);
      };
    },
    close() {
      closed = true;
      ws?.close();
    },
  };
}
