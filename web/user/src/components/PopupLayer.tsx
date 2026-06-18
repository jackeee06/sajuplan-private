import { useEffect, useState } from 'react'
import { popupsApi, type PublicPopup } from '../lib/api'
import { FILE_BASE } from '../lib/runtime-env'
import { openExternalUrl } from '../lib/native-bridge'
import { sanitizeIntroHtml } from '../lib/sanitizeHtml'

/**
 * 사용자 팝업(공지 레이어) 노출 — 2026-06-12 신설.
 * 관리자(/mng/popup-layers)가 등록한 활성 팝업을 앱 진입 시 모달로 보여준다.
 *  - 여러 개면 하나씩 순차 노출(닫으면 다음).
 *  - "오늘 하루 보지 않기" → disable_hours 동안 localStorage 로 숨김.
 *  - content(HTML)는 sanitize, 이미지/링크 클릭은 openExternalUrl(WebView 안전).
 */

const HIDE_KEY = (id: number) => `popup_hide_until_${id}`

function imgUrl(p: PublicPopup): string | null {
  const u = p.image_url_webp || p.image_url
  if (!u) return null
  return /^https?:\/\//.test(u) ? u : `${FILE_BASE}${u}`
}

export default function PopupLayer({ area = 'home' }: { area?: 'home' | 'counselor' }) {
  const [popups, setPopups] = useState<PublicPopup[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    popupsApi
      .list(area)
      .then((r) => {
        const now = Date.now()
        const visible = (r.items ?? []).filter((p) => {
          const until = Number(localStorage.getItem(HIDE_KEY(p.id)) ?? 0)
          return !(until && until > now)
        })
        setPopups(visible)
      })
      .catch(() => undefined)
  }, [area])

  if (popups.length === 0 || idx >= popups.length) return null
  const p = popups[idx]
  const img = imgUrl(p)

  const close = () => setIdx((i) => i + 1)
  const hideToday = () => {
    const hours = p.disable_hours > 0 ? p.disable_hours : 24
    localStorage.setItem(HIDE_KEY(p.id), String(Date.now() + hours * 3600 * 1000))
    close()
  }
  const onImageClick = () => {
    if (p.link_url) openExternalUrl(p.link_url)
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-label={p.title || '팝업 공지'}
    >
      <div className="w-full max-w-[360px] max-h-[85vh] bg-white rounded-[16px] overflow-hidden shadow-xl flex flex-col">
        {p.title && (
          <div className="px-4 pt-4 pb-2 text-[16px] font-semibold text-[#030712] shrink-0">{p.title}</div>
        )}
        <div className="overflow-y-auto">
          {img &&
            (p.link_url ? (
              <button type="button" onClick={onImageClick} className="block w-full" aria-label={p.title || '팝업 링크'}>
                <img src={img} alt={p.title || ''} className="w-full h-auto block" />
              </button>
            ) : (
              <img src={img} alt={p.title || ''} className="w-full h-auto block" />
            ))}
          {p.content && p.content.trim() !== '' &&
            (p.is_html ? (
              <div
                className="px-4 py-3 text-[14px] leading-[160%] text-[#364153] popup-html"
                dangerouslySetInnerHTML={{ __html: sanitizeIntroHtml(p.content) }}
              />
            ) : (
              <div className="px-4 py-3 text-[14px] leading-[160%] text-[#364153] whitespace-pre-line">
                {p.content}
              </div>
            ))}
        </div>
        <div className="flex border-t border-[#F3F4F6] mt-auto shrink-0">
          <button
            type="button"
            onClick={hideToday}
            className="flex-1 h-[48px] text-[14px] text-[#6A7282] border-r border-[#F3F4F6]"
          >
            오늘 하루 보지 않기
          </button>
          <button type="button" onClick={close} className="flex-1 h-[48px] text-[14px] font-medium text-[#ec4899]">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
