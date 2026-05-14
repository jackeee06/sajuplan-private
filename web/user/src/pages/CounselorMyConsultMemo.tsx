import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, consultApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import {
  CONSULT_MEMO_CATEGORIES,
  CONSULT_MEMO_TOPICS,
} from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_전화상담 메모 작성 / 채팅상담 메모 작성
 * Figma node-id: 165:11772 (전화) / 163:25453 (채팅)
 *
 * URL 패턴:
 *  - /counselor/mypage/calls/:id/memo  → type=phone
 *  - /counselor/mypage/chats/:id/memo  → type=chat
 *
 * :id 는 consultation.id. 백엔드가 본인 상담만 GET/POST 허용.
 * 폼: 상담분류(셀렉트) / 상담주제(셀렉트) / 메모(텍스트에어리어) / 작성완료(UPSERT)
 */
export default function CounselorMyConsultMemo() {
  const navigate = useNavigate()
  const { member } = useAuth()
  const { id = '0', type = 'phone' } = useParams<{ id: string; type: string }>()
  const isChat = type === 'chat'
  const consultationId = Number(id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consult, setConsult] = useState<{
    member_name: string
    started_at: string | null
    ended_at: string | null
    amt: number
  } | null>(null)

  const [category, setCategory] = useState('')
  const [topic, setTopic] = useState('')
  const [memo, setMemo] = useState('')

  useEffect(() => {
    if (!Number.isFinite(consultationId) || consultationId <= 0) {
      setError('잘못된 상담 정보입니다.')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    consultApi
      .getMemo(consultationId)
      .then((r) => {
        if (!alive) return
        if (!r.consultation) {
          setError('상담 정보를 찾을 수 없습니다.')
          return
        }
        setConsult({
          member_name: r.consultation.member_name,
          started_at: r.consultation.started_at,
          ended_at: r.consultation.ended_at,
          amt: r.consultation.amt,
        })
        if (r.memo) {
          setCategory(r.memo.category ?? '')
          setTopic(r.memo.topic ?? '')
          setMemo(r.memo.memo ?? '')
        }
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login')
          return
        }
        setError(e instanceof Error ? e.message : '메모를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [consultationId, navigate])

  const handleSave = async () => {
    if (saving) return
    if (!category) {
      setError('상담분류를 선택해주세요.')
      return
    }
    if (!topic) {
      setError('상담주제를 선택해주세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await consultApi.saveMemo(consultationId, {
        category,
        topic,
        memo: memo.trim() || null,
      })
      navigate(-1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mobile-frame flex flex-col pb-6">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          {isChat ? '채팅상담 메모' : '전화상담 메모'}
        </h1>
      </header>

      <main className="flex-1 px-4 pt-2 flex flex-col gap-5">
        {loading && (
          <p className="py-10 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
        )}

        {!loading && error && !consult && (
          <p className="py-10 text-center text-[14px] text-[#FB2C36]">{error}</p>
        )}

        {!loading && consult && (
          <>
            {/* 상단 회색 카드 */}
            <section className="rounded-[12px] bg-[#F9FAFB] px-5 py-4">
              <p className="text-[16px] font-bold text-[#030712]">{consult.member_name}</p>
              <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
                <li className="flex items-center justify-between">
                  <span className="text-[#6A7282]">상담사</span>
                  <span className="text-[#1E2939]">{member?.name ?? ''}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[#6A7282]">시작시간</span>
                  <span className="text-[#1E2939]">{formatKDateTime(consult.started_at)}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[#6A7282]">완료시간</span>
                  <span className="text-[#1E2939]">{formatKDateTime(consult.ended_at)}</span>
                </li>
                {isChat && (
                  <li className="flex items-center justify-between">
                    <span className="text-[#6A7282]">과금 포인트</span>
                    <span className="text-[#1E2939]">{(consult.amt ?? 0).toLocaleString()}P</span>
                  </li>
                )}
              </ul>
            </section>

            <Field label="상담분류" required>
              <SimpleSelect
                value={category}
                options={CONSULT_MEMO_CATEGORIES}
                placeholder="상담분류 선택"
                onChange={(v) => {
                  setCategory(v)
                  if (error === '상담분류를 선택해주세요.') setError(null)
                }}
              />
            </Field>

            <Field label="상담주제" required>
              <SimpleSelect
                value={topic}
                options={CONSULT_MEMO_TOPICS}
                placeholder="상담주제 선택"
                onChange={(v) => {
                  setTopic(v)
                  if (error === '상담주제를 선택해주세요.') setError(null)
                }}
              />
            </Field>

            <div>
              <p className="text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">메모</p>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="고객 상담 메모를 작성해보세요."
                rows={6}
                className="w-full px-4 py-3 rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] leading-[150%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none resize-none"
              />
            </div>

            {error && (
              <p className="text-[13px] text-[#FB2C36]">{error}</p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mt-2 w-full h-[52px] rounded-full bg-[#9B7AF7] text-white text-[16px] font-semibold disabled:opacity-60"
            >
              {saving ? '저장 중...' : '작성완료'}
            </button>
          </>
        )}
      </main>
    </div>
  )
}

function formatKDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/* ─────────── 폼 헬퍼 ─────────── */

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">
        {label}
        {required && <span className="text-[#FF6467] ml-0.5">*</span>}
      </p>
      {children}
    </div>
  )
}

function SimpleSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string
  options: readonly string[]
  placeholder: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-between text-[15px]"
      >
        <span className={value ? 'text-[#1E2939]' : 'text-[#99A1AF]'}>{value || placeholder}</span>
        <svg viewBox="0 0 16 16" className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" aria-hidden>
          <path d="M4 6L8 10L12 6" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-[260px] overflow-y-auto bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_8px_20px_rgba(16,24,40,0.08)] py-1"
        >
          {options.map((opt) => {
            const selected = value === opt
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={`w-full px-4 py-2.5 text-left text-[15px] leading-5 ${
                    selected ? 'text-[#8259F5] font-medium bg-[#F3EEFE]' : 'text-[#1E2939] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {opt}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
