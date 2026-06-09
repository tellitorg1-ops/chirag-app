import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminGuard from './AdminGuard'
import AdminLayout from './AdminLayout'

const fmt = (n) => {
  if (!n) return '0'
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function AdminAnalyticsContent() {
  const [summary,  setSummary]  = useState({})
  const [topVols,  setTopVols]  = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [snapshotRes, rankingsRes, profilesRes] = await Promise.all([
      supabase.from('analytics_snapshots').select('yt_views, yt_subs, fb_reach, yt_videos_this_week'),
      supabase.from('ranking_scores').select('*').order('total_score', { ascending: false }).limit(10),
      supabase.from('profiles').select('id, name, district, photo_url, team_id').eq('role', 'volunteer'),
    ])

    const snaps    = snapshotRes.data || []
    const rankings = rankingsRes.data || []
    const profiles = profilesRes.data || []

    // Merge rankings with profiles manually
    const topVols = rankings.map(r => {
      const profile = profiles.find(p => p.id === r.volunteer_id)
      return {
        ...r,
        name:      profile?.name     || 'Unknown',
        district:  profile?.district || '—',
        photo_url: profile?.photo_url,
        team_id:   profile?.team_id,
      }
    })

    setSummary({
      totalYTViews:  snaps.reduce((s, d) => s + (d.yt_views || 0), 0),
      totalYTSubs:   snaps.reduce((s, d) => s + (d.yt_subs || 0), 0),
      totalFBReach:  snaps.reduce((s, d) => s + (d.fb_reach || 0), 0),
      totalVideos:   snaps.reduce((s, d) => s + (d.yt_videos_this_week || 0), 0),
      totalAccounts: snaps.length,
    })
    setTopVols(topVols)
    setLoading(false)
  }

  if (loading) return <Loader />

  const GRADE_COLOR = { sparsh: '#64748B', sankalp: '#1D6FED', uday: '#F59E0B', ojas: '#9333EA', tejas: '#DC2626' }

  return (
    <div>
      <h1 style={s.pageTitle}>Network Analytics</h1>
      <p style={s.pageSub}>Aggregated performance across all volunteers</p>

      {/* Summary cards */}
      <div style={s.summaryGrid}>
        {[
          { label: 'Total YT Views',     value: fmt(summary.totalYTViews),  icon: 'ti-brand-youtube', color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Total YT Subs',      value: fmt(summary.totalYTSubs),   icon: 'ti-users',         color: '#1D6FED', bg: '#EFF6FF' },
          { label: 'Total FB Reach',     value: fmt(summary.totalFBReach),  icon: 'ti-brand-facebook',color: '#1D6FED', bg: '#EFF6FF' },
          { label: 'Videos This Week',   value: fmt(summary.totalVideos),   icon: 'ti-video',         color: '#9333EA', bg: '#FAF5FF' },
          { label: 'Connected Accounts', value: fmt(summary.totalAccounts), icon: 'ti-link',          color: '#16A34A', bg: '#F0FDF4' },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} style={s.summaryCard}>
            <div style={{ ...s.summaryIcon, background: bg }}>
              <i className={`ti ${icon}`} style={{ fontSize: 20, color }} />
            </div>
            <p style={s.summaryValue}>{value}</p>
            <p style={s.summaryLabel}>{label}</p>
          </div>
        ))}
      </div>

      {/* Top volunteers leaderboard */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '24px 0 14px' }}>Top Volunteers This Week</h2>
      <div style={s.tableCard}>
        <div style={s.tableHead}>
          <span style={s.th}>Rank</span>
          <span style={{ ...s.th, flex: 1 }}>Volunteer</span>
          <span style={s.th}>District</span>
          <span style={s.th}>Grade</span>
          <span style={s.th}>Score</span>
        </div>
        {topVols.map((v, i) => {
          const grade = (v.grade || 'sparsh').toLowerCase()
          return (
            <div key={v.id} style={{ ...s.tableRow, background: i === 0 ? '#FFFBEB' : '#fff' }}>
              <span style={{ ...s.td, fontWeight: 800, color: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : '#CBD5E1', width: 40 }}>
                #{i + 1}
              </span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={s.volAvatar}>{(v.name || '?').charAt(0).toUpperCase()}</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{v.name || 'Unknown'}</span>
              </div>
              <span style={s.td}>{v.district || '—'}</span>
              <span style={{ ...s.td, color: GRADE_COLOR[grade], fontWeight: 700 }}>
                {grade.charAt(0).toUpperCase() + grade.slice(1)}
              </span>
              <span style={{ ...s.td, fontWeight: 800, color: '#0F172A' }}>{v.total_score || 0}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E2E8F0', borderTop: '3px solid #0A2540', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function AdminAnalytics() {
  return <AdminGuard><AdminLayout><AdminAnalyticsContent /></AdminLayout></AdminGuard>
}

const s = {
  pageTitle:    { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' },
  pageSub:      { fontSize: 13, color: '#94A3B8', marginBottom: 20 },
  summaryGrid:  { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 4 },
  summaryCard:  { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 },
  summaryIcon:  { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  summaryValue: { fontSize: 24, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' },
  summaryLabel: { fontSize: 11, color: '#94A3B8' },
  tableCard:    { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' },
  tableHead:    { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
  th:           { fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: 80 },
  tableRow:     { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #F1F5F9' },
  td:           { fontSize: 13, color: '#64748B', minWidth: 80 },
  volAvatar:    { width: 30, height: 30, borderRadius: '50%', background: '#EFF6FF', color: '#1D6FED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
}
