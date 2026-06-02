import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import ConsultHistoryCard from '../components/ConsultHistoryCard'
import { MOCK_CALL_HISTORY } from '../data/myActivities'

/**
 * 전화상담 내역 — Figma 109:10816
 *  카드 리스트: ConsultHistoryCard 재사용 (type='전화상담')
 */
export default function MyCalls() {
  const navigate = useNavigate()
  const [items, setItems] = useState(MOCK_CALL_HISTORY)

  const handleDelete = (id: number) => {
    setItems((list) => list.filter((it) => it.id !== id))
  }

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
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
          전화상담 내역
        </h1>
      </header>

      <main className="flex-1 px-4">
        {items.map((it) => (
          <ConsultHistoryCard key={it.id} item={it} type="전화상담" onDelete={handleDelete} />
        ))}
      </main>

      <FloatingActions bottomOffset={24} />
      <BottomNav />
      </div>
  )
}
