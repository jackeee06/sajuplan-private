import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotebookPen, Save, CheckCircle } from 'lucide-react'
import { useAuth } from '../lib/auth-context'

/**
 * 상담사 개인 메모장.
 *
 * - 본인만 본인 메모 보기/저장
 * - 자동 저장 (2초 디바운스)
 * - 단순 textarea (이미지 업로드는 향후 검토)
 * - 회원별 특이사항, 본인 노트 등 자유 형식
 */

const API_BASE = (window as unknown as { __SAJUMOON_CONFIG?: { env?: string } }).__SAJUMOON_CONFIG?.env === 'prod'
  ? 'https://api.sajuplan.com'
  : 'https://api.sajumoon.kr'

export default function CounselorMyMemo() {
  const navigate = useNavigate()
  const { isLoggedIn, isCounselor } = useAuth()
  const [content, setContent] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isLoggedIn || !isCounselor) {
      navigate('/login')
      return
    }
    fetch(`${API_BASE}/user/counselor-mypage/memo`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content ?? '')
        setSavedAt(data.updated_at)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [isLoggedIn, isCounselor, navigate])

  const save = async (text: string) => {
    setSaving(true)
    try {
      const r = await fetch(`${API_BASE}/user/counselor-mypage/memo`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (r.ok) {
        const data = await r.json()
        setSavedAt(data.updated_at)
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setContent(v)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => save(v), 2000)
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="mobile-frame flex flex-col">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-white border-b border-[#F3F4F6]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712] flex items-center gap-1.5">
          <NotebookPen className="w-5 h-5 text-pink-500" />
          <span>나만의 메모장</span>
        </h1>
        <div className="text-[11px] text-gray-400 flex items-center gap-1">
          {saving ? (
            <>
              <Save className="w-3 h-3 animate-pulse" /> 저장 중
            </>
          ) : savedAt ? (
            <>
              <CheckCircle className="w-3 h-3 text-green-500" /> {formatTime(savedAt)}
            </>
          ) : null}
        </div>
      </header>

      <div className="px-4 py-3 bg-pink-50 border-b border-pink-100">
        <p className="text-[12.5px] text-pink-900 leading-[1.5]">
          💡 회원별 특이사항, 본인 운영 노트, 일정 등 자유롭게 메모하세요.
          본인만 보입니다. 2초 후 자동 저장.
        </p>
      </div>

      <div className="flex-1 p-4">
        {loading ? (
          <p className="text-center text-gray-400 text-[13px]">로딩 중...</p>
        ) : (
          <textarea
            value={content}
            onChange={onChange}
            placeholder="예시:&#10;&#10;- A 회원 (010-****-1234) — 따뜻한 톤 좋아함, 직장 스트레스 관련 문의 많음&#10;- B 회원 — 답변 빠르게 받고 싶어함&#10;&#10;5/30 출근: 14시-22시&#10;6/1 휴가&#10;&#10;자주 쓰는 답변:&#10;1. '오늘 어떤 점이 궁금하신가요?'&#10;..."
            className="w-full min-h-[60vh] p-3 border border-gray-200 rounded-lg text-[14px] leading-[1.7] focus:outline-none focus:border-pink-300 resize-none"
          />
        )}
      </div>
    </div>
  )
}
