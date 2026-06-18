import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

/**
 * 관리자 시딩 후기 작성 모달 (초기 상담사 가치 부여 — 상담사 합의된 마케팅).
 *  - 상담사 선택(검색 + 이름 그리드) / 작성자 이름(자동생성·직접) / 작성일(과거 가능)
 *    / 상담종류·시간 / 별점 / 제목 / 내용
 *  - 제출 → POST /admin/posts/reviews/seed (검증 우회 + 코인/알림 미발송 + _seed 박제)
 */

type Counselor = { id: number; name: string | null; nickname: string | null; mb_id: string | null }

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '문', '양', '손', '배', '백']
const GIVEN_LAST = ['수', '지', '민', '준', '현', '우', '연', '서', '윤', '아', '은', '진', '호', '영', '규', '림', '솔']

/** displayReviewer 마스킹과 동일한 형태("연*" / "김*수")의 랜덤 표시명 생성 */
function genReviewerName(): string {
  const s = SURNAMES[Math.floor(Math.random() * SURNAMES.length)]
  if (Math.random() < 0.45) return `${s}*`
  const last = GIVEN_LAST[Math.floor(Math.random() * GIVEN_LAST.length)]
  return `${s}*${last}`
}

/** (현재시각 - days) 를 datetime-local input 값('YYYY-MM-DDTHH:mm')으로 */
function daysAgoLocalInput(days: number): string {
  const d = new Date(Date.now() - days * 86400000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 작성일 빠른 선택 프리셋 */
const DATE_PRESETS: { label: string; days: number }[] = [
  { label: '지금', days: 0 },
  { label: '1일 전', days: 1 },
  { label: '3일 전', days: 3 },
  { label: '1주 전', days: 7 },
  { label: '2주 전', days: 14 },
  { label: '한 달 전', days: 30 },
]

export default function SeedReviewModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [search, setSearch] = useState('')
  const [counselorId, setCounselorId] = useState<number | null>(null)

  const [reviewerName, setReviewerName] = useState(genReviewerName())
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [consultType, setConsultType] = useState<'채팅' | '전화'>('채팅')
  const [durMin, setDurMin] = useState(17)
  const [durSec, setDurSec] = useState(20)
  const [createdAt, setCreatedAt] = useState(daysAgoLocalInput(0))
  const [activePreset, setActivePreset] = useState<number | null>(0)
  const [showPicker, setShowPicker] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 모달 열릴 때 상담사 목록 로드 + 폼 초기화
  useEffect(() => {
    if (!open) return
    setError(null)
    setCounselorId(null)
    setSearch('')
    setReviewerName(genReviewerName())
    setTitle('')
    setContent('')
    setConsultType('채팅')
    setDurMin(17)
    setDurSec(20)
    setCreatedAt(daysAgoLocalInput(0))
    setActivePreset(0)
    setShowPicker(false)
    api<{ items: Counselor[] }>('/admin/members/counselors?limit=300')
      .then((r) => setCounselors(r.items ?? []))
      .catch(() => setCounselors([]))
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return counselors
    return counselors.filter((c) =>
      [c.name, c.nickname, c.mb_id].some((v) => (v ?? '').includes(q)),
    )
  }, [counselors, search])

  const selected = counselors.find((c) => c.id === counselorId) ?? null
  const labelOf = (c: Counselor) => c.nickname || c.name || c.mb_id || `#${c.id}`

  if (!open) return null

  const submit = async () => {
    setError(null)
    if (!counselorId) { setError('상담사를 선택해주세요.'); return }
    if (!reviewerName.trim()) { setError('작성자 이름을 입력해주세요.'); return }
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    if (!content.trim()) { setError('내용을 입력해주세요.'); return }
    setSubmitting(true)
    try {
      await api('/admin/posts/reviews/seed', {
        method: 'POST',
        body: JSON.stringify({
          counselor_id: counselorId,
          reviewer_name: reviewerName.trim(),
          title: title.trim(),
          content: content.trim(),
          // datetime-local(로컬) → ISO(UTC)로 명확히 변환해 전송
          created_at: new Date(createdAt).toISOString(),
          consult_type: consultType,
          consult_duration_sec: Math.max(0, durMin) * 60 + Math.max(0, durSec),
        }),
      })
      onSuccess('시딩 후기 작성 완료')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '작성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[680px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">시딩 후기 작성</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2">
          초기 상담사 가치 부여용 시딩 후기입니다. 회원 코인·상담사 알림은 발송되지 않으며, 시딩 표식이 박제됩니다.
        </p>

        {/* 상담사 선택 */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            상담사 선택 {selected && <span className="text-brand-600 font-semibold">— {labelOf(selected)}</span>}
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·닉네임·아이디 검색"
            className={inputCls + ' mb-2'}
          />
          <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto p-2 rounded-md border border-gray-200 dark:border-gray-700">
            {filtered.length === 0 ? (
              <span className="text-xs text-gray-400">상담사가 없습니다.</span>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCounselorId(c.id)}
                  className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                    counselorId === c.id
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >
                  {labelOf(c)}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 작성자 이름 */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">작성자 이름 (별표 표시)</label>
          <div className="flex gap-2">
            <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} className={inputCls} />
            <button
              onClick={() => setReviewerName(genReviewerName())}
              className="shrink-0 px-3 py-2 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
            >
              자동생성
            </button>
          </div>
        </div>

        {/* 작성일 — 빠른 선택 (대부분 클릭 한 번) */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">작성일</label>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((p) => {
              const on = !showPicker && activePreset === p.days
              return (
                <button
                  key={p.label}
                  onClick={() => { setCreatedAt(daysAgoLocalInput(p.days)); setActivePreset(p.days); setShowPicker(false) }}
                  className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                    on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >{p.label}</button>
              )
            })}
            <button
              onClick={() => { setShowPicker(true); setActivePreset(null) }}
              className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                showPicker ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-brand-50/50'
              }`}
            >직접 지정</button>
          </div>
          {showPicker && (
            <input type="datetime-local" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} className={inputCls + ' mt-2'} />
          )}
          <p className="text-[10px] text-gray-400 mt-1.5">
            → {new Date(createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>

        {/* 상담종류 + 시간 */}
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">상담 종류</label>
            <div className="flex gap-1">
              {(['채팅', '전화'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setConsultType(t)}
                  className={`px-3 py-2 text-xs rounded-md border font-medium ${
                    consultType === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >{t}상담</button>
              ))}
            </div>
          </div>
          <div className="w-[100px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">상담 분</label>
            <input type="number" min={0} value={durMin} onChange={(e) => setDurMin(Number(e.target.value))} className={inputCls} />
          </div>
          <div className="w-[100px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">상담 초</label>
            <input type="number" min={0} max={59} value={durSec} onChange={(e) => setDurSec(Number(e.target.value))} className={inputCls} />
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">제목</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 정말 많은 도움 되었습니다." className={inputCls} />
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">내용</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="후기 본문" className={inputCls + ' resize-y'} />
        </div>

        {error && <div className="text-sm text-rose-600 bg-rose-50 rounded-md px-3 py-2">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">취소</button>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-50"
          >
            {submitting ? '작성 중…' : '시딩 후기 등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
