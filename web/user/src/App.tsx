import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useParams } from 'react-router-dom'
import { AuthProvider } from './lib/auth-context'
import WebAppGate from './components/WebAppGate'
import { ConsultProvider } from './lib/consult-context'
import { LikeProvider } from './lib/like-context'
import { LoginPromptProvider } from './lib/login-prompt-context'
import NativeBackBridge from './components/NativeBackBridge'
import AttendanceToast from './components/AttendanceToast'
import GradeUpgradeToast from './components/GradeUpgradeToast'
import ModeIndicator from './components/ModeIndicator'
import PullToRefresh from './components/PullToRefresh'
import GlobalAlerts from './components/GlobalAlerts'
import CounselorIncomingChatWatcher from './components/CounselorIncomingChatWatcher'
import ScrollToTop from './components/ScrollToTop'

/**
 * ── 라우트 코드분할 (데이터 라우터 + React.lazy) ───────────────────────────
 * 전 페이지를 `React.lazy` 로 동적 import → 초기 JS 1.5MB → ~330KB.
 * 새 페이지 추가 시 별도 청크로 자동 분리되어 초기 번들이 영구 비대화되지 않는다.
 *
 * ⚠️ 크래시 회피 구조 (바이블 system/13 — 실측 검증):
 *   1) `route.lazy` + `RouterProvider fallbackElement` 는 lazy 라우트 진입 시
 *      `useAuth must be used inside <AuthProvider>` / `removeChild` 크래시.
 *      (lazy 자식이 부모 라우트 element=providers 바깥에서 렌더됨.)
 *   2) 해법 = providers 안쪽에서 **<Outlet/> 을 직접 <Suspense> 로 감싼다.**
 *      lazy 컴포넌트가 suspend→resolve 되는 동안 AuthProvider 가 언마운트되지
 *      않아 컨텍스트가 유지된다. (바이블의 동작 확인 repo: AuthProvider>Suspense>lazy)
 *   3) RouterProvider 에는 fallbackElement 를 주지 않는다(초기화 시 전체 트리를
 *      대체해 providers 가 사라지는 문제 회피). 초기 lazy 로드 폴백도 (2) 의
 *      Suspense 가 담당한다.
 */

