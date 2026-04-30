import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
import Favorites from './pages/Favorites'
import Reviews from './pages/Reviews'

export default function App() {
  return (
    <BrowserRouter basename="/">
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
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/reviews" element={<Reviews />} />
        {/* 추후: /chat/:id, /mypage, /bookmarks, /point */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
