import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FaYoutube, FaFacebook, FaInstagram, FaTwitter } from 'react-icons/fa'

/* ── Helpers ── */

const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

const initials = (name = '') => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}

const formatDate = (ts) => {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const GRADE_ORDER = ['sparsh', 'sankalp', 'uday', 'ojas', 'tejas']
const GRADE_RANK  = { sparsh: 1, sankalp: 2, uday: 3, ojas: 4, tejas: 5 }
const GRADE_META  = [
  { key: 'sparsh',  icon: '⚡', iconBg: '#EEF2FF' },
  { key: 'sankalp', icon: '✨', iconBg: '#F0FDF4' },
  { key: 'uday',    icon: '⭐', iconBg: '#FFFBEB' },
  { key: 'ojas',    icon: '🌟', iconBg: '#EFF6FF' },
  { key: 'tejas',   icon: '🔥', iconBg: '#FEF2F2' },
]

/* ── Main ── */

export default function Profile() {
  const [profile,     setProfile]     = useState({})
  const [score,       setScore]       = useState({})
  const [accounts,    setAccounts]    = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }

    const [profileRes, scoreRes, accountsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('weekly_scores').select('*').eq('volunteer_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('social_accounts').select('*').eq('volunteer_id', user.id).maybeSingle(),
    ])

    setProfile(profileRes.data || {})
    setScore(scoreRes.data || {})
    setAccounts(accountsRes.data || {})
    setCurrentUser(user)
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) return <SkeletonProfile />

  const currentGrade     = (score?.grade || '').toLowerCase()
  const currentRank      = GRADE_RANK[currentGrade] || 0
  const isApproved       = profile.sparsh_approved === true
  const isUnlocked       = (key) => isApproved && GRADE_RANK[key] <= currentRank
  const showBanner       = !profile.photo_url || !profile.aadhaar_url
  const currentGradeMeta = GRADE_META.find(g => g.key === currentGrade)

  const ACCOUNT_LIST = [
    { key: 'yt', name: 'YouTube',   Icon: FaYoutube,   bg: '#FEF2F2', color: '#DC2626', connected: accounts?.yt_connected },
    { key: 'fb', name: 'Facebook',  Icon: FaFacebook,  bg: '#EFF6FF', color: '#1D6FED', connected: accounts?.fb_connected },
    { key: 'ig', name: 'Instagram', Icon: FaInstagram, bg: '#FDF4FF', color: '#9333EA', connected: !!accounts?.ig_username },
    { key: 'tw', name: 'Twitter/X', Icon: FaTwitter,   bg: '#F8FAFC', color: '#64748B', connected: !!accounts?.twitter_url },
  ]

  return (
    <div style={s.page} className="vol-page">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* ── NAVY HEADER ── */}
      <div style={s.header}>
        <div style={s.statusBar}>
          <span style={s.statusTime}>9:41</span>
          <span style={s.statusRight}>▮▮▮ ▊▊ 🔋</span>
        </div>

        <p style={s.headerTitle}>My Profile</p>

        <div style={s.photoSection}>
          {profile.photo_url ? (
            <img src={profile.photo_url} alt="avatar" style={s.photoImg} />
          ) : (
            <div style={s.photoInitials}>{initials(profile.name || '')}</div>
          )}
          <p style={s.profileName}>{profile.name || 'Volunteer'}</p>
          <p style={s.profileId}>{profile.team_id || '—'}</p>
          {isApproved && currentGradeMeta && (
            <div style={s.gradeBadge}>
              <span>{currentGradeMeta.icon}</span>
              <span style={s.gradeBadgeText}>{capitalize(currentGrade)} Chirag</span>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={s.body}>

        {/* Stats row */}
        <div style={s.statsGrid}>
          <StatCard value={score?.rank ? `#${score.rank}` : '—'} label="India Rank" />
          <StatCard value={score?.total_score || '0'}             label="This Week" />
          <StatCard value={capitalize(score?.grade || 'Sparsh')}  label="Grade" />
        </div>

        {/* Incomplete banner */}
        {showBanner && (
          <div style={s.banner}>
            <span>⚠️</span>
            <div>
              <p style={s.bannerTitle}>Complete your profile</p>
              <p style={s.bannerSub}>Upload photo &amp; Aadhaar to become Sparsh Chirag</p>
            </div>
          </div>
        )}

        {/* ── Achievements ── */}
        <p style={s.sectionTitle}>My Achievements</p>
        {GRADE_META.map(({ key, icon, iconBg }) => {
          const unlocked = isUnlocked(key)
          return (
            <div key={key} style={{ ...s.achieveCard, opacity: unlocked ? 1 : 0.4 }}>
              <div style={{ ...s.achieveIcon, background: unlocked ? iconBg : '#F1F5F9' }}>
                <span style={{ fontSize: 20 }}>{unlocked ? icon : '🔒'}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ ...s.achieveName, color: unlocked ? '#0F172A' : '#94A3B8' }}>
                  {capitalize(key)} Chirag
                </p>
                {unlocked ? (
                  <>
                    <p style={s.achieveSub}>Achieved · By: Admin</p>
                    <p style={s.achieveDate}>{formatDate(profile.created_at)}</p>
                  </>
                ) : (
                  <p style={s.achieveSub}>Not achieved yet</p>
                )}
              </div>
              {unlocked
                ? <div style={s.doneCircle}>✓</div>
                : <div style={s.lockCircle}>🔒</div>
              }
            </div>
          )
        })}

        {/* ── Personal Details ── */}
        <p style={s.sectionTitle}>Personal Details</p>
        <div style={s.detailsCard}>
          {[
            ['Mobile',       profile.mobile],
            ['District',     profile.district],
            ['Block',        profile.block],
            ['Age',          profile.age],
            ['Team ID',      profile.team_id],
            ['Member Since', formatDate(profile.created_at)],
          ].map(([label, value], i, arr) => (
            <div key={label} style={{ ...s.detailRow, borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <span style={s.detailLabel}>{label}</span>
              <span style={s.detailValue}>{value || '—'}</span>
            </div>
          ))}
        </div>

        {/* ── Aadhaar Status ── */}
        <p style={s.sectionTitle}>Aadhaar Verification</p>
        {profile.aadhaar_url ? (
          <div style={s.aadhaarOk}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <div style={{ flex: 1 }}>
              <p style={s.aadhaarOkTitle}>Aadhaar Uploaded ✓</p>
              <p style={s.aadhaarOkSub}>Under verification</p>
            </div>
            <div style={s.pendingBadge}>Pending</div>
          </div>
        ) : (
          <div style={s.aadhaarWarn}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={s.aadhaarWarnTitle}>Upload Aadhaar</p>
              <p style={s.aadhaarWarnSub}>Required for Sparsh Chirag</p>
            </div>
            <span onClick={() => navigate('/register')} style={s.uploadLink}>Upload →</span>
          </div>
        )}

        {/* ── Connected Accounts ── */}
        <p style={s.sectionTitle}>Connected Accounts</p>
        <div style={s.detailsCard}>
          {ACCOUNT_LIST.map(({ key, name, Icon, bg, color, connected }, i) => (
            <div key={key} style={{ ...s.accountRow, borderBottom: i < ACCOUNT_LIST.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <div style={{ ...s.accountIcon, background: bg }}>
                <Icon color={color} size={16} />
              </div>
              <span style={s.accountName}>{name}</span>
              {connected
                ? <span style={s.connectedText}>Connected ✓</span>
                : <span onClick={() => navigate('/connect')} style={s.connectLink}>Connect →</span>
              }
            </div>
          ))}
        </div>

        {/* ── Logout ── */}
        <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>

        <div style={{ height: 80 }} />
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={s.bottomNav}>
        <NavBtn icon="🏠" label="Home"    onClick={() => navigate('/home')} />
        <NavBtn icon="🏆" label="Rank"    onClick={() => navigate('/leaderboard')} />
        <NavBtn icon="🔔" label="Alerts"  onClick={() => navigate('/notifications')} />
        <NavBtn icon="👤" label="Profile" active />
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function StatCard({ value, label }) {
  return (
    <div style={s.statCard}>
      <p style={s.statValue}>{value}</p>
      <p style={s.statLabel}>{label}</p>
    </div>
  )
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={s.navBtn}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ ...s.navLabel, color: active ? '#0A2540' : '#CBD5E1', fontWeight: active ? 700 : 400 }}>
        {label}
      </span>
    </button>
  )
}

function SkeletonProfile() {
  const sk = (h, w, r = 10) => ({
    height: h, width: w || '100%', borderRadius: r,
    background: '#E2E8F0', animation: 'pulse 1.5s ease-in-out infinite',
  })
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ background: '#0A2540', padding: '48px 20px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ ...sk(80, 80, '50%'), background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ ...sk(18, 140, 8), background: 'rgba(255,255,255,0.12)' }} />
        <div style={{ ...sk(12, 100, 6),  background: 'rgba(255,255,255,0.08)' }} />
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[...Array(3)].map((_, i) => <div key={i} style={sk(70)} />)}
        </div>
        {[...Array(5)].map((_, i) => <div key={i} style={sk(64)} />)}
      </div>
    </div>
  )
}

