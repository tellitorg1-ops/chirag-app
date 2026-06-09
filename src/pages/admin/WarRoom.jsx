import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminGuard from './AdminGuard'
import AdminLayout from './AdminLayout'

function WarRoomContent() {
  const [stats,    setStats]    = useState({})
  const [recent,   setRecent]   = useState([])
  const [topVols,  setTopVols]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    const [volRes, approvedRes, pendingRes, weekRes, recentRes, rankingsRes, profilesRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'volunteer'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('sparsh_approved', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .eq('sparsh_approved', false).not('aadhaar_url', 'is', null),
      supabase.from('weekly_scores').select('total_score')
        .order('total_score', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('profiles').select('id, name, district, created_at, role')
        .order('created_at', { ascending: false }).limit(8),
      supabase.from('ranking_scores').select('*')
        .order('total_score', { ascending: false }).limit(5),
      supabase.from('profiles').select('id, name, district, photo_url').eq('role', 'volunteer'),
    ])

    setStats({
      totalVolunteers: volRes.count || 0,
      approved:        approvedRes.count || 0,
      pendingApproval: pendingRes.count || 0,
      topScore:        weekRes.data?.total_score || 0,
    })
    setRecent(recentRes.data || [])

    // Merge rankings with profiles
    const rankings = rankingsRes.data || []
    const profiles = profilesRes.data || []
    setTopVols(rankings.map(r => ({
      ...r,
      name:     profiles.find(p => p.id === r.volunteer_id)?.name     || 'Unknown',
      district: profiles.find(p => p.id === r.volunteer_id)?.district || '—',
    })))

    setLoading(false)
  }

  const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n)

  if (loading) return <PageLoader />

  return (
    <div className="admin-page">
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>War Room</h1>
          <p style={s.pageSubtitle}>Real-time volunteer network overview</p>
        </div>
        <button onClick={() => navigate('/admin/broadcast')} style={s.primaryBtn}>
          <i className="ti ti-speakerphone" /> Broadcast
        </button>
      </div>

      {/* Stats grid */}
      <div style={s.statsGrid}>
        <StatCard icon="ti-users"        color="#1D6FED" bg="#EFF6FF" label="Total Volunteers" value={fmt(stats.totalVolunteers)} />
        <StatCard icon="ti-check-circle" color="#16A34A" bg="#F0FDF4" label="Sparsh Approved"  value={fmt(stats.approved)} />
        <StatCard icon="ti-clock"        color="#F59E0B" bg="#FFFBEB" label="Pending Approval" value={fmt(stats.pendingApproval)}
          action={{ label: 'Review →', onClick: () => navigate('/admin/approvals') }} />
        <StatCard icon="ti-trophy"       color="#9333EA" bg="#FAF5FF" label="Top Score"        value={fmt(stats.topScore)} />
      </div>

      {/* Quick actions */}
      <div style={s.sectionHeader}>
        <h2 style={s.sectionTitle}>Quick Actions</h2>
      </div>
      <div style={s.quickGrid}>
        {[
          { icon: 'ti-users',        label: 'Manage Volunteers', sub: 'View & edit volunteer data',   path: '/admin/volunteers',  color: '#1D6FED', bg: '#EFF6FF' },
          { icon: 'ti-check',        label: 'Pending Approvals', sub: `${stats.pendingApproval} waiting`, path: '/admin/approvals',   color: '#16A34A', bg: '#F0FDF4' },
          { icon: 'ti-speakerphone', label: 'Broadcast Message', sub: 'Send to all or selected',     path: '/admin/broadcast',   color: '#F59E0B', bg: '#FFFBEB' },
          { icon: 'ti-chart-bar',    label: 'Analytics Report',  sub: 'Network performance data',    path: '/admin/analytics',   color: '#9333EA', bg: '#FAF5FF' },
        ].map(({ icon, label, sub, path, color, bg }) => (
          <div key={path} onClick={() => navigate(path)} style={s.quickCard}>
            <div style={{ ...s.quickIcon, background: bg }}>
              <i className={`ti ${icon}`} style={{ fontSize: 22, color }} />
            </div>
            <div>
              <p style={s.quickLabel}>{label}</p>
              <p style={s.quickSub}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column bottom section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recently Joined */}
        <div>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>Recently Joined</h2>
            <span onClick={() => navigate('/admin/volunteers')} style={s.viewAll}>View all →</span>
          </div>
          <div style={s.tableCard}>
            {recent.map((v, i) => (
              <div key={v.id} style={{ ...s.tableRow, borderBottom: i < recent.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div style={s.tableAvatar}>{(v.name || '?').charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <p style={s.tableName}>{v.name || 'Unnamed'}</p>
                  <p style={s.tableSub}>{v.district || '—'}</p>
                </div>
                <div style={s.tableDate}>
                  {new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Volunteers */}
        <div>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>Top Volunteers</h2>
            <span onClick={() => navigate('/admin/analytics')} style={s.viewAll}>Full report →</span>
          </div>
          <div style={s.tableCard}>
            {topVols.length === 0 ? (
              <p style={{ fontSize: 12, color: '#94A3B8', padding: '16px', textAlign: 'center' }}>No ranking data yet</p>
            ) : topVols.map((v, i) => (
              <div key={v.id} style={{ ...s.tableRow, borderBottom: i < topVols.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div style={{ width: 24, fontSize: 12, fontWeight: 800, color: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : '#CBD5E1', flexShrink: 0 }}>
                  #{i + 1}
                </div>
                <div style={s.tableAvatar}>{(v.name || '?').charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <p style={s.tableName}>{v.name}</p>
                  <p style={s.tableSub}>{v.district}</p>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{v.total_score || 0}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function StatCard({ icon, color, bg, label, value, action }) {
  return (
    <div style={s.statCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ ...s.statIcon, background: bg }}>
          <i className={`ti ${icon}`} style={{ fontSize: 20, color }} />
        </div>
        {action && (
          <span onClick={action.onClick} style={{ fontSize: 11, color: '#1D6FED', cursor: 'pointer', fontWeight: 600 }}>
            {action.label}
          </span>
        )}
      </div>
      <p style={s.statValue}>{value}</p>
      <p style={s.statLabel}>{label}</p>
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E2E8F0', borderTop: '3px solid #0A2540', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function WarRoom() {
  return (
    <AdminGuard>
      <AdminLayout>
        <WarRoomContent />
      </AdminLayout>
    </AdminGuard>
  )
}

const s = {
  pageHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  pageTitle:    { fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0 },
  pageSubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 3 },
  primaryBtn:   { background: '#0A2540', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter,sans-serif' },
  statsGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 },
  statCard:     { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: 18 },
  statIcon:     { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  statValue:    { fontSize: 28, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' },
  statLabel:    { fontSize: 12, color: '#94A3B8' },
  sectionHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 },
  viewAll:      { fontSize: 12, color: '#1D6FED', cursor: 'pointer', fontWeight: 600 },
  quickGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 },
  quickCard:    { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 },
  quickIcon:    { width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  quickLabel:   { fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 3 },
  quickSub:     { fontSize: 11, color: '#94A3B8' },
  tableCard:    { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' },
  tableRow:     { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' },
  tableAvatar:  { width: 36, height: 36, borderRadius: '50%', background: '#EFF6FF', color: '#1D6FED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  tableName:    { fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 },
  tableSub:     { fontSize: 11, color: '#94A3B8' },
  tableDate:    { fontSize: 11, color: '#CBD5E1' },
}
