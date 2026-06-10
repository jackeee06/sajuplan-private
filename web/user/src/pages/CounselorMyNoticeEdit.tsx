import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { useAuth } from '../lib/auth-context'
import { counselorMypageApi } from '../lib/api'

const MAX_LEN = 2000

/**
 * 상담사 마이페이지 — 내 공지사항 작성/수정
 * Route: /counselor/mypage/notice-edit
 *
 * 상담사 프로필 상세 페이지의 "상담사 공지사항" 영역에 표시됨.
 * 휴가 일정, 상담 가능 시간, 안내사항 등을 직접 입력.
 */
export default function CounselorMyNoticeEdit() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()

  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!member || member.role !== 'counselor') return
    let alive = true
    counselorMypageApi.getMyNotice()
      .then((r) => { if (alive) { setNotice(r.notice ?? ''); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [member])

  const save = async () => {
    setSaving(true)
    try {
      await counselorMypageApi.setMyNotice(notice)
      setSaved(true)
      setToast('공지사항이 저장됐습니다.')
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
          <h1 className="text-[18px] font-semibold text-[#030712]">공지사항 작성</h1>
        </div>
        <main className="flex-1 px-4 py-6">
          <div className="h-48 rounded-2xl bg-[#F3F4F6] animate-pulse" />
        </main>
      </div>
    )
  }
  if (!member) return <Navigate to="/login?redirect=/counselor/mypage/notice-edit" replace />
  if (member.role !== 'counselor') return <Navigate to="/mypage" replace />

  const remaining = MAX_LEN - notice.length

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
          공지사항 작성
        </h1>
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {/* 안내 */}
        <section className="rounded-[16px] bg-[#fffbeb] border border-[#fde68a] p-4">
          <p className="text-[13px] leading-[160%] text-[#92400e]">
            상담사 프로필 페이지의 <strong>상담사 공지사항</strong> 영역에 표시됩니다.<br />
            휴가 일정, 상담 가능 시간, 이벤트 안내 등을 자유롭게 작성해주세요.
          </p>
        </section>

        {/* 입력 */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-[#1E2939]">공지 내용</p>
            <span className={`text-[12px] ${remaining < 100 ? 'text-[#FB2C36]' : 'text-[#9CA3AF]'}`}>
              {notice.length} / {MAX_LEN}
            </span>
          </div>
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value.slice(0, MAX_LEN))}
            placeholder={`예시:\n📅 5월 20일 ~ 25일 개인 사정으로 휴가입니다.\n✅ 평일 오전 9시 ~ 오후 6시 상담 가능합니다.\n📞 긴급 문의는 채팅으로 남겨주세요.`}
            rows={10}
            className="w-full rounded-[16px] border border-[#F3F4F6] bg-[#F9FAFB] p-4 text-[14px] leading-[170%] text-[#1E2939] placeholder-[#9CA3AF] focus:outline-none focus:border-[#9b7af7] resize-none"
          />
          <p className="text-[12px] text-[#9CA3AF]">
            줄바꿈은 Enter로, 이모지 사용 가능합니다.
          </p>
        </section>

        {/* 미리보기 */}
        {notice.trim() && (
          <section className="rounded-[16px] border border-[#F3F4F6] bg-white p-4">
            <p className="text-[12px] font-semibold text-[#9CA3AF] mb-2">미리보기 — 프로필에서 이렇게 보입니다</p>
            <p className="text-[14px] leading-[150%] text-[#4A5565] whitespace-pre-line">
              {notice}
            </p>
          </section>
        )}

        {/* 저장 */}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full h-12 rounded-full bg-[#9b7af7] text-white text-[15px] font-semibold disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장하기'}
        </button>

        {/* 저장 후 프로필 확인 링크 */}
        {saved && (
          <Link
            to={`/counselors/${member.id}`}
            className="w-full h-12 rounded-full border border-[#9b7af7] text-[#9b7af7] text-[15px] font-semibold flex items-center justify-center gap-2"
          >
            프로필에서 확인하기 →
          </Link>
        )}

        {/* 삭제 */}
        {notice.trim() && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('공지사항을 삭제하시겠습니까?')) {
                setNotice('')
                setSaved(false)
              }
            }}
            className="w-full h-10 rounded-full border border-[#E5E7EB] text-[14px] text-[#6A7282]"
          >
            공지 지우기
          </button>
        )}
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
