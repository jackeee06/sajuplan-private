import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Chip, NumCell } from '../components/table'

interface Item {
  word: string
  total_count: number
  last_date: string
}

const PERIODS = [
  { days: 1, label: '오늘' },
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
  { days: 90, label: '최근 90일' },
]

export default function SearchPopular() {
  const [days, setDays] = useState(7)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api<{ items: Item[] }>(`/admin/board-ops/popular-ranking?days=${days}`)
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">인기검색어 순위</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">집계 기간별 검색어 랭킹</p>
      </div>

      {/* 기간 칩 */}
      <div className="flex flex-wrap gap-2 items-center">
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
  )
}