const Home = lazy(() => import('./pages/Home'))
const TarotIntro = lazy(() => import('./pages/TarotIntro'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const SignupComplete = lazy(() => import('./pages/SignupComplete'))
const Find = lazy(() => import('./pages/Find'))
const FindComplete = lazy(() => import('./pages/FindComplete'))
const Search = lazy(() => import('./pages/Search'))
const SearchResult = lazy(() => import('./pages/SearchResult'))
const Notifications = lazy(() => import('./pages/Notifications'))
const NotificationDetail = lazy(() => import('./pages/NotificationDetail'))
const CounselorList = lazy(() => import('./pages/CounselorList'))
const CounselorDetail = lazy(() => import('./pages/CounselorDetail'))
const CounselorQnaDetail = lazy(() => import('./pages/CounselorQnaDetail'))
const CounselorQnaNew = lazy(() => import('./pages/CounselorQnaNew'))
const CounselorReviewNew = lazy(() => import('./pages/CounselorReviewNew'))
const ChatRoom = lazy(() => import('./pages/ChatRoom'))
const ChatLog = lazy(() => import('./pages/ChatLog'))
const Favorites = lazy(() => import('./pages/Favorites'))
const MyPageEntry = lazy(() => import('./pages/MyPageEntry'))
const MemberMyPage = lazy(() => import('./pages/MemberMyPage'))
const MemberEdit = lazy(() => import('./pages/MemberEdit'))
const AppSettings = lazy(() => import('./pages/AppSettings'))
const MyCalls = lazy(() => import('./pages/MyCalls'))
const MyChats = lazy(() => import('./pages/MyChats'))
const MyHistory = lazy(() => import('./pages/MyHistory'))
const SettlementHistory = lazy(() => import('./pages/SettlementHistory'))
const MyReviews = lazy(() => import('./pages/MyReviews'))
const MyReviewDetail = lazy(() => import('./pages/MyReviewDetail'))
const MyReviewNew = lazy(() => import('./pages/MyReviewNew'))
const MyReviewEdit = lazy(() => import('./pages/MyReviewEdit'))
const MyQnas = lazy(() => import('./pages/MyQnas'))
const MyQnaDetail = lazy(() => import('./pages/MyQnaDetail'))
const SupportInquiries = lazy(() => import('./pages/SupportInquiries'))
const SupportInquiryNew = lazy(() => import('./pages/SupportInquiryNew'))
const SupportInquiryDetail = lazy(() => import('./pages/SupportInquiryDetail'))
const Coupons = lazy(() => import('./pages/Coupons'))
const Payments = lazy(() => import('./pages/Payments'))
const Points = lazy(() => import('./pages/Points'))
const Charge = lazy(() => import('./pages/Charge'))
const ChargeCardRegister = lazy(() => import('./pages/ChargeCardRegister'))
const ChargeComplete = lazy(() => import('./pages/ChargeComplete'))
const ChargeVbankInfo = lazy(() => import('./pages/ChargeVbankInfo'))
const CounselorMyPage = lazy(() => import('./pages/CounselorMyPage'))
const CounselorMyReferral = lazy(() => import('./pages/CounselorMyReferral'))
const CounselorMyBank = lazy(() => import('./pages/CounselorMyBank'))
const CounselorMyStyle = lazy(() => import('./pages/CounselorMyStyle'))
const CounselorMyIntro = lazy(() => import('./pages/CounselorMyIntro'))
const CounselorMyPayout = lazy(() => import('./pages/CounselorMyPayout'))
const CounselorMyTips = lazy(() => import('./pages/CounselorMyTips'))
const CounselorMyTipDetail = lazy(() => import('./pages/CounselorMyTipDetail'))
const CounselorMyNotices = lazy(() => import('./pages/CounselorMyNotices'))
const CounselorMyNoticeDetail = lazy(() => import('./pages/CounselorMyNoticeDetail'))
const CounselorMyNoticeEdit = lazy(() => import('./pages/CounselorMyNoticeEdit'))
const CounselorMyQnas = lazy(() => import('./pages/CounselorMyQnas'))
const CounselorMyQnaNew = lazy(() => import('./pages/CounselorMyQnaNew'))
const CounselorMyQnaDetail = lazy(() => import('./pages/CounselorMyQnaDetail'))
const CounselorMyCustomerQnas = lazy(() => import('./pages/CounselorMyCustomerQnas'))
const CounselorMyCustomerQnaDetail = lazy(() => import('./pages/CounselorMyCustomerQnaDetail'))
const CounselorMyReviews = lazy(() => import('./pages/CounselorMyReviews'))
const CounselorMyReviewDetail = lazy(() => import('./pages/CounselorMyReviewDetail'))
const CounselorMyCalls = lazy(() => import('./pages/CounselorMyCalls'))
const CounselorMyChats = lazy(() => import('./pages/CounselorMyChats'))
const CounselorMyMemo = lazy(() => import('./pages/CounselorMyMemo'))
const CounselorIncomingList = lazy(() => import('./pages/CounselorIncomingList'))
const CounselorMyConsultMemo = lazy(() => import('./pages/CounselorMyConsultMemo'))
const CounselorMyConsultStats = lazy(() => import('./pages/CounselorMyConsultStats'))
const CounselorFeeSchedule = lazy(() => import('./pages/CounselorFeeSchedule'))
const CounselorMyProducts = lazy(() => import('./pages/CounselorMyProducts'))
const CounselorMyProductInfo = lazy(() => import('./pages/CounselorMyProductInfo'))
const CounselorMyProductReviews = lazy(() => import('./pages/CounselorMyProductReviews'))
const CounselorMyProductQna = lazy(() => import('./pages/CounselorMyProductQna'))
const CounselorMyProductGuide = lazy(() => import('./pages/CounselorMyProductGuide'))
const Events = lazy(() => import('./pages/Events'))
const EventDetail = lazy(() => import('./pages/EventDetail'))
const Notices = lazy(() => import('./pages/Notices'))
const NoticeDetail = lazy(() => import('./pages/NoticeDetail'))
const Help = lazy(() => import('./pages/Help'))
const NewCounselors = lazy(() => import('./pages/NewCounselors'))
const CounselorApply = lazy(() => import('./pages/CounselorApply'))
const CounselorApplyNew = lazy(() => import('./pages/CounselorApplyNew'))
const CounselorApplyDone = lazy(() => import('./pages/CounselorApplyDone'))
const CounselorApplyDetail = lazy(() => import('./pages/CounselorApplyDetail'))
const RecruiterLanding = lazy(() => import('./pages/RecruiterLanding'))
const PromoterDashboard = lazy(() => import('./pages/PromoterDashboard'))
const InviteFriends = lazy(() => import('./pages/InviteFriends'))
const SignupCouponEvent = lazy(() => import('./pages/SignupCouponEvent'))

/** 구 URL (/counselors/:id/reviews, /qna) → ?tab= 방식으로 리다이렉트 */
function TabRedirect({ tab }: { tab: string }) {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/counselors/${id}?tab=${tab}`} replace />
}

/** index.html 부트 스켈레톤과 동일 — lazy 청크 로드 동안의 짧은 폴백 */
function BootFallback() {
  return (
    <div className="sjm-boot">
      <img className="sjm-boot__logo" src="/img/logo_b.svg" alt="사주플랜" />
      <div className="sjm-boot__spin" aria-label="로딩 중"></div>
      <div className="sjm-boot__hint">잠시만 기다려 주세요…</div>
    </div>
  )
}

/**
 * 전역 providers + 상시마운트 컴포넌트 + <Suspense><Outlet/></Suspense>.
 * 라우트 전환 시 언마운트되지 않는다. lazy 자식의 suspend 는 AuthProvider 안쪽의
 * 이 Suspense 가 처리 → 컨텍스트 유지(크래시 회피 핵심).
 */
function RootLayout() {
  return (
    <>
      <WebAppGate />
      <AuthProvider>
        <LoginPromptProvider>
          <LikeProvider>
            <ConsultProvider>
              <ScrollToTop />
              <NativeBackBridge />
              <AttendanceToast />
              <GradeUpgradeToast />
              <CounselorIncomingChatWatcher />
              <ModeIndicator />
              <PullToRefresh />
              <GlobalAlerts />
              <Suspense fallback={<BootFallback />}>
                <Outlet />
              </Suspense>
            </ConsultProvider>
          </LikeProvider>
        </LoginPromptProvider>
      </AuthProvider>
    </>
  )
}

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <RootLayout />,
      children: [
        { index: true, element: <Home /> },
        { path: 'login', element: <Login /> },
        { path: 'signup', element: <Signup /> },
        { path: 'signup/complete', element: <SignupComplete /> },
        { path: 'find', element: <Find /> },
        { path: 'find/complete', element: <FindComplete /> },
        { path: 'search', element: <Search /> },
        { path: 'search/result', element: <SearchResult /> },
        { path: 'notifications', element: <Notifications /> },
        { path: 'notifications/:id', element: <NotificationDetail /> },
        { path: 'tarot-intro', element: <TarotIntro /> },
        { path: 'counselors', element: <CounselorList /> },
        { path: 'counselors/:id', element: <CounselorDetail /> },
        // 구 URL 하위호환 — 동일 페이지 ?tab= 방식으로 리다이렉트
        { path: 'counselors/:id/reviews', element: <TabRedirect tab="reviews" /> },
        { path: 'counselors/:id/reviews/new', element: <CounselorReviewNew /> },
        { path: 'counselors/:id/qna', element: <TabRedirect tab="qna" /> },
        { path: 'counselors/:id/qna/:qnaId', element: <CounselorQnaDetail /> },
        { path: 'counselors/:id/qna/new', element: <CounselorQnaNew /> },
        { path: 'chat/:id', element: <ChatRoom /> },
        { path: 'chat-log/:id', element: <ChatLog /> },
        { path: 'favorites', element: <Favorites /> },
        { path: 'mypage', element: <MyPageEntry /> },
        { path: 'mypage/member', element: <MemberMyPage /> },
        { path: 'mypage/member/edit', element: <MemberEdit /> },
        { path: 'mypage/app-settings', element: <AppSettings /> },
        { path: 'mypage/calls', element: <MyCalls /> },
        { path: 'mypage/chats', element: <MyChats /> },
        { path: 'mypage/history', element: <MyHistory /> },
        // [2026-05-25] 정산 내역 — 상담사 전용. 옛 URL 자동 redirect 로 보존
        { path: 'counselor/mypage/settlement/history', element: <SettlementHistory /> },
        { path: 'mypage/settlement/history', element: <Navigate to="/counselor/mypage/settlement/history" replace /> },
        { path: 'mypage/my-reviews', element: <MyReviews /> },
        { path: 'mypage/my-reviews/new', element: <MyReviewNew /> },
        { path: 'mypage/my-reviews/:id/edit', element: <MyReviewEdit /> },
        { path: 'mypage/my-reviews/:id', element: <MyReviewDetail /> },
        { path: 'mypage/my-qnas', element: <MyQnas /> },
        { path: 'mypage/my-qnas/:id', element: <MyQnaDetail /> },
        { path: 'mypage/support-inquiries', element: <SupportInquiries /> },
        { path: 'mypage/support-inquiries/new', element: <SupportInquiryNew /> },
        { path: 'mypage/support-inquiries/:id', element: <SupportInquiryDetail /> },
        { path: 'mypage/invite', element: <InviteFriends /> },
        { path: 'mypage/coupons', element: <Coupons /> },
        { path: 'mypage/payments', element: <Payments /> },
        { path: 'mypage/points', element: <Points /> },
        { path: 'mypage/charge', element: <Charge /> },
        { path: 'mypage/charge/card-register', element: <ChargeCardRegister /> },
        { path: 'charge/complete', element: <ChargeComplete /> },
        { path: 'charge/vbank-info', element: <ChargeVbankInfo /> },
        { path: 'counselor/mypage', element: <CounselorMyPage /> },
        { path: 'counselor/mypage/referral', element: <CounselorMyReferral /> },
        { path: 'counselor/mypage/bank', element: <CounselorMyBank /> },
        { path: 'counselor/mypage/style', element: <CounselorMyStyle /> },
        { path: 'counselor/mypage/intro', element: <CounselorMyIntro /> },
        { path: 'counselor/mypage/payout', element: <CounselorMyPayout /> },
        { path: 'counselor/mypage/tips', element: <CounselorMyTips /> },
        { path: 'counselor/mypage/tips/:id', element: <CounselorMyTipDetail /> },
        { path: 'counselor/mypage/notices', element: <CounselorMyNotices /> },
        { path: 'counselor/mypage/notices/:id', element: <CounselorMyNoticeDetail /> },
        { path: 'counselor/mypage/notice-edit', element: <CounselorMyNoticeEdit /> },
        { path: 'counselor/mypage/qnas', element: <CounselorMyQnas /> },
        { path: 'counselor/mypage/qnas/new', element: <CounselorMyQnaNew /> },
        { path: 'counselor/mypage/qnas/:id', element: <CounselorMyQnaDetail /> },
        { path: 'counselor/mypage/customer-qnas', element: <CounselorMyCustomerQnas /> },
        { path: 'counselor/mypage/customer-qnas/:id', element: <CounselorMyCustomerQnaDetail /> },
        { path: 'counselor/mypage/reviews', element: <CounselorMyReviews /> },
        { path: 'counselor/mypage/reviews/:id', element: <CounselorMyReviewDetail /> },
        { path: 'counselor/mypage/calls', element: <CounselorMyCalls /> },
        { path: 'counselor/mypage/chats', element: <CounselorMyChats /> },
        // [2026-05-30] 상담사 incoming 채팅 요청 리스트 — _PREPAID_CHAT_POLICY.md §15
        { path: 'counselor/mypage/incoming', element: <CounselorIncomingList /> },
        // [2026-05-31] 상담사 개인 메모장 — 본인만 보기/쓰기 (admin_memo 테이블 공유)
        { path: 'counselor/mypage/memo', element: <CounselorMyMemo /> },
        { path: 'counselor/mypage/:type/:id/memo', element: <CounselorMyConsultMemo /> },
        { path: 'counselor/mypage/consult-stats', element: <CounselorMyConsultStats /> },
        { path: 'counselor/mypage/fee-schedule', element: <CounselorFeeSchedule /> },
        { path: 'counselor/mypage/products', element: <CounselorMyProducts /> },
        { path: 'counselor/mypage/products/:id/info', element: <CounselorMyProductInfo /> },
        { path: 'counselor/mypage/products/:id/reviews', element: <CounselorMyProductReviews /> },
        { path: 'counselor/mypage/products/:id/qna', element: <CounselorMyProductQna /> },
        { path: 'counselor/mypage/products/:id/guide', element: <CounselorMyProductGuide /> },
        { path: 'mypage/events', element: <Events /> },
        { path: 'mypage/events/:id', element: <EventDetail /> },
        { path: 'mypage/notices', element: <Notices /> },
        { path: 'mypage/notices/:id', element: <NoticeDetail /> },
        { path: 'mypage/help', element: <Help /> },
        { path: 'mypage/new-counselors', element: <NewCounselors /> },
        { path: 'mypage/counselor-apply', element: <CounselorApply /> },
        { path: 'mypage/counselor-apply/new', element: <CounselorApplyNew /> },
        { path: 'mypage/counselor-apply/done', element: <CounselorApplyDone /> },
        { path: 'mypage/counselor-apply/:id', element: <CounselorApplyDetail /> },
        // 모집인(서포터즈) — QR/링크 랜딩 + 모집인 대시보드 (앱 게이트 예외)
        { path: 's/:code', element: <RecruiterLanding /> },
        { path: 'promoter', element: <PromoterDashboard /> },
        // 공개 쿠폰 이벤트 페이지 — 직원·가족·지인 호의 공유용(로그인·앱 불필요, 게이트 예외)
        { path: 'event', element: <SignupCouponEvent /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: '/' },
)

export default function App() {
  return <RouterProvider router={router} />
}
