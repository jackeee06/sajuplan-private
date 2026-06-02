// [PII 보호] 슈퍼관리자 전화번호 노출 토글 (시간 제한).
//   - 만료 시각(epoch ms)을 sessionStorage 에 저장.
//   - 현재 시각이 만료 시각을 지나면 자동으로 OFF (키 제거 + false 반환).
//   - 브라우저 탭을 닫으면 sessionStorage 가 사라져 어차피 OFF.
//   - 만료 감지 후 헤더가 자동으로 페이지를 새로고침 → 평문→마스킹 전환.
//   - KEY_MINUTES 는 현재 선택된 옵션(라디오 활성 표시용)을 보관.
const KEY = 'sjm_phone_peek_until'
const KEY_MINUTES = 'sjm_phone_peek_minutes'

export const PEEK_DURATIONS: Array<{ label: string; minutes: number }> = [
  { label: '5분', minutes: 5 },
  { label: '10분', minutes: 10 },
  { label: '30분', minutes: 30 },
  { label: '1일', minutes: 24 * 60 },
]

function readUntil(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const ms = Number(raw)
    if (!Number.isFinite(ms)) return null
    return ms
  } catch {
    return null
  }
}

/** 토글이 켜져 있고 아직 만료되지 않았는지. 만료된 경우 키를 정리한다. */
export function isPhonePeekOn(): boolean {
  const until = readUntil()
  if (until === null) return false
  if (Date.now() >= until) {
    clearPhonePeek()
    return false
  }
  return true
}

/** 남은 시간(ms). 꺼져 있거나 만료된 경우 0. */
export function phonePeekRemainingMs(): number {
  const until = readUntil()
  if (until === null) return 0
  return Math.max(0, until - Date.now())
}

/** durationMinutes 동안 노출. 0 또는 음수면 끄기와 동일. */
export function setPhonePeek(durationMinutes: number): void {
  if (typeof window === 'undefined') return
  try {
    if (durationMinutes <= 0) {
      window.sessionStorage.removeItem(KEY)
      window.sessionStorage.removeItem(KEY_MINUTES)
      return
    }
    const until = Date.now() + durationMinutes * 60_000
    window.sessionStorage.setItem(KEY, String(until))
    window.sessionStorage.setItem(KEY_MINUTES, String(durationMinutes))
  } catch {
    // sessionStorage 사용 불가 환경 — 조용히 무시
  }
}

export function clearPhonePeek(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(KEY)
    window.sessionStorage.removeItem(KEY_MINUTES)
  } catch {
    // 무시
  }
}

/** 현재 선택된 분 수 (라디오 활성 표시용). 만료/꺼짐이면 0. */
export function getPhonePeekMinutes(): number {
  if (!isPhonePeekOn()) return 0
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.sessionStorage.getItem(KEY_MINUTES)
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

/** "MM:SS" 또는 "Hh MM분" 형태로 포맷 — 헤더 카운트다운 표시용. */
export function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  if (totalSec <= 0) return '0초'
  const hours = Math.floor(totalSec / 3600)
  if (hours >= 1) {
    const mins = Math.floor((totalSec % 3600) / 60)
    return `${hours}시간 ${mins}분`
  }
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
