import { useState, useEffect } from 'react'
import { fetchSettings, getCachedSettings } from '../utils/settings'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const roleLabels = { admin: 'مدير النظام', manager: 'مدير فرع', staff: 'موظف', accountant: 'محاسب' }

export default function Profile({ user, setUser }) {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const [profile, setProfile] = useState(user)
  const [settings, setSettings] = useState(getCachedSettings())
  const [name, setName] = useState(user?.name || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [msg, setMsg] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    fetchSettings().then(setSettings)
    // جلب أحدث البيانات (متضمنة اسم الفرع)
    fetch(`${API_URL}/auth/me`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) { setProfile(d.user); setName(d.user.name); setAvatar(d.user.avatar || '') } })
      .catch(() => {})
  }, [])

  const show = (setter, text) => {
    setter(text)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return show(setMsg, '❌ صيغة غير مدعومة — استخدم PNG أو JPG')
    if (file.size > 1000000) return show(setMsg, '❌ حجم الصورة كبير — الحد الأقصى 1MB')
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result)
    reader.readAsDataURL(file)
  }

  const saveProfile = async () => {
    if (!name.trim()) return show(setMsg, '❌ الاسم مطلوب')
    setSavingProfile(true)
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), avatar })
      })
      const data = await res.json()
      if (res.ok) {
        setProfile(p => ({ ...p, ...data.user }))
        setUser(u => ({ ...u, name: data.user.name, avatar: data.user.avatar }))
        show(setMsg, '✅ تم حفظ الملف الشخصي بنجاح!')
      } else {
        show(setMsg, '❌ فشل الحفظ: ' + (data.message || ''))
      }
    } catch {
      show(setMsg, '❌ خطأ في الاتصال')
    }
    setSavingProfile(false)
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pw.next.length < 6) return show(setPwMsg, '❌ كلمة المرور الجديدة 6 أحرف على الأقل')
    if (pw.next !== pw.confirm) return show(setPwMsg, '❌ تأكيد كلمة المرور غير متطابق')
    setSavingPw(true)
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pw.current, new_password: pw.next })
      })
      const data = await res.json()
      if (res.ok) {
        setPw({ current: '', next: '', confirm: '' })
        show(setPwMsg, '✅ تم تغيير كلمة المرور بنجاح!')
      } else {
        show(setPwMsg, '❌ ' + (data.message || 'فشل التغيير'))
      }
    } catch {
      show(setPwMsg, '❌ خطأ في الاتصال')
    }
    setSavingPw(false)
  }

  const initials = (profile?.name || '?').trim().charAt(0).toUpperCase()

  return (
    <div dir="rtl" className="max-w-2xl mx-auto">
      <PageHeader title="👤 الملف الشخصي" />

      {msg && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${msg.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {msg}
        </div>
      )}

      {/* بطاقة المعلومات */}
      <div className="card-ios p-6 mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-20 h-20 rounded-full bg-ios-blue flex items-center justify-center text-white text-3xl font-extrabold overflow-hidden shrink-0">
            {avatar
              ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
              : initials}
          </div>
          <div>
            <div className="text-xl font-extrabold text-ios-text">{profile?.name}</div>
            <div className="text-ios-label text-sm">{profile?.email}</div>
            <span className="inline-block mt-1 text-xs font-bold bg-ios-blue/10 text-ios-blue px-2.5 py-1 rounded-full">
              {profile?.custom_role_name ? `🎭 ${profile.custom_role_name}` : (roleLabels[profile?.role] || profile?.role)}
            </span>
          </div>
        </div>
        <div className="border-t border-ios-sep pt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-ios-label text-xs mb-0.5">الفرع</div>
            <div className="font-semibold text-ios-text">{profile?.branch_name || 'كل الفروع'}</div>
          </div>
          <div>
            <div className="text-ios-label text-xs mb-0.5">عضو منذ</div>
            <div className="font-semibold text-ios-text">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ar') : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* تعديل الاسم والصورة */}
      <div className="card-ios p-6 mb-6">
        <div className="section-title"><h3 className="mb-4">✏️ تعديل الاسم والصورة</h3></div>
        <div className="space-y-4">
          <div>
            <label className="label-ios">الاسم</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-ios" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-ios-fill flex items-center justify-center text-2xl font-extrabold text-ios-label overflow-hidden shrink-0">
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="flex-1">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarFile}
                className="block w-full text-xs text-ios-label bg-ios-fill rounded-xl p-2" />
              <p className="text-xs text-ios-label mt-1">PNG أو JPG — حد أقصى 1MB</p>
              {avatar && (
                <button onClick={() => setAvatar('')} className="text-ios-red text-xs font-bold mt-1 active:opacity-70">
                  🗑️ إزالة الصورة
                </button>
              )}
            </div>
          </div>
          <button onClick={saveProfile} disabled={savingProfile}
            className="btn-ios w-full py-3 disabled:opacity-60">
            {savingProfile ? 'جاري الحفظ...' : '💾 حفظ التعديلات'}
          </button>
        </div>
      </div>

      {/* تغيير كلمة المرور */}
      <div className="card-ios p-6">
        <div className="section-title"><h3 className="mb-4">🔒 تغيير كلمة المرور</h3></div>
        {pwMsg && (
          <div className={`p-3 rounded-2xl mb-4 text-sm font-bold ${pwMsg.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
            {pwMsg}
          </div>
        )}
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="label-ios">كلمة المرور الحالية</label>
            <input type="password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })}
              required className="input-ios" style={{ direction: 'ltr', textAlign: 'right' }} />
          </div>
          <div>
            <label className="label-ios">كلمة المرور الجديدة</label>
            <input type="password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })}
              required minLength={6} className="input-ios" style={{ direction: 'ltr', textAlign: 'right' }} />
          </div>
          <div>
            <label className="label-ios">تأكيد كلمة المرور الجديدة</label>
            <input type="password" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })}
              required className="input-ios" style={{ direction: 'ltr', textAlign: 'right' }} />
          </div>
          <button type="submit" disabled={savingPw}
            className="btn-ios w-full py-3 disabled:opacity-60">
            {savingPw ? 'جاري التغيير...' : '🔑 تغيير كلمة المرور'}
          </button>
        </form>
      </div>

      <p className="text-center text-ios-label text-xs mt-6">
        {settings.company_name} — نظام الجرد اليومي
      </p>
    </div>
  )
}
