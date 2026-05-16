import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth-context'
import { ConsultProvider } from './lib/consult-context'
import { LikeProvider } from './lib/like-context'
import { LoginPromptProvider } from './lib/login-prompt-context'
import NativeBackBridge from './components/NativeBackBridge'
import AttendanceToast from './components/AttendanceToast'
import ScrollToTop from './components/ScrollToTop'
import MyPageEntry from './pages/MyPageEntry'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SignupComplete from './pages/SignupComplete'
import Find from './pages/Find'
import FindComplete from './pages/FindComplete'
import Home from './pages/Home'
import Search from './pages/Search'
import SearchResult from './pages/SearchResult'
import Notifications from './pages/Notifications'
import CounselorList from './pages/CounselorList'
import CounselorDetail from './pages/CounselorDetail'
import CounselorReviews from './pages/CounselorReviews'
import CounselorQna from './pages/CounselorQna'
import CounselorQnaDetail from './pages/CounselorQnaDetail'
import CounselorQnaNew from './pages/CounselorQnaNew'
import CounselorReviewNew from './pages/CounselorReviewNew'
import ChatRoom from './pages/ChatRoom'
import ChatLog from './pages/ChatLog'
import Favorites from './pages/Favorites'
import Reviews from './pages/Reviews'
import ReviewDetail from './pages/ReviewDetail'
import MemberMyPage from './pages/MemberMyPage'
import MemberEdit from './pages/MemberEdit'
import AppSettings from './pages/AppSettings'
import MyCalls from './pages/MyCalls'
import MyChats from './pages/MyChats'
import MyHistory from './pages/MyHistory'
import SettlementHistory from './pages/SettlementHistory'
import MyReviews from './pages/MyReviews'
import MyReviewDetail from './pages/MyReviewDetail'
import MyReviewNew from './pages/MyReviewNew'
import MyReviewEdit from './pages/MyReviewEdit'
import MyQnas from './pages/MyQnas'
import MyQnaDetail from './pages/MyQnaDetail'
import Coupons from './pages/Coupons'
import Payments from './pages/Payments'
import Points from './pages/Points'
import Charge from './pages/Charge'
import ChargeCardRegister from './pages/ChargeCardRegister'
import ChargeComplete from './pages/ChargeComplete'
import ChargeVbankInfo from './pages/ChargeVbankInfo'
import CounselorMyPage from './pages/CounselorMyPage'
import CounselorMyTips from './pages/CounselorMyTips'
import CounselorMyTipDetail from './pages/CounselorMyTipDetail'
import CounselorMyNotices from './pages/CounselorMyNotices'
import CounselorMyNoticeDetail from './pages/CounselorMyNoticeDetail'
import CounselorMyQnas from './pages/CounselorMyQnas'
import CounselorMyQnaNew from './pages/CounselorMyQnaNew'
import CounselorMyQnaDetail from './pages/CounselorMyQnaDetail'
import CounselorMyCustomerQnas from './pages/CounselorMyCustomerQnas'
import CounselorMyCustomerQnaDetail from './pages/CounselorMyCustomerQnaDetail'
import CounselorMyReviews from './pages/CounselorMyReviews'
import CounselorMyReviewDetail from './pages/CounselorMyReviewDetail'
import CounselorMyCalls from './pages/CounselorMyCalls'
import CounselorMyChats from './pages/CounselorMyChats'
import CounselorMyConsultMemo from './pages/CounselorMyConsultMemo'
import CounselorMyConsultStats from './pages/CounselorMyConsultStats'
import CounselorMyProducts from './pages/CounselorMyProducts'
import CounselorMyProductInfo from './pages/CounselorMyProductInfo'
import CounselorMyProductReviews from './pages/CounselorMyProductReviews'
import CounselorMyProductQna from './pages/CounselorMyProductQna'
import CounselorMyProductGuide from './pages/CounselorMyProductGuide'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import Notices from './pages/Notices'
import NoticeDetail from './pages/NoticeDetail'
import Help from './pages/Help'
import NewCounselors from './pages/NewCounselors'
import CounselorApply from './pages/CounselorApply'
import CounselorApplyNew from './pages/CounselorApplyNew'
import CounselorApplyDone from './pages/CounselorApplyDone'
import CounselorApplyDetail from './pages/CounselorApplyDetail'

