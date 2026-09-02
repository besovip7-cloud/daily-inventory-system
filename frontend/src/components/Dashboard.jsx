import { useState, useEffect } from 'react'

export default function Dashboard({ apiUrl }) {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${apiUrl}/branches`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }})
      .then(r => r.json())
      .then(data => { setBranches(data); setLoading(false) })
      .catch(() => { setError('فشل تحميل البيانات'); setLoading(false) })
  }, [apiUrl])

  if (loading) return <div className="text-center p-10">جاري التحميل...</div>
  if (error) return <div className="text-center p-10 text-red-600">{error}</div>

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900">🏪 الفروع</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {branches.map(branch => (
          <div key={branch.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <h3 className="font-bold text-lg text-gray-900">{branch.name}</h3>
            <p className="text-gray-500 text-sm mt-1">{branch.location}</p>
            <p className="text-gray-400 text-xs mt-2">المدير: {branch.manager_name}</p>
            <div className="mt-4 flex gap-2">
              <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">نشط</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4">📊 حالة النظام</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{branches.length}</div>
            <div className="text-sm text-gray-600">فروع</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">✅</div>
            <div className="text-sm text-gray-600">API شغال</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">🗄️</div>
            <div className="text-sm text-gray-600">DB متصل</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">🔐</div>
            <div className="text-sm text-gray-600">JWT Active</div>
          </div>
        </div>
      </div>
    </div>
  )
}
