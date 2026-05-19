import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
import CounselorGradeDetail from './pages/CounselorGradeDetail'
import ConsultationDetail from './pages/ConsultationDetail'
import RefundList from './pages/RefundList'
import OpsKpi from './pages/OpsKpi'
import ReferralList from './pages/ReferralList'
import AlimtalkBulk from './pages/AlimtalkBulk'
import PostsOverview from './pages/PostsOverview'
import PopupLayerForm from './pages/PopupLayerForm'
import PushNotifications from './pages/PushNotifications'
import PopupLayerList from './pages/PopupLayerList'
import SajuConfig from './pages/SajuConfig'
import SearchKeywords from './pages/SearchKeywords'
import SearchPopular from './pages/SearchPopular'
import SettlementList from './pages/SettlementList'
import Settings from './pages/Settings'
import StatsOverview from './pages/StatsOverview'

export default function App() {
  return (
    <BrowserRouter basename="/mng">
      <AuthProvider>
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
              <Route path="/saju-config" element={<SajuConfig />} />

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
              <Route path="/members/counselors/:id/grade-detail" element={<CounselorGradeDetail />} />

              {/* 채팅내역 */}
              <Route path="/chat-history" element={<ChatHistoryList />} />
              <Route path="/chat-history/by-roomid" element={<ChatHistoryDetail />} />
              <Route path="/chat-history/:id" element={<ChatHistoryDetail />} />

              {/* 환경설정 */}
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
