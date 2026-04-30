// Daum (Kakao) 우편번호 검색 위젯 로더
// https://postcode.map.daum.net/guide

const SCRIPT_URL = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

export interface DaumPostcodeData {
  zonecode: string          // 5자리 우편번호 (신주소)
  address: string           // 기본 주소 (도로명 또는 지번)
  roadAddress: string       // 도로명 주소
  jibunAddress: string      // 지번 주소
  buildingName?: string
  bname?: string
  userSelectedType: 'R' | 'J'
}

interface DaumGlobal {
  Postcode: new (config: {
    oncomplete: (data: DaumPostcodeData) => void
    onclose?: () => void
    width?: string | number
    height?: string | number
  }) => { open: () => void; embed: (el: HTMLElement) => void }
}

declare global {
  interface Window {
    daum?: DaumGlobal
  }
}

let loadingPromise: Promise<DaumGlobal> | null = null

function loadScript(): Promise<DaumGlobal> {
  if (window.daum) return Promise.resolve(window.daum)
  if (loadingPromise) return loadingPromise
  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.daum) resolve(window.daum)
      else reject(new Error('daum.Postcode 로드 실패'))
    }
    script.onerror = () => reject(new Error('우편번호 스크립트 로드 실패'))
    document.head.appendChild(script)
  })
  return loadingPromise
}

export async function openPostcode(onSelect: (data: DaumPostcodeData) => void) {
  const daum = await loadScript()
  new daum.Postcode({ oncomplete: onSelect }).open()
}
