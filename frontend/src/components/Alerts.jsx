import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Alerts() {
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setBranches(data)
        if (data.length > 0) setSelectedBranch(data[0].id)
      })
  }, [])

  useEffect(() => {
    if (!selectedBranch) return
    loadAlerts()
  }, [selectedBranch])

  const loadAlerts = () => {
    setLoading(true)
    fetch(`${API_URL}/alerts/${selectedBranch}?resolved=false`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setAlerts(data)
        setLoading(false)
      })
  }

  const resolveAlert = async (id) => {
    try {
      const res = await fetch(`${API_URL}/alerts/${id}/resolve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setMessage('✅ تم حل التنبيه')
        loadAlerts()
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (err) {
      setMessage('❌ فشل حل التنبيه')
    }
  }

  const resolveAll = async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/${selectedBranch}/resolve-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setMessage('✅ تم حل كل التنبيهات')
        loadAlerts()
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (err) {
      setMessage('❌ فشل الحل')
    }
  }

  const getAlertIcon = (type) => {
    if (type === 'critical') return '🚨'
    if (type === 'warning') return '⚠️'
    return '🔵'
  }

  const getAlertClass = (type) => {
    if (type === 'critical') return 'bg-ios-red/10 text-ios-red'
    if (type === 'warning') return 'bg-ios-yellow/20 text-[#B25000]'
    if (type === 'variance') return 'bg-ios-orange/15 text-ios-orange'
    return 'bg-ios-blue/10 text-ios-blue'
  }

  const unresolvedCount = alerts.filter(a => !a.is_resolved).length

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-ios-text tracking-tight">🔔 التنبيهات</h2>
        {unresolvedCount > 0 && (
          <span className="badge-ios bg-ios-red text-white">
            {unresolvedCount} تنبيه
          </span>
        )}
      </div>

      {message && (
        <div className="bg-ios-green/15 text-[#1F7A33] p-4 rounded-2xl mb-4 font-bold">
          {message}
        </div>
      )}

      <div className="card-ios p-4 mb-6 flex justify-between items-center">
        <div className="flex-1">
          <label className="label-ios">اختر الفرع</label>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="input-ios md:w-80"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {unresolvedCount > 0 && (
          <button
            onClick={resolveAll}
            className="btn-ios mr-4"
          >
            ✓ حل الكل
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center p-10 text-ios-label">جاري التحميل...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center p-10 card-ios">
          <div className="text-6xl mb-4">🎉</div>
          <div className="text-xl font-bold text-ios-text">لا توجد تنبيهات!</div>
          <div className="text-ios-label">كل شي على ما يرام</div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-4 rounded-2xl ${getAlertClass(alert.alert_type)} flex justify-between items-center`}
            >
              <div className="flex-1">
                <div className="font-bold text-lg mb-1">
                  {getAlertIcon(alert.alert_type)} {alert.title}
                </div>
                <div className="text-sm opacity-80">{alert.message}</div>
                <div className="text-xs mt-2 opacity-60">
                  {new Date(alert.created_at).toLocaleString('ar-SA')}
                </div>
              </div>
              {!alert.is_resolved && (
                <button
                  onClick={() => resolveAlert(alert.id)}
                  className="bg-white text-ios-blue px-4 py-2 rounded-xl font-bold shadow-sm active:opacity-70 mr-4"
                >
                  ✓ حلّ
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}