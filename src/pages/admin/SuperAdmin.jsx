import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import TickBadge from '../../components/TickBadge'

const roleColors = {
  super_admin: { bg: '#F5F3FF', color: '#6D28D9', label: '⭐ Super Admin' },
  admin:       { bg: '#EFF6FF', color: '#1D6FED', label: 'Admin' },
  author:      { bg: '#FFFBEB', color: '#D97706', label: '✍ Author' },
}

export default function SuperAdmin() {
  const [searchMobile, setSearchMobile] = useState('')
  const [foundUser,    setFoundUser]    = useState(undefined)
  const [admins,       setAdmins]       = useState([])
  const [auditLogs,    setAuditLogs]    = useState([])
  const [loading,      setLoading]      = useState(false)
  const [currentUser,  setCurrentUser]  = useState(null)
  const [activeTab,    setActiveTab]    = useState('roles')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    const [adminsRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').in('role', ['admin', 'author', 'super_admin']).order('role'),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    setAdmins(adminsRes.data || [])
    setAuditLogs(logsRes.data || [])
  }

  const findUser = async () => {
    if (!searchMobile.trim()) return
    setLoading(true)
    const mobile = searchMobile.replace(/\D/g, '')
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`mobile.eq.${mobile},mobile.eq.91${mobile},mobile.eq.+91${mobile}`)
      .maybeSingle()
    setFoundUser(data)
    setLoading(false)
  }

  const changeRole = async (volId, volName, newRole) => {
    const tick =
      newRole === 'admin' || newRole === 'super_admin' ? 'blue'
      : newRole === 'author' ? 'gold'
      : null

    await supabase.from('profiles').update({ role: newRole, verified_tick: tick }).eq('id', volId)

    await supabase.from('audit_logs').insert({
      performed_by: currentUser.id,
      action: 'ROLE_CHANGE',
      target_id: volId,
      details: { name: volName, new_role: newRole },
    })

    await supabase.from('notifications').insert({
      volunteer_id: volId,
      title: 'Role Updated',
      body: `Your role is now: ${newRole}`,
      type: 'notification',
    })

    alert(`${volName} is now ${newRole}!`)
    setFoundUser(prev => ({ ...prev, role: newRole, verified_tick: tick }))
    await fetchData()
  }

  const removeRole = async (volId, volName) => {
    if (!window.confirm(`Remove ${volName}'s special role?`)) return

    await supabase.from('profiles').update({ role: 'volunteer', verified_tick: null }).eq('id', volId)

    await supabase.from('audit_logs').insert({
      performed_by: currentUser.id,
      action: 'ROLE_REMOVED',
      target_id: volId,
      details: { name: volName },
    })

    await fetchData()
  }

  return (
    <AdminLayout>
      <div style={{ padding: 20, maxWidth: 800 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
          Super Admin Panel
        </h1>
        <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 20px' }}>
          Manage roles and permissions
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#F8FAFC', borderRadius: 12, padding: 4, marginBottom: 20, width: 'fit-content', gap: 4 }}>
          {[
            { id: 'roles', label: 'Role Manager' },
            { id: 'team',  label: 'Current Team' },
            { id: 'logs',  label: 'Audit Log' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px', borderRadius: 9, border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter,sans-serif',
                background: activeTab === tab.id ? '#fff' : 'transparent',
                color:      activeTab === tab.id ? '#0F172A' : '#94A3B8',
                boxShadow:  activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ROLE MANAGER TAB */}
        {activeTab === 'roles' && (
          <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
              Find Volunteer by Mobile
            </h2>
            <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>
              Enter mobile number to assign role
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={searchMobile}
                onChange={e => setSearchMobile(e.target.value)}
                placeholder="9876543210"
                onKeyDown={e => e.key === 'Enter' && findUser()}
                style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none' }}
              />
              <button
                onClick={findUser}
                style={{ padding: '10px 20px', background: '#0A2540', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
              >
                {loading ? 'Searching...' : 'Find'}
              </button>
            </div>

            {/* Found user card */}
            {foundUser && (
              <div style={{ marginTop: 16, background: '#F8FAFC', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0A2540', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>
                    {(foundUser.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                      {foundUser.name || 'No name'}
                      <TickBadge type={foundUser.verified_tick} size={14} />
                    </div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>
                      {foundUser.mobile}
                      {' • '}
                      <span style={{ fontWeight: 600, color: roleColors[foundUser.role]?.color || '#64748B' }}>
                        {foundUser.role}
                      </span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: '#64748B', marginBottom: 10, fontWeight: 600 }}>Assign Role:</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => changeRole(foundUser.id, foundUser.name, 'admin')}
                    style={{ padding: '8px 16px', background: '#EFF6FF', color: '#1D6FED', border: '1.5px solid #BFDBFE', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
                  >
                    🔵 Make Admin
                  </button>
                  <button
                    onClick={() => changeRole(foundUser.id, foundUser.name, 'author')}
                    style={{ padding: '8px 16px', background: '#FFFBEB', color: '#D97706', border: '1.5px solid #FDE68A', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
                  >
                    🟡 Make Author
                  </button>
                  <button
                    onClick={() => changeRole(foundUser.id, foundUser.name, 'volunteer')}
                    style={{ padding: '8px 16px', background: '#F8FAFC', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
                  >
                    Remove Role
                  </button>
                </div>
              </div>
            )}

            {foundUser === null && searchMobile && !loading && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
                No user found with this mobile number. Ask them to register first.
              </div>
            )}
          </div>
        )}

        {/* CURRENT TEAM TAB */}
        {activeTab === 'team' && (
          <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              All Admins &amp; Authors ({admins.length})
            </div>
            {admins.map((a) => {
              const rc = roleColors[a.role]
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: rc?.bg || '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: rc?.color || '#64748B', flexShrink: 0 }}>
                    {(a.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                      {a.verified_name || a.name}
                      <TickBadge type={a.verified_tick} size={13} />
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{a.mobile}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: rc?.bg, color: rc?.color }}>
                    {rc?.label || a.role}
                  </span>
                  {a.role !== 'super_admin' && (
                    <button
                      onClick={() => removeRole(a.id, a.name)}
                      style={{ padding: '5px 10px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* AUDIT LOG TAB */}
        {activeTab === 'logs' && (
          <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              Recent Actions
            </div>
            {auditLogs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                No logs yet
              </div>
            ) : auditLogs.map(log => (
              <div key={log.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#EFF6FF', color: '#1D6FED', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {log.action}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#0F172A', fontWeight: 500 }}>
                    {log.details?.name || 'Unknown'}
                    {log.details?.new_role && <span style={{ color: '#94A3B8' }}> → {log.details.new_role}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
