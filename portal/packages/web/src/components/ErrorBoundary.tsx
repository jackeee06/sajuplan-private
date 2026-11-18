import { Component, type ReactNode } from "react";

// 청크 로드 실패(재배포로 옛 청크가 사라져 import 실패) 감지 — 브라우저마다 메시지가 달라 폭넓게 매칭.
function isChunkError(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /ChunkLoadError|dynamically imported module|Loading chunk|module script failed|Failed to fetch/i.test(msg);
}

// 렌더 에러 안전망 — 한 화면이 터져도 흰 화면 대신 폴백을 보여주고 홈으로 복구.
// 단, 재배포 후 '옛 청크 404'로 인한 실패면 자동으로 1회 새로고침해 최신 코드로 복구(사용자가 수동 새로고침할 필요 없음).
export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: unknown) {
    console.error("[portal] render error", e);
    if (isChunkError(e)) {
      // 10초 내 이미 자동 새로고침했는데 또 실패하면 진짜 문제 → 폴백 유지(무한 루프 방지).
      const KEY = "portal_chunk_reload_at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }
  reset = () => { this.setState({ hasError: false }); window.location.assign("/"); };
  render() {
    if (this.state.hasError) {
      return (
        <div className="px-4 py-20 text-center">
          <p className="text-[32px]">🥲</p>
          <p className="mt-2 text-[15px] font-semibold text-ink">잠시 문제가 생겼어요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/70">잠시 후 다시 시도해 주세요.</p>
          <button type="button" onClick={this.reset} className="mt-4 rounded-xl bg-accent-500 px-5 py-2.5 text-[14px] font-semibold text-white active:scale-[0.98]">홈으로</button>
        </div>
      );
    }
    return this.props.children;
  }
}
