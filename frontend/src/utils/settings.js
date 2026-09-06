const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const DEFAULTS = { company_name: 'Saj Alreef Express', company_logo: '' }

// الإعدادات المخزنة محلياً (تنقرأ فوراً بدون انتظار الشبكة)
export const getCachedSettings = () => {
  try {
    const raw = localStorage.getItem('app_settings')
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export const fetchSettings = async () => {
  try {
    const res = await fetch(`${API_URL}/settings`)
    if (!res.ok) return getCachedSettings()
    const data = await res.json()
    const settings = { ...DEFAULTS, ...data }
    localStorage.setItem('app_settings', JSON.stringify(settings))
    return settings
  } catch {
    return getCachedSettings()
  }
}
