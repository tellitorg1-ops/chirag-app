import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { syncAllAnalytics } from '../lib/analyticsSync'
import { FaYoutube, FaFacebook, FaInstagram } from 'react-icons/fa'

/* ── Helpers ── */

const fmt = (n) => {
  if (!n) return '0'
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

const timeAgo = (ts) => {
  if (!ts) return 'Never'
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TABS = ['Overview', 'YouTube', 'Facebook']

/* ── Main ── */

export default function Analytics() {
  const [analytics,   setAnalytics]   = useState({})
  const [videos,      setVideos]      = useState([])
  const [posts,       setPosts]       = useState([])
  const [score,       setScore]       = useState({})
  const [accounts,    setAccounts]    = useState({})
  const [ranking,     setRanking]     = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [activeTab,   setActiveTab]   = useState('Overview')
  const navigate = useNavigate()

  useEffect(() => { fetchAnalytics() }, [])

  const fetchAnalytics = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }

    const [analyticsRes, videosRes, postsRes, scoreRes, accountsRes, rankingRes] =
      await Promise.all([
        supabase.from('analytics_snapshots').select('*')
          .eq('volunteer_id', user.id)
          .order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('yt_videos').select('*')
          .eq('volunteer_id', user.id)
          .order('published_at', { ascending: false }).limit(20),
        supabase.from('fb_posts').select('*')
          .eq('volunteer_id', user.id)
          .order('published_at', { ascending: false }).limit(20),
        supabase.from('weekly_scores').select('*')
          .eq('volunteer_id', user.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('social_accounts').select('*')
          .eq('volunteer_id', user.id).maybeSingle(),
        supabase.from('ranking_scores').select('*')
          .eq('volunteer_id', user.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

    setAnalytics(analyticsRes.data   || {})
    setVideos(videosRes.data         || [])
    setPosts(postsRes.data           || [])
    setScore(scoreRes.data           || {})
    setAccounts(accountsRes.data     || {})
    setRanking(rankingRes.data       || {})
    setCurrentUser(user)
    setLoading(false)
  }

  const handleRefresh = async () => {
    if (!currentUser) return
    setRefreshing(true)
    await syncAllAnalytics(currentUser.id)
    await fetchAnalytics()
    setRefreshing(false)
  }

  if (loading) return <SkeletonAnalytics />

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

        <div style={s.topRow}>
          <button onClick={() => navigate(-1)} style={s.iconBtn}>←</button>
          <div style={{ flex: 1 }}>
            <p style={s.title}>My Analytics</p>
            <p style={s.titleSub}>
              Last synced: {timeAgo(analytics?.last_updated)}
            </p>
          </div>
          <button onClick={handleRefresh} style={s.iconBtn}>
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
              🔄
            </span>
          </button>
        </div>

        {/* Score summary — 2×2 grid */}
        <div style={s.scoreGrid}>
          <ScoreTile label="Total Score" value={fmt(score?.total_score)} />
          <ScoreTile label="India Rank"  value={score?.rank ? `#${score.rank}` : '—'} />
          <ScoreTile label="Grade"       value={capitalize(score?.grade || 'sparsh')} />
          <ScoreTile label="Streak"      value={`${analytics?.posting_streak || 0}d`} />
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...s.tab,
              color:        activeTab === tab ? '#0A2540' : '#94A3B8',
              fontWeight:   activeTab === tab ? 700 : 400,
              borderBottom: activeTab === tab ? '2px solid #0A2540' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div style={s.body}>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'Overview' && (
          <>
            {/* Sync Now card */}
            <div style={s.syncCard}>
              <div>
                <p style={s.syncTitle}>Sync Analytics</p>
                <p style={s.syncSub}>
                  {refreshing ? 'Syncing your data...' : 'Pull latest data from your channels'}
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  ...s.syncBtn,
                  opacity: refreshing ? 0.6 : 1,
                  cursor: refreshing ? 'not-allowed' : 'pointer',
                }}
              >
                <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
                  🔄
                </span>
                {' '}{refreshing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
            {/* Score Breakdown */}
            <p style={s.sectionTitle}>Your Score Breakdown</p>
            <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: 14, marginBottom: 14 }}>
              {[
                { label: 'YouTube Views',    score: ranking?.yt_views_score,      max: 30 },
                { label: 'YouTube Subs',     score: ranking?.yt_subs_score,       max: 10 },
                { label: 'YT Quality',       score: ranking?.yt_quality_score,    max: 5  },
                { label: 'Facebook Reach',   score: ranking?.fb_reach_score,      max: 15 },
                { label: 'FB Engagement',    score: ranking?.fb_engagement_score, max: 10 },
                { label: 'Posting Streak',   score: ranking?.streak_score,        max: 10 },
                { label: 'Content Frequency',score: ranking?.frequency_score,     max: 10 },
                { label: 'Growth Rate',      score: ranking?.growth_score,        max: 10 },
              ].map(({ label, score, max }) => {
                const val  = score || 0
                const pct  = max > 0 ? (val / max) * 100 : 0
                const color = pct >= 70 ? '#16A34A' : pct >= 40 ? '#F59E0B' : '#DC2626'
                return (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color }}>{val}/{max}</span>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Total Score</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1D6FED' }}>{ranking?.total_score || 0}/100</span>
              </div>
            </div>

            <PlatformCard
              connected={accounts?.yt_connected}
              Icon={FaYoutube} iconColor="#DC2626" iconBg="#FEF2F2"
              name="YouTube"
              channelName={accounts?.yt_channel_name}
              stats={[
                { label: 'Total Views', value: fmt(analytics?.yt_views) },
                { label: 'Subscribers', value: fmt(analytics?.yt_subs) },
                { label: 'Videos This Week', value: analytics?.yt_videos_this_week || 0 },
              ]}
              onConnect={() => navigate('/connect')}
            />
            <PlatformCard
              connected={accounts?.fb_connected}
              Icon={FaFacebook} iconColor="#1D6FED" iconBg="#EFF6FF"
              name="Facebook"
              channelName={accounts?.fb_page_name}
              stats={[
                { label: 'Page Reach',   value: fmt(analytics?.fb_reach) },
                { label: 'Total Posts',  value: analytics?.fb_total_posts || 0 },
                { label: 'Total Likes',  value: fmt(analytics?.fb_total_likes) },
              ]}
              onConnect={() => navigate('/connect')}
            />
            <PlatformCard
              connected={!!accounts?.ig_username}
              Icon={FaInstagram} iconColor="#9333EA" iconBg="#FDF4FF"
              name="Instagram"
              channelName={accounts?.ig_username}
              stats={[
                { label: 'Reel Views',  value: fmt(analytics?.ig_reel_views) },
                { label: 'Followers',   value: fmt(analytics?.ig_followers) },
                { label: 'Total Posts', value: analytics?.ig_total_posts || 0 },
              ]}
              onConnect={() => navigate('/connect')}
            />
          </>
        )}

        {/* ── YOUTUBE TAB ── */}
        {activeTab === 'YouTube' && (
          <>
            {/* Channel banner */}
            {accounts?.yt_connected ? (
              <div style={s.ytBanner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ ...s.platformIconCircle, background: '#FEF2F2' }}>
                    <FaYoutube color="#DC2626" size={20} />
                  </div>
                  <div>
                    <p style={s.ytChannelName}>{accounts?.yt_channel_name || 'Your Channel'}</p>
                    <p style={s.ytStats}>
                      {fmt(analytics?.yt_views)} views · {fmt(analytics?.yt_subs)} subs
                    </p>
                  </div>
                </div>
                <a
                  href="https://studio.youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  style={s.studioLink}
                >
                  Open YouTube Studio →
                </a>
              </div>
            ) : (
              <NotConnectedCard name="YouTube" onConnect={() => navigate('/connect')} />
            )}

            <p style={s.sectionTitle}>Recent Videos</p>

            {videos.length === 0 ? (
              <EmptyState icon="🎬" text="No videos found" sub="Sync to load your recent videos" />
            ) : (
              videos.map(video => (
                <div key={video.id} style={s.videoCard}>
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt={video.title} style={s.thumbnail} />
                  ) : (
                    <div style={s.thumbnailFallback}>▶</div>
                  )}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={s.videoTitle}>{video.title}</p>
                    <div style={s.videoStats}>
                      <span>👁 {fmt(video.views)}</span>
                      <span>👍 {fmt(video.likes)}</span>
                      <span>💬 {fmt(video.comments)}</span>
                    </div>
                    <p style={s.videoDate}>{new Date(video.published_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div style={video.is_verified ? s.verifiedBadge : s.unverifiedBadge}>
                    {video.is_verified ? '✓ Chirag' : '⚠ Pending'}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── FACEBOOK TAB ── */}
        {activeTab === 'Facebook' && (
          <>
            {accounts?.fb_connected ? (
              <div style={{ ...s.ytBanner, background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ ...s.platformIconCircle, background: '#DBEAFE' }}>
                    <FaFacebook color="#1D6FED" size={20} />
                  </div>
                  <div>
                    <p style={{ ...s.ytChannelName, color: '#1E40AF' }}>
                      {accounts?.fb_page_name || 'Your Page'}
                    </p>
                    <p style={s.ytStats}>
                      {fmt(analytics?.fb_reach)} reach · {analytics?.fb_total_posts || 0} posts
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <NotConnectedCard name="Facebook" onConnect={() => navigate('/connect')} />
            )}

            <p style={s.sectionTitle}>Recent Posts</p>

            {posts.length === 0 ? (
              <EmptyState icon="📘" text="No posts found" sub="Connect Facebook to see your posts" />
            ) : (
              posts.map(post => (
                <div key={post.id} style={s.postCard}>
                  <p style={s.postMessage} numberOfLines={2}>{post.message || 'Facebook post'}</p>
                  <div style={s.videoStats}>
                    <span>👁 {fmt(post.reach)}</span>
                    <span>👍 {fmt(post.likes)}</span>
                    <span>💬 {fmt(post.comments)}</span>
                  </div>
                  <p style={s.videoDate}>{new Date(post.published_at).toLocaleDateString('en-IN')}</p>
                </div>
              ))
            )}
          </>
        )}

        <div style={{ height: 80 }} />
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={s.bottomNav}>
        <NavBtn icon="🏠" label="Home"    onClick={() => navigate('/home')} />
        <NavBtn icon="🏆" label="Rank"    onClick={() => navigate('/leaderboard')} />
        <NavBtn icon="🔔" label="Alerts"  onClick={() => navigate('/notifications')} />
        <NavBtn icon="👤" label="Profile" onClick={() => navigate('/profile')} />
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function ScoreTile({ label, value }) {
  return (
    <div style={s.scoreTile}>
      <p style={s.scoreTileVal}>{value}</p>
      <p style={s.scoreTileLbl}>{label}</p>
    </div>
  )
}

function PlatformCard({ connected, Icon, iconColor, iconBg, name, channelName, stats, onConnect }) {
  return (
    <div style={{
      ...s.platformCard,
      background: connected ? '#fff' : '#F8FAFC',
      borderColor: connected ? '#E2E8F0' : '#E2E8F0',
      opacity: connected ? 1 : 0.75,
    }}>
      <div style={s.platformTop}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...s.platformIconCircle, background: iconBg }}>
            <Icon color={iconColor} size={18} />
          </div>
          <div>
            <p style={s.platformName}>{name}</p>
            {channelName && <p style={s.channelSub}>{channelName}</p>}
          </div>
        </div>
        {connected
          ? <span style={s.connectedPill}>Connected ✓</span>
          : <span onClick={onConnect} style={s.connectLink}>Connect →</span>
        }
      </div>
      {connected && (
        <div style={s.statsRow}>
          {stats.map((stat, i) => (
            <div key={i} style={s.statItem}>
              <p style={s.statVal}>{stat.value}</p>
              <p style={s.statLbl}>{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotConnectedCard({ name, onConnect }) {
  return (
    <div style={s.notConnected}>
      <p style={s.notConnectedText}>{name} not connected</p>
      <button onClick={onConnect} style={s.notConnectedBtn}>Connect {name} →</button>
    </div>
  )
}

function EmptyState({ icon, text, sub }) {
  return (
    <div style={s.emptyState}>
      <span style={{ fontSize: 36 }}>{icon}</span>
      <p style={s.emptyTitle}>{text}</p>
      <p style={s.emptySub}>{sub}</p>
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

function SkeletonAnalytics() {
  const sk = (h, w, r = 10) => ({
    height: h, width: w || '100%', borderRadius: r,
    background: '#E2E8F0', animation: 'pulse 1.5s ease-in-out infinite',
  })
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ background: '#0A2540', padding: '48px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...sk(22, 160, 8), background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ ...sk(56, undefined, 14), background: 'rgba(255,255,255,0.08)' }} />)}
        </div>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...Array(3)].map((_, i) => <div key={i} style={sk(100)} />)}
      </div>
    </div>
  )
}

/* ── Styles ── */
const s = {
  page:        { minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' },
  header:      { background: '#0A2540', padding: '0 20px 20px' },
  statusBar:   { display: 'flex', justifyContent: 'space-between', padding: '14px 0 18px' },
  statusTime:  { fontSize: 14, fontWeight: 700, color: '#fff' },
  statusRight: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  topRow:      { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconBtn: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title:       { fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5, margin: 0 },
  titleSub:    { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  scoreGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  scoreTile: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, padding: '12px 14px',
  },
  scoreTileVal: { fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 },
  scoreTileLbl: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  tabBar: {
    display: 'flex', background: '#fff',
    borderBottom: '1px solid #F1F5F9', padding: '0 16px',
  },
  tab: {
    flex: 1, padding: '12px 0', fontSize: 13,
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', transition: 'color 0.15s',
  },
  body:         { flex: 1, overflowY: 'auto', padding: '14px 16px 0' },
  syncCard: { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  syncTitle: { fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 3 },
  syncSub:   { fontSize: 11, color: '#94A3B8' },
  syncBtn: { background: '#0A2540', color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: 'none', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '14px 0 10px' },
  platformCard: {
    border: '1.5px solid #E2E8F0', borderRadius: 16,
    padding: 14, marginBottom: 12,
  },
  platformTop:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  platformIconCircle: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  platformName: { fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 2 },
  channelSub:   { fontSize: 11, color: '#94A3B8' },
  connectedPill: { background: '#D1FAE5', color: '#16A34A', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8 },
  connectLink:   { fontSize: 12, color: '#1D6FED', cursor: 'pointer', fontWeight: 600 },
  statsRow:      { display: 'flex', gap: 0 },
  statItem:      { flex: 1, textAlign: 'center', borderRight: '1px solid #F1F5F9', padding: '8px 0' },
  statVal:       { fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 },
  statLbl:       { fontSize: 9, color: '#94A3B8', marginTop: 2 },
  ytBanner: {
    background: '#FEF2F2', border: '1.5px solid #FECACA',
    borderRadius: 16, padding: 14, marginBottom: 12,
  },
  ytChannelName: { fontSize: 15, fontWeight: 800, color: '#DC2626', margin: 0 },
  ytStats:       { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  studioLink:    { fontSize: 12, color: '#DC2626', fontWeight: 700, textDecoration: 'none' },
  videoCard: {
    background: '#fff', border: '1.5px solid #E2E8F0',
    borderRadius: 14, padding: 12, marginBottom: 10,
    display: 'flex', alignItems: 'flex-start', gap: 12,
  },
  thumbnail:        { width: 60, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  thumbnailFallback: { width: 60, height: 40, borderRadius: 8, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#94A3B8', flexShrink: 0 },
  videoTitle:   { fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  videoStats:   { display: 'flex', gap: 10, fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  videoDate:    { fontSize: 10, color: '#CBD5E1' },
  verifiedBadge:   { background: '#D1FAE5', color: '#16A34A', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0 },
  unverifiedBadge: { background: '#FEF9C3', color: '#92400E', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0 },
  postCard: { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 12, marginBottom: 10 },
  postMessage: { fontSize: 13, color: '#0F172A', marginBottom: 8, lineHeight: 1.4 },
  notConnected: { background: '#F8FAFC', border: '1.5px dashed #E2E8F0', borderRadius: 16, padding: 20, textAlign: 'center', marginBottom: 12 },
  notConnectedText: { fontSize: 14, color: '#94A3B8', marginBottom: 10 },
  notConnectedBtn:  { background: '#0A2540', color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: 600, color: '#94A3B8', margin: 0 },
  emptySub:   { fontSize: 12, color: '#CBD5E1', margin: 0 },
  bottomNav: { position: 'sticky', bottom: 0, background: '#fff', borderTop: '1.5px solid #F1F5F9', display: 'flex', padding: '10px 0 18px', zIndex: 100 },
  navBtn:    { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'Inter, sans-serif' },
  navLabel:  { fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' },
}
