import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FaYoutube, FaFacebook, FaInstagram, FaTwitter } from 'react-icons/fa'

/* ── Platform config ── */
const PLATFORMS = [
  {
    key:     'yt',
    Icon:    FaYoutube,
    iconBg:  '#FEF2F2',
    iconColor: '#DC2626',
    name:    'YouTube Channel',
    desc:    'Views & analytics tracked automatically',
    placeholder:  'youtube.com/@yourchannel',
    helperText:   'Enter your YouTube channel URL\nNot a video URL — channel URL only\nExample: youtube.com/@RaviKumarLJP',
    connectedKey:  'yt_connected',
    urlKey:        'youtube_channel_url',
    nameKey:       'yt_channel_name',
    manual: false,
  },
  {
    key:     'fb',
    Icon:    FaFacebook,
    iconBg:  '#EFF6FF',
    iconColor: '#1D6FED',
    name:    'Facebook Page',
    desc:    'Page reach & engagement tracked',
    placeholder:  'facebook.com/yourpagename',
    helperText:   'Enter your Facebook Page URL\nNot personal profile — Page URL only',
    connectedKey:  'fb_connected',
    urlKey:        'facebook_page_url',
    nameKey:       'fb_page_name',
    manual: false,
  },
  {
    key:     'ig',
    Icon:    FaInstagram,
    iconBg:  '#FDF4FF',
    iconColor: '#9333EA',
    name:    'Instagram',
    desc:    'Reels & story views tracked',
    placeholder: '@your_instagram',
    connectedKey:  null,
    urlKey:        'ig_username',
    nameKey:       'ig_username',
    manual: false,
  },
  {
    key:     'tw',
    Icon:    FaTwitter,
    iconBg:  '#F8FAFC',
    iconColor: '#64748B',
    name:    'Twitter / X',
    desc:    'Manual link only (auto-track not available)',
    placeholder: 'twitter.com/yourhandle',
    connectedKey:  null,
    urlKey:        'twitter_url',
    nameKey:       'twitter_url',
    manual: true,
  },
]

/* ── Main ── */

