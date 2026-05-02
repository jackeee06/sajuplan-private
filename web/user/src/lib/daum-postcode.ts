/**
 * Daum 우편번호 서비스 동적 로더 + 검색창 오픈.
 * — sample 의 G5_POSTCODE_JS 동등 (`postcode.v2.js`).
 * — 페이지 초기 로드 부담을 줄이려고 클릭 시 한 번만 스크립트를 로드.
 */
const SCRIPT_URL =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

export interface DaumPostcodeResult {
  /** 우편번호 (5자리, 신주소) */
  zonecode: string
  /** 도로명 또는 지번 주소 (사용자가 선택한 타입) */
  address: string
  /** 'R' = 도로명, 'J' = 지번 */
  addressType: 'R' | 'J'
  /** 도로명일 때 건물명 (없으면 빈 문자열) */
  buildingName: string
  /** 지번 주소 */
  jibunAddress: string
  /** 도로명 주소 */
  roadAddress: string
}

interface DaumPostcodeApi {
  open(): void
  embed(el: HTMLElement, opts?: { autoClose?: boolean }): void
}

interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeResult) => void
  onclose?: (state: 'FORCE_CLOSE' | 'COMPLETE_CLOSE') => void
  width?: string | number
  height?: string | number
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: DaumPostcodeOptions) => DaumPostcodeApi
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('not in browser'))
  if (window.daum?.Postcode) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_URL
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Daum 우편번호 스크립트 로드 실패'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export async function openDaumPostcode(
  onComplete: (data: DaumPostcodeResult) => void,
): Promise<void> {
  await loadScript()
  if (!window.daum?.Postcode) throw new Error('Daum API 미가용')
  new window.daum.Postcode({
    oncomplete: (data) => {
      onComplete(data)
    },
  }).open()
}

/**
 * 페이지 내부 컨테이너에 검색창을 임베드 (모바일 웹뷰 친화적).
 * popup 차단 / 새 창 어색함을 피하고 페이지 안에 펼쳐졌다 접히는 형태로 동작.
 */
export async function embedDaumPostcode(
  container: HTMLElement,
  onComplete: (data: DaumPostcodeResult) => void,
): Promise<void> {
  await loadScript()
  if (!window.daum?.Postcode) throw new Error('Daum API 미가용')
  // 컨테이너 비우고 새로 임베드
  container.innerHTML = ''
  new window.daum.Postcode({
    oncomplete: (data) => onComplete(data),
    width: '100%',
    height: '100%',
  }).embed(container, { autoClose: true })
}

