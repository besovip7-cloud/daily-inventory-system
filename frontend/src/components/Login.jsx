import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login({ setUser, apiUrl }) {
  const [email, setEmail] = useState('admin@system.com')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
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
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ios-bg px-4" dir="rtl">
      <div className="card-ios p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-ios-text tracking-tight">📦 نظام الجرد اليومي</h1>
        <p className="text-center text-ios-label mb-6">تسجيل الدخول</p>
        {error && <div className="bg-ios-red/10 text-ios-red p-3 rounded-2xl mb-4 text-sm font-semibold">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-ios">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input-ios" />
          </div>
          <div>
            <label className="label-ios">كلمة المرور</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="input-ios" />
          </div>
          <button type="submit" className="btn-ios w-full py-3 text-lg">
            دخول
          </button>
        </form>
      </div>
    </div>
  )
}
