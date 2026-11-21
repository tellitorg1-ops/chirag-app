import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { command, rows } from './api'
import { BUSINESS_STAGES, STAGES } from './domain'
const Session = createContext(null)
const Workspace = createContext(null)
export const useSession = () => useContext(Session)
export const useWorkspace = () => useContext(Workspace)
export function SessionProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [error, setError] = useState('')
  const cache = useQueryClient()
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: e }) => { if (e) setError(e.message); setSession(data.session) }).catch(e => { setError(e.message); setSession(null) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) cache.clear() })
    return () => data.subscription.unsubscribe()
  }, [cache])
  return <Session.Provider value={{ session, user: session?.user, loading: session === undefined, error }}>{children}</Session.Provider>
}
export function useOrganizations() {
  const { user } = useSession()
  return useQuery({ queryKey: ['organizations', user?.id], enabled: !!user, refetchInterval: 10000, queryFn: async () => {
    const account = await command('account')
    const [orgs, members, admin] = await Promise.all([
      supabase.from('cmd_orgs').select('*').order('name'),
      supabase.from('cmd_members').select('*').eq('user_id', user.id),
      supabase.from('cmd_platform_admins').select('user_id').eq('user_id', user.id),
    ])
    for (const r of [orgs, members, admin]) if (r.error) throw new Error(r.error.message)
    return { orgs: orgs.data, members: members.data, ...account }
  } })
}
export function WorkspaceProvider({ children }) {
  const { user, loading } = useSession()
  const q = useOrganizations()
  const id = localStorage.getItem('command_org')
  if (loading || (user && q.isPending)) return <div className="loading-screen">Opening your workspace…</div>
  if (!user) return <Navigate to="/" replace />
  if (q.error) return <div className="setup-error"><h1>Workspace unavailable</h1><p>{q.error.message}</p><p>The command database migration must be installed on this app’s Supabase project.</p><button onClick={() => q.refetch()}>Retry</button><a href="/organizations">Organizations</a></div>
  const org = q.data?.orgs.find(o => o.id === id)
  if (!q.data?.isAdmin && !q.data?.profile?.completed) return <Navigate to="/organizations" replace />
  const member = q.data?.members.find(m => m.org_id === id && m.active)
  if (!org || (!member && !q.data.isPlatform)) return <Navigate to="/organizations" replace />
  const isManager = q.data.isPlatform || (q.data.isAdmin && !!member?.can_manage)
  const roleLabel = q.data.isPlatform ? 'Super Admin' : q.data.isAdmin ? 'Admin' : member?.stage === 5 ? (member.wing === 'social' ? 'Social Media Karyakarta' : 'Ground Karyakarta') : STAGES[member?.stage - 1]
  return <Workspace.Provider value={{ org, member, user, profile: q.data.profile, roleLabel, isAdmin: q.data.isAdmin, isPlatform: q.data.isPlatform, isManager, isLeader: isManager || (member?.stage != null && member.stage < 5), stageNames: org.mode === 'business' ? BUSINESS_STAGES : STAGES }}>{children}</Workspace.Provider>
}
export function useRows(table, options = {}) {
  const { org, user } = useWorkspace()
  return useQuery({ queryKey: ['workspace', org.id, user.id, table, options], queryFn: () => rows(table, org.id, options) })
}
export function useRanking(period, date) {
  const { org, user } = useWorkspace()
  return useQuery({ queryKey: ['workspace', org.id, user.id, 'ranking', period, date], queryFn: () => command('rankings', org.id, { period, date }) })
}
