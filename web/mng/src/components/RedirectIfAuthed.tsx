import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function RedirectIfAuthed() {
  const { status } = useAuth()
  if (status === 'loading') return null
  if (status === 'authed') return <Navigate to="/dashboard" replace />
  return <Outlet />
}
