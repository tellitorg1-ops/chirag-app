import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider, WorkspaceProvider } from './command/context'
import { Entry, SignIn } from './command/Onboarding'
const Organizations = lazy(() => import('./command/Account').then(m => ({default:m.JoinWorkspace})))
const Platform = lazy(() => import('./command/Account').then(m => ({default:m.AdministrationCenter})))
import { Shell } from './command/Shell'
const Dashboard = lazy(() => import('./command/Dashboard').then(m => ({ default: m.Dashboard })))
const Reports = lazy(() => import('./command/TeamReport').then(m => ({default:m.TeamReport})))
const Hazri = lazy(() => import('./command/Operations').then(m => ({ default: m.Hazri })))
const Diary = lazy(() => import('./command/Operations').then(m => ({ default: m.Diary })))
const Tasks = lazy(() => import('./command/Operations').then(m => ({ default: m.Tasks })))
const Reviews = lazy(() => import('./command/Operations').then(m => ({ default: m.Reviews })))
const Content = lazy(() => import('./pages/Content'))
const Hierarchy = lazy(() => import('./command/Administration').then(m => ({ default: m.Hierarchy })))
const Broadcast = lazy(() => import('./command/Administration').then(m => ({ default: m.Broadcast })))
const Rankings = lazy(() => import('./command/Insights').then(m => ({ default: m.Rankings })))
const Social = lazy(() => import('./command/Insights').then(m => ({ default: m.Social })))
const Inbox = lazy(() => import('./command/Insights').then(m => ({ default: m.Inbox })))
const Profile = lazy(() => import('./command/Insights').then(m => ({ default: m.Profile })))
import './command/command.css'
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } })
export default function App() {
  return <QueryClientProvider client={client}><BrowserRouter><SessionProvider><Suspense fallback={<div className="loading-screen">Opening workspace…</div>}><Routes>
    <Route path="/" element={<Entry />} /><Route path="/login" element={<SignIn />} />
    <Route path="/organizations" element={<Organizations />} /><Route path="/platform" element={<Platform />} />
    <Route element={<WorkspaceProvider><Shell /></WorkspaceProvider>}>
      <Route path="/home" element={<Dashboard />} /><Route path="/reports" element={<Reports />} /><Route path="/hazri" element={<Hazri />} />
      <Route path="/diary" element={<Diary />} /><Route path="/tasks" element={<Tasks />} />
      <Route path="/content" element={<Content />} /><Route path="/reviews" element={<Reviews />} />
      <Route path="/hierarchy" element={<Hierarchy />} /><Route path="/leaderboard" element={<Rankings />} />
      <Route path="/analytics" element={<Social />} /><Route path="/notifications" element={<Inbox />} />
      <Route path="/broadcast" element={<Broadcast />} /><Route path="/profile" element={<Profile />} />
    </Route>
    <Route path="/connect" element={<Navigate to="/analytics" replace />} />
    <Route path="/register" element={<Navigate to="/organizations" replace />} />
    <Route path="/otp" element={<Navigate to="/login" replace />} />
    <Route path="/admin/*" element={<Navigate to="/home" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></SessionProvider></BrowserRouter></QueryClientProvider>
}
