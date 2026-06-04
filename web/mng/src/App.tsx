import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AdminLayout from './components/layout/AdminLayout'
import RequireAuth from './components/RequireAuth'
import { AuthProvider } from './lib/auth'
import BannerForm from './pages/BannerForm'
import BannerList from './pages/BannerList'
import ChargeAmounts from './pages/ChargeAmounts'
import AdminPermissionMatrix from './pages/AdminPermissionMatrix'
import AdminUsers from './pages/AdminUsers'
import AlimtalkTemplates from './pages/AlimtalkTemplates'
import ChatHistoryDetail from './pages/ChatHistoryDetail'
import ChatHistoryList from './pages/ChatHistoryList'
import ConsultationList from './pages/ConsultationList'
import ContentForm from './pages/ContentForm'
import ContentList from './pages/ContentList'
import CouponZoneForm from './pages/CouponZoneForm'
import CouponZoneList from './pages/CouponZoneList'
import CounselorApplyDetail from './pages/CounselorApplyDetail'
import CounselorApplyList from './pages/CounselorApplyList'
import CounselorForm from './pages/CounselorForm'
import CounselorList from './pages/CounselorList'
import CustomerForm from './pages/CustomerForm'
import CustomerList from './pages/CustomerList'
import Dashboard from './pages/Dashboard'
import AllMenus from './pages/AllMenus'
import EventsList from './pages/EventsList'
import EventForm from './pages/EventForm'
import FaqList from './pages/FaqList'
import Login from './pages/Login'
import NoticesList from './pages/NoticesList'
import NoticeForm from './pages/NoticeForm'
import PaymentDetail from './pages/PaymentDetail'
import PaymentList from './pages/PaymentList'
import PointHistoryList from './pages/PointHistoryList'
import PostList from './pages/PostList'
import PostReports from './pages/PostReports'
import ReviewReports from './pages/ReviewReports'
import Attendance from './pages/Attendance'
import GradeManagement from './pages/GradeManagement'
import ProfitSimulator from './pages/ProfitSimulator'
import CounselorGradeDetail from './pages/CounselorGradeDetail'
import ConsultationDetail from './pages/ConsultationDetail'
import RefundList from './pages/RefundList'
import ShortCallRefundList from './pages/ShortCallRefundList'
import PayoutList from './pages/PayoutList'
import OpsKpi from './pages/OpsKpi'
import ReferralList from './pages/ReferralList'
import AlimtalkBulk from './pages/AlimtalkBulk'
import PostsOverview from './pages/PostsOverview'
import PopupLayerForm from './pages/PopupLayerForm'
import PushNotifications from './pages/PushNotifications'
import PushGuide from './pages/PushGuide'
import AlertGuide from './pages/AlertGuide'
import PopupLayerList from './pages/PopupLayerList'

import SearchKeywords from './pages/SearchKeywords'
import SearchPopular from './pages/SearchPopular'
import SettlementList from './pages/SettlementList'
import Settings from './pages/Settings'
import AdminMemo from './pages/AdminMemo'
import AdminHandbook from './pages/AdminHandbook'
import InfraInfo from './pages/InfraInfo'
import AdminHandbookAI from './pages/AdminHandbookAI'
import AdminHandbookConfig from './pages/AdminHandbookConfig'
import StatsOverview from './pages/StatsOverview'

/**
 * 라우트 변경 시 페이지 상단으로 자동 스크롤.
 *  - AdminLayout 의 <main> 은 overflow-auto 자체 스크롤 컨테이너 → 그쪽이 진짜 스크롤 타깃.
 *  - 즉시 reset + rAF reset 두 번 호출 (렌더링 직후 콘텐츠 갱신 타이밍 보장).
 *  - behavior 'instant' 로 즉시 점프 (smooth 애니메이션 X — 페이지 전환 시 부드러움보다 정확성).
 */
