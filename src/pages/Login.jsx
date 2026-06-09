import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const sendOTP = async () => {
    if (phone.length < 10) return
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      phone: '+91' + phone,
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    localStorage.setItem('chirag_phone', phone)
    navigate('/otp')
    setLoading(false)
  }

  const ready = phone.length === 10 && !loading

  return (
    <div style={s.page} className="vol-page">

      {/* ── Navy top ── */}
      <div style={s.top}>
        <div style={s.badge}>VOLUNTEERX</div>
        <h1 style={s.heading}>
          VOLUNTEER<span style={{ color: '#3B82F6' }}>X</span>
        </h1>
        <p style={s.subtitle}>Digital Volunteer Management Platform</p>
      </div>

      {/* ── White card ── */}
      <div style={s.card}>
        <h2 style={s.cardHeading}>Welcome back</h2>
        <p style={s.cardSub}>Login with your mobile number</p>

        <PhoneInput phone={phone} onChange={setPhone} />

        <button
          onClick={sendOTP}
          disabled={!ready}
          style={{
            ...s.btn,
            opacity: ready ? 1 : 0.45,
            cursor: ready ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Sending...' : 'Send OTP →'}
        </button>

        <div style={s.featureRow}>
          <FeatureCard emoji="🏆" label="Rank System" />
          <FeatureCard emoji="📊" label="Track Views" />
          <FeatureCard emoji="🎁" label="Win Prizes" />
        </div>

        <p style={s.footer}>Developed by Vjenix Futuristic Technologies</p>
      </div>

    </div>
  )
}

function PhoneInput({ phone, onChange }) {
  const [focused, setFocused] = useState(false)

  return (
    <div
      style={{
        ...s.inputWrap,
        borderColor: focused ? '#1D6FED' : '#E2E8F0',
        background: focused ? '#EFF6FF' : '#F8FAFC',
        boxShadow: focused ? '0 0 0 3px rgba(29,111,237,0.08)' : 'none',
      }}
    >
      <span style={s.prefix}>+91</span>
      <div style={s.separator} />
      <input
        type="tel"
        inputMode="numeric"
        value={phone}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder="98765 43210"
        maxLength={10}
        autoFocus
        style={s.input}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  )
}

function FeatureCard({ emoji, label }) {
  return (
    <div style={s.featureCard}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span style={s.featureLabel}>{label}</span>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Inter, sans-serif',
  },
  top: {
    background: '#0A2540',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '56px 24px 84px',
    gap: 14,
  },
  badge: {
    border: '1.5px solid rgba(255,255,255,0.3)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    padding: '5px 16px',
    borderRadius: 100,
  },
  heading: {
    fontSize: 34,
    fontWeight: 900,
    color: '#FFFFFF',
    letterSpacing: -1,
    margin: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    margin: 0,
    textAlign: 'center',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '28px 28px 0 0',
    padding: '36px 24px 48px',
    marginTop: -28,
    flex: 1,
    boxShadow: '0 -2px 20px rgba(10,37,64,0.1)',
  },
  cardHeading: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0F172A',
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 28,
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    border: '1.5px solid #E2E8F0',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
  },
  prefix: {
    padding: '14px 14px',
    color: '#1D6FED',
    fontWeight: 700,
    fontSize: 15,
    flexShrink: 0,
  },
  separator: {
    width: 1,
    height: 22,
    background: '#E2E8F0',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '14px 14px',
    fontSize: 16,
    fontWeight: 500,
    color: '#0F172A',
    fontFamily: 'Inter, sans-serif',
  },
  btn: {
    width: '100%',
    background: '#0A2540',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 16,
    padding: '15px',
    borderRadius: 14,
    border: 'none',
    marginBottom: 28,
    fontFamily: 'Inter, sans-serif',
    transition: 'opacity 0.18s',
    letterSpacing: 0.2,
  },
  featureRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 28,
  },
  featureCard: {
    flex: 1,
    background: '#F8FAFC',
    border: '1.5px solid #E2E8F0',
    borderRadius: 14,
    padding: '14px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 7,
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#64748B',
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#CBD5E1',
    fontSize: 11,
    letterSpacing: 0.2,
  },
}
