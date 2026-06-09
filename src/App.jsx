import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import Login          from './pages/Login'
import OtpVerify      from './pages/OtpVerify'
import Register       from './pages/Register'
import Home           from './pages/Home'
import Leaderboard    from './pages/Leaderboard'
import Profile        from './pages/Profile'
import Tasks          from './pages/Tasks'
import ConnectAccounts from './pages/ConnectAccounts'
import Analytics      from './pages/Analytics'
import Notifications  from './pages/Notifications'

import WarRoom         from './pages/admin/WarRoom'
import Volunteers      from './pages/admin/Volunteers'
import Approvals       from './pages/admin/Approvals'
import Broadcast       from './pages/admin/Broadcast'
import AdminAnalytics  from './pages/admin/AdminAnalytics'
import SuperAdmin      from './pages/admin/SuperAdmin'

const queryClient = new QueryClient()

function ProtectedRoute({ children }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"          element={<Login />} />
          <Route path="/otp"       element={<OtpVerify />} />
          <Route path="/register"  element={<Register />} />

          {/* Volunteer app */}
          <Route path="/home"          element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/leaderboard"   element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/profile"       element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/tasks"         element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/connect"       element={<ProtectedRoute><ConnectAccounts /></ProtectedRoute>} />
          <Route path="/analytics"     element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

          {/* Admin — role guard is inside each page via AdminGuard */}
          <Route path="/admin"                element={<WarRoom />} />
          <Route path="/admin/volunteers"     element={<Volunteers />} />
          <Route path="/admin/approvals"      element={<Approvals />} />
          <Route path="/admin/broadcast"      element={<Broadcast />} />
          <Route path="/admin/analytics"      element={<AdminAnalytics />} />
          <Route path="/admin/super"          element={<SuperAdmin />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