export default function ConnectAccounts() {
  const [connections,  setConnections]  = useState(null)
  const [currentUser,  setCurrentUser]  = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(null)
  const [inputs,       setInputs]       = useState({ yt: '', fb: '', ig: '', tw: '' })
  const navigate = useNavigate()

  useEffect(() => { fetchConnections() }, [])

  const fetchConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }
    setCurrentUser(user)

    const { data } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('volunteer_id', user.id)
      .maybeSingle()

    setConnections(data || {})
    setLoading(false)
  }

  const saveAccount = async (platform, url) => {
    if (!url.trim()) return
    setSaving(platform.key)

    const { data: { user } } = await supabase.auth.getUser()

    const { data: existing } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('volunteer_id', user.id)
      .maybeSingle()

    const updateData = { volunteer_id: user.id }

    if (platform.key === 'yt') {
      updateData.youtube_channel_url = url
      updateData.youtube_channel_id  = url
      updateData.yt_connected        = true
      updateData.yt_channel_name     = url
    }
    if (platform.key === 'fb') {
      updateData.facebook_page_url   = url
      updateData.facebook_page_id    = url
      updateData.fb_connected        = true
      updateData.fb_page_name        = url
    }
    if (platform.key === 'ig') updateData.ig_username  = url
    if (platform.key === 'tw') updateData.twitter_url  = url

    let error

    if (existing) {
      const res = await supabase
        .from('social_accounts')
        .update(updateData)
        .eq('volunteer_id', user.id)
      error = res.error
    } else {
      const res = await supabase
        .from('social_accounts')
        .insert({ volunteer_id: user.id, ...updateData })
      error = res.error
    }

    if (error) {
      console.log('Save error:', error)
      setSaving(null)
      return
    }

    setInputs(prev => ({ ...prev, [platform.key]: '' }))
    await fetchConnections()
    setSaving(null)
    alert('Account connected successfully!')
  }

  const disconnect = async (platform) => {
    if (!currentUser) return
    const clearData = {}
    if (platform.connectedKey) clearData[platform.connectedKey] = false
    clearData[platform.urlKey]  = null
    clearData[platform.nameKey] = null

    await supabase.from('social_accounts')
      .update(clearData).eq('volunteer_id', currentUser.id)

    await fetchConnections()
  }

  const isConnected = (platform) => {
    if (!connections) return false
    if (platform.key === 'yt') return connections.yt_connected === true
    if (platform.key === 'fb') return connections.fb_connected === true
    return !!connections[platform.urlKey]
  }

  const getHandle = (platform) => {
    if (!connections) return ''
    return connections[platform.nameKey] || ''
  }

  const getSavedUrl = (platform) => {
    if (!connections) return ''
    if (platform.key === 'yt') return connections.youtube_channel_url || ''
    if (platform.key === 'fb') return connections.facebook_page_url || ''
    if (platform.key === 'ig') return connections.ig_username || ''
    if (platform.key === 'tw') return connections.twitter_url || ''
    return ''
  }

  if (loading) return <SkeletonConnect />

  return (
    <div style={s.page} className="vol-page">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* ── NAVY HEADER ── */}
      <div style={s.header}>

        {/* Status bar */}
        <div style={s.statusBar}>
          <span style={s.statusTime}>9:41</span>
          <span style={s.statusRight}>▮▮▮ ▊▊ 🔋</span>
        </div>

        {/* Back + title */}
        <div style={s.topRow}>
          <button onClick={() => navigate(-1)} style={s.backBtn}>←</button>
          <div style={{ flex: 1 }}>
            <p style={s.title}>Connect Accounts</p>
            <p style={s.titleSub}>
              Link your social media to track your impact
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div style={s.infoBanner}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
          <p style={s.infoText}>
            Connect your accounts once — views will be tracked automatically
          </p>
        </div>
      </div>

      {/* ── WHITE CARD ── */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Your Accounts</p>

        {PLATFORMS.map(platform => {
          const connected = isConnected(platform)
          const handle    = getHandle(platform)
          const { Icon }  = platform

          return (
            <div
              key={platform.key}
              style={{
                ...s.platformCard,
                borderColor: connected ? '#BFDBFE' : '#E2E8F0',
                background:  connected ? '#F0F9FF' : '#F8FAFC',
              }}
            >
              {/* Top row */}
              <div style={s.platformTop}>
                <div style={s.platformLeft}>
                  {/* Icon */}
                  <div style={{ ...s.iconCircle, background: platform.iconBg }}>
                    <Icon color={platform.iconColor} size={18} />
                  </div>
                  {/* Name + badge */}
                  <div>
                    <div style={s.platformNameRow}>
                      <span style={s.platformName}>{platform.name}</span>
                      {platform.manual && (
                        <span style={s.manualBadge}>Manual</span>
                      )}
                    </div>
                    <p style={s.platformDesc}>{platform.desc}</p>
                    {connected && (
                      <span style={s.connectedBadge}>Connected ✓</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Connected state */}
              {connected && (
                <div style={{ marginTop: 10 }}>
                  <p style={s.channelName}>
                    {platform.key === 'yt' ? 'Channel' :
                     platform.key === 'fb' ? 'Page' :
                     platform.key === 'ig' ? 'Account' : 'Handle'}: {handle}
                  </p>
                  <span
                    onClick={() => disconnect(platform)}
                    style={s.disconnectLink}
                  >
                    Disconnect
                  </span>
                </div>
              )}

              {/* Not connected — input + save */}
              {!connected && (
                <div style={{ marginTop: 10 }}>
                  <input
                    style={s.urlInput}
                    placeholder={platform.placeholder}
                    value={inputs[platform.key] || getSavedUrl(platform)}
                    onChange={e => setInputs(prev => ({ ...prev, [platform.key]: e.target.value }))}
                    onFocus={e => { e.target.style.borderColor = '#1D6FED' }}
                    onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
                  />
                  {platform.helperText && (
                    <p style={s.helperText}>{platform.helperText}</p>
                  )}
                  <button
                    onClick={() => saveAccount(platform, inputs[platform.key])}
                    disabled={saving === platform.key || !inputs[platform.key].trim()}
                    style={{
                      ...s.saveBtn,
                      opacity: (!inputs[platform.key].trim() || saving === platform.key) ? 0.5 : 1,
                      cursor: (!inputs[platform.key].trim() || saving === platform.key) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saving === platform.key ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Skip */}
        <p onClick={() => navigate('/home')} style={s.skipText}>
          Skip for now — Connect later in Profile
        </p>

        <div style={{ height: 40 }} />
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={s.bottomNav}>
        <NavBtn icon="🏠" label="Home"    onClick={() => navigate('/home')} />
        <NavBtn icon="🏆" label="Rank"    onClick={() => navigate('/leaderboard')} />
        <NavBtn icon="🔔" label="Alerts"  onClick={() => navigate('/notifications')} />
        <NavBtn icon="👤" label="Profile" active onClick={() => navigate('/profile')} />
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

function SkeletonConnect() {
  const sk = (h, w, r = 10) => ({
    height: h, width: w || '100%', borderRadius: r,
    background: '#E2E8F0',
    animation: 'pulse 1.5s ease-in-out infinite',
  })
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ background: '#0A2540', padding: '48px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...sk(22, 180, 8), background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ ...sk(36, '100%', 14), background: 'rgba(255,255,255,0.08)' }} />
      </div>
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 14, border: '1.5px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={sk(36, 36, '50%')} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={sk(14, '55%', 6)} />
                <div style={sk(10, '70%', 4)} />
              </div>
            </div>
            <div style={sk(40, '100%', 12)} />
            <div style={sk(30, 70, 10)} />
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
  statusBar:   { display: 'flex', justifyContent: 'space-between', padding: '14px 0 18px' },
  statusTime:  { fontSize: 14, fontWeight: 700, color: '#fff' },
  statusRight: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  topRow: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  backBtn: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    border: 'none', cursor: 'pointer',
    color: '#fff', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  title:    { fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5, margin: 0 },
  titleSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  infoBanner: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 },
  card: {
    background: '#fff',
    borderRadius: '28px 28px 0 0',
    padding: '20px 16px 100px',
    flex: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 16 },
  platformCard: {
    borderRadius: 16,
    border: '1.5px solid #E2E8F0',
    padding: 14,
    marginBottom: 10,
    transition: 'all 0.2s',
  },
  platformTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  platformLeft: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  iconCircle: {
    width: 36, height: 36, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  platformNameRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
  platformName: { fontSize: 14, fontWeight: 700, color: '#0F172A' },
  manualBadge: {
    background: '#F1F5F9', color: '#64748B',
    fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 600,
  },
  platformDesc:   { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  connectedBadge: {
    display: 'inline-block',
    background: '#D1FAE5', color: '#16A34A',
    fontSize: 10, fontWeight: 700,
    padding: '3px 8px', borderRadius: 8,
  },
  channelName:    { fontSize: 12, color: '#64748B', marginBottom: 4 },
  disconnectLink: { fontSize: 11, color: '#DC2626', cursor: 'pointer', fontWeight: 500 },
  urlInput: {
    width: '100%',
    border: '1.5px solid #E2E8F0',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 13,
    fontFamily: 'Inter, sans-serif',
    color: '#0F172A',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.18s',
  },
  helperText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 1.6,
    whiteSpace: 'pre-line',
  },
  saveBtn: {
    background: '#0A2540', color: '#fff',
    fontSize: 11, fontWeight: 700,
    padding: '6px 14px', borderRadius: 10,
    border: 'none', marginTop: 8,
    fontFamily: 'Inter, sans-serif',
    transition: 'opacity 0.15s',
  },
  skipText: {
    textAlign: 'center',
    fontSize: 12, color: '#94A3B8',
    cursor: 'pointer', marginTop: 20,
    textDecoration: 'underline',
    textDecorationColor: '#E2E8F0',
  },
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
