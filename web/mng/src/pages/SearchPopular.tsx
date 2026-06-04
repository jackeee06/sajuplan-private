import { useEffect, useRef, useState } from 'react'
import { Pin, X } from 'lucide-react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Chip, NumCell } from '../components/table'

interface RankItem {
  word: string
  total_count: number
  last_date: string
}

interface PinItem {
  rank: number
  keyword: string
}

const PERIODS = [
  { days: 1, label: '오늘' },
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
  { days: 90, label: '최근 90일' },
]

const MAX_PINS = 2

export default function SearchPopular() {
  const [days, setDays] = useState(7)
  const [items, setItems] = useState<RankItem[]>([])
  const [loading, setLoading] = useState(false)

  // 핀 상태
  const [pins, setPins] = useState<(string)[]>(Array(MAX_PINS).fill('')) // index 0 = rank 1
  const [pinSaving, setPinSaving] = useState(false)
  const [pinSavedAt, setPinSavedAt] = useState<Date | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // 순위 데이터 로드
  useEffect(() => {
    setLoading(true)
    api<{ items: RankItem[] }>(`/admin/board-ops/popular-ranking?days=${days}`)
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false))
  }, [days])

  // 핀 초기 로드
  useEffect(() => {
    api<{ items: PinItem[] }>('/admin/board-ops/keyword-pins').then((r) => {
      const next = Array(MAX_PINS).fill('')
      r.items.forEach((p) => {
        if (p.rank >= 1 && p.rank <= MAX_PINS) next[p.rank - 1] = p.keyword
      })
      setPins(next)
    })
  }, [])

  const handlePinChange = (idx: number, val: string) => {
    setPins((prev) => { const next = [...prev]; next[idx] = val; return next })
  }

  const handlePinClear = (idx: number) => {
    setPins((prev) => { const next = [...prev]; next[idx] = ''; return next })
    inputRefs.current[idx]?.focus()
  }

  const handleSavePins = async () => {
    setPinSaving(true)
    try {
      const pinPayload: PinItem[] = pins
        .map((kw, i) => ({ rank: i + 1, keyword: kw.trim() }))
        .filter((p) => p.keyword !== '')
      await api('/admin/board-ops/keyword-pins', {
        method: 'PUT',
        body: JSON.stringify({ pins: pinPayload }),
      })
      setPinSavedAt(new Date())
      alert('저장되었습니다.')
    } finally {
      setPinSaving(false)
    }
  }

  const activePinCount = pins.filter((kw) => kw.trim() !== '').length

  return (
    <div className="space-y-5 max-w-[1100px]">

      {/* ── 핀 고정 관리 ── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <Pin className="w-4 h-4 text-brand-500" />
              인기검색어 핀 고정
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              입력한 순위에 키워드를 고정합니다. 비워두면 실검색 순위로 자동 채워집니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pinSavedAt && (
              <span className="text-sm font-medium text-green-600">
                ✓ 저장되었습니다
              </span>
            )}
            <button
              onClick={handleSavePins}
              disabled={pinSaving}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium"
            >
              {pinSaving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {pins.map((kw, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`w-5 text-right text-sm font-bold shrink-0 ${kw.trim() ? 'text-brand-500' : 'text-gray-300'}`}>
                {i + 1}
              </span>
              <div className="relative">
                <input
                  ref={(el) => { inputRefs.current[i] = el }}
                  type="text"
                  value={kw}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  placeholder={`${i + 1}위`}
                  maxLength={20}
                  className="w-[130px] pl-2.5 pr-7 py-1.5 text-sm border rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:text-gray-100 placeholder-gray-300"
                />
                {kw && (
                  <button
                    onClick={() => handlePinClear(i)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {activePinCount > 0 && (
          <p className="text-xs text-brand-500">
            현재 {activePinCount}개 핀 고정 중 — 나머지 {MAX_PINS - activePinCount}개 슬롯은 실검색 순위로 채워집니다.
          </p>
        )}
      </div>

      {/* ── 순위 조회 ── */}
      <div>
        <div className="mb-2">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">인기검색어 순위</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">집계 기간별 검색어 랭킹 (실검색 기준)</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="text-xs text-gray-500 mr-1">집계 기간</span>
          {PERIODS.map((p) => (
            <Chip key={p.days} label={p.label} active={days === p.days} onClick={() => setDays(p.days)} />
          ))}
        </div>

        <TableShell>
          <THead>
            <Th align="center">순위</Th>
            <Th align="left">검색어</Th>
            <Th align="right">검색수</Th>
            <Th align="left">최근 날짜</Th>
          </THead>
          <TBody>
            {loading ? (
              <EmptyRow colSpan={4} loading />
            ) : items.length === 0 ? (
              <EmptyRow colSpan={4} />
            ) : (
              items.map((i, idx) => (
                <Tr key={i.word}>
                  <Td align="center">
                    {idx + 1 <= 3 ? (
                      <span className="font-bold text-amber-600">#{idx + 1}</span>
                    ) : (
                      <span className="text-gray-400">#{idx + 1}</span>
                    )}
                  </Td>
                  <Td align="left" className="font-medium">{i.word}</Td>
                  <Td align="right"><NumCell value={i.total_count} bold /></Td>
                  <Td align="left" className="text-xs text-gray-500 tabular-nums">{i.last_date}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </TableShell>
      </div>
    </div>
  )
}
