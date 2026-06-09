import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function OtpVerify() {
  const phone = localStorage.getItem('chirag_phone') || ''
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [timer, setTimer] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const inputRefs = useRef([])
  const navigate = useNavigate()

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000)
      return () => clearTimeout(t)
    } else {
      setCanResend(true)
    }
  }, [timer])

  function handleChange(index, value) {
    if (!/^\d?$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    setError('')
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const next = [...otp]
        next[index] = ''
        setOtp(next)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((d, i) => { next[i] = d })
    setOtp(next)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const verifyOTP = async () => {
    const code = otp.join('')
    if (code.length < 6) return
    setLoading(true)
    setError('')

    const cleanPhone = phone.replace(/\s/g, '')
    const fullPhone = '+91' + cleanPhone

    console.log('Phone:', fullPhone)
    console.log('OTP:', code)
    console.log('Type: sms')

    const { data, error: err } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: code,
      type: 'sms',
    })

    if (err) {
      setError('Wrong OTP. Please try again.')
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('id', data.user.id)
        .maybeSingle()

      console.log('Profile found:', profile)

      // Role check first
      if (profile?.role === 'super_admin' ||
          profile?.role === 'admin' ||
          profile?.role === 'viewer') {
        navigate('/admin')
        return
      }

      // Volunteer check
      if (profile?.name) {
        navigate('/home')
        return
      }

      // No profile → register
      navigate('/register')
    }
  }

  const resendOTP = async () => {
    if (!canResend) return
    await supabase.auth.signInWithOtp({ phone: '+91' + phone })
    setTimer(60)
    setCanResend(false)
    setOtp(['', '', '', '', '', ''])
    setError('')
    inputRefs.current[0]?.focus()
  }

  const filled = otp.join('').length === 6
  const maskedPhone = phone
    ? phone.slice(0, 2) + '×'.repeat(6) + phone.slice(-2)
    : '××××××××××'

  return (
    <div style={s.page} className="vol-page">

      {/* ── Navy top ── */}
      <div style={s.top}>
        <div style={s.badge}>🔒 OTP Verify</div>
        <h1 style={s.heading}>
          VERIFY <span style={{ color: '#3B82F6' }}>YOUR OTP</span>
        </h1>
        <p style={s.subtitle}>Code sent to +91 {maskedPhone}</p>
      </div>

      {/* ── White card ── */}
      <div style={s.card}>
        <h2 style={s.cardHeading}>Enter Code</h2>
        <p style={s.cardSub}>6-digit OTP</p>

        {/* OTP boxes */}
        <div style={s.otpRow}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              style={{
                ...s.otpBox,
                borderColor: digit ? '#1D6FED' : '#E2E8F0',
                background: digit ? '#EFF6FF' : '#F8FAFC',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#1D6FED'
                e.target.style.background = '#EFF6FF'
              }}
              onBlur={e => {
                e.target.style.borderColor = digit ? '#1D6FED' : '#E2E8F0'
                e.target.style.background = digit ? '#EFF6FF' : '#F8FAFC'
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && <div style={s.errorBox}>{error}</div>}

        {/* Verify button */}
        <button
          onClick={verifyOTP}
          disabled={!filled || loading}
          style={{
            ...s.btn,
            opacity: filled && !loading ? 1 : 0.45,
            cursor: filled && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Verifying...' : 'Verify →'}
        </button>

        {/* Resend */}
        <p style={s.resendText}>
          Didn't receive code?{' '}
          {canResend ? (
            <span onClick={resendOTP} style={s.resendLink}>Resend</span>
          ) : (
            <span style={{ color: '#94A3B8' }}>Resend ({timer}s)</span>
          )}
        </p>

        {/* Back */}
        <p onClick={() => navigate('/')} style={s.backLink}>
          ← Go back
        </p>

        <p style={s.footer}>Developed by Vjenix Futuristic Technologies</p>
      </div>

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
    letterSpacing: 1.5,
    padding: '5px 16px',
    borderRadius: 100,
  },
  heading: {
    fontSize: 32,
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
  otpRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpBox: {
    width: 44,
    height: 54,
    border: '1.5px solid #E2E8F0',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: 800,
    textAlign: 'center',
    outline: 'none',
    color: '#0F172A',
    fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.15s, background 0.15s',
  },
  errorBox: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 14,
  },
  btn: {
    width: '100%',
    background: '#1D6FED',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 16,
    padding: '15px',
    borderRadius: 14,
    border: 'none',
    marginBottom: 20,
    fontFamily: 'Inter, sans-serif',
    transition: 'opacity 0.18s',
    letterSpacing: 0.2,
  },
  resendText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  resendLink: {
    color: '#1D6FED',
    fontWeight: 700,
    cursor: 'pointer',
  },
  backLink: {
    textAlign: 'center',
    fontSize: 13,
    color: '#94A3B8',
    cursor: 'pointer',
    marginBottom: 28,
  },
  footer: {
    textAlign: 'center',
    color: '#CBD5E1',
    fontSize: 11,
    letterSpacing: 0.2,
  },
}