/* ── Styles ── */
const s = {
  page:        { minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' },
  header:      { background: '#0A2540', padding: '0 20px 24px' },
  statusBar:   { display: 'flex', justifyContent: 'space-between', padding: '14px 0 16px' },
  statusTime:  { fontSize: 14, fontWeight: 700, color: '#fff' },
  statusRight: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: 900, color: '#fff', textAlign: 'center', marginBottom: 20, letterSpacing: -0.5 },
  photoSection:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  photoImg:      { width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)' },
  photoInitials: { width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 28, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  profileName:   { fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 4 },
  profileId:     { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  gradeBadge:    { background: 'rgba(29,111,237,0.3)', border: '1px solid rgba(29,111,237,0.5)', borderRadius: 20, padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 },
  gradeBadgeText: { fontSize: 10, fontWeight: 700, color: '#fff' },
  body:        { flex: 1, overflowY: 'auto', padding: '14px 16px 0' },
  statsGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 },
  statCard:    { background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 12, textAlign: 'center' },
  statValue:   { fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 },
  statLabel:   { fontSize: 10, color: '#94A3B8', marginTop: 3 },
  banner:      { background: '#FEF9C3', border: '1.5px solid #FDE047', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  bannerTitle: { fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 2 },
  bannerSub:   { fontSize: 11, color: '#A16207' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '6px 0 10px' },
  achieveCard: { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 },
  achieveIcon: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  achieveName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  achieveSub:  { fontSize: 11, color: '#94A3B8', marginBottom: 1 },
  achieveDate: { fontSize: 10, color: '#CBD5E1' },
  doneCircle:  { width: 24, height: 24, borderRadius: '50%', background: '#D1FAE5', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  lockCircle:  { width: 24, height: 24, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 },
  detailsCard: { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '0 14px', marginBottom: 14, overflow: 'hidden' },
  detailRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0' },
  detailLabel: { fontSize: 13, color: '#94A3B8' },
  detailValue: { fontSize: 13, fontWeight: 600, color: '#0F172A' },
  aadhaarOk:      { background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  aadhaarOkTitle: { fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 2 },
  aadhaarOkSub:   { fontSize: 11, color: '#4ADE80' },
  pendingBadge:   { background: '#FEF9C3', color: '#92400E', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, flexShrink: 0 },
  aadhaarWarn:      { background: '#FEF9C3', border: '1.5px solid #FDE047', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  aadhaarWarnTitle: { fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 2 },
  aadhaarWarnSub:   { fontSize: 11, color: '#A16207' },
  uploadLink:   { fontSize: 11, fontWeight: 700, color: '#92400E', cursor: 'pointer', flexShrink: 0 },
  accountRow:   { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' },
  accountIcon:  { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  accountName:  { fontSize: 13, fontWeight: 600, color: '#0F172A', flex: 1 },
  connectedText: { fontSize: 11, fontWeight: 700, color: '#16A34A' },
  connectLink:   { fontSize: 11, fontWeight: 600, color: '#1D6FED', cursor: 'pointer' },
  logoutBtn: { width: '100%', background: 'transparent', border: '1.5px solid #FECACA', color: '#DC2626', borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: 12 },
  bottomNav: { position: 'sticky', bottom: 0, background: '#fff', borderTop: '1.5px solid #F1F5F9', display: 'flex', padding: '10px 0 18px', zIndex: 100 },
  navBtn:    { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'Inter, sans-serif' },
  navLabel:  { fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' },
}
