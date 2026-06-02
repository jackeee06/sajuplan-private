import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { settingsApi } from '../lib/api'
import { openExternalUrl } from '../lib/native-bridge'

/**
 * 점검 안내 배너 — 어드민이 설정에서 ON/OFF + 메시지 입력.
 *
 *  - settings: maintenance.banner_active / banner_title / banner_body / banner_link
 *  - 모든 사용자(비로그인 포함) 노출 — 점검은 전체 영향
 *  - 노란 경고 톤 (단골 배너의 핑크와 구분)
 *  - X 버튼 → sessionStorage (이번 세션 닫힘. 다음 진입 시 다시 보임)
 *  - 60초마다 polling (사장님이 도중에 ON/OFF 토글하면 사용자도 반영)
 *  - 링크 입력 시 클릭 가능, 비우면 표시만
 */
const DISMISS_KEY = 'maintenance_banner_dismissed_v1'
const POLL_INTERVAL_MS = 60_000

export default function MaintenanceBanner() {
  const [active, setActive] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true)
  }, [])

  useEffect(() => {
    const fetchOnce = async () => {
      try {
        const s = await settingsApi.public()
        const isActive = (s['maintenance.banner_active'] ?? '') === 'true' || s['maintenance.banner_active'] === '1'
        setActive(isActive)
        setTitle((s['maintenance.banner_title'] ?? '').trim())
        setBody((s['maintenance.banner_body'] ?? '').trim())
        setLink((s['maintenance.banner_link'] ?? '').trim())
      } catch {
        setActive(false)
      }
    }
    fetchOnce()
    timerRef.current = setInterval(fetchOnce, POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (!active || dismissed) return null
  if (!title && !body) return null

  const onDismiss = () => {
    setDismissed(true)
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(DISMISS_KEY, '1')
  }

  const Content = () => (
    <div className="flex items-center gap-1.5">
      <span className="text-base leading-none">🔧</span>
      <span className="text-[13px] text-[#92400e] font-medium truncate">
        {title && <span className="font-semibold">{title}</span>}
        {title && body ? <span> — {body}</span> : <span>{body}</span>}
      </span>
      {link && <span className="text-[11.5px] text-[#92400e]/70 shrink-0">자세히 →</span>}
    </div>
  )

  // 링크 분기 — 외부 URL 은 새 탭 / 내부 path 는 React Router Link (SPA 라우팅).
  //   - "/..." 시작 → 내부 path
  //   - "http(s)://..." → 외부 명시
  //   - "www.foo.com" 또는 "foo.com" (도메인 패턴 — 점 포함, / 로 시작 X) → 외부 자동 감지 + https:// prepend
  const isExternal = !link.startsWith('/') && (
    /^https?:\/\//i.test(link) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(link)
  )
  const externalHref = isExternal && !/^https?:\/\//i.test(link) ? `https://${link}` : link

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#fef3c7] border-b border-[#fcd34d]">
      {link ? (
        isExternal ? (
          // 외부 URL: native-bridge 의 openExternalUrl 사용 — 앱 안이면 외부 브라우저(Safari/Chrome) 로 열기.
          // (WebView 의 setSupportMultipleWindows=false 때문에 target="_blank" 는 무시됨)
          <a
            href={externalHref}
            onClick={(e) => {
              e.preventDefault()
              openExternalUrl(externalHref)
            }}
            className="flex-1 min-w-0 cursor-pointer"
          >
            <Content />
          </a>
        ) : (
          <Link to={link} className="flex-1 min-w-0">
            <Content />
          </Link>
        )
      ) : (
        <div className="flex-1 min-w-0">
          <Content />
        </div>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="배너 닫기"
        className="shrink-0 w-5 h-5 flex items-center justify-center text-[#92400e]/70 hover:text-[#92400e]"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
        </svg>
      </button>
    </div>
  )
}
