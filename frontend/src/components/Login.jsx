import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSettings, getCachedSettings } from '../utils/settings'

export default function Login({ setUser, apiUrl }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [settings, setSettings] = useState(getCachedSettings())
  const navigate = useNavigate()

  useEffect(() => {
    fetchSettings().then(setSettings)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (data.token) {
        localStorage.setItem('token', data.token)
        setUser(data.user)
        navigate('/')
      } else {
        setError(data.message || 'بيانات الدخول غير صحيحة')
      }
    } catch (err) {
      console.error(err)
      setError('حدث خطأ في الاتصال بالسيرفر')
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      dir="rtl"
      style={{ background: 'linear-gradient(160deg, #181614 0%, #241B12 55%, #3A2410 100%)' }}>
      {/* توهجات برتقالية زخرفية — هوية صاج الريف */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-brand-deep/20 blur-3xl" />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-brand-gold/10 blur-3xl" />

      <div className="relative w-full max-w-md anim-pop">
        {/* الشعار */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-white shadow-lg shadow-brand/20 mb-4 overflow-hidden flex items-center justify-center">
            {settings.company_logo
              ? <img src={settings.company_logo} alt="logo" className="w-full h-full object-contain" />
              : <img src="/icon-192.png" alt="logo" className="w-full h-full object-contain" />}
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">{settings.company_name}</h1>
          <p className="text-white/70 mt-1 text-sm">نظام الجرد اليومي — تسجيل الدخول لحسابك</p>
        </div>

        {/* البطاقة */}
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-8">
          {error && <div className="bg-ios-red/10 text-ios-red p-3 rounded-2xl mb-4 text-sm font-semibold anim-pop">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-ios">البريد الإلكتروني</label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ios-label">✉️</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@mail.com"
                  required
                  style={{ direction: 'ltr', textAlign: 'right' }}
                  className="input-ios pr-11" />
              </div>
            </div>
            <div>
              <label className="label-ios">كلمة المرور</label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ios-label">🔒</span>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ direction: 'ltr', textAlign: 'right' }}
                  className="input-ios pr-11 pl-12" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ios-label text-lg active:opacity-60">
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={busy}
              className="btn-ios w-full py-3.5 text-lg shadow-lg shadow-ios-blue/30 disabled:opacity-60">
              {busy ? 'جاري الدخول...' : 'دخول'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/70 text-xs mt-6">نظام إدارة الجرد والمبيعات للفروع</p>
      </div>
    </div>
  )
}
