import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Branches() {
  const [branches, setBranches] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => setBranches(data || []))
  }, [])

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">🏪 الفروع</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map(branch => (
          <div key={branch.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg text-gray-900 mb-2">{branch.name}</h3>
            <p className="text-gray-500 text-sm mb-1">📍 {branch.location || '—'}</p>
            <p className="text-gray-500 text-sm">👤 المدير: {branch.manager_name || '—'}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-400 mt-6 text-center">
        إضافة وتعديل وحذف الفروع من صفحة "🛠️ الإدارة العامة" (للأدمن فقط)
      </p>
    </div>
  )
}
