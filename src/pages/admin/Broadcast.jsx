import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminGuard from './AdminGuard'
import AdminLayout from './AdminLayout'

const TYPES = [
  { key: 'notification', label: 'General', icon: 'ti-bell',       color: '#1D6FED' },
  { key: 'task',         label: 'Task',    icon: 'ti-checkbox',   color: '#16A34A' },
  { key: 'crisis',       label: 'Alert',   icon: 'ti-alert',      color: '#DC2626' },
  { key: 'reward',       label: 'Reward',  icon: 'ti-gift',       color: '#F59E0B' },
]

function BroadcastContent() {
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [type,       setType]       = useState('notification')
  const [target,     setTarget]     = useState('all')
  const [district,   setDistrict]   = useState('')
  const [districts,  setDistricts]  = useState([])
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)
  const [history,    setHistory]    = useState([])
  const [volCount,   setVolCount]   = useState(0)

  useEffect(() => { fetchDistrictsAndCount(); fetchHistory() }, [])
  useEffect(() => { fetchCount() }, [target, district])

  const fetchDistrictsAndCount = async () => {
    const { data } = await supabase.from('profiles').select('district').eq('role', 'volunteer')
    const unique = [...new Set((data || []).map(d => d.district).filter(Boolean))].sort()
    setDistricts(unique)
  }

  const fetchCount = async () => {
    let q = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'volunteer')
    if (target === 'district' && district) q = q.eq('district', district)
    if (target === 'approved')             q = q.eq('sparsh_approved', true)
    const { count } = await q
    setVolCount(count || 0)
  }

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) console.error('fetchHistory error:', error)
    setHistory(data || [])
  }

  const send = async () => {
    if (!title.trim() || !body.trim()) return
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Insert broadcast record
    const { error: broadcastError } = await supabase
      .from('broadcasts')
      .insert({
        title,
        body,
        type,
        target,
        target_value: district || null,
        points:       0,
        platform:     '',
        created_by:   user.id,
      })

    if (broadcastError) {
      console.error('Broadcast insert error:', broadcastError)
      setSending(false)
      return
    }

    // Manually create notifications (backup in case DB trigger fails)
    let volQuery = supabase.from('profiles').select('id').eq('role', 'volunteer')
    if (target === 'district' && district) volQuery = volQuery.eq('district', district)
    if (target === 'approved')             volQuery = volQuery.eq('sparsh_approved', true)
    const { data: targetVols } = await volQuery

    if (targetVols?.length > 0) {
      const notifs = targetVols.map(v => ({
        volunteer_id: v.id,
        title,
        body,
        type,
      }))
      const { error: notifError } = await supabase.from('notifications').insert(notifs)
      if (notifError) console.error('Notifications insert error:', notifError)
    }

    setTitle('')
    setBody('')
    setDistrict('')
    setTarget('all')
    setSent(true)
    await fetchHistory()
    setTimeout(() => setSent(false), 3000)
    setSending(false)
  }

  const selectedType = TYPES.find(t => t.key === type)

  return (
    <div className="admin-page" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>

      {/* Compose */}
      <div>
        <h1 style={s.pageTitle}>Broadcast Message</h1>
        <p style={s.pageSub}>Send notifications to all or specific volunteers</p>

        <div style={s.card}>
          {/* Message Type */}
          <p style={s.label}>Message Type</p>
          <div style={s.typeGrid}>
            {TYPES.map(t => (
              <div
                key={t.key}
                onClick={() => setType(t.key)}
                style={{
                  ...s.typeCard,
                  borderColor: type === t.key ? t.color : '#E2E8F0',
                  background: type === t.key ? `${t.color}10` : '#F8FAFC',
                }}
              >
                <i className={`ti ${t.icon}`} style={{ fontSize: 20, color: t.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: type === t.key ? t.color : '#64748B' }}>
                  {t.label}
                </span>
              </div>
            ))}
          </div>

          {/* Target audience */}
          <p style={s.label}>Target Audience</p>
          <div style={s.targetRow}>
            {[['all', 'All Volunteers'], ['approved', 'Approved Only'], ['district', 'By District']].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTarget(k)}
                style={{ ...s.targetBtn, background: target === k ? '#0A2540' : '#fff', color: target === k ? '#fff' : '#64748B', borderColor: target === k ? '#0A2540' : '#E2E8F0' }}
              >
                {l}
              </button>
            ))}
          </div>

          {target === 'district' && (
            <select
              style={s.select}
              value={district}
              onChange={e => setDistrict(e.target.value)}
            >
              <option value="">Select district...</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          <div style={s.recipientCount}>
            <i className="ti ti-users" style={{ fontSize: 14, color: '#94A3B8' }} />
            <span style={{ fontSize: 12, color: '#64748B' }}>
              This will be sent to <strong>{volCount}</strong> volunteer{volCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Title */}
          <p style={s.label}>Title</p>
          <input
            style={s.input}
            placeholder="Message title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
          />

          {/* Body */}
          <p style={s.label}>Message</p>
          <textarea
            style={s.textarea}
            placeholder="Write your message here..."
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
          />

          {/* Preview */}
          {(title || body) && (
            <div style={{ ...s.preview, borderLeft: `3px solid ${selectedType?.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <i className={`ti ${selectedType?.icon}`} style={{ fontSize: 14, color: selectedType?.color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: selectedType?.color }}>Preview</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{title || '—'}</p>
              <p style={{ fontSize: 12, color: '#64748B' }}>{body || '—'}</p>
            </div>
          )}

          <button
            onClick={send}
            disabled={sending || !title.trim() || !body.trim() || (target === 'district' && !district)}
            style={{ ...s.sendBtn, opacity: (sending || !title.trim() || !body.trim()) ? 0.5 : 1 }}
          >
            <i className="ti ti-send" />
            {sending ? 'Sending...' : sent ? '✓ Sent!' : `Send to ${volCount} Volunteers`}
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Broadcast History</h2>
        <div style={s.historyList}>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: 24 }}>No broadcasts yet</p>
          ) : (
            history.map(h => {
              const t = TYPES.find(x => x.key === h.type) || TYPES[0]
              return (
                <div key={h.id} style={s.historyCard}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <i className={`ti ${t.icon}`} style={{ fontSize: 16, color: t.color, marginTop: 1 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>{h.title}</p>
                      <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>{h.body}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={s.historyMeta}>{h.target || 'all'}</span>
                        {h.target_value && <span style={s.historyMeta}>{h.target_value}</span>}
                        <span style={s.historyMeta}>{new Date(h.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function Broadcast() {
  return <AdminGuard><AdminLayout><BroadcastContent /></AdminLayout></AdminGuard>
}

const s = {
  pageTitle:     { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' },
  pageSub:       { fontSize: 13, color: '#94A3B8', marginBottom: 20 },
  card:          { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: 20 },
  label:         { fontSize: 12, fontWeight: 600, color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
  typeGrid:      { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
  typeCard:      { border: '1.5px solid', borderRadius: 12, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' },
  targetRow:     { display: 'flex', gap: 8 },
  targetBtn:     { flex: 1, fontSize: 11, fontWeight: 600, padding: '7px 10px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
  select:        { width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'Inter,sans-serif', color: '#0F172A', marginTop: 8, outline: 'none' },
  recipientCount:{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, marginTop: 12 },
  input:         { width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '11px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', color: '#0F172A', outline: 'none', boxSizing: 'border-box' },
  textarea:      { width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '11px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', color: '#0F172A', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  preview:       { background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', marginTop: 14 },
  sendBtn:       { width: '100%', background: '#0A2540', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, fontFamily: 'Inter,sans-serif' },
  historyList:   { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' },
  historyCard:   { padding: '12px 14px', borderBottom: '1px solid #F1F5F9' },
  historyMeta:   { fontSize: 10, color: '#94A3B8', background: '#F8FAFC', padding: '2px 6px', borderRadius: 4 },
}
