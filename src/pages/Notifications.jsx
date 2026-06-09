import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/* ── Helpers ── */

const timeAgo = (date) => {
  if (!date) return ''
  const now  = new Date()
  const then = new Date(date)
  const diff = now - then
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)

  if (mins < 60)  return `${mins} min ago`
  if (hours < 24) return `${hours} hours ago`
  if (days === 1) return 'Yesterday'
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const TYPE_META = {
  notification:    { bg: '#EFF6FF', icon: '🔔' },
  crisis:          { bg: '#FEF2F2', icon: '🚨' },
  task:            { bg: '#F0FDF4', icon: '✅' },
  reward:          { bg: '#FFFBEB', icon: '🎁' },
  grade_upgrade:   { bg: '#EEF2FF', icon: '⚡' },
  sparsh_approved: { bg: '#F0FDF4', icon: '✓' },
}

const FILTER_TABS = ['All', 'Tasks', 'Alerts', 'Rewards']

const matchesFilter = (notif, filter) => {
  if (filter === 'All') return true
  if (filter === 'Tasks')   return notif.type === 'task'
  if (filter === 'Alerts')  return notif.type === 'crisis' || notif.type === 'notification'
  if (filter === 'Rewards') return notif.type === 'reward' || notif.type === 'grade_upgrade' || notif.type === 'sparsh_approved'
  return true
}

/* ── Main ── */

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [currentUser,   setCurrentUser]   = useState(null)
  const [activeFilter,  setActiveFilter]  = useState('All')
  const navigate = useNavigate()

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    if (!currentUser?.id) return

    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `volunteer_id=eq.${currentUser.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [currentUser?.id])

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }

    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('volunteer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setNotifications(notifs || [])
    setCurrentUser(user)
    setLoading(false)

    // Mark all unread as read
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('volunteer_id', user.id)
      .is('read_at', null)
  }

  const markAllRead = async () => {
    if (!currentUser) return
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('volunteer_id', currentUser.id)
      .is('read_at', null)

    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    )
  }

  if (loading) return <SkeletonNotifs />

  const filtered = notifications.filter(n => matchesFilter(n, activeFilter))

  return (
    <div style={s.page} className="vol-page">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* ── HEADER ── */}
      <div style={s.header}>
        <div style={s.statusBar}>
          <span style={s.statusTime}>9:41</span>
          <span style={s.statusRight}>▮▮▮ ▊▊ 🔋</span>
        </div>

        <div style={s.topRow}>
          <button onClick={() => navigate(-1)} style={s.backBtn}>←</button>
          <p style={s.title}>Notifications</p>
          <button onClick={markAllRead} style={s.markReadBtn}>Mark all read</button>
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      <div style={s.tabBar}>
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            style={{
              ...s.tab,
              color:        activeFilter === tab ? '#0A2540' : '#94A3B8',
              fontWeight:   activeFilter === tab ? 700 : 400,
              borderBottom: activeFilter === tab ? '2px solid #0A2540' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── LIST ── */}
      <div style={s.list}>
        {filtered.length === 0 ? (
          <div style={s.empty}>
            <span style={{ fontSize: 40, color: '#CBD5E1' }}>🔔</span>
            <p style={s.emptyTitle}>No notifications yet</p>
            <p style={s.emptySub}>You'll see updates here</p>
          </div>
        ) : (
          filtered.map(notif => {
            const meta    = TYPE_META[notif.type] || TYPE_META.notification
            const unread  = !notif.read_at

            return (
              <div
                key={notif.id}
                style={{
                  ...s.notifCard,
                  background:  unread ? '#F8FFFE' : '#fff',
                  borderLeft:  unread ? '3px solid #1D6FED' : '3px solid transparent',
                }}
              >
                <div style={{ ...s.notifIcon, background: meta.bg }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={s.notifTitle}>{notif.title || 'Notification'}</p>
                  <p style={s.notifBody}>{notif.body || notif.message || ''}</p>
                  <p style={s.notifTime}>{timeAgo(notif.created_at)}</p>
                </div>
                {unread && <div style={s.unreadDot} />}
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}

/* ── Skeleton ── */

function SkeletonNotifs() {
  const sk = (h, w, r = 8) => ({
    height: h, width: w || '100%', borderRadius: r,
    background: '#E2E8F0', animation: 'pulse 1.5s ease-in-out infinite',
  })
  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ background: '#0A2540', padding: '48px 20px 20px' }}>
        <div style={{ ...sk(22, 160), background: 'rgba(255,255,255,0.15)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={sk(36, 36, '50%')} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={sk(14, '65%')} />
              <div style={sk(11, '85%')} />
              <div style={sk(10, '30%')} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Styles ── */
const s = {
  page:        { minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' },
  header:      { background: '#0A2540', padding: '0 20px 16px' },
  statusBar:   { display: 'flex', justifyContent: 'space-between', padding: '14px 0 14px' },
  statusTime:  { fontSize: 14, fontWeight: 700, color: '#fff' },
  statusRight: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  topRow:      { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn:     { width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 20, fontWeight: 900, color: '#fff', flex: 1, letterSpacing: -0.5, margin: 0 },
  markReadBtn: { fontSize: 11, color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 },
  tabBar: { display: 'flex', background: '#fff', borderBottom: '1px solid #F1F5F9', padding: '0 16px' },
  tab: { flex: 1, padding: '12px 0', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'color 0.15s' },
  list:        { flex: 1, overflowY: 'auto' },
  notifCard:   { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: '1px solid #F1F5F9', position: 'relative' },
  notifIcon:   { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifTitle:  { fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2, lineHeight: 1.3 },
  notifBody:   { fontSize: 12, color: '#64748B', marginBottom: 4, lineHeight: 1.4 },
  notifTime:   { fontSize: 10, color: '#CBD5E1' },
  unreadDot:   { width: 8, height: 8, borderRadius: '50%', background: '#1D6FED', flexShrink: 0, marginTop: 4 },
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 10 },
  emptyTitle:  { fontSize: 14, fontWeight: 600, color: '#94A3B8', margin: 0 },
  emptySub:    { fontSize: 12, color: '#CBD5E1', margin: 0 },
}
