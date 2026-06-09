import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FaYoutube, FaFacebook, FaWhatsapp, FaInstagram } from 'react-icons/fa'

/* ── Platform config ── */

const PLATFORMS = {
  yt: { bg: '#FEF2F2', color: '#DC2626', Icon: FaYoutube,   label: 'YouTube' },
  fb: { bg: '#EFF6FF', color: '#1D6FED', Icon: FaFacebook,  label: 'Facebook' },
  wa: { bg: '#F0FDF4', color: '#16A34A', Icon: FaWhatsapp,  label: 'WhatsApp' },
  ig: { bg: '#FDF4FF', color: '#9333EA', Icon: FaInstagram, label: 'Instagram' },
}

const FILTER_PILLS = [
  { key: 'all', label: 'All' },
  { key: 'yt',  label: 'YouTube' },
  { key: 'fb',  label: 'Facebook' },
  { key: 'wa',  label: 'WhatsApp' },
  { key: 'ig',  label: 'Instagram' },
]

/* ── Main ── */

export default function Tasks() {
  const [tasks,        setTasks]        = useState([])
  const [completedIds, setCompletedIds] = useState([])
  const [currentUser,  setCurrentUser]  = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('all')
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }

    const [tasksRes, completionsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('active', true)
        .order('created_at', { ascending: false }),
      supabase.from('task_completions').select('task_id')
        .eq('volunteer_id', user.id),
    ])

    setTasks(tasksRes.data || [])
    setCompletedIds(completionsRes.data?.map(c => c.task_id) || [])
    setCurrentUser(user)
    setLoading(false)
  }

  const markDone = async (taskId, points) => {
    if (completedIds.includes(taskId)) return

    const { error } = await supabase
      .from('task_completions')
      .insert({ task_id: taskId, volunteer_id: currentUser.id })

    if (error) return

    setCompletedIds(prev => [...prev, taskId])

    const { data: existingScore } = await supabase
      .from('weekly_scores')
      .select('*')
      .eq('volunteer_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingScore) {
      await supabase
        .from('weekly_scores')
        .update({ total_score: existingScore.total_score + points })
        .eq('id', existingScore.id)
    } else {
      await supabase
        .from('weekly_scores')
        .insert({
          volunteer_id: currentUser.id,
          week_start: new Date().toISOString().split('T')[0],
          total_score: points,
          grade: 'sparsh',
        })
    }
  }

  if (loading) return <SkeletonTasks />

  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter(t => t.platform === filter)

  const totalEarned = tasks
    .filter(t => completedIds.includes(t.id))
    .reduce((sum, t) => sum + (t.points || 0), 0)

  const allDone = tasks.length > 0 && completedIds.length >= tasks.length
  const progress = tasks.length > 0
    ? (completedIds.length / tasks.length) * 100
    : 0

  return (
    <div style={s.page} className="vol-page">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pill-scroll::-webkit-scrollbar { display:none }
      `}</style>

      {/* ── NAVY HEADER ── */}
      <div style={s.header}>

        {/* Status bar */}
        <div style={s.statusBar}>
          <span style={s.statusTime}>9:41</span>
          <span style={s.statusRight}>▮▮▮ ▊▊ 🔋</span>
        </div>

        {/* Title + count badge */}
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          Tasks assigned by your organization
        </p>
        <div style={s.titleRow}>
          <p style={s.title}>Today's Tasks</p>
          <div style={s.countBadge}>
            {completedIds.length}/{tasks.length}
          </div>
        </div>

        {/* Progress bar */}
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${progress}%` }} />
        </div>

        {/* Filter pills */}
        <div className="pill-scroll" style={s.pillRow}>
          {FILTER_PILLS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                ...s.pill,
                background:  filter === key ? '#fff' : 'rgba(255,255,255,0.1)',
                color:       filter === key ? '#0A2540' : 'rgba(255,255,255,0.5)',
                fontWeight:  filter === key ? 700 : 400,
                border:      filter === key ? 'none' : '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div style={s.body}>

        {/* Points summary card */}
        <div style={s.summaryCard}>
          <div>
            <p style={s.summaryLabel}>Points Earned Today</p>
            <p style={s.summaryScore}>{totalEarned}</p>
          </div>
          <p style={s.summaryMsg}>
            {allDone ? 'All done! 🎉' : 'Keep going!'}
          </p>
        </div>

        {/* All done celebration */}
        {allDone && (
          <div style={s.celebCard}>
            <p style={{ fontSize: 32, margin: '0 0 6px' }}>🎉</p>
            <p style={s.celebTitle}>All tasks done!</p>
            <p style={s.celebSub}>Amazing work today!</p>
            <p style={s.celebPts}>{totalEarned} pts earned</p>
          </div>
        )}

        {/* Empty state */}
        {filteredTasks.length === 0 && !allDone && (
          <div style={s.empty}>
            <span style={{ fontSize: 40, color: '#CBD5E1' }}>✅</span>
            <p style={s.emptyTitle}>No tasks yet</p>
            <p style={s.emptySub}>Your admin will assign tasks via broadcast messages</p>
          </div>
        )}

        {/* Task cards */}
        {filteredTasks.map(task => {
          const done     = completedIds.includes(task.id)
          const platform = PLATFORMS[task.platform]
          const Icon     = platform?.Icon

          return (
            <div
              key={task.id}
              style={{
                ...s.taskCard,
                borderColor: done ? '#BFDBFE' : '#E2E8F0',
                background:  done ? '#F8FFFE' : '#fff',
                opacity:     done ? 0.8 : 1,
              }}
            >
              {/* Platform icon */}
              <div style={{
                ...s.iconCircle,
                background: platform?.bg || '#F8FAFC',
              }}>
                {Icon
                  ? <Icon color={platform.color} size={18} />
                  : <span style={{ fontSize: 18 }}>📋</span>
                }
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <p style={{
                  ...s.taskTitle,
                  textDecoration: done ? 'line-through' : 'none',
                  color: done ? '#94A3B8' : '#0F172A',
                }}>
                  {task.title}
                </p>
                <p style={s.taskDesc}>{task.description}</p>
                <div style={{
                  ...s.ptsBadge,
                  background: done ? '#D1FAE5' : '#EFF6FF',
                  color:      done ? '#16A34A' : '#1D6FED',
                }}>
                  {done ? `✓ ${task.points} pts earned` : `+${task.points} pts`}
                </div>
              </div>

              {/* Action */}
              {done ? (
                <div style={s.doneCircle}>✓</div>
              ) : (
                <button
                  onClick={() => markDone(task.id, task.points || 0)}
                  style={s.markDoneBtn}
                >
                  Mark Done
                </button>
              )}
            </div>
          )
        })}

        <div style={{ height: 80 }} />
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={s.bottomNav}>
        <NavBtn icon="🏠" label="Home"    onClick={() => navigate('/home')} />
        <NavBtn icon="🏆" label="Rank"    onClick={() => navigate('/leaderboard')} />
        <NavBtn icon="🔔" label="Alerts" onClick={() => navigate('/notifications')} />
        <NavBtn icon="👤" label="Profile" onClick={() => navigate('/profile')} />
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

function SkeletonTasks() {
  const sk = (h, w, r = 10) => ({
    height: h, width: w || '100%', borderRadius: r,
    background: '#E2E8F0',
    animation: 'pulse 1.5s ease-in-out infinite',
    flexShrink: 0,
  })
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ background: '#0A2540', padding: '48px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...sk(22, 160, 8), background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ ...sk(6, '100%', 3), background: 'rgba(255,255,255,0.15)', marginTop: 4 }} />
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={sk(60, undefined, 16)} />
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', padding: 14, borderRadius: 16, border: '1.5px solid #E2E8F0' }}>
            <div style={sk(44, 44, '50%')} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={sk(14, '70%', 6)} />
              <div style={sk(10, '45%', 4)} />
              <div style={sk(20, 80, 8)} />
            </div>
            <div style={sk(32, 80, 10)} />
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
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title:    { fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -1, margin: 0 },
  countBadge: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff', fontSize: 12, fontWeight: 700,
    padding: '4px 12px', borderRadius: 20,
  },
  progressTrack: {
    height: 6, borderRadius: 3,
    background: 'rgba(255,255,255,0.15)',
    marginBottom: 12, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 3,
    background: '#1D6FED',
    transition: 'width 0.3s ease',
  },
  pillRow: {
    display: 'flex', gap: 8,
    overflowX: 'auto', scrollbarWidth: 'none',
  },
  pill: {
    fontSize: 11, padding: '5px 14px',
    borderRadius: 20, cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'Inter, sans-serif',
  },
  body: { flex: 1, padding: '12px 16px 0', overflowY: 'auto' },
  summaryCard: {
    background: '#fff',
    border: '1.5px solid #E2E8F0',
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: { fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 },
  summaryScore: { fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 },
  summaryMsg:   { fontSize: 12, fontWeight: 600, color: '#1D6FED', margin: 0 },
  celebCard: {
    background: 'linear-gradient(135deg, #EFF6FF, #F0FDF4)',
    border: '1.5px solid #BFDBFE',
    borderRadius: 16,
    padding: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  celebTitle: { fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 },
  celebSub:   { fontSize: 13, color: '#64748B', marginTop: 4 },
  celebPts:   { fontSize: 18, fontWeight: 800, color: '#1D6FED', marginTop: 6 },
  empty: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '40px 0', gap: 10,
  },
  emptyTitle: { fontSize: 14, fontWeight: 600, color: '#94A3B8', margin: 0 },
  emptySub:   { fontSize: 12, color: '#CBD5E1', margin: 0 },
  taskCard: {
    background: '#fff',
    border: '1.5px solid #E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    transition: 'all 0.2s',
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  taskTitle: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  taskDesc:  { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
  ptsBadge: {
    display: 'inline-block',
    fontSize: 11, fontWeight: 700,
    padding: '3px 8px', borderRadius: 8,
  },
  doneCircle: {
    width: 32, height: 32, borderRadius: '50%',
    background: '#D1FAE5', color: '#16A34A',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 700, flexShrink: 0,
  },
  markDoneBtn: {
    background: '#0A2540', color: '#fff',
    fontSize: 11, fontWeight: 700,
    padding: '6px 12px', borderRadius: 10,
    border: 'none', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    flexShrink: 0,
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
