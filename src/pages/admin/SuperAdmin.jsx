import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminGuard from './AdminGuard'
import AdminLayout from './AdminLayout'

function SuperAdminContent() {
  const [admins,   setAdmins]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(null)
  const [newAdmin, setNewAdmin] = useState({ mobile: '', name: '', role: 'admin' })
  const [adding,   setAdding]   = useState(false)
  const [msg,      setMsg]      = useState('')

  useEffect(() => { fetchAdmins() }, [])

  const fetchAdmins = async () => {
    const { data } = await supabase.from('profiles').select('*')
      .in('role', ['admin', 'super_admin']).order('created_at', { ascending: false })
    setAdmins(data || [])
    setLoading(false)
  }

  const updateRole = async (id, role) => {
    setSaving(id)
    await supabase.from('profiles').update({ role }).eq('id', id)
    await fetchAdmins()
    setSaving(null)
  }

  const updateTick = async (id, tick) => {
    setSaving(id + '_tick')
    await supabase.from('profiles').update({ verified_tick: tick }).eq('id', id)
    await fetchAdmins()
    setSaving(null)
  }

  const promoteByMobile = async () => {
    if (!newAdmin.mobile.trim()) return
    setAdding(true)
    const phone = '+91' + newAdmin.mobile.replace(/\D/g, '')
    const { data, error } = await supabase.from('profiles').update({ role: newAdmin.role })
      .eq('mobile', phone).select()

    if (error || !data?.length) {
      setMsg('❌ Volunteer not found with this mobile number')
    } else {
      setMsg(`✅ ${data[0].name || phone} promoted to ${newAdmin.role}`)
      setNewAdmin({ mobile: '', name: '', role: 'admin' })
      await fetchAdmins()
    }
    setAdding(false)
    setTimeout(() => setMsg(''), 4000)
  }

  if (loading) return <Loader />

  return (
    <div className="admin-page">
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>⭐ Super Admin Panel</h1>
          <p style={s.pageSub}>Manage admin roles, verified ticks, and system settings</p>
        </div>
        <div style={s.superBadge}>Super Admin Only</div>
      </div>

      {/* Promote to admin */}
      <div style={s.card}>
        <h2 style={s.cardTitle}>Promote Volunteer to Admin</h2>
        <div style={s.promoteRow}>
          <input
            style={s.input}
            placeholder="Mobile number (10 digits)"
            value={newAdmin.mobile}
            onChange={e => setNewAdmin(p => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
            maxLength={10}
          />
          <select
            style={s.select}
            value={newAdmin.role}
            onChange={e => setNewAdmin(p => ({ ...p, role: e.target.value }))}
          >
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <button
            onClick={promoteByMobile}
            disabled={adding || newAdmin.mobile.length < 10}
            style={{ ...s.btn, opacity: (adding || newAdmin.mobile.length < 10) ? 0.5 : 1 }}
          >
            {adding ? 'Promoting...' : 'Promote →'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 13, marginTop: 10, color: msg.startsWith('✅') ? '#16A34A' : '#DC2626' }}>{msg}</p>}
      </div>

      {/* Admin list */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '24px 0 14px' }}>
        Admin Roster ({admins.length})
      </h2>
      <div style={s.tableCard}>
        {admins.map((a, i) => (
          <div key={a.id} style={{ ...s.tableRow, borderBottom: i < admins.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
            <div style={{ ...s.avatar, background: a.role === 'super_admin' ? 'rgba(139,92,246,0.15)' : '#EFF6FF', color: a.role === 'super_admin' ? '#9333EA' : '#1D6FED' }}>
              {(a.name || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={s.name}>{a.name || 'Unnamed'}</p>
              <p style={s.sub}>{a.mobile} · {a.district || '—'}</p>
            </div>

            {/* Role select */}
            <select
              value={a.role}
              onChange={e => updateRole(a.id, e.target.value)}
              disabled={saving === a.id}
              style={{ ...s.roleSelect, color: a.role === 'super_admin' ? '#9333EA' : '#1D6FED' }}
            >
              <option value="volunteer">Volunteer</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>

            {/* Verified tick */}
            <select
              value={a.verified_tick || ''}
              onChange={e => updateTick(a.id, e.target.value || null)}
              disabled={saving === a.id + '_tick'}
              style={s.tickSelect}
            >
              <option value="">No tick</option>
              <option value="blue">Blue tick</option>
              <option value="green">Green tick</option>
            </select>

            <div style={{ fontSize: 11, color: '#94A3B8', minWidth: 60, textAlign: 'right' }}>
              {saving === a.id || saving === a.id + '_tick' ? 'Saving...' : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Danger zone */}
      <div style={s.dangerCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: '#DC2626' }} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', margin: 0 }}>Danger Zone</h3>
        </div>
        <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>These actions are irreversible. Proceed with caution.</p>
        <button style={s.dangerBtn} onClick={() => alert('Contact system administrator for this action.')}>
          Reset All Rankings
        </button>
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

export default function SuperAdmin() {
  return (
    <AdminGuard requireSuperAdmin>
      <AdminLayout><SuperAdminContent /></AdminLayout>
    </AdminGuard>
  )
}

const s = {
  pageHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle:   { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' },
  pageSub:     { fontSize: 13, color: '#94A3B8' },
  superBadge:  { background: 'rgba(139,92,246,0.1)', color: '#9333EA', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 700 },
  card:        { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: 20, marginBottom: 20 },
  cardTitle:   { fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 14 },
  promoteRow:  { display: 'flex', gap: 10 },
  input:       { flex: 1, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', color: '#0F172A', outline: 'none' },
  select:      { border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'Inter,sans-serif', color: '#0F172A', outline: 'none' },
  btn:         { background: '#0A2540', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
  tableCard:   { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  tableRow:    { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' },
  avatar:      { width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0 },
  name:        { fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 },
  sub:         { fontSize: 11, color: '#94A3B8' },
  roleSelect:  { fontSize: 12, fontWeight: 700, border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '4px 8px', fontFamily: 'Inter,sans-serif', outline: 'none', cursor: 'pointer' },
  tickSelect:  { fontSize: 12, color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '4px 8px', fontFamily: 'Inter,sans-serif', outline: 'none', cursor: 'pointer' },
  dangerCard:  { background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 14, padding: 16 },
  dangerBtn:   { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
}
