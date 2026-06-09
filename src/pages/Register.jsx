import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DISTRICTS = [
  'Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai',
  'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga',
  'East Champaran', 'Gaya', 'Gopalganj', 'Jamui',
  'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria',
  'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani',
  'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna',
  'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran',
  'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan',
  'Supaul', 'Vaishali', 'West Champaran',
]

export default function Register() {
  const [form, setForm] = useState({
    name: '', district: '', block: '',
    age: '', aadhaar: '', referral: '',
  })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [aadhaarFile, setAadhaarFile] = useState(null)
  const [aadhaarFileName, setAadhaarFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')

  const photoInputRef = useRef(null)
  const aadhaarInputRef = useRef(null)
  const navigate = useNavigate()

  const set = (key) => (e) => {
    setForm(f => ({ ...f, [key]: e.target.value }))
    setError('')
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Photo must be less than 2MB')
      return
    }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError('')
  }

  const handleAadhaarSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Aadhaar file must be less than 5MB')
      return
    }
    setAadhaarFile(file)
    setAadhaarFileName(file.name)
    setError('')
  }

  const handleSubmit = async () => {
    if (!form.name || !form.district || !form.block || !form.age || !form.aadhaar) {
      setError('Please fill all required fields')
      return
    }
    if (form.aadhaar.length !== 4) {
      setError('Enter last 4 digits of Aadhaar only')
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    let photoUrl = null
    let aadhaarUrl = null

    if (photo) {
      setUploadProgress('Uploading photo...')
      const photoExt = photo.name.split('.').pop()
      const photoPath = user.id + '/photo.' + photoExt
      const { error: photoError } = await supabase.storage
        .from('profile-photos')
        .upload(photoPath, photo, { upsert: true })

      if (!photoError) {
        const { data } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(photoPath)
        photoUrl = data.publicUrl
      }
    }

    if (aadhaarFile) {
      setUploadProgress('Uploading Aadhaar...')
      const aadhaarExt = aadhaarFile.name.split('.').pop()
      const aadhaarPath = user.id + '/aadhaar.' + aadhaarExt
      const { error: aadhaarError } = await supabase.storage
        .from('aadhaar-docs')
        .upload(aadhaarPath, aadhaarFile, { upsert: true })

      if (!aadhaarError) {
        aadhaarUrl = aadhaarPath
      }
    }

    setUploadProgress('Saving profile...')

    const { error: dbError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        mobile: user.phone,
        name: form.name,
        district: form.district,
        block: form.block,
        age: parseInt(form.age),
        aadhaar_last4: form.aadhaar,
        photo_url: photoUrl,
        aadhaar_url: aadhaarUrl,
        profile_complete: !!(photoUrl && aadhaarUrl),
        role: 'volunteer',
      })

    if (dbError) {
      setError(dbError.message)
      setLoading(false)
      setUploadProgress('')
      return
    }

    navigate('/connect')
  }

  return (
    <div style={s.page} className="vol-page">

      {/* ── Navy top ── */}
      <div style={s.top}>
        <div style={s.badge}>Step 1 of 2</div>
        <h1 style={s.heading}>
          CREATE YOUR <span style={{ color: '#3B82F6' }}>PROFILE</span>
        </h1>
        <p style={s.subtitle}>Fill in your details to get started</p>
      </div>

      {/* ── White card ── */}
      <div style={s.card}>
        <h2 style={s.cardHeading}>Your Details</h2>
        <p style={s.cardSub}>All fields required</p>

        {/* ── Photo upload ── */}
        <div style={s.photoSection}>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handlePhotoSelect}
            style={{ display: 'none' }}
          />
          <PhotoCircle
            preview={photoPreview}
            onClick={() => photoInputRef.current?.click()}
          />
          <p style={s.photoHint}>Tap to upload photo</p>
        </div>

        {/* Full Name */}
        <Field label="Full Name">
          <input
            style={s.input}
            placeholder="Enter your full name"
            value={form.name}
            onChange={set('name')}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </Field>

        {/* State */}
        <Field label="State">
          <select
            style={{ ...s.input, color: '#0F172A' }}
            defaultValue="Bihar"
            disabled
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            <option value="Bihar">Bihar</option>
          </select>
        </Field>

        {/* District */}
        <Field label="District">
          <select
            style={{ ...s.input, color: form.district ? '#0F172A' : '#94A3B8' }}
            value={form.district}
            onChange={set('district')}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            <option value="" disabled>Select your district</option>
            {DISTRICTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>

        {/* Block */}
        <Field label="Block / Area">
          <input
            style={s.input}
            placeholder="Enter your block name"
            value={form.block}
            onChange={set('block')}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </Field>

        {/* Age */}
        <Field label="Age">
          <input
            style={s.input}
            type="number"
            inputMode="numeric"
            min={18}
            max={60}
            placeholder="Your age"
            value={form.age}
            onChange={e => { setForm(f => ({ ...f, age: e.target.value })); setError('') }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </Field>

        {/* Aadhaar last 4 */}
        <Field label="Aadhaar Last 4 Digits">
          <input
            style={s.input}
            type="tel"
            inputMode="numeric"
            maxLength={4}
            placeholder="XXXX"
            value={form.aadhaar}
            onChange={e => {
              setForm(f => ({ ...f, aadhaar: e.target.value.replace(/\D/g, '').slice(0, 4) }))
              setError('')
            }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </Field>

        {/* ── Aadhaar file upload ── */}
        <Field label="Aadhaar Card Upload">
          <input
            ref={aadhaarInputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={handleAadhaarSelect}
            style={{ display: 'none' }}
          />
          <AadhaarUploadBox
            fileName={aadhaarFileName}
            onClick={() => aadhaarInputRef.current?.click()}
          />
          <p style={s.skipText} onClick={() => {}}>
            You can upload later in Profile
          </p>
        </Field>

        {/* Referral */}
        <Field label="Referral Code (optional)">
          <input
            style={s.input}
            placeholder="Enter referral code (optional)"
            value={form.referral}
            onChange={set('referral')}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </Field>

        {/* Error */}
        {error && <div style={s.errorBox}>{error}</div>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            ...s.btn,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Please wait...' : 'Create My Profile →'}
        </button>

        {uploadProgress && (
          <p style={s.progressText}>{uploadProgress}</p>
        )}

        <p style={s.footer}>Developed by Vjenix Futuristic Technologies</p>
      </div>

    </div>
  )
}

/* ── Sub-components ── */

function PhotoCircle({ preview, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.photoCircle,
        borderColor: hovered ? '#1D6FED' : '#E2E8F0',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {preview ? (
        <img src={preview} alt="preview" style={s.photoImg} />
      ) : (
        <span style={{ fontSize: 28 }}>📷</span>
      )}
    </div>
  )
}

function AadhaarUploadBox({ fileName, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.uploadBox,
        borderColor: hovered || fileName ? '#1D6FED' : '#E2E8F0',
        background: hovered || fileName ? '#EFF6FF' : '#F8FAFC',
        cursor: 'pointer',
      }}
    >
      {fileName ? (
        <div style={s.uploadDone}>
          <span style={{ fontSize: 20 }}>✅</span>
          <span style={s.uploadFileName}>{fileName}</span>
        </div>
      ) : (
        <>
          <span style={{ fontSize: 24, color: '#1D6FED' }}>⬆️</span>
          <p style={s.uploadText}>Upload Aadhaar Card</p>
          <p style={s.uploadSub}>JPG, PNG or PDF • Max 5MB</p>
        </>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={s.field}>
      <p style={s.label}>{label.toUpperCase()}</p>
      {children}
    </div>
  )
}

function focusStyle(e) {
  e.target.style.borderColor = '#1D6FED'
  e.target.style.background = '#EFF6FF'
}

function blurStyle(e) {
  e.target.style.borderColor = '#E2E8F0'
  e.target.style.background = '#F8FAFC'
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
    fontSize: 28,
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
  photoSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
  },
  photoCircle: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    border: '2px dashed #E2E8F0',
    background: '#F8FAFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.18s',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '50%',
  },
  photoHint: {
    fontSize: 12,
    color: '#94A3B8',
    margin: 0,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    border: '1.5px solid #E2E8F0',
    borderRadius: 14,
    padding: '13px 16px',
    fontSize: 15,
    fontWeight: 500,
    color: '#0F172A',
    background: '#F8FAFC',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.18s, background 0.18s',
    boxSizing: 'border-box',
    appearance: 'none',
  },
  uploadBox: {
    border: '1.5px dashed #E2E8F0',
    borderRadius: 14,
    padding: '20px',
    background: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    transition: 'border-color 0.18s, background 0.18s',
  },
  uploadText: {
    fontSize: 14,
    fontWeight: 600,
    color: '#0F172A',
    margin: 0,
  },
  uploadSub: {
    fontSize: 12,
    color: '#94A3B8',
    margin: 0,
  },
  uploadDone: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  uploadFileName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#0F172A',
    wordBreak: 'break-all',
  },
  skipText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: '#CBD5E1',
  },
  errorBox: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 16,
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
    marginBottom: 8,
    fontFamily: 'Inter, sans-serif',
    transition: 'opacity 0.18s',
    letterSpacing: 0.2,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#1D6FED',
    marginBottom: 16,
    fontWeight: 500,
  },
  footer: {
    textAlign: 'center',
    color: '#CBD5E1',
    fontSize: 11,
    letterSpacing: 0.2,
    marginTop: 20,
  },
}
