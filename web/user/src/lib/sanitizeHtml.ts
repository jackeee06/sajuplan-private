import DOMPurify from 'dompurify'

/**
 * 사용자에게 렌더되는 HTML 정화 (저장형 XSS 방어).
 *
 * [2026-06-12] 정규식 denylist → DOMPurify(allowlist, "좋은 것만 남기기")로 교체.
 *   denylist 의 변형/중첩 우회 위험을 구조적으로 제거. 호출처는 함수명 그대로라 변경 없음.
 *   - 공지/이벤트/알림/약관/상담사 소개·공지/팝업 본문 등 dangerouslySetInnerHTML 전부 이 함수 경유.
 *   - USE_PROFILES html: 일반 HTML 태그만 허용(script·iframe·on이벤트·javascript URL 제거, SVG/MathML 차단).
 */
export function sanitizeIntroHtml(raw: string): string {
  if (!raw) return ''
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
}
