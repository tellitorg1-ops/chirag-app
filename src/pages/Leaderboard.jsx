import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/* ── Helpers ── */

const formatNum = (n) => {
  if (!n) return '0'
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

const AVATAR_COLORS = ['#FEF3C7', '#EFF6FF', '#F0FDF4', '#FDF4FF', '#FEE2E2']
const avatarBg = (name = '') =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

const initials = (name = '') => {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}

const GRADE_STYLE = {
  tejas:   { bg: '#FEF3C7', color: '#92400E' },
  ojas:    { bg: '#DBEAFE', color: '#1E40AF' },
  uday:    { bg: '#D1FAE5', color: '#065F46' },
  sankalp: { bg: '#F0FDF4', color: '#166534' },
  sparsh:  { bg: '#F8FAFC', color: '#64748B' },
}

const RANK_COLOR = (rank) => {
  if (rank === 1) return '#F59E0B'
  if (rank === 2) return '#94A3B8'
  if (rank === 3) return '#B45309'
  return '#CBD5E1'
}

const GRADE_TABS = ['All', 'Tejas', 'Ojas', 'Uday', 'Sankalp', 'Sparsh']

/* ── Main ── */

export default function Leaderboard() {
  const [myProfile,   setMyProfile]   = useState(null)
  const [myScore,     setMyScore]     = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState('all')
  const [gradeFilter, setGradeFilter] = useState('All')
  const [userId,      setUserId]      = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }
    setUserId(user.id)

    const [profileRes, scoreRes, boardRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('weekly_scores').select('*')
        .eq('volunteer_id', user.id)
        .order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('weekly_scores')
        .select('*, profiles(id, name, district, photo_url)')
        .order('rank', { ascending: true })
        .limit(50),
    ])

    setMyProfile(profileRes.data)
    setMyScore(scoreRes.data)
    setLeaderboard(boardRes.data || [])
    setLoading(false)
  }

  if (loading) return <SkeletonLeaderboard />

  /* Filtering */
  const filtered = leaderboard.filter(item => {
    const profile = item.profiles
    if (filter === 'district' && myProfile?.district) {
      if (profile?.district !== myProfile.district) return false
    }
    if (gradeFilter !== 'All') {
      const g = (item.grade || profile?.grade || '').toLowerCase()
      if (g !== gradeFilter.toLowerCase()) return false
    }
    return true
  })

  return (
    <div style={s.page} className="vol-page">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .grade-scroll::-webkit-scrollbar { display: none }
      `}</style>

      {/* ── NAVY HEADER ── */}
      <div style={s.header}>

        {/* Status bar */}
        <div style={s.statusBar}>
          <span style={s.statusTime}>9:41</span>
          <span style={s.statusRight}>▮▮▮ ▊▊ 🔋</span>
        </div>

        {/* Title */}
        <p style={s.title}>Leaderboard</p>
        <p style={s.titleSub}>600+ Volunteers competing</p>

        {/* Filter pills */}
        <div style={s.pillRow}>
          {[['all', 'All India'], ['district', 'My District'], ['week', 'This Week']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                ...s.pill,
                background:   filter === key ? '#fff' : 'rgba(255,255,255,0.1)',
                color:        filter === key ? '#0A2540' : 'rgba(255,255,255,0.5)',
                fontWeight:   filter === key ? 700 : 400,
                border:       filter === key ? 'none' : '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MY RANK CARD ── */}
      <div style={s.myRankCard}>
        <p style={s.myRankNum}>#{myScore?.rank || '—'}</p>
        <div style={{ flex: 1 }}>
          <p style={s.myRankName}>{myProfile?.name || 'You'}</p>
          <p style={s.myRankSub}>
            {myProfile?.district || '—'} &bull; {capitalize(myScore?.grade || 'sparsh')}
          </p>
        </div>
        <p style={s.myRankScore}>{formatNum(myScore?.total_score)}</p>
      </div>

      {/* ── GRADE FILTER TABS ── */}
      <div className="grade-scroll" style={s.gradeTabs}>
        {GRADE_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setGradeFilter(tab)}
            style={{
              ...s.gradeTab,
              background:   gradeFilter === tab ? '#0A2540' : '#fff',
              color:        gradeFilter === tab ? '#fff' : '#94A3B8',
              borderColor:  gradeFilter === tab ? '#0A2540' : '#E2E8F0',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── LEADERBOARD LIST ── */}
      <div style={s.listWrap}>

        {filtered.length === 0 ? (
          <div style={s.empty}>
            <span style={{ fontSize: 40, color: '#CBD5E1' }}>🏆</span>
            <p style={s.emptyTitle}>No rankings yet</p>
            <p style={s.emptySub}>Start posting to get ranked!</p>
          </div>
        ) : (
          filtered.map((item, i) => {
            const profile  = item.profiles || {}
            const isMe     = profile.id === userId
            const grade    = (item.grade || profile.grade || 'sparsh').toLowerCase()
            const gs       = GRADE_STYLE[grade] || GRADE_STYLE.sparsh
            const rank     = item.rank || (i + 1)

            return (
              <div
                key={item.id || i}
                style={{
                  ...s.row,
                  background:   isMe ? '#EFF6FF' : 'transparent',
                  border:       isMe ? '1.5px solid #BFDBFE' : 'none',
                  borderRadius: isMe ? 12 : 0,
                  padding:      isMe ? '10px 8px' : '10px 0',
                  borderBottom: isMe ? 'none' : (i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none'),
                }}
              >
                {/* Rank */}
                <span style={{ ...s.rankNum, color: RANK_COLOR(rank) }}>
                  {rank}
                </span>

                {/* Avatar */}
                {profile.photo_url ? (
                  <img
                    src={profile.photo_url}
                    alt={profile.name}
                    style={s.avatar}
                  />
                ) : (
                  <div style={{ ...s.avatarInitials, background: avatarBg(profile.name) }}>
                    {initials(profile.name)}
                  </div>
                )}

                {/* Name + grade */}
                <div style={{ flex: 1 }}>
                  <p style={{ ...s.rowName, color: isMe ? '#1D6FED' : '#0F172A' }}>
                    {profile.name || 'Unknown'}
                  </p>
                  <span style={{ ...s.gradeBadge, background: gs.bg, color: gs.color }}>
                    {capitalize(grade)}
                  </span>
                </div>

                {/* Score */}
                <p style={{ ...s.rowScore, color: isMe ? '#1D6FED' : '#0F172A' }}>
                  {formatNum(item.total_score)}
                </p>
              </div>
            )
          })
        )}

        <div style={{ height: 40 }} />
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={s.bottomNav}>
        <NavBtn icon="🏠" label="Home"    onClick={() => navigate('/home')} />
        <NavBtn icon="🏆" label="Rank"    active />
        <NavBtn icon="🔔" label="Alerts"   onClick={() => navigate('/notifications')} />
        <NavBtn icon="👤" label="Profile" onClick={() => navigate('/profile')} />
      </div>

    </div>
  )
}

/* ── Sub-components ── */

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

function SkeletonLeaderboard() {
  const sk = (h, r = 10) => ({
    height: h, borderRadius: r,
    background: '#E2E8F0',
    animation: 'pulse 1.5s ease-in-out infinite',
  })
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ background: '#0A2540', padding: '48px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...sk(22, 8), width: 180, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ ...sk(14, 6), width: 140, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {[80, 90, 80].map((w, i) => (
            <div key={i} style={{ ...sk(30, 20), width: w, background: 'rgba(255,255,255,0.08)' }} />
          ))}
        </div>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ ...sk(70, 20) }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ ...sk(36, '50%'), width: 36, flexShrink: 0 }} />
            <div style={{ ...sk(36, '50%'), width: 36, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ ...sk(13, 6), width: '60%' }} />
              <div style={{ ...sk(10, 4), width: '35%' }} />
            </div>
            <div style={{ ...sk(13, 6), width: 36 }} />
          </div>
        ))}
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
  header: { background: '#0A2540', padding: '0 20px 20px' },
  statusBar: { display: 'flex', justifyContent: 'space-between', padding: '14px 0 18px' },
  statusTime:  { fontSize: 14, fontWeight: 700, color: '#fff' },
  statusRight: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  title:    { fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -1, margin: 0 },
  titleSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  pillRow:  { display: 'flex', gap: 8, marginTop: 12 },
  pill: {
    fontSize: 11, padding: '6px 14px',
    borderRadius: 20, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
  },
  myRankCard: {
    background: '#1D6FED',
    borderRadius: 20,
    margin: '12px 16px',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  myRankNum:   { fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: -1, margin: 0, flexShrink: 0 },
  myRankName:  { fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 },
  myRankSub:   { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  myRankScore: { fontSize: 18, fontWeight: 900, color: '#fff', margin: 0, flexShrink: 0 },
  gradeTabs: {
    display: 'flex',
    gap: 6,
    padding: '4px 16px 12px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  gradeTab: {
    fontSize: 11, fontWeight: 600,
    padding: '5px 12px', borderRadius: 20,
    cursor: 'pointer', whiteSpace: 'nowrap',
    border: '1.5px solid #E2E8F0',
    fontFamily: 'Inter, sans-serif',
    transition: 'background 0.15s',
  },
  listWrap: {
    background: '#fff',
    borderRadius: '24px 24px 0 0',
    flex: 1,
    padding: '14px 16px 100px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  rankNum: {
    width: 24,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 800,
    flexShrink: 0,
  },
  avatar: {
    width: 36, height: 36,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  avatarInitials: {
    width: 36, height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#0F172A',
    flexShrink: 0,
  },
  rowName: {
    fontSize: 13, fontWeight: 600,
    marginBottom: 3,
  },
  gradeBadge: {
    display: 'inline-block',
    fontSize: 9, fontWeight: 700,
    padding: '2px 7px', borderRadius: 6,
  },
  rowScore: {
    fontSize: 13, fontWeight: 800,
    flexShrink: 0,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 0',
    gap: 10,
  },
  emptyTitle: { fontSize: 14, fontWeight: 600, color: '#94A3B8', margin: 0 },
  emptySub:   { fontSize: 12, color: '#CBD5E1', margin: 0 },
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
