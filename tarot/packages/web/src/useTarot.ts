import { useCallback, useEffect, useReducer } from 'react';
import { initialState, reduce, type TarotEvent, type TarotTransport } from '@tarot/engine';

/**
 * 보드 세션 훅. 이벤트는 항상 transport 를 거쳐 되돌아와 reduce 로 적용된다.
 *  - 솔로: LocalTransport (즉시 루프백)
 *  - 라이브: LiveTransport (WebSocket 에코) → 상담사·고객 동일 상태
 */
export function useTarot(transport: TarotTransport) {
  const [state, applyEvent] = useReducer(reduce, initialState);

  useEffect(() => transport.subscribe(applyEvent), [transport]);

  const send = useCallback((ev: TarotEvent) => transport.send(ev), [transport]);

  return { state, send };
}
