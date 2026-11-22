import { useEffect, useState } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Clock3, NotebookPen, ListChecks, Radio, Users, Trophy, ChartNoAxesCombined, Bell, Send, ShieldCheck, UserRound, Menu, X, LogOut } from 'lucide-react'
import { useWorkspace, useRows } from './context'
import { enablePush, detachDevice } from './notifications'
import { supabase } from '../lib/supabase'
import { ErrorBox } from './ui'
import { workspaceCapabilities, allowedWorkspacePath } from './permissions'
const nav = [ ['/home','Overview',LayoutDashboard], ['/hazri','Hazri / shifts',Clock3], ['/work-sheet','Work sheet',NotebookPen], ['/tasks','Tasks & proofs',ListChecks], ['/content','Campaigns & content',Radio], ['/leaderboard','Rankings & rewards',Trophy], ['/analytics','Social media',ChartNoAxesCombined], ['/notifications','Notifications',Bell], ['/profile','My profile',UserRound] ]
export function Shell() {
  const { org, member, user, isLeader, isPlatform, isAdmin, roleLabel, stageNames } = useWorkspace()
  const [menuPath, setMenuPath] = useState(null)
  const [error, setError] = useState('')
  const location = useLocation()
  const cache = useQueryClient()
  const inbox = useRows('notifications')
  const unread = inbox.data?.filter(n => !n.read_at).length || 0
  useEffect(() => {
    cache.invalidateQueries({ queryKey: ['workspace', org.id, user.id] })
    const channel = supabase.channel(`command:${org.id}:${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'cmd_notifications', filter: `user_id=eq.${user.id}` }, () => cache.invalidateQueries({ queryKey: ['workspace', org.id, user.id, 'notifications'] })).subscribe()
    const timer = setInterval(() => { cache.invalidateQueries({ queryKey: ['workspace', org.id, user.id] }); cache.invalidateQueries({ queryKey: ['organizations', user.id] }) }, 30000)
    return () => { supabase.removeChannel(channel); clearInterval(timer) }
  }, [org.id, user.id, cache, roleLabel, member?.manager_id])
  async function logout() {
    try { await detachDevice(org.id).catch(() => {}); const { error: e } = await supabase.auth.signOut({ scope: 'local' }); if (e) throw e; localStorage.removeItem('command_org'); cache.clear() } catch (e) { setError(e.message) }
  }
  const access = workspaceCapabilities({member,isAdmin,isLeader})
  const visibleNav = nav.filter(([path]) => allowedWorkspacePath(path,access)).map(([path,label,Icon]) => [path, access.supervise ? ({'/tasks':'Task monitoring','/content':'Directives & assignments','/analytics':'Social team reports','/leaderboard':'Team performance'}[path] || label) : path==='/content' ? (access.social ? 'Campaign content' : 'Ground instructions') : label, Icon])
  const items = [...visibleNav, ...(access.supervise ? [['/reports','Team work sheets',Users],['/reviews','Verification desk',ShieldCheck],['/hierarchy','People & hierarchy',Users],['/broadcast','Broadcast',Send]] : [])]
  const quickNav = access.supervise ? items.filter(x=>['/home','/tasks','/reports','/reviews','/notifications'].includes(x[0])) : visibleNav.slice(0,5)
  return <div className="command-app"><a className="skip-link" href="#main-content">Skip to content</a><aside className={`sidebar ${menuPath === location.pathname ? 'open' : ''}`}><div className="sidebar-brand"><span className="brand-mark">L</span><span>Leader IQ.in<small>COMMAND CENTER</small></span><button className="mobile-only ghost" aria-label="Close navigation" onClick={() => setMenuPath(null)}><X /></button></div><Link to="/organizations" className="org-switch"><span className="org-icon">{org.name[0]}</span><span><strong>{org.name}</strong><small>{org.mode === 'political' ? 'Political organization' : 'Business / Brand'} · Switch</small></span></Link><p className="nav-label">WORKSPACE</p><nav aria-label="Main navigation">{items.map(([path,label,Icon]) => <NavLink key={path} to={path}><Icon size={19} />{label}{path === '/notifications' && unread > 0 && <b className="count">{unread}</b>}</NavLink>)}</nav>{isAdmin && <Link className="platform-link" to="/platform">{roleLabel} dashboard</Link>}<div className="sidebar-user"><span className="avatar">{member?.name?.[0] || 'A'}</span><div><strong>{isAdmin ? roleLabel : member?.name}</strong><small>{roleLabel}</small></div><button className="ghost" onClick={logout} aria-label="Sign out"><LogOut size={18} /></button></div></aside><div className="command-main"><header className="topbar"><button className="ghost mobile-only" aria-label="Open navigation" onClick={() => setMenuPath(location.pathname)}><Menu /></button><span className="breadcrumb">Workspace <span>/</span> {items.find(x => x[0] === location.pathname)?.[1] || 'Command'}</span><div><span className="live-label"><i /> {org.active ? 'Workspace active' : 'Suspended'}</span><Link to="/notifications" className="notification-icon" aria-label={`${unread} unread notifications`}><Bell size={20} />{unread > 0 && <b>{unread}</b>}</Link><Link className="avatar" to="/profile">{member?.name?.[0] || 'A'}</Link></div></header><NotificationGate key={org.id} /><main id="main-content"><ErrorBox error={error} />{unread > 0 && <Link className="inbox-banner" to="/notifications">{unread} unread organization update{unread > 1 ? 's' : ''}. View notifications</Link>}{allowedWorkspacePath(location.pathname,access) ? <Outlet /> : <section className="panel"><h1>This option is not part of your role</h1><p>Use your dashboard for the tools assigned to your responsibilities.</p><Link className="button primary" to="/home">Open my dashboard</Link></section>}</main><nav className="bottom-nav" aria-label="Quick navigation">{quickNav.map(([path,label,Icon]) => <NavLink key={path} to={path}><Icon size={21} /><span>{label.split(' ')[0]}</span></NavLink>)}</nav></div></div>
}
function NotificationGate() {
  const { org } = useWorkspace()
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    const check = () => {
      const p = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
      setPermission(p)
      if (p !== 'granted') setReady(false)
      if (p === 'granted') enablePush(org.id).then(() => { if (alive) setReady(true) }).catch(e => { if (alive) { setError(e.message); setReady(false) } })
    }
    check(); window.addEventListener('focus', check); document.addEventListener('visibilitychange', check)
    return () => { alive = false; window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
  }, [org.id])
  async function allow() { setBusy(true); setError(''); try { await enablePush(org.id); setReady(true); setPermission('granted') } catch (e) { setError(e.message) } finally { setBusy(false) } }
  if (permission === 'granted' && ready) return null
  return <section className="push-prompt" aria-label="Required notifications"><Bell size={20} /><div><strong>Enable mandatory work notifications</strong><p>{permission === 'denied' ? 'Notifications are blocked. Open browser Site settings → Notifications → Allow, then return here.' : permission === 'unsupported' ? 'Open in a push-capable browser. On iPhone/iPad, add to Home Screen and launch the installed app.' : 'Allow alerts for assignments, proof reviews and important organization updates, including when this app is closed.'}</p>{error && <p role="alert">{error}</p>}</div><button onClick={allow} disabled={busy}>{busy ? 'Connecting…' : permission === 'granted' || permission === 'denied' ? 'Check again' : 'Allow notifications'}</button></section>
}
