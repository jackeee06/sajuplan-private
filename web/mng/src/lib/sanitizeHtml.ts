import DOMPurify from 'dompurify'

/**
 * 관리자 화면에 렌더되는 사용자/지원자 작성 HTML 정화 (저장형 XSS 방어).
 *
 * [2026-06-12] 정규식 denylist → DOMPurify(allowlist) 교체. 상담사 신청 본인소개 등
 *   신뢰 불가 입력을 관리자 화면에서 렌더할 때 사용. 호출처 함수명 그대로.
 */
export function sanitizeIntroHtml(raw: string): string {
  if (!raw) return ''
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
}
