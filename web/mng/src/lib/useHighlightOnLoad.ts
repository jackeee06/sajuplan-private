import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * "?hl=키워드" 쿼리스트링이 있으면 페이지 mount 후 해당 텍스트로 자동 스크롤 + 형광펜 강조.
 *
 * 동작 순서:
 *   1. 페이지 첫 렌더 끝나길 ~300ms 기다림
 *   2. DOM 에서 키워드 텍스트 노드 검색
 *   3. 발견 → scrollIntoView({behavior:'smooth', block:'center'}) + 일시적 노란 형광펜 (~2.5s)
 *   4. 못 찾음 → 페이지 안의 <button>/[role=tab] 라벨 중 키워드 포함 버튼 자동 클릭
 *      → 200ms 후 재검색
 *   5. 그래도 못 찾으면 무해히 종료 (페이지 이동은 이미 완료된 상태)
 *
 * 페이지 코드 수정 없이도 작동. AllMenus 의 sub-feature Link 가 ?hl=... 자동 부착.
 */
export function useHighlightOnLoad() {
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const hl = params.get('hl')
    if (!hl) return
    const keyword = hl.trim()
    if (!keyword) return
    const tabHint = (params.get('tab') ?? '').trim()

    let cancelled = false

    const run = () => {
      const t1 = window.setTimeout(() => {
        if (cancelled) return
        // 1) tab 힌트가 있으면 먼저 그 탭 클릭
        if (tabHint) {
          tryClickTab(tabHint)
          window.setTimeout(() => {
            if (cancelled) return
            if (tryFind(keyword)) return
            // 탭 클릭 후에도 못 찾으면 키워드로 탭 매칭 한 번 더 시도
            if (tryClickTab(keyword)) {
              window.setTimeout(() => !cancelled && tryFind(keyword), 250)
            }
          }, 280)
          return
        }
        // 2) tab 힌트 없음 — 현재 화면에서 바로 찾기
        if (tryFind(keyword)) return
        // 3) 못 찾으면 키워드로 탭 자동 클릭 시도
        if (tryClickTab(keyword)) {
          window.setTimeout(() => !cancelled && tryFind(keyword), 250)
        }
      }, 300)
      return t1
    }
    const id = run()
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [location.key])
}

/** 공백/조사 영향 줄이기 위한 정규화 (한국어 매칭 보조). */
function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}

/**
 * DOM 에서 키워드와 매칭되는 텍스트 노드 찾기. main 영역 안에서만 검색.
 * 양방향 매칭: 페이지가 키워드를 포함 OR 키워드가 페이지 텍스트를 포함 (최소 길이 2).
 * 후자는 false positive 줄이려 keyword.length >= 3 일 때만.
 */
function findElement(keyword: string): HTMLElement | null {
  const root = document.querySelector('main') ?? document.body
  const kw = keyword.trim()
  const nkw = normalize(kw)
  if (!nkw) return null

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const raw = (node.nodeValue ?? '').trim()
      if (raw.length < 2) return NodeFilter.FILTER_REJECT
      const nt = normalize(raw)
      // 1순위: 페이지 텍스트에 키워드가 들어 있음 (정확)
      if (nt.includes(nkw)) return NodeFilter.FILTER_ACCEPT
      // 2순위: 키워드가 페이지 텍스트를 포함 (긴 라벨이 짧은 페이지 텍스트 매칭)
      if (nkw.length >= 3 && nt.length >= 2 && nkw.includes(nt)) return NodeFilter.FILTER_ACCEPT
      return NodeFilter.FILTER_REJECT
    },
  })
  const node = walker.nextNode()
  if (!node) return null
  let el: Node | null = node.parentNode
  while (el && el.nodeType !== 1) el = el.parentNode
  return (el as HTMLElement) ?? null
}

/** 보이는지 검사 (display:none / hidden 등 제외) */
function isVisible(el: HTMLElement): boolean {
  if (!el.offsetParent && el.tagName !== 'BODY') {
    // offsetParent null → display:none 이거나 fixed 의 특정 케이스
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}

/** 스크롤 + 일시 형광펜 강조 */
function highlightElement(el: HTMLElement): void {
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch {
    el.scrollIntoView()
  }
  // 일시적 outline + background flash. animation 종료 후 정리.
  const prev = {
    transition: el.style.transition,
    background: el.style.backgroundColor,
    boxShadow: el.style.boxShadow,
    borderRadius: el.style.borderRadius,
  }
  el.style.transition = 'background-color 250ms ease, box-shadow 250ms ease'
  // 빨간 강조 — 가독성 위해 배경은 옅게, 외곽선 진하고 두껍게
  el.style.backgroundColor = 'rgba(254, 202, 202, 0.7)'  // red-200 / 70%
  el.style.boxShadow = '0 0 0 4px rgba(220, 38, 38, 0.85)'  // red-600 / 85%
  el.style.borderRadius = '6px'

  // 강한 깜빡임: 더 잘 눈에 띄게 0.4s 주기로 3번 깜빡 후 정리
  window.setTimeout(() => {
    el.style.backgroundColor = 'rgba(254, 226, 226, 0.3)'
    el.style.boxShadow = '0 0 0 2px rgba(220, 38, 38, 0.4)'
  }, 400)
  window.setTimeout(() => {
    el.style.backgroundColor = 'rgba(254, 202, 202, 0.75)'
    el.style.boxShadow = '0 0 0 4px rgba(220, 38, 38, 0.9)'
  }, 800)
  window.setTimeout(() => {
    el.style.backgroundColor = 'rgba(254, 226, 226, 0.3)'
    el.style.boxShadow = '0 0 0 2px rgba(220, 38, 38, 0.4)'
  }, 1200)
  window.setTimeout(() => {
    el.style.backgroundColor = 'rgba(254, 202, 202, 0.7)'
    el.style.boxShadow = '0 0 0 4px rgba(220, 38, 38, 0.85)'
  }, 1600)
  window.setTimeout(() => {
    el.style.backgroundColor = prev.background
    el.style.boxShadow = prev.boxShadow
  }, 2800)
  window.setTimeout(() => {
    el.style.transition = prev.transition
    el.style.borderRadius = prev.borderRadius
  }, 3100)
}

/** 키워드 발견 시 강조. 성공 여부 반환. */
function tryFind(keyword: string): boolean {
  const el = findElement(keyword)
  if (!el || !isVisible(el)) return false
  highlightElement(el)
  return true
}

/** 비활성 탭일 가능성 — 페이지 내 button/role=tab 중 키워드 매칭 버튼 자동 클릭. */
function tryClickTab(keyword: string): boolean {
  const root = document.querySelector('main') ?? document.body
  const candidates = root.querySelectorAll('button, [role="tab"], a')
  const nkw = normalize(keyword)
  for (const c of Array.from(candidates)) {
    const text = (c.textContent ?? '').trim()
    if (!text || text.length > 30) continue // 메인 액션 버튼 스킵
    const nt = normalize(text)
    // 공백 무시한 양방향 부분일치
    if (nt.includes(nkw) || (nkw.length >= 3 && nt.length >= 2 && nkw.includes(nt))) {
      try {
        (c as HTMLElement).click()
        return true
      } catch {
        // 클릭 실패 — 다음 후보
      }
    }
  }
  return false
}
