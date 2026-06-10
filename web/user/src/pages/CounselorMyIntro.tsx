import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { HtmlEditorHandle } from '../components/HtmlEditor'
const HtmlEditor = lazy(() => import('../components/HtmlEditor'))
import { counselorMypageApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'

/**
 * 상담사 마이페이지 — 본인 소개 편집
 * Route: /counselor/mypage/intro
 *
 * MemberEdit.tsx 에서 분리 — HtmlEditor lazy 로딩이 정보수정 진입을 느리게 만들던 문제 해결.
 */
export default function CounselorMyIntro() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()

  const editorRef = useRef<HtmlEditorHandle>(null)
  const [intro, setIntro] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!member || member.role !== 'counselor') return
    let alive = true
    counselorMypageApi
      .getIntro()
      .then((r) => { if (alive) { setIntro(r.intro ?? ''); setLoaded(true) } })
      .catch(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [member])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  if (authLoading) return null
  if (!member || member.role !== 'counselor') {
    return <Navigate to="/login?redirect=/counselor/mypage/intro" replace />
  }

  const handleSave = async () => {
    const html = (editorRef.current?.getHTML() ?? intro).trim()
    setSaving(true)
    setError(null)
    try {
      const r = await counselorMypageApi.setIntro(html)
      setIntro(r.intro)
      setToast('본인 소개가 저장됐습니다.')
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* 헤더 */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-white border-b border-[#F3F4F6]">
        <button onClick={() => navigate(-1)} className="w-[30px] h-[30px] flex items-center justify-center flex-shrink-0">
          <img src="/img/ic_hd_back.svg" alt="뒤로" className="w-[28px] h-[28px]" />
        </button>
        <span className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">본인 소개 수정</span>
      </header>

      <div className="px-4 py-5 flex flex-col gap-4 max-w-[600px] mx-auto">
        <p className="text-[13px] text-[#99A1AF]">
          상담사 상세 페이지 "소개" 탭에 노출되는 본문입니다. 이미지·서식 포함 가능.
        </p>

        {loaded ? (
          <div className="rounded-[12px] overflow-hidden border border-[#F3F4F6] bg-white">
            <Suspense fallback={
              <div className="h-[160px] flex items-center justify-center text-[13px] text-[#99A1AF]">
                에디터 로딩 중…
              </div>
            }>
              <HtmlEditor ref={editorRef} initialHtml={intro} height="400px" />
            </Suspense>
          </div>
        ) : (
          <div className="h-[160px] rounded-[12px] bg-white border border-[#F3F4F6] flex items-center justify-center text-[13px] text-[#99A1AF]">
            불러오는 중…
          </div>
        )}

        {error && <p className="text-[13px] text-[#FB2C36]">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !loaded}
          className="w-full h-[52px] rounded-full bg-[#9b7af7] text-white text-[15px] font-semibold disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1E2939] text-white text-[13px] px-4 py-2.5 rounded-full z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
