import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import TickBadge from '../../components/TickBadge'

const NAV_ITEMS = [
  { path: '/admin',             icon: 'ti-home',        label: 'War Room',   exact: true },
  { path: '/admin/volunteers',  icon: 'ti-users',       label: 'Volunteers' },
  { path: '/admin/approvals',   icon: 'ti-check',       label: 'Approvals' },
  { path: '/admin/broadcast',   icon: 'ti-speakerphone',label: 'Broadcast' },
  { path: '/admin/analytics',   icon: 'ti-chart-bar',   label: 'Analytics' },
]

export default function AdminLayout({ children }) {
  const [adminProfile, setAdminProfile] = useState(null)
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()

  useEffect(() => { fetchAdminProfile() }, [])

  const fetchAdminProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setAdminProfile(data)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const navItems = [
    ...NAV_ITEMS,
    ...(adminProfile?.role === 'super_admin'
      ? [{ path: '/admin/super', icon: 'ti-shield', label: 'Super Admin', superOnly: true }]
      : []),
  ]

  const isActive = (path, exact) =>
    exact ? location.pathname === path : location.pathname.startsWith(path)

  const Sidebar = () => (
    <div style={s.sidebar}>
      {/* Logo */}
      <div style={s.sidebarLogo}>
        <div style={s.logoText}>VolunteerX</div>
        <div style={s.logoSub}>Admin Dashboard</div>
      </div>

      {/* Admin Profile */}
      {adminProfile && (
        <div style={s.adminInfo}>
          <div style={{
            ...s.adminAvatar,
            background: adminProfile.role === 'super_admin'
              ? 'rgba(139,92,246,0.3)' : 'rgba(29,111,237,0.3)',
          }}>
            {(adminProfile.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={s.adminName}>
                {adminProfile.verified_name || adminProfile.name}
              </span>
              <TickBadge type={adminProfile.verified_tick} size={12} />
            </div>
            <div style={{
              ...s.adminRole,
              color: adminProfile.role === 'super_admin' ? '#A78BFA' : '#60A5FA',
            }}>
              {adminProfile.role === 'super_admin' ? '⭐ Super Admin' : 'Admin'}
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={s.nav}>
        {navItems.map(item => {
          const active = isActive(item.path, item.exact)
          return (
            <div
              key={item.path}
              onClick={() => { navigate(item.path); setMobileOpen(false) }}
              style={{
                ...s.navItem,
                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                color:      active ? '#fff' : 'rgba(255,255,255,0.55)',
              }}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: 18 }} />
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>
                {item.label}
              </span>
              {item.superOnly && (
                <span style={s.superBadge}>SUPER</span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={s.sidebarFooter}>
        <div onClick={() => navigate('/')} style={s.footerLink}>
          <i className="ti ti-arrow-left" style={{ fontSize: 15 }} />
          <span>Back to App</span>
        </div>
        <div onClick={handleLogout} style={{ ...s.footerLink, color: '#FDA4AF' }}>
          <i className="ti ti-logout" style={{ fontSize: 15 }} />
          <span>Logout</span>
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.layout}>
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-content { margin-left: 0 !important; }
        }
        @media (min-width: 769px) {
          .admin-mobile-overlay { display: none !important; }
          .admin-topbar-menu-btn { display: none !important; }
        }
      `}</style>

      {/* Sidebar desktop */}
      <div className="admin-sidebar-desktop" style={{ ...s.sidebar, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100, overflowY: 'auto' }}>
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="admin-mobile-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div style={{ ...s.sidebar, width: 240, height: '100vh', overflowY: 'auto', position: 'relative', zIndex: 201 }}>
            <Sidebar />
          </div>
          <div onClick={() => setMobileOpen(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />
        </div>
      )}

      {/* Main content */}
      <div className="admin-content" style={{ marginLeft: 240, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={s.topbar}>
          <button
            className="admin-topbar-menu-btn"
            onClick={() => setMobileOpen(true)}
            style={s.menuBtn}
          >
            <i className="ti ti-menu-2" style={{ fontSize: 20 }} />
          </button>
          <span style={s.topbarTitle}>
            {navItems.find(n => isActive(n.path, n.exact))?.label || 'Admin'}
          </span>
          <div style={s.topbarRight}>
            <span style={s.topbarDate}>
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Page content */}
        <div style={s.content}>{children}</div>
      </div>
    </div>
  )
}

const s = {
  layout:  { display: 'flex', minHeight: '100vh', fontFamily: 'Inter,sans-serif', background: '#F8FAFC' },
  sidebar: { width: 240, background: '#0A2540', display: 'flex', flexDirection: 'column' },
  sidebarLogo: { padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  logoText:    { fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' },
  logoSub:     { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  adminInfo:   { padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 },
  adminAvatar: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 },
  adminName:   { fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  adminRole:   { fontSize: 10, marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.5px' },
  nav:         { flex: 1, padding: '8px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 10,
    cursor: 'pointer', marginBottom: 2,
    transition: 'all 0.15s',
  },
  superBadge:  { fontSize: 9, background: 'rgba(139,92,246,0.3)', color: '#A78BFA', padding: '2px 6px', borderRadius: 6, marginLeft: 'auto', fontWeight: 700 },
  sidebarFooter: { padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 4 },
  footerLink:  { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 12, transition: 'color 0.15s' },
  topbar:      { background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 },
  menuBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: '#0A2540', padding: 4 },
  topbarTitle: { fontSize: 16, fontWeight: 700, color: '#0F172A', flex: 1 },
  topbarRight: { display: 'flex', alignItems: 'center', gap: 12 },
  topbarDate:  { fontSize: 12, color: '#94A3B8' },
  content:     { flex: 1, padding: '24px' },
}