export default function App() {
  return (
    <BrowserRouter basename="/">
      <AuthProvider>
      <LoginPromptProvider>
      <LikeProvider>
      <ConsultProvider>
      <ScrollToTop />
      <NativeBackBridge />
      <AttendanceToast />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/signup/complete" element={<SignupComplete />} />
        <Route path="/find" element={<Find />} />
        <Route path="/find/complete" element={<FindComplete />} />
        <Route path="/search" element={<Search />} />
        <Route path="/search/result" element={<SearchResult />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/counselors" element={<CounselorList />} />
        <Route path="/counselors/:id" element={<CounselorDetail />} />
        <Route path="/counselors/:id/reviews" element={<CounselorReviews />} />
        <Route path="/counselors/:id/reviews/new" element={<CounselorReviewNew />} />
        <Route path="/counselors/:id/qna" element={<CounselorQna />} />
        <Route path="/counselors/:id/qna/:qnaId" element={<CounselorQnaDetail />} />
        <Route path="/counselors/:id/qna/new" element={<CounselorQnaNew />} />
        <Route path="/chat/:id" element={<ChatRoom />} />
        <Route path="/chat-log/:id" element={<ChatLog />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/reviews/:id" element={<ReviewDetail />} />
        <Route path="/mypage" element={<MyPageEntry />} />
        <Route path="/mypage/member" element={<MemberMyPage />} />
        <Route path="/mypage/member/edit" element={<MemberEdit />} />
        <Route path="/mypage/app-settings" element={<AppSettings />} />
        <Route path="/mypage/calls" element={<MyCalls />} />
        <Route path="/mypage/chats" element={<MyChats />} />
        <Route path="/mypage/history" element={<MyHistory />} />
        <Route path="/mypage/settlement/history" element={<SettlementHistory />} />
        <Route path="/mypage/my-reviews" element={<MyReviews />} />
        <Route path="/mypage/my-reviews/new" element={<MyReviewNew />} />
        <Route path="/mypage/my-reviews/:id/edit" element={<MyReviewEdit />} />
        <Route path="/mypage/my-reviews/:id" element={<MyReviewDetail />} />
        <Route path="/mypage/my-qnas" element={<MyQnas />} />
        <Route path="/mypage/my-qnas/:id" element={<MyQnaDetail />} />
        <Route path="/mypage/coupons" element={<Coupons />} />
        <Route path="/mypage/payments" element={<Payments />} />
        <Route path="/mypage/points" element={<Points />} />
        <Route path="/mypage/charge" element={<Charge />} />
        <Route path="/mypage/charge/card-register" element={<ChargeCardRegister />} />
        <Route path="/charge/complete" element={<ChargeComplete />} />
        <Route path="/charge/vbank-info" element={<ChargeVbankInfo />} />
        <Route path="/counselor/mypage" element={<CounselorMyPage />} />
        <Route path="/counselor/mypage/tips" element={<CounselorMyTips />} />
        <Route path="/counselor/mypage/tips/:id" element={<CounselorMyTipDetail />} />
        <Route path="/counselor/mypage/notices" element={<CounselorMyNotices />} />
        <Route path="/counselor/mypage/notices/:id" element={<CounselorMyNoticeDetail />} />
        <Route path="/counselor/mypage/qnas" element={<CounselorMyQnas />} />
        <Route path="/counselor/mypage/qnas/new" element={<CounselorMyQnaNew />} />
        <Route path="/counselor/mypage/qnas/:id" element={<CounselorMyQnaDetail />} />
        <Route path="/counselor/mypage/customer-qnas" element={<CounselorMyCustomerQnas />} />
        <Route path="/counselor/mypage/customer-qnas/:id" element={<CounselorMyCustomerQnaDetail />} />
        <Route path="/counselor/mypage/reviews" element={<CounselorMyReviews />} />
        <Route path="/counselor/mypage/reviews/:id" element={<CounselorMyReviewDetail />} />
        <Route path="/counselor/mypage/calls" element={<CounselorMyCalls />} />
        <Route path="/counselor/mypage/chats" element={<CounselorMyChats />} />
        <Route path="/counselor/mypage/:type/:id/memo" element={<CounselorMyConsultMemo />} />
        <Route path="/counselor/mypage/consult-stats" element={<CounselorMyConsultStats />} />
        <Route path="/counselor/mypage/products" element={<CounselorMyProducts />} />
        <Route path="/counselor/mypage/products/:id/info" element={<CounselorMyProductInfo />} />
        <Route path="/counselor/mypage/products/:id/reviews" element={<CounselorMyProductReviews />} />
        <Route path="/counselor/mypage/products/:id/qna" element={<CounselorMyProductQna />} />
        <Route path="/counselor/mypage/products/:id/guide" element={<CounselorMyProductGuide />} />
        <Route path="/mypage/events" element={<Events />} />
        <Route path="/mypage/events/:id" element={<EventDetail />} />
        <Route path="/mypage/notices" element={<Notices />} />
        <Route path="/mypage/notices/:id" element={<NoticeDetail />} />
        <Route path="/mypage/help" element={<Help />} />
        <Route path="/mypage/new-counselors" element={<NewCounselors />} />
        <Route path="/mypage/counselor-apply" element={<CounselorApply />} />
        <Route path="/mypage/counselor-apply/new" element={<CounselorApplyNew />} />
        <Route path="/mypage/counselor-apply/done" element={<CounselorApplyDone />} />
        <Route path="/mypage/counselor-apply/:id" element={<CounselorApplyDetail />} />
        {/* 추후: /chat/:id, /bookmarks, /point, /mypage/inquiry/new */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ConsultProvider>
      </LikeProvider>
      </LoginPromptProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
