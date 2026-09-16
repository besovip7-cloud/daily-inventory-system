import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSettings, getCachedSettings } from '../utils/settings'
import { setToken } from '../utils/token'

const QUICK_USER_KEY = 'quickUser'

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return { text: 'صباح الخير', icon: '☀️' }
  if (h < 17) return { text: 'طاب يومك', icon: '🌤️' }
  return { text: 'مساء الخير', icon: '🌙' }
}

export default function Login({ setUser, apiUrl }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [remember, setRemember] = useState(true)
  const [settings, setSettings] = useState(getCachedSettings())
  const [quickUser, setQuickUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(QUICK_USER_KEY)) } catch { return null }
  })
  const [pin, setPin] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [pinSetup, setPinSetup] = useState(null) // { token, user }
  const [pinSetupValue, setPinSetupValue] = useState('')
  const [pinSetupBusy, setPinSetupBusy] = useState(false)
  // استعادة كلمة المرور
  const [fpOpen, setFpOpen] = useState(false)
  const [fpStep, setFpStep] = useState(1) // 1: هوية 2: كود + كلمة جديدة
  const [fpIdentifier, setFpIdentifier] = useState('')
  const [fpCode, setFpCode] = useState('')
  const [fpPassword, setFpPassword] = useState('')
  const [fpMsg, setFpMsg] = useState('')
  const [fpErr, setFpErr] = useState('')
  const [fpBusy, setFpBusy] = useState(false)
  const navigate = useNavigate()
  const g = greeting()

  useEffect(() => {
    fetchSettings().then(setSettings)
  }, [])

  const finishLogin = (token, user, rememberChoice) => {
    setToken(token, rememberChoice)
    setUser(user)
    navigate('/')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      })
      const data = await res.json()
      if (data.token) {
        localStorage.setItem(QUICK_USER_KEY, JSON.stringify({ identifier: identifier.trim(), name: data.user.name }))
        if (!data.user.has_quick_pin) {
          setPinSetup({ token: data.token, user: data.user })
        } else {
          finishLogin(data.token, data.user, remember)
        }
      } else {
        setError(data.message || 'بيانات الدخول غير صحيحة')
      }
    } catch (err) {
      console.error(err)
      setError('حدث خطأ في الاتصال بالسيرفر')
    }
    setBusy(false)
  }

  const handleQuickLogin = async (e) => {
    e.preventDefault()
    if (!quickUser || pin.length < 4) return
    setError('')
    setPinBusy(true)
    try {
      const res = await fetch(`${apiUrl}/auth/quick-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: quickUser.identifier, pin })
      })
      const data = await res.json()
      if (data.token) {
        finishLogin(data.token, data.user, true)
      } else {
        setError(data.message || 'الرقم السري غير صحيح')
        setPin('')
      }
    } catch {
      setError('حدث خطأ في الاتصال بالسيرفر')
    }
    setPinBusy(false)
  }

  const handlePinSetup = async (e) => {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(pinSetupValue)) {
      setError('الرقم السري لازم 4 إلى 6 أرقام')
      return
    }
    setPinSetupBusy(true)
    try {
      const res = await fetch(`${apiUrl}/auth/quick-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pinSetup.token}` },
        body: JSON.stringify({ pin: pinSetupValue })
      })
      const data = await res.json()
      if (res.ok) {
        finishLogin(pinSetup.token, { ...pinSetup.user, has_quick_pin: true }, remember)
      } else {
        setError(data.message || 'تعذر تفعيل الدخول السريع')
      }
    } catch {
      setError('حدث خطأ في الاتصال بالسيرفر')
    }
    setPinSetupBusy(false)
  }

  const skipPinSetup = () => {
    finishLogin(pinSetup.token, pinSetup.user, remember)
  }

  const forgetQuickUser = () => {
    localStorage.removeItem(QUICK_USER_KEY)
    setQuickUser(null)
    setPin('')
  }

  const openForgot = () => {
    setFpOpen(true)
    setFpStep(1)
    setFpIdentifier(identifier.trim())
    setFpCode('')
    setFpPassword('')
    setFpMsg('')
    setFpErr('')
  }

  const handleForgotRequest = async (e) => {
    e.preventDefault()
    setFpErr('')
    setFpMsg('')
    setFpBusy(true)
    try {
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: fpIdentifier })
      })
      const data = await res.json()
      if (res.ok) {
        setFpMsg(data.email_hint ? `${data.message} (أُرسل إلى ${data.email_hint})` : data.message)
        setFpStep(2)
      } else {
        setFpErr(data.message || 'تعذر إرسال الكود')
      }
    } catch {
      setFpErr('حدث خطأ في الاتصال بالسيرفر')
    }
    setFpBusy(false)
  }

  const handleForgotReset = async (e) => {
    e.preventDefault()
    setFpErr('')
    setFpMsg('')
    setFpBusy(true)
    try {
      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: fpIdentifier, code: fpCode, new_password: fpPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setFpMsg(data.message)
        setTimeout(() => { setFpOpen(false); setPassword('') }, 1800)
      } else {
        setFpErr(data.message || 'تعذر إعادة التعيين')
      }
    } catch {
      setFpErr('حدث خطأ في الاتصال بالسيرفر')
    }
    setFpBusy(false)
  }

  const logo = settings.company_logo || '/icon-192.png'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      dir="rtl"
      style={{ background: 'linear-gradient(160deg, #181614 0%, #241B12 55%, #3A2410 100%)' }}>
      {/* توهجات زخرفية — هوية صاج الريف */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-brand-deep/20 blur-3xl" />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-brand-gold/10 blur-3xl" />
      {/* علامة الشعار المائية بالخلفية */}
      <img src={logo} alt="" aria-hidden
        className="absolute -left-20 -bottom-24 w-[420px] h-[420px] object-contain opacity-[0.06] pointer-events-none select-none rotate-12" />

      <div className="relative w-full max-w-md anim-pop">
        {/* التحية + الشعار */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-white shadow-lg shadow-brand/20 mb-4 overflow-hidden flex items-center justify-center anim-float">
            <img src={logo} alt="logo" className="w-full h-full object-contain" />
          </div>
          <p className="text-white/80 text-sm font-semibold">{g.text} {g.icon}</p>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm mt-1">{settings.company_name}</h1>
          <p className="text-white/70 mt-1 text-sm">نظام الجرد اليومي — تسجيل الدخول لحسابك</p>
        </div>

        {/* الدخول السريع برقم PIN */}
        {quickUser && !pinSetup && (
          <form onSubmit={handleQuickLogin}
            className="bg-white/10 backdrop-blur border border-white/15 rounded-3xl p-5 mb-4 anim-pop">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-extrabold text-white shrink-0">
                {(quickUser.name || '؟').trim().charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold truncate">{quickUser.name}</div>
                <div className="text-white/60 text-xs">دخول سريع برقمك السري ⚡</div>
              </div>
              <button type="button" onClick={forgetQuickUser}
                className="text-white/50 text-xs active:opacity-60 shrink-0">حساب آخر؟</button>
            </div>
            <div className="flex gap-2 mt-3">
              <input type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••" required
                style={{ direction: 'ltr', textAlign: 'center', letterSpacing: '0.5em' }}
                className="input-ios flex-1 !bg-white/90 h-12 text-lg font-bold" />
              <button type="submit" disabled={pinBusy || pin.length < 4}
                className="btn-ios px-6 h-12 disabled:opacity-60">
                {pinBusy ? '...' : 'دخول ⚡'}
              </button>
            </div>
          </form>
        )}

        {/* نافذة تفعيل الدخول السريع */}
        {pinSetup && (
          <div className="bg-white rounded-3xl shadow-2xl p-6 mb-4 anim-pop">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚡</div>
              <h2 className="text-lg font-extrabold text-ios-text">فعّل الدخول السريع؟</h2>
              <p className="text-ios-label text-sm mt-1">سجّل رقم PIN (4-6 أرقام) حتى تدخل للنظام بضغطة وحدة من هذا الجهاز — بدون إيميل وباسورد</p>
            </div>
            <form onSubmit={handlePinSetup} className="space-y-3">
              <input type="password" inputMode="numeric" maxLength={6} value={pinSetupValue}
                onChange={e => setPinSetupValue(e.target.value.replace(/\D/g, ''))}
                placeholder="••••" required
                style={{ direction: 'ltr', textAlign: 'center', letterSpacing: '0.5em' }}
                className="input-ios h-12 text-lg font-bold" />
              <div className="flex gap-2">
                <button type="submit" disabled={pinSetupBusy || !/^\d{4,6}$/.test(pinSetupValue)}
                  className="btn-ios flex-1 py-3 disabled:opacity-60">
                  {pinSetupBusy ? 'جاري التفعيل...' : 'تفعيل ⚡'}
                </button>
                <button type="button" onClick={skipPinSetup}
                  className="btn-ios-secondary px-5">تخطي</button>
              </div>
            </form>
          </div>
        )}

        {/* البطاقة الرئيسية */}
        {!pinSetup && (
          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-6 sm:p-8">
            {error && <div className="bg-ios-red/10 text-ios-red p-3 rounded-2xl mb-4 text-sm font-semibold anim-pop">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-ios">الإيميل أو رقم الواتساب</label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ios-label">
                    {identifier.includes('@') || !identifier ? '✉️' : '📱'}
                  </span>
                  <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                    placeholder="example@mail.com أو 96477XXXXXXX"
                    required
                    style={{ direction: 'ltr', textAlign: 'right' }}
                    className="input-ios pr-11 h-12" />
                </div>
                <p className="text-[11px] text-ios-label mt-1">اكتب إيميلك أو رقم الواتساب المسجل — النظام يفرّق تلقائياً</p>
              </div>
              <div>
                <label className="label-ios">كلمة المرور</label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ios-label">🔒</span>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ direction: 'ltr', textAlign: 'right' }}
                    className="input-ios pr-11 pl-12 h-12" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ios-label text-lg active:opacity-60">
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                    className="w-4 h-4 accent-ios-blue" />
                  <span className="text-sm text-ios-text font-semibold">تذكرني</span>
                </label>
                <button type="button" onClick={openForgot}
                  className="text-sm font-bold text-ios-blue active:opacity-60">
                  نسيت كلمة المرور؟
                </button>
              </div>
              <button type="submit" disabled={busy}
                className="btn-ios w-full py-4 text-lg shadow-lg shadow-ios-blue/30 disabled:opacity-60">
                {busy ? 'جاري الدخول...' : 'دخول'}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-white/70 text-xs mt-6">نظام إدارة الجرد والمبيعات للفروع</p>
      </div>

      {/* نافذة استعادة كلمة المرور */}
      {fpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setFpOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm anim-pop"
            onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🔑</div>
              <h2 className="text-lg font-extrabold text-ios-text">استعادة كلمة المرور</h2>
              <p className="text-ios-label text-sm mt-1">
                {fpStep === 1
                  ? 'أدخل إيميلك أو رقم الواتساب المسجل — راح نوصلك كود على الإيميل'
                  : `أدخل الكود المُرسل${fpIdentifier.includes('@') ? ' إلى إيميلك' : ''} وكلمة المرور الجديدة`}
              </p>
            </div>
            {fpErr && <div className="bg-ios-red/10 text-ios-red p-3 rounded-2xl mb-3 text-sm font-semibold anim-pop">{fpErr}</div>}
            {fpMsg && <div className="bg-ios-green/10 text-ios-green p-3 rounded-2xl mb-3 text-sm font-semibold anim-pop">{fpMsg}</div>}

            {fpStep === 1 ? (
              <form onSubmit={handleForgotRequest} className="space-y-3">
                <input type="text" value={fpIdentifier} onChange={e => setFpIdentifier(e.target.value)}
                  placeholder="example@mail.com أو 96477XXXXXXX"
                  required
                  style={{ direction: 'ltr', textAlign: 'right' }}
                  className="input-ios h-12" />
                <button type="submit" disabled={fpBusy || !fpIdentifier.trim()}
                  className="btn-ios w-full py-3 disabled:opacity-60">
                  {fpBusy ? 'جاري الإرسال...' : 'إرسال الكود 📧'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotReset} className="space-y-3">
                <input type="text" inputMode="numeric" maxLength={6} value={fpCode}
                  onChange={e => setFpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="كود الاستعادة (6 أرقام)"
                  required
                  style={{ direction: 'ltr', textAlign: 'center', letterSpacing: '0.5em' }}
                  className="input-ios h-12 text-lg font-bold" />
                <input type="password" value={fpPassword} onChange={e => setFpPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
                  required minLength={6}
                  style={{ direction: 'ltr', textAlign: 'right' }}
                  className="input-ios h-12" />
                <button type="submit" disabled={fpBusy || fpCode.length < 4 || fpPassword.length < 6}
                  className="btn-ios w-full py-3 disabled:opacity-60">
                  {fpBusy ? 'جاري الحفظ...' : 'تعيين كلمة المرور الجديدة ✅'}
                </button>
                <button type="button" onClick={() => { setFpStep(1); setFpErr(''); setFpMsg('') }}
                  className="w-full text-center text-sm font-bold text-ios-blue active:opacity-60 py-1">
                  ← رجوع لإعادة الإرسال
                </button>
              </form>
            )}
            <button type="button" onClick={() => setFpOpen(false)}
              className="w-full mt-2 text-center text-sm text-ios-label active:opacity-60 py-1">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
