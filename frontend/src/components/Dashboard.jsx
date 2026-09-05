import { useState, useEffect } from 'react'
import { visibleBranches } from '../utils/branchScope'

export default function Dashboard({ apiUrl, user }) {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${apiUrl}/branches`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }})
      .then(r => r.json())
      .then(data => { setBranches(visibleBranches(user, data || [])); setLoading(false) })
      .catch(() => { setError('فشل تحميل البيانات'); setLoading(false) })
  }, [apiUrl])

  if (loading) return <div className="text-center p-10 text-ios-label">جاري التحميل...</div>
  if (error) return <div className="text-center p-10 text-ios-red font-semibold">{error}</div>

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-ios-text tracking-tight">🏪 الفروع</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {branches.map(branch => (
          <div key={branch.id} className="card-ios p-6">
            <h3 className="font-bold text-lg text-ios-text">{branch.name}</h3>
            <p className="text-ios-label text-sm mt-1">{branch.location}</p>
            <p className="text-ios-label text-xs mt-2">المدير: {branch.manager_name}</p>
            <div className="mt-4 flex gap-2">
              <span className="badge-ios bg-ios-green/15 text-ios-green">نشط</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 card-ios p-6">
        <h3 className="font-bold text-lg mb-4 text-ios-text">📊 حالة النظام</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-ios-blue/10 rounded-2xl">
            <div className="text-3xl font-semibold text-ios-blue">{branches.length}</div>
            <div className="text-sm text-ios-label mt-1">فروع</div>
          </div>
          <div className="text-center p-4 bg-ios-green/15 rounded-2xl">
            <div className="text-2xl font-semibold">✅</div>
            <div className="text-sm text-ios-label mt-1">API شغال</div>
          </div>
          <div className="text-center p-4 bg-ios-orange/15 rounded-2xl">
            <div className="text-2xl font-semibold">🗄️</div>
            <div className="text-sm text-ios-label mt-1">DB متصل</div>
          </div>
          <div className="text-center p-4 bg-ios-yellow/25 rounded-2xl">
            <div className="text-2xl font-semibold">🔐</div>
            <div className="text-sm text-ios-label mt-1">JWT Active</div>
          </div>
        </div>
      </div>
    </div>
  )
}
