import { useState, useEffect } from 'react'

const API_URL = 'https://inventory-api-6lta.onrender.com/api'

export default function Branches() {
  const [branches, setBranches] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', location: '', manager_name: '' })
  const [message, setMessage] = useState('')
  const token = localStorage.getItem('token')

  useEffect(() => {
    loadBranches()
  }, [])

  const loadBranches = () => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => setBranches(data))
  }

  const startEdit = (branch) => {
    setEditing(branch.id)
    setForm({
      name: branch.name,
      location: branch.location || '',
      manager_name: branch.manager_name || ''
    })
  }

  const handleSave = async (id) => {
    setMessage('')
    try {
      const res = await fetch(`${API_URL}/branches/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        setMessage('✅ تم التحديث بنجاح!')
        setEditing(null)
        loadBranches()
      } else {
        setMessage('❌ فشل التحديث')
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">🏪 إدارة الفروع</h2>
      
      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map(branch => (
          <div key={branch.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            {editing === branch.id ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">اسم الفرع</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">الموقع</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => setForm({...form, location: e.target.value})}
                    className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">اسم المدير</label>
                  <input
                    type="text"
                    value={form.manager_name}
                    onChange={e => setForm({...form, manager_name: e.target.value})}
                    className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(branch.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition"
                  >
                    💾 حفظ
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{branch.name}</h3>
                <p className="text-gray-500 text-sm mb-1">📍 {branch.location || '—'}</p>
                <p className="text-gray-500 text-sm mb-4">👤 المدير: {branch.manager_name || '—'}</p>
                <button
                  onClick={() => startEdit(branch)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition"
                >
                  ✏️ تعديل
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}