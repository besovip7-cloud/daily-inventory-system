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
    if (type === 'critical') return 'bg-red-50 border-red-200 text-red-800'
    if (type === 'warning') return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    return 'bg-blue-50 border-blue-200 text-blue-800'
  }

  const unresolvedCount = alerts.filter(a => !a.is_resolved).length

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">🔔 التنبيهات</h2>
        {unresolvedCount > 0 && (
          <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            {unresolvedCount} تنبيه
          </span>
        )}
      </div>

      {message && (
        <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-4 font-bold">
          {message}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex justify-between items-center">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">اختر الفرع</label>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="w-full md:w-80 p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {unresolvedCount > 0 && (
          <button
            onClick={resolveAll}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition"
          >
            ✓ حل الكل
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center p-10">جاري التحميل...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">🎉</div>
          <div className="text-xl font-bold text-gray-700">لا توجد تنبيهات!</div>
          <div className="text-gray-500">كل شي على ما يرام</div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border ${getAlertClass(alert.alert_type)} flex justify-between items-center`}
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
                  className="bg-white px-4 py-2 rounded-lg font-bold shadow-sm hover:shadow-md transition mr-4"
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