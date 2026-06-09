import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FaYoutube, FaFacebook, FaInstagram, FaFire } from 'react-icons/fa'
import { syncAllAnalytics } from '../lib/analyticsSync'

/* ── Helpers ── */

const formatNum = (n) => {
  if (!n) return '0'
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Sparsh'

const timeAgo = (ts) => {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const GRADE_ICON = {
  sparsh:  '⚡',
  sankalp: '✨',
  uday:    '⭐',
  ojas:    '🌟',
  tejas:   '🔥',
}

const initials = (name = '') => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}

const NOTIF_ICON = {
  crisis:       { bg: '#FEF2F2', icon: '🚨' },
  task:         { bg: '#F0FDF4', icon: '✅' },
  reward:       { bg: '#FEF9C3', icon: '🎁' },
  notification: { bg: '#EFF6FF', icon: '🔔' },
}

/* ── Main ── */

export default function Home() {
  const [profile,       setProfile]       = useState(null)
  const [score,         setScore]         = useState(null)
  const [analytics,     setAnalytics]     = useState(null)
  const [notifications, setNotifications] = useState([])
  const [ranking,       setRanking]       = useState({})
  const [currentUser,   setCurrentUser]   = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [unreadCount,   setUnreadCount]   = useState(0)
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }

    const [profileRes, scoreRes, analyticsRes, notifRes, rankingRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('weekly_scores').select('*')
        .eq('volunteer_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('analytics_snapshots').select('*')
        .eq('volunteer_id', user.id)
        .order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('messages').select('*')
        .or(`to_id.eq.${user.id},to_id.is.null`)
        .order('created_at', { ascending: false }).limit(3),
      supabase.from('ranking_scores').select('ai_suggestion, total_score, rank')
        .eq('volunteer_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const score     = scoreRes.data
    const analytics = analyticsRes.data

    if (!score) {
      await supabase.from('weekly_scores').insert({
        volunteer_id: user.id,
        week_start:   new Date().toISOString().split('T')[0],
        total_score:  0,
        grade:        'sparsh',
        rank:         null,
      })
    }

    setCurrentUser(user)

    // Fetch unread notification count
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('volunteer_id', user.id)
      .is('read_at', null)
    setUnreadCount(count || 0)

    setProfile(profileRes.data)
    setScore(score || { total_score: 0, rank: null, grade: 'sparsh' })
    setAnalytics(analytics || { yt_views: 0, fb_reach: 0, ig_reel_views: 0, posting_streak: 0 })
    setNotifications(notifRes.data || [])
    setRanking(rankingRes.data || {})
    setLoading(false)
  }

  const handleRefresh = async () => {
    if (!currentUser) return
    setRefreshing(true)
    await syncAllAnalytics(currentUser.id)
    await fetchData()
    setRefreshing(false)
  }

  if (loading) return <SkeletonHome />

  const shortId = profile?.id?.slice(-6).toUpperCase() ?? '——'

  return (
    <div style={s.page} className="vol-page">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ── NAVY HEADER ── */}
      <div style={s.header}>
        <div style={s.statusBar}>
          <span style={s.statusTime}>9:41</span>
          <span style={s.statusRight}>▮▮▮ ▊▊ 🔋</span>
        </div>

        {/* Greeting + bell */}
        <div style={s.greetRow}>
          <p style={s.greetSmall}>Welcome back,</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleRefresh} style={s.bellBtn}>
              <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
                🔄
              </span>
            </button>
            <button onClick={() => navigate('/notifications')} style={{ ...s.bellBtn, position: 'relative' }}>
              🔔
              {unreadCount > 0 && (
                <div style={s.unreadBadge}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Profile identity row */}
        <div style={s.identityRow}>
          {/* Avatar */}
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt="avatar" style={s.avatarImg} />
          ) : (
            <div style={s.avatarInitials}>
              {initials(profile?.name || '')}
            </div>
          )}

          {/* Name + ID */}
          <div style={{ flex: 1 }}>
            <p style={s.identityName}>{profile?.name || 'Volunteer'}</p>
            <p style={s.identitySub}>
              {profile?.team_id || shortId} &bull; {profile?.district || '—'}
            </p>
          </div>

          {/* Award badge — only if sparsh_approved */}
          {profile?.sparsh_approved === true && (
            <div style={s.awardBadge}>
              <span style={{ fontSize: 14 }}>
                {GRADE_ICON[(score?.grade || 'sparsh').toLowerCase()] || '⚡'}
              </span>
              <span style={s.awardText}>
                {capitalize(score?.grade || 'sparsh')}
              </span>
            </div>
          )}
        </div>

        {/* Score card */}
        <div style={s.scoreCard}>
          <div style={s.scoreBlob} />
          <p style={s.scoreLabel}>THIS WEEK SCORE</p>
          <p style={s.scoreNum}>{score?.total_score || '0'}</p>
          <p style={s.scoreRank}>India Rank #{score?.rank || '—'}</p>
          <div style={s.gradeBadge}>{capitalize(score?.grade || 'sparsh')}</div>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div style={s.body}>

        {/* Incomplete profile banner */}
        {profile?.profile_complete === false && (
          <div style={s.banner}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={s.bannerTitle}>Complete your profile</p>
              <p style={s.bannerSub}>Upload Aadhaar &amp; photo to become Sparsh Chirag</p>
            </div>
            <span onClick={() => navigate('/profile')} style={s.bannerAction}>
              Complete →
            </span>
          </div>
        )}

        {/* ── Analytics section ── */}
        <div style={s.sectionHeader}>
          <p style={s.sectionTitle}>Your Analytics</p>
          <span
            onClick={() => navigate('/analytics')}
            style={s.sectionLink}
          >
            Tap to see details →
          </span>
        </div>

        <div style={s.analyticsGrid}>
          <AnalyticsCard
            icon={<FaYoutube color="#DC2626" size={16} />}
            iconBg="#FEF2F2"
            value={formatNum(analytics?.yt_views)}
            label="YouTube Views"
            onClick={() => navigate('/analytics')}
          />
          <AnalyticsCard
            icon={<FaFacebook color="#1D6FED" size={16} />}
            iconBg="#EFF6FF"
            value={formatNum(analytics?.fb_reach)}
            label="Facebook Reach"
            onClick={() => navigate('/analytics')}
          />
          <AnalyticsCard
            icon={<FaInstagram color="#9333EA" size={16} />}
            iconBg="#FDF4FF"
            value={formatNum(analytics?.ig_reel_views)}
            label="Instagram Reels"
            onClick={() => navigate('/analytics')}
          />
          <AnalyticsCard
            icon={<FaFire color="#EA580C" size={16} />}
            iconBg="#FFF7ED"
            value={analytics?.posting_streak || '0'}
            label="Day Streak"
            onClick={() => navigate('/analytics')}
          />
        </div>

        {/* ── Notifications section ── */}
        <p style={{ ...s.sectionTitle, marginBottom: 10 }}>Recent Notifications</p>

        {notifications.length === 0 ? (
          <div style={s.emptyNotif}>
            <span style={{ fontSize: 28 }}>🔔</span>
            <p style={s.emptyNotifText}>No notifications yet</p>
          </div>
        ) : (
          notifications.map(notif => {
            const type  = notif.type || 'notification'
            const style = NOTIF_ICON[type] || NOTIF_ICON.notification
            return (
              <div key={notif.id} style={s.notifCard}>
                <div style={{ ...s.notifIcon, background: style.bg }}>
                  <span style={{ fontSize: 16 }}>{style.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={s.notifTitle}>{notif.title || notif.subject || 'Notification'}</p>
                  <p style={s.notifBody}>{notif.body || notif.message || ''}</p>
                  <p style={s.notifTime}>{timeAgo(notif.created_at)}</p>
                </div>
                {!notif.read_at && <div style={s.unreadDot} />}
              </div>
            )
          })
        )}

        {/* ── AI Suggestion ── */}
        <div style={s.aiCard}>
          <div style={s.aiHeader}>
            <span>💡</span>
            <span style={s.aiTitle}>AI Suggestion</span>
          </div>
          <p style={s.aiBody}>
            {ranking?.ai_suggestion || 'Sync your analytics to get personalized tips!'}
          </p>
        </div>

        {/* ── Quick actions ── */}
        <p style={{ ...s.sectionTitle, marginTop: 6, marginBottom: 10 }}>Quick Actions</p>

        <div style={s.actionsGrid}>
          <QuickAction
            icon="🔔" label="Notifications"
            bg="#0A2540" color="#fff"
            onClick={() => navigate('/notifications')}
          />
          <QuickAction
            icon="🏆" label="My Ranking"
            bg="#EFF6FF" color="#1D6FED"
            border="1.5px solid #BFDBFE"
            onClick={() => navigate('/leaderboard')}
          />
          <QuickAction
            icon="👤" label="My Profile"
            bg="#F8FAFC" color="#0F172A"
            border="1.5px solid #E2E8F0"
            onClick={() => navigate('/profile')}
          />
          <QuickAction
            icon="🔗" label="Connect Accounts"
            bg="#F8FAFC" color="#0F172A"
            border="1.5px solid #E2E8F0"
            onClick={() => navigate('/connect')}
          />
        </div>

        <div style={{ height: 90 }} />
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={s.bottomNav}>
        <NavBtn icon="🏠" label="Home"    active onClick={() => navigate('/home')} />
        <NavBtn icon="🏆" label="Rank"          onClick={() => navigate('/leaderboard')} />
        <NavBtn icon="🔔" label="Alerts"        onClick={() => navigate('/notifications')} />
        <NavBtn icon="👤" label="Profile"       onClick={() => navigate('/profile')} />
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function AnalyticsCard({ icon, iconBg, value, label, onClick }) {
  return (
    <div style={{ ...s.analyticsCard, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ ...s.analyticsIcon, background: iconBg }}>{icon}</div>
      <p style={s.analyticsValue}>{value}</p>
      <p style={s.analyticsLabel}>{label}</p>
    </div>
  )
}

function QuickAction({ icon, label, bg, color, border, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...s.actionBtn,
        background: bg,
        color,
        border: border || 'none',
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
    </button>
  )
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={s.navBtn}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{
        ...s.navLabel,
        color:      active ? '#0A2540' : '#CBD5E1',
        fontWeight: active ? 700 : 400,
      }}>
        {label}
      </span>
    </button>
  )
}

