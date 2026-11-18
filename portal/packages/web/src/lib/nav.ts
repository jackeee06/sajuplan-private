// SPA 내비게이션 — pushState로 경로(/tojeong 등)를 바꾸고 popstate를 쏴서 App이 라우트를 갱신.
// 해시(#/) 대신 실제 경로를 쓰면 타일별 URL이 검색·공유에 분리 노출된다(nginx SPA fallback 전제).
export function navigate(path: string) {
  const cur = window.location.pathname + window.location.search;
  if (cur === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
