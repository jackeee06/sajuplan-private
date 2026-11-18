import type { TarotEvent, TarotTransport } from '@tarot/engine';

// 독립(솔로/마케팅) 모드 — 이벤트를 내 화면에만 즉시 되돌린다(네트워크 0).
// 라이브 모드에선 이 자리에 WebSocket 트랜스포트를 끼운다(같은 인터페이스).
export function createLocalTransport(): TarotTransport {
  let handlers: Array<(ev: TarotEvent) => void> = [];
  return {
    send(ev) {
      // 동기 루프백 — reduce 가 구독자에서 적용된다.
      for (const h of handlers) h(ev);
    },
    subscribe(handler) {
      handlers.push(handler);
      return () => {
        handlers = handlers.filter((h) => h !== handler);
      };
    },
  };
}
