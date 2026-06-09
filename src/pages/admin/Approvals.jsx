import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminGuard from './AdminGuard'
import AdminLayout from './AdminLayout'

function ApprovalsContent() {
  const [pending,  setPending]  = useState([])
  const [approved, setApproved] = useState([])
  const [tab,      setTab]      = useState('pending')
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [pendRes, appRes] = await Promise.all([
      supabase.from('profiles').select('*')
        .eq('sparsh_approved', false).not('aadhaar_url', 'is', null)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*')
        .eq('sparsh_approved', true)
        .order('updated_at', { ascending: false }).limit(30),
    ])
    setPending(pendRes.data || [])
    setApproved(appRes.data || [])
    setLoading(false)
  }

  const approve = async (id, val) => {
    setSaving(id)
    await supabase.from('profiles').update({ sparsh_approved: val }).eq('id', id)

    // Send notification
    if (val) {
      await supabase.from('notifications').insert({
        volunteer_id: id,
        type:         'sparsh_approved',
        title:        '🎉 Sparsh Chirag Approved!',
        body:         'Congratulations! You are now a Sparsh Chirag volunteer.',
      })
    }

    await fetchAll()
    setSaving(null)
  }

  const list = tab === 'pending' ? pending : approved

  return (
    <div className="admin-page">
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Sparsh Approvals</h1>
          <p style={s.pageSub}>Volunteers with Aadhaar uploaded awaiting approval</p>
        </div>
        <div style={s.counters}>
          <div style={s.counterBadge}>
            <span style={{ color: '#F59E0B', fontWeight: 700 }}>{pending.length}</span> Pending
          </div>
          <div style={s.counterBadge}>
            <span style={{ color: '#16A34A', fontWeight: 700 }}>{approved.length}</span> Approved
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {[['pending', `Pending (${pending.length})`], ['approved', `Approved (${approved.length})`]].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{ ...s.tab, borderBottom: tab === k ? '2px solid #0A2540' : '2px solid transparent', color: tab === k ? '#0A2540' : '#94A3B8', fontWeight: tab === k ? 700 : 400 }}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <div style={s.grid}>
          {list.length === 0 ? (
            <div style={s.empty}>
              <i className="ti ti-check-circle" style={{ fontSize: 36, color: '#E2E8F0' }} />
              <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 10 }}>
                {tab === 'pending' ? 'No pending approvals' : 'No approved volunteers yet'}
              </p>
            </div>
          ) : (
            list.map(v => (
              <div key={v.id} style={s.card}>
                {/* Avatar + name */}
                <div style={s.cardTop}>
                  <div style={s.avatar}>
                    {v.photo_url
                      ? <img src={v.photo_url} alt="photo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (v.name || '?').charAt(0).toUpperCase()
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={s.name}>{v.name || 'Unnamed'}</p>
                    <p style={s.sub}>{v.district} · {v.block}</p>
                  </div>
                  {v.sparsh_approved && <span style={s.approvedBadge}>Approved ✓</span>}
                </div>

                {/* Details */}
                <div style={s.details}>
                  <Detail label="Mobile" value={v.mobile} />
                  <Detail label="Age"    value={v.age} />
                  <Detail label="Aadhaar" value={v.aadhaar_url ? 'Uploaded ✓' : '—'} green={!!v.aadhaar_url} />
                  <Detail label="Joined" value={v.created_at ? new Date(v.created_at).toLocaleDateString('en-IN') : '—'} />
                </div>

                {/* Aadhaar doc link */}
                {v.aadhaar_url && (
                  <a
                    href={`https://amtymjposqvtztjwwwjg.supabase.co/storage/v1/object/public/aadhaar-docs/${v.aadhaar_url}`}
                    target="_blank" rel="noreferrer"
                    style={s.docLink}
                  >
                    <i className="ti ti-file" /> View Aadhaar Doc
                  </a>
                )}

                {/* Actions */}
                {tab === 'pending' ? (
                  <div style={s.actions}>
                    <button
                      onClick={() => approve(v.id, true)}
                      disabled={saving === v.id}
                      style={{ ...s.btn, background: '#16A34A' }}
                    >
                      {saving === v.id ? '...' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => approve(v.id, false)}
                      disabled={saving === v.id}
                      style={{ ...s.btn, background: '#DC2626' }}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => approve(v.id, false)}
                    disabled={saving === v.id}
                    style={{ ...s.btn, background: '#DC2626', width: '100%' }}
                  >
                    {saving === v.id ? '...' : 'Revoke Approval'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, green }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
      <span style={{ fontSize: 11, color: '#94A3B8' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: green ? '#16A34A' : '#0F172A' }}>{value || '—'}</span>
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

export default function Approvals() {
  return <AdminGuard><AdminLayout><ApprovalsContent /></AdminLayout></AdminGuard>
}

const s = {
  pageHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle:     { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 },
  pageSub:       { fontSize: 13, color: '#94A3B8', marginTop: 3 },
  counters:      { display: 'flex', gap: 12 },
  counterBadge:  { fontSize: 13, color: '#64748B', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '6px 14px' },
  tabs:          { display: 'flex', borderBottom: '1px solid #E2E8F0', marginBottom: 20 },
  tab:           { padding: '10px 16px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
  grid:          { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 },
  card:          { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: 16 },
  cardTop:       { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar:        { width: 48, height: 48, borderRadius: '50%', background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, flexShrink: 0, overflow: 'hidden' },
  name:          { fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 3 },
  sub:           { fontSize: 11, color: '#94A3B8' },
  approvedBadge: { fontSize: 10, background: '#D1FAE5', color: '#16A34A', padding: '3px 8px', borderRadius: 8, fontWeight: 700, flexShrink: 0 },
  details:       { marginBottom: 12 },
  docLink:       { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1D6FED', textDecoration: 'none', fontWeight: 600, marginBottom: 12 },
  actions:       { display: 'flex', gap: 8 },
  btn:           { flex: 1, color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
  empty:         { gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' },
}
