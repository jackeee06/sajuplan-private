import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import { useHighlightOnLoad } from '../../lib/useHighlightOnLoad'

export default function AdminLayout() {
  // ?hl=키워드 쿼리스트링이 있으면 페이지 mount 후 해당 텍스트로
  // 자동 스크롤 + 형광펜 강조 (전체 메뉴에서 sub-feature 클릭 시 작동).
  useHighlightOnLoad()

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
