import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 브라우저 자동 스크롤 복원 비활성화 — ScrollToTop 컴포넌트가 직접 관리
// history.replaceState 후 브라우저가 scroll을 0으로 복원하는 문제 방지
if (typeof window !== 'undefined') {
  window.history.scrollRestoration = 'manual'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
