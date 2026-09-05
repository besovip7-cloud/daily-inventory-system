import { useState, useEffect } from 'react'
import { visibleBranches } from '../utils/branchScope'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Branches({ user }) {
  const [branches, setBranches] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => setBranches(visibleBranches(user, data || [])))
  }, [])

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-ios-text tracking-tight">🏪 الفروع</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map(branch => (
          <div key={branch.id} className="card-ios p-6">
            <h3 className="font-bold text-lg text-ios-text mb-2">{branch.name}</h3>
            <p className="text-ios-label text-sm mb-1">📍 {branch.location || '—'}</p>
            <p className="text-ios-label text-sm">👤 المدير: {branch.manager_name || '—'}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-ios-label mt-6 text-center">
        إضافة وتعديل وحذف الفروع من صفحة "🛠️ الإدارة العامة" (للأدمن فقط)
      </p>
    </div>
  )
}