function SkeletonHome() {
  const sk = (h, w, r = 10) => ({
    height: h, width: w || '100%', borderRadius: r,
    background: '#E2E8F0',
    animation: 'pulse 1.5s ease-in-out infinite',
  })
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ background: '#0A2540', padding: '48px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...sk(14, 130, 8), background: 'rgba(255,255,255,0.12)' }} />
        <div style={{ ...sk(22, 180, 8), background: 'rgba(255,255,255,0.14)' }} />
        <div style={{ ...sk(104, undefined, 20), marginTop: 4, background: 'rgba(255,255,255,0.08)' }} />
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={sk(80)} />)}
        </div>
        {[...Array(2)].map((_, i) => <div key={i} style={sk(64)} />)}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={sk(64)} />)}
        </div>
      </div>
    </div>
  )
}

/* ── Styles ── */
const s = {
  page: {
    minHeight: '100vh',
    background: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Inter, sans-serif',
  },
  header:      { background: '#0A2540', padding: '0 20px 20px' },
  statusBar:   { display: 'flex', justifyContent: 'space-between', padding: '14px 0 20px' },
  statusTime:  { fontSize: 14, fontWeight: 700, color: '#fff' },
  statusRight: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  greetRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  greetSmall: { fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 },
  bellBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    border: 'none', cursor: 'pointer', fontSize: 15,
  },
  unreadBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    background: '#EF4444', color: '#fff',
    fontSize: 9, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 3px',
  },
  identityRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, padding: '12px 14px', marginBottom: 14,
  },
  avatarImg: {
    width: 48, height: 48, borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
  avatarInitials: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff', fontSize: 18, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  identityName: { fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 3 },
  identitySub:  { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  awardBadge: {
    background: 'rgba(251,191,36,0.15)',
    border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: 20, padding: '5px 10px',
    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
  },
  awardText: { fontSize: 10, fontWeight: 700, color: '#FDE68A' },
  scoreCard: {
    background: '#1D2D44', borderRadius: 20,
    padding: '16px 18px', position: 'relative', overflow: 'hidden',
  },
  scoreBlob: {
    position: 'absolute', top: -20, right: -20,
    width: 80, height: 80, borderRadius: '50%',
    background: 'rgba(29,111,237,0.2)', filter: 'blur(20px)',
  },
  scoreLabel: { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, marginBottom: 4 },
  scoreNum:   { fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: -2, lineHeight: 1, marginBottom: 4 },
  scoreRank:  { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 },
  gradeBadge: {
    display: 'inline-block', background: '#1D6FED', color: '#fff',
    fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
  },
  body: { flex: 1, overflowY: 'auto', padding: '14px 16px 0' },
  banner: {
    background: '#FEF9C3', border: '1.5px solid #FDE047',
    borderRadius: 16, padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  bannerTitle:  { fontSize: 13, fontWeight: 600, color: '#92400E', margin: 0 },
  bannerSub:    { fontSize: 11, color: '#A16207', margin: 0 },
  bannerAction: { fontSize: 11, fontWeight: 700, color: '#92400E', cursor: 'pointer', whiteSpace: 'nowrap' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:  { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 },
  sectionLink:   { fontSize: 11, color: '#1D6FED', cursor: 'pointer', fontWeight: 600 },
  analyticsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 },
  analyticsCard: {
    background: '#fff', border: '1.5px solid #E2E8F0',
    borderRadius: 14, padding: 14,
  },
  analyticsIcon: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  analyticsValue: { fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 },
  analyticsLabel: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  notifCard: {
    background: '#fff', border: '1.5px solid #E2E8F0',
    borderRadius: 14, padding: 12, marginBottom: 8,
    display: 'flex', alignItems: 'flex-start', gap: 10,
    position: 'relative',
  },
  notifIcon: {
    width: 36, height: 36, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  notifTitle: { fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 },
  notifBody:  { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  notifTime:  { fontSize: 10, color: '#CBD5E1' },
  unreadDot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: '50%', background: '#1D6FED',
  },
  emptyNotif: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '20px 0', gap: 8, marginBottom: 8,
  },
  emptyNotifText: { fontSize: 13, color: '#94A3B8', margin: 0 },
  actionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 },
  actionBtn: {
    borderRadius: 14, padding: '14px 12px',
    display: 'flex', alignItems: 'center', gap: 8,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
    textAlign: 'left',
  },
  aiCard:   { background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 16, padding: 14, marginBottom: 12 },
  aiHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiTitle:  { fontSize: 12, fontWeight: 700, color: '#1D6FED' },
  aiBody:   { fontSize: 13, color: '#1E40AF', lineHeight: 1.5, margin: 0 },
  bottomNav: {
    position: 'sticky', bottom: 0,
    background: '#fff', borderTop: '1.5px solid #F1F5F9',
    display: 'flex', padding: '10px 0 18px', zIndex: 100,
  },
  navBtn: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 3,
    background: 'none', border: 'none',
    cursor: 'pointer', padding: '4px 0',
    fontFamily: 'Inter, sans-serif',
  },
  navLabel: { fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' },
}