function ScrollToTop() {
  const { pathname } = useLocation()

  // 마운트 1회 — 브라우저 자동 스크롤 복원 OFF (우리가 직접 제어)
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    const reset = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
      } catch {
        window.scrollTo(0, 0)
      }
      document.querySelectorAll('main, [data-scroll-root], .overflow-auto, .overflow-y-auto').forEach((el) => {
        ;(el as HTMLElement).scrollTop = 0
      })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    // 5중 안전망 — 다양한 렌더 타이밍 모두 커버
    reset()
    const raf = requestAnimationFrame(reset)
    const t1 = window.setTimeout(reset, 50)
    const t2 = window.setTimeout(reset, 200)
    const t3 = window.setTimeout(reset, 500)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter basename="/mng">
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<AdminLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/all-menus" element={<AllMenus />} />

              {/* 회원현황 */}
              <Route path="/members/customers" element={<CustomerList />} />
              <Route path="/members/customers/new" element={<CustomerForm />} />
              <Route path="/members/customers/:id" element={<CustomerForm />} />
              <Route path="/members/counselors" element={<CounselorList />} />
              <Route path="/members/counselors/new" element={<CounselorForm />} />
              <Route path="/members/counselors/:id" element={<CounselorForm />} />
              <Route path="/members/counselor-apply" element={<CounselorApplyList />} />
              <Route path="/members/counselor-apply/:id" element={<CounselorApplyDetail />} />

              {/* 매출현황 */}
              <Route path="/consultations" element={<ConsultationList />} />
              <Route path="/consultations/:id" element={<ConsultationDetail />} />
              <Route path="/refunds" element={<RefundList />} />
              <Route path="/short-call-refunds" element={<ShortCallRefundList />} />
              <Route path="/payouts" element={<PayoutList />} />
              <Route path="/ops-kpi" element={<OpsKpi />} />
              <Route path="/alimtalk-bulk" element={<AlimtalkBulk />} />
              <Route path="/charge-amounts" element={<ChargeAmounts />} />
              <Route path="/payments" element={<PaymentList />} />
              <Route path="/payments/:id" element={<PaymentDetail />} />
              <Route path="/points/history" element={<PointHistoryList />} />
              <Route path="/settlements" element={<SettlementList />} />
              <Route path="/referrals" element={<ReferralList />} />

              {/* 쿠폰존 관리 */}
              <Route path="/coupon-zones" element={<CouponZoneList />} />
              <Route path="/coupon-zones/new" element={<CouponZoneForm />} />
              <Route path="/coupon-zones/:id" element={<CouponZoneForm />} />

              {/* 기타 */}
              <Route path="/banners" element={<BannerList />} />
              <Route path="/banners/new" element={<BannerForm />} />
              <Route path="/banners/:id" element={<BannerForm />} />
              <Route path="/popup-layers" element={<PopupLayerList />} />
              <Route path="/popup-layers/new" element={<PopupLayerForm />} />
              <Route path="/popup-layers/:id" element={<PopupLayerForm />} />


              {/* 게시판관리 */}
              <Route path="/search-keywords" element={<SearchKeywords />} />
              <Route path="/search-popular" element={<SearchPopular />} />
              <Route path="/posts-overview" element={<PostsOverview />} />
              <Route path="/post-reports" element={<PostReports />} />
              <Route path="/faqs" element={<FaqList />} />
              <Route path="/notices" element={<NoticesList />} />
              <Route path="/notices/new" element={<NoticeForm />} />
              <Route path="/notices/:id" element={<NoticeForm />} />
              <Route path="/events" element={<EventsList />} />
              <Route path="/events/new" element={<EventForm />} />
              <Route path="/events/:id" element={<EventForm />} />

              {/* 알림 */}
              <Route path="/push-notifications" element={<PushNotifications />} />
              <Route path="/push-guide" element={<PushGuide />} />
              <Route path="/alert-guide" element={<AlertGuide />} />
              <Route path="/alimtalk-templates" element={<AlimtalkTemplates />} />

              {/* 통계 */}
              <Route path="/stats" element={<StatsOverview />} />

              {/* 권한관리 */}
              <Route path="/admin-users" element={<AdminUsers />} />
              <Route path="/admin-permissions/:id" element={<AdminPermissionMatrix />} />

              {/* 콘텐츠 (라우트만 보존) */}
              <Route path="/contents" element={<ContentList />} />
              <Route path="/contents/new" element={<ContentForm />} />
              <Route path="/contents/:id" element={<ContentForm />} />

              {/* 게시판 통합 (review/wish/wish_event/qa/qa_counselor) */}
              <Route path="/posts/:slug" element={<PostList />} />

              {/* 후기 신고 관리 (2026-05-15 신설) */}
              <Route path="/review-reports" element={<ReviewReports />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/grade" element={<GradeManagement />} />
              <Route path="/profit-simulator" element={<ProfitSimulator />} />
              <Route path="/members/counselors/:id/grade-detail" element={<CounselorGradeDetail />} />

              {/* 채팅내역 */}
              <Route path="/chat-history" element={<ChatHistoryList />} />
              <Route path="/chat-history/by-roomid" element={<ChatHistoryDetail />} />
              <Route path="/chat-history/:id" element={<ChatHistoryDetail />} />

              {/* 환경설정 */}
              <Route path="/settings" element={<Settings />} />

              {/* 메모장 — 관리자 개인 메모 (2026-05-22) */}
              <Route path="/memo" element={<AdminMemo />} />

              {/* 운영 바이블 — 채팅·결제 핵심 정책 + 자연어 질문 검색 (2026-05-30) */}
              <Route path="/handbook" element={<AdminHandbook />} />

              {/* 운영 바이블 AI — Claude API 기반 자연어 답변 (2026-05-31, Phase 2-A) */}
              <Route path="/handbook-ai" element={<AdminHandbookAI />} />
              <Route path="/handbook-config" element={<AdminHandbookConfig />} />

              {/* 인프라 잠금 정보 — 슈퍼관리자 전용 (2026-06-02) */}
              <Route path="/infra-info" element={<InfraInfo />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
