import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminGuard from './AdminGuard'
import AdminLayout from './AdminLayout'

const GRADE_COLOR = {
  tejas:   { bg: '#FEF3C7', color: '#92400E' },
  ojas:    { bg: '#DBEAFE', color: '#1E40AF' },
  uday:    { bg: '#D1FAE5', color: '#065F46' },
  sankalp: { bg: '#F0FDF4', color: '#166534' },
  sparsh:  { bg: '#EEF2FF', color: '#3730A3' },
}

function VolunteersContent() {
  const [volunteers,     setVolunteers]     = useState([])
  const [search,         setSearch]         = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [loading,        setLoading]        = useState(true)
  const [deleteTarget,   setDeleteTarget]   = useState(null)
  const [selectedVol,    setSelectedVol]    = useState(null)
  const [savingId,       setSavingId]       = useState(null)
  const [analytics,      setAnalytics]      = useState(null)
  const [districts,      setDistricts]      = useState([])

  /* ── Fetch volunteers + enrich with rankings & socials ── */
  const fetchVolunteers = async () => {
    setLoading(true)

    const { data: vols, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'volunteer')
      .order('created_at', { ascending: false })

    console.log('Query result:', vols)
    console.log('Query error:', error)
    console.log('Count:', vols?.length)

    if (!vols || error) {
      setVolunteers([])
      setLoading(false)
      return
    }

    const [rankingsRes, socialsRes] = await Promise.all([
      supabase.from('ranking_scores').select('*'),
      supabase.from('social_accounts').select('*'),
    ])

    const rankings = rankingsRes.data || []
    const socials  = socialsRes.data  || []

    const enriched = vols.map(vol => ({
      ...vol,
      score:  rankings.find(r => r.volunteer_id === vol.id) || {},
      social: socials.find(s => s.volunteer_id === vol.id)  || {},
    }))

    setVolunteers(enriched)

    const dists = [...new Set(vols.map(v => v.district).filter(Boolean))].sort()
    setDistricts(dists)

    setLoading(false)
  }

  useEffect(() => { fetchVolunteers() }, [])

  /* ── Client-side filter ── */
  const filtered = volunteers.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !search || (
      v.name?.toLowerCase().includes(q) ||
      v.mobile?.includes(search) ||
      v.district?.toLowerCase().includes(q)
    )
    const matchDistrict = !filterDistrict || v.district === filterDistrict
    return matchSearch && matchDistrict
  })

  /* ── View Aadhaar signed URL ── */
  const viewAadhaar = async (path) => {
    try {
      const { data, error } = await supabase.storage
        .from('aadhaar-docs')
        .createSignedUrl(path, 120)

      console.log('Signed URL result:', data, error)

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      } else {
        alert('Cannot open document: ' + (error?.message || 'Unknown error'))
      }
    } catch (e) {
      console.error('viewAadhaar exception:', e)
      alert('Error: ' + e.message)
    }
  }

  /* ── Verify Aadhaar ── */
  const verifyAadhaar = async (volId) => {
    setSavingId(volId + '_aadhaar')
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('profiles')
      .update({
        aadhaar_verified:    true,
        aadhaar_verified_by: user.id,
        aadhaar_verified_at: new Date().toISOString(),
      })
      .eq('id', volId)

    if (!error) {
      await supabase.from('notifications').insert({
        volunteer_id: volId,
        title: 'Aadhaar Verified!',
        body:  'Your Aadhaar has been verified.',
        type:  'notification',
      })
      alert('Aadhaar verified!')
      setSelectedVol(prev => ({ ...prev, aadhaar_verified: true }))
      fetchVolunteers()
    } else {
      console.error('verifyAadhaar error:', error)
      alert('Failed: ' + error.message)
    }

    setSavingId(null)
  }

  /* ── Approve Sparsh ── */
  const approveSparsh = async (volId) => {
    setSavingId(volId + '_sparsh')
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('profiles')
      .update({
        sparsh_approved:    true,
        sparsh_approved_by: user.id,
        sparsh_approved_at: new Date().toISOString(),
      })
      .eq('id', volId)

    if (!error) {
      await supabase.from('notifications').insert({
        volunteer_id: volId,
        title: '🎉 Sparsh Chirag!',
        body:  'Congratulations! You are now Sparsh Chirag!',
        type:  'sparsh_approved',
      })
      alert('Sparsh Chirag approved!')
      setSelectedVol(prev => ({ ...prev, sparsh_approved: true }))
      fetchVolunteers()
    } else {
      console.error('approveSparsh error:', error)
      alert('Failed: ' + error.message)
    }

    setSavingId(null)
  }

  /* ── Delete volunteer ── */
  const deleteVolunteer = async (vol) => {
    setSavingId(vol.id + '_delete')
    const { data: { user } } = await supabase.auth.getUser()

    const tables = [
      'notifications', 'task_completions', 'analytics_snapshots',
      'weekly_scores', 'ranking_scores', 'social_accounts',
      'yt_videos', 'fb_posts',
    ]
    for (const t of tables) {
      const { error } = await supabase.from(t).delete().eq('volunteer_id', vol.id)
      if (error) console.warn(`delete ${t}:`, error.message)
    }

    const { error } = await supabase.from('profiles').delete().eq('id', vol.id)
    if (error) {
      console.error('delete profile error:', error)
      alert('Failed to delete: ' + error.message)
      setSavingId(null)
      return
    }

    await supabase.from('audit_logs').insert({
      performed_by: user.id,
      action:       'DELETE_VOLUNTEER',
      target_id:    vol.id,
      details:      { name: vol.name, mobile: vol.mobile },
    })

    setDeleteTarget(null)
    setSelectedVol(null)
    fetchVolunteers()
    setSavingId(null)
  }

  /* ── Open detail: fetch analytics + social ── */
  const openDetail = async (vol) => {
    setSelectedVol(vol)
    setAnalytics(null)

    const [analyticsRes, socialRes] = await Promise.all([
      supabase.from('analytics_snapshots').select('*')
        .eq('volunteer_id', vol.id)
        .order('snapshot_date', { ascending: false })
        .limit(1).maybeSingle(),
      supabase.from('social_accounts')
        .select('yt_connected,fb_connected,youtube_channel_url')
        .eq('volunteer_id', vol.id).maybeSingle(),
    ])

    setAnalytics(analyticsRes.data || {})
    setSelectedVol(v => ({ ...v, social: socialRes.data || {} }))
  }

  const fmt = (n) => {
    if (!n) return '0'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return String(n)
  }

  const isSaving = (id, suffix) => savingId === id + suffix

  return (
    <div className="admin-page" style={{ display: 'flex', gap: 0, height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* ── LEFT PANEL ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 20px 0 0' }}>

        {/* Header */}
        <div style={s.row}>
          <div>
            <h1 style={s.title}>Volunteers</h1>
            <p style={s.sub}>
              {volunteers.length} total
              {filtered.length !== volunteers.length && ` · ${filtered.length} shown`}
            </p>
          </div>
          <button onClick={fetchVolunteers} style={s.refreshBtn}>
            <i className="ti ti-refresh" style={{ fontSize: 15 }} /> Refresh
          </button>
        </div>

        {/* Search + filter */}
        <div style={s.controls}>
          <div style={s.searchBox}>
            <i className="ti ti-search" style={{ fontSize: 14, color: '#94A3B8' }} />
            <input
              style={s.searchInput}
              placeholder="Search name, mobile, district..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <span onClick={() => setSearch('')} style={{ cursor: 'pointer', color: '#94A3B8', fontSize: 14 }}>✕</span>
            )}
          </div>
          <select
            style={s.districtSelect}
            value={filterDistrict}
            onChange={e => setFilterDistrict(e.target.value)}
          >
            <option value="">All Districts</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={s.tableWrap} className="admin-table">
          {loading ? <Loader /> : filtered.length === 0 ? (
            <div style={s.empty}>
              <i className="ti ti-users" style={{ fontSize: 36, color: '#E2E8F0' }} />
              <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 10 }}>
                {volunteers.length === 0 ? 'No volunteers found' : 'No results for this search'}
              </p>
            </div>
          ) : (
            <>
              <div style={s.thead}>
                {['Name', 'District', 'Grade', 'Score', 'YT', 'FB', 'Sparsh', 'Actions'].map(h => (
                  <span key={h} style={s.th}>{h}</span>
                ))}
              </div>
              {filtered.map(v => {
                const grade = (v.score?.grade || 'sparsh').toLowerCase()
                const gc = GRADE_COLOR[grade] || GRADE_COLOR.sparsh
                return (
                  <div
                    key={v.id}
                    style={{
                      ...s.trow,
                      background:  selectedVol?.id === v.id ? '#EFF6FF' : '#fff',
                      borderLeft: `3px solid ${selectedVol?.id === v.id ? '#1D6FED' : 'transparent'}`,
                    }}
                  >
                    <div style={{ minWidth: 140 }}>
                      <p style={s.rowName}>{v.name || 'Unnamed'}</p>
                      <p style={s.rowSub}>{v.mobile}</p>
                    </div>
                    <span style={s.rowCell}>{v.district || '—'}</span>
                    <span style={{ ...s.gradeBadge, background: gc.bg, color: gc.color }}>
                      {grade.charAt(0).toUpperCase() + grade.slice(1)}
                    </span>
                    <span style={{ ...s.rowCell, fontWeight: 700 }}>{v.score?.total_score || 0}</span>
                    <span style={{ ...s.dot, background: v.social?.yt_connected ? '#16A34A' : '#E2E8F0' }} />
                    <span style={{ ...s.dot, background: v.social?.fb_connected ? '#1D6FED' : '#E2E8F0' }} />
                    <span style={{ ...s.dot, background: v.sparsh_approved ? '#16A34A' : '#E2E8F0' }} />
                    <div style={s.actions}>
                      <button onClick={() => openDetail(v)} style={s.iconBtn} title="View">
                        <i className="ti ti-eye" style={{ fontSize: 15 }} />
                      </button>
                      <button onClick={() => setDeleteTarget(v)} style={{ ...s.iconBtn, color: '#DC2626' }} title="Delete">
                        <i className="ti ti-trash" style={{ fontSize: 15 }} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT DETAIL PANEL ── */}
      {selectedVol && (
        <div style={s.detail}>
          <div style={s.detailHead}>
            <div style={s.detailAvatar}>
              {(selectedVol.name || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={s.detailName}>{selectedVol.name || 'Unnamed'}</p>
              <p style={s.detailSub}>{selectedVol.team_id || selectedVol.id?.slice(-6)}</p>
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                {selectedVol.sparsh_approved  && <span style={s.statusBadge}>⚡ Sparsh</span>}
                {selectedVol.aadhaar_verified && (
                  <span style={{ ...s.statusBadge, background: 'rgba(22,163,74,0.2)', color: '#D1FAE5' }}>
                    🛡 Verified
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => setSelectedVol(null)} style={s.closeBtn}>✕</button>
          </div>

          <div style={s.detailBody}>

            <Section title="Profile Info">
              {[
                ['Mobile',          selectedVol.mobile],
                ['District',        selectedVol.district],
                ['Block',           selectedVol.block],
                ['Age',             selectedVol.age],
                ['Aadhaar (last 4)',selectedVol.aadhaar_last4],
                ['Joined', selectedVol.created_at
                  ? new Date(selectedVol.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'],
              ].map(([l, val]) => (
                <div key={l} style={s.infoRow}>
                  <span style={s.infoLabel}>{l}</span>
                  <span style={s.infoValue}>{val || '—'}</span>
                </div>
              ))}
            </Section>

            <Section title="Aadhaar">
              {!selectedVol.aadhaar_url ? (
                <div style={s.alertCard}>
                  <span>⚠️</span>
                  <span style={{ fontSize: 12, color: '#92400E' }}>Not uploaded yet</span>
                </div>
              ) : (
                <div style={{
                  ...s.alertCard,
                  background: selectedVol.aadhaar_verified ? '#F0FDF4' : '#FFFBEB',
                  border: `1px solid ${selectedVol.aadhaar_verified ? '#BBF7D0' : '#FDE68A'}`,
                }}>
                  <span>{selectedVol.aadhaar_verified ? '✅' : '📄'}</span>
                  <span style={{ fontSize: 12, color: selectedVol.aadhaar_verified ? '#166534' : '#92400E', flex: 1 }}>
                    {selectedVol.aadhaar_verified ? 'Aadhaar verified' : 'Uploaded, pending verification'}
                  </span>
                  <button onClick={() => viewAadhaar(selectedVol.aadhaar_url)} style={s.smallBtn}>
                    View Document
                  </button>
                </div>
              )}
            </Section>

            <Section title="Social Accounts">
              <div style={s.infoRow}>
                <span style={s.infoLabel}>YouTube</span>
                <span style={{ fontSize: 12, color: selectedVol.social?.yt_connected ? '#16A34A' : '#94A3B8' }}>
                  {selectedVol.social?.yt_connected
                    ? `✓ ${selectedVol.social.youtube_channel_url || 'Connected'}`
                    : 'Not connected'}
                </span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Facebook</span>
                <span style={{ fontSize: 12, color: selectedVol.social?.fb_connected ? '#1D6FED' : '#94A3B8' }}>
                  {selectedVol.social?.fb_connected ? '✓ Connected' : 'Not connected'}
                </span>
              </div>
            </Section>

            {analytics !== null && (
              <Section title="Analytics">
                {[
                  ['YT Views', fmt(analytics.yt_views)],
                  ['FB Reach', fmt(analytics.fb_reach)],
                  ['Streak',   analytics.posting_streak ? `${analytics.posting_streak} days` : '0 days'],
                ].map(([l, val]) => (
                  <div key={l} style={s.infoRow}>
                    <span style={s.infoLabel}>{l}</span>
                    <span style={s.infoValue}>{val}</span>
                  </div>
                ))}
              </Section>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {selectedVol.aadhaar_url && !selectedVol.aadhaar_verified && (
                <button
                  onClick={() => verifyAadhaar(selectedVol.id)}
                  disabled={!!savingId}
                  style={{ ...s.actionBtn, background: '#16A34A' }}
                >
                  {isSaving(selectedVol.id, '_aadhaar') ? 'Saving...' : '🛡 Verify Aadhaar'}
                </button>
              )}
              {!selectedVol.sparsh_approved && (
                <button
                  onClick={() => approveSparsh(selectedVol.id)}
                  disabled={!!savingId}
                  style={{ ...s.actionBtn, background: '#0A2540' }}
                >
                  {isSaving(selectedVol.id, '_sparsh') ? 'Saving...' : '⚡ Approve Sparsh Chirag'}
                </button>
              )}
              <button
                onClick={() => setDeleteTarget(selectedVol)}
                style={{ ...s.actionBtn, background: 'transparent', color: '#DC2626', border: '1.5px solid #FECACA' }}
              >
                🗑 Delete Volunteer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteTarget && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
              Delete {deleteTarget.name}?
            </p>
            <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={s.cancelBtn}>Cancel</button>
              <button
                onClick={() => deleteVolunteer(deleteTarget)}
                disabled={isSaving(deleteTarget.id, '_delete')}
                style={{ ...s.deleteBtn, opacity: isSaving(deleteTarget.id, '_delete') ? 0.6 : 1 }}
              >
                {isSaving(deleteTarget.id, '_delete') ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E2E8F0', borderTop: '3px solid #0A2540', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function Volunteers() {
  return <AdminGuard><AdminLayout><VolunteersContent /></AdminLayout></AdminGuard>
}

const s = {
  row:            { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title:          { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 },
  sub:            { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  refreshBtn:     { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Inter,sans-serif' },
  controls:       { display: 'flex', gap: 10, marginBottom: 12 },
  searchBox:      { flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '9px 14px' },
  searchInput:    { flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'Inter,sans-serif', color: '#0F172A', background: 'transparent' },
  districtSelect: { border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontFamily: 'Inter,sans-serif', color: '#64748B', outline: 'none' },
  tableWrap:      { flex: 1, overflowY: 'auto', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14 },
  thead:          { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 28px 28px 28px 80px', gap: 8, padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0 },
  th:             { fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  trow:           { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 28px 28px 28px 80px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' },
  rowName:        { fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 },
  rowSub:         { fontSize: 11, color: '#94A3B8' },
  rowCell:        { fontSize: 12, color: '#64748B' },
  gradeBadge:     { fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6, textAlign: 'center' },
  dot:            { width: 10, height: 10, borderRadius: '50%' },
  actions:        { display: 'flex', gap: 4 },
  iconBtn:        { background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4, borderRadius: 6 },
  empty:          { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' },
  detail:         { width: 320, background: '#fff', borderLeft: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 },
  detailHead:     { background: '#0A2540', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0 },
  detailAvatar:   { width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 },
  detailName:     { fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 },
  detailSub:      { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  statusBadge:    { fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 6px', borderRadius: 4 },
  closeBtn:       { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', flexShrink: 0, marginLeft: 'auto' },
  detailBody:     { flex: 1, overflowY: 'auto', padding: '16px' },
  infoRow:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F8FAFC' },
  infoLabel:      { fontSize: 12, color: '#94A3B8' },
  infoValue:      { fontSize: 12, fontWeight: 600, color: '#0F172A' },
  alertCard:      { display: 'flex', alignItems: 'center', gap: 8, background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 10, padding: '10px 12px', fontSize: 12 },
  smallBtn:       { fontSize: 11, fontWeight: 700, background: '#0A2540', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', flexShrink: 0 },
  actionBtn:      { width: '100%', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
  overlay:        { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:          { background: '#fff', borderRadius: 16, padding: 24, maxWidth: 380, width: '90%' },
  cancelBtn:      { flex: 1, background: '#F8FAFC', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
  deleteBtn:      { flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
}
