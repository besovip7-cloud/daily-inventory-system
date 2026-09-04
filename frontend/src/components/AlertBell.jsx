import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const alertIcon = (type) => {
  if (type === 'critical') return '🚨'
  if (type === 'warning') return '⚠️'
  if (type === 'variance') return '⚖️'
  return '🔵'
}

export default function AlertBell() {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState([])

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/my-count`, { headers })
      const data = await res.json()
      setCount(data.count || 0)
    } catch (e) { /* silently ignore */ }
  }, [])

  const loadAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/my`, { headers })
      setAlerts(await res.json() || [])
    } catch (e) { /* silently ignore */ }
  }

  useEffect(() => {
    loadCount()
    const timer = setInterval(loadCount, 60000)
    return () => clearInterval(timer)
  }, [loadCount])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) loadAlerts()
  }

  const resolveAll = async () => {
    try {
      await fetch(`${API_URL}/alerts/resolve-mine`, { method: 'PUT', headers })
      setAlerts([])
      setCount(0)
    } catch (e) { /* silently ignore */ }
  }

  return (
    <div className="relative">
      <button onClick={toggle} className="relative text-xl" title="التنبيهات">
        🔔
        {count > 0 && (
          <span className="absolute -top-2 -left-2 bg-red-600 text-white text-xs font-bold rounded-full px-1.5 min-w-[20px] text-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)}></div>
          <div className="absolute left-0 top-8 z-20 w-80 bg-white text-gray-800 rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="flex justify-between items-center p-3 border-b border-gray-100">
              <span className="font-bold">🔔 التنبيهات ({count})</span>
              {alerts.length > 0 && (
                <button onClick={resolveAll} className="text-xs text-blue-600 font-bold hover:underline">
                  ✓ قرأت الكل
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">🎉 لا توجد تنبيهات جديدة</p>
              ) : (
                alerts.map(a => (
                  <div key={a.id} className="p-3 border-b border-gray-50 hover:bg-gray-50">
                    <div className="font-bold text-sm">{alertIcon(a.alert_type)} {a.title}</div>
                    <div className="text-xs text-gray-600 mt-1">{a.message}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {a.branch_name && <span>{a.branch_name} • </span>}
                      {new Date(a.created_at).toLocaleString('ar')}
                    </div>
                  </div>
                ))
              )}
            </div>
            <Link to="/alerts" onClick={() => setOpen(false)}
              className="block text-center text-sm text-blue-600 font-bold p-2 hover:bg-blue-50 border-t border-gray-100">
              عرض صفحة التنبيهات
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
