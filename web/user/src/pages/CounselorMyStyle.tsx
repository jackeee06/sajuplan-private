import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { useAuth } from '../lib/auth-context'
import { counselorMypageApi, settingsApi } from '../lib/api'

/**
 * 상담사 마이페이지 — 내 상담 스타일 설정
 * Route: /counselor/mypage/style
 */
export default function CounselorMyStyle() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()

  const [styleOptions, setStyleOptions] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!member || member.role !== 'counselor') return
    let alive = true

    Promise.all([
      settingsApi.public(),
      counselorMypageApi.getMyTraits(),
    ]).then(([s, t]) => {
      if (!alive) return
      const raw = s['counselor.style_options']
      if (raw) {
        try { setStyleOptions(JSON.parse(raw) as string[]) } catch { /* 기본값 */ }
      }
      setSelected(t.traits ?? [])
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [member])

  const toggle = (opt: string) => {
    setSelected((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      await counselorMypageApi.setMyTraits(selected)
      setToast('저장됐습니다.')
      setTimeout(() => setToast(null), 2500)
    } catch {
      setToast('저장에 실패했습니다.')
      setTimeout(() => setToast(null), 2500)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="h-[60px] px-4 flex items-center bg-white">
          <h1 className="text-[18px] font-semibold text-[#030712]">상담 스타일</h1>
        </div>
        <main className="flex-1 px-4 py-6">
          <div className="h-32 rounded-2xl bg-[#F3F4F6] animate-pulse" />
        </main>
      </div>
    )
  }
  if (!member) return <Navigate to="/login?redirect=/counselor/mypage/style" replace />
  if (member.role !== 'counselor') return <Navigate to="/mypage" replace />

  return (
    <div className="mobile-frame flex flex-col pb-[80px]">
      {/* 헤더 */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-[30px] h-[30px] flex items-center justify-center"
          aria-label="뒤로가기"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          상담 스타일
        </h1>
      </header>

      <main className="flex-1 px-4 py-4">
        {/* 안내 */}
        <section className="rounded-[16px] bg-[#f3f0ff] border border-[#e9d5ff] p-4 mb-4">
          <p className="text-[13px] leading-[160%] text-[#6d28d9]">
            본인의 상담 스타일을 선택해주세요.<br />
            선택한 스타일은 상담사 프로필 페이지에 표시됩니다.
          </p>
        </section>

        {/* 스타일 선택 */}
        <section className="rounded-[16px] bg-white border border-[#F3F4F6] p-5">
          <p className="text-[14px] font-semibold text-[#1E2939] mb-3">스타일 선택</p>
          {styleOptions.length === 0 ? (
            <p className="text-[13px] text-[#6A7282]">등록된 스타일 선택지가 없습니다.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {styleOptions.map((opt) => {
                const active = selected.includes(opt)
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => toggle(opt)}
                      className={
                        active
                          ? 'h-[38px] px-5 rounded-full bg-[#f472b6] text-white text-[14px] font-medium'
                          : 'h-[38px] px-5 rounded-full border border-[#E5E7EB] bg-white text-[#6A7282] text-[14px] font-medium'
                      }
                    >
                      {opt}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {selected.length > 0 && (
            <p className="mt-3 text-[12px] text-[#9b7af7]">
              선택됨: {selected.join(', ')}
            </p>
          )}
        </section>

        {/* 저장 */}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-4 w-full h-12 rounded-full bg-[#9b7af7] text-white text-[15px] font-semibold disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장하기'}
        </button>
      </main>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-[#1E2939] text-white text-[13px] font-medium shadow-lg">
          {toast}
        </div>
      )}

      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}
