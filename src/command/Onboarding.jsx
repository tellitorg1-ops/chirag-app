import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, Flag, ShieldCheck, Layers3, Radio } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { command } from './api'
import { useSession } from './context'
import { ErrorBox, Field } from './ui'
export function Entry() {
  const navigate = useNavigate()
  const { user } = useSession()
  function choose(mode) { localStorage.setItem('command_mode', mode); navigate(user ? '/organizations' : '/login') }
  return <div className="entry"><div className="entry-brand"><span className="brand-mark">L</span> Leader IQ.in <span>COMMAND</span></div><div className="entry-grid"><section><p className="eyebrow">ONE PLATFORM. EVERY LEVEL.</p><h1>Leadership meets<br /><em>ground reality.</em></h1><p className="entry-description">Bring your people, daily operations and digital execution into one connected command workspace.</p><div className="entry-benefits"><span><Layers3 size={19} /> Five levels. One chain of command.</span><span><ShieldCheck size={19} /> Verified work. Earned recognition.</span><span><Radio size={19} /> Field updates that reach leadership.</span></div></section><section className="entry-choices"><p className="eyebrow">CHOOSE YOUR WORKSPACE</p><button className="mode-card" onClick={() => choose('political')}><Flag size={30} /><h2>Political Parties</h2><p>Leadership, karyakarta teams, ground pulse and campaign execution.</p><span>Enter political workspace</span></button><button className="mode-card" onClick={() => choose('business')}><Building2 size={30} /><h2>Business / Brand</h2><p>Regional teams, field operations, brand campaigns and performance.</p><span>Enter business workspace</span></button><p className="muted small">Join directly, complete your basic profile, and your administrator will assign your party and role.</p></section></div><footer>Leader IQ.in <span>Clarity at every level.</span></footer></div>
}
export function SignIn() {
  const { user } = useSession()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resendAt, setResendAt] = useState(0)
  if (user) return <Navigate to="/organizations" replace />
  async function send(e) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number.')
      if (Date.now() < resendAt) throw new Error('Please wait one minute before requesting another code.')
      const { error: err } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` })
      if (err) throw err
      setSent(true); setResendAt(Date.now() + 60000)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  async function verify(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { const { error: err } = await supabase.auth.verifyOtp({ phone: `+91${phone}`, token: otp, type: 'sms' }); if (err) throw err } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <div className="auth-page"><Link to="/" className="wordmark">Leader IQ.in / COMMAND</Link><div className="auth-card"><p className="eyebrow">SECURE MOBILE LOGIN</p><h1>{sent ? 'Verify your number' : 'Welcome to command.'}</h1><p className="muted">{sent ? `Enter the code sent to +91 ${phone}.` : 'Your organization’s work starts here.'}</p><ErrorBox error={error} /><form onSubmit={sent ? verify : send}>{!sent ? <Field label="Mobile number"><div className="phone-input"><span>+91</span><input aria-label="Mobile number" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} required /></div></Field> : <Field label="Verification code"><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required /></Field>}<button className="primary" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify & continue' : 'Send verification code'}</button></form>{sent && <div className="button-row"><button className="ghost" onClick={send} disabled={busy}>Resend code</button><button className="ghost" onClick={() => { setSent(false); setOtp('') }}>Change number</button></div>}<p className="muted small">No Aadhaar document or number is required to get started.</p></div></div>
}
