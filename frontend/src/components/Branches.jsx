import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Branches({ user }) {
  const isAdmin = user?.role === 'admin'
  const [branches, setBranches] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', location: '', manager_name: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [newBranch, setNewBranch] = useState({ name: '', location: '', manager_name: '' })
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
      const data = await res.json()
      if (res.ok) {
        setMessage('✅ تم التحديث بنجاح!')
        setEditing(null)
        loadBranches()
      } else {
        setMessage('❌ فشل التحديث: ' + (data.message || ''))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      const res = await fetch(`${API_URL}/branches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newBranch)
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('✅ تم إضافة الفرع بنجاح!')
        setNewBranch({ name: '', location: '', manager_name: '' })
        setShowAdd(false)
        loadBranches()
      } else {
        setMessage('❌ فشل الإضافة: ' + (data.message || ''))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const handleDelete = async (branch) => {
    if (!window.confirm(
      `⚠️ تحذير: حذف "${branch.name}" سيمحو نهائياً:\n` +
      `• كل مواد المخزون وسجلات الجرد\n` +
      `• كل سجلات المبيعات\n` +
      `• كل التنبيهات\n\nهل أنت متأكد؟`
    )) return
    try {
      const res = await fetch(`${API_URL}/branches/${branch.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ تم حذف ${branch.name}`)
        loadBranches()
      } else {
        setMessage('❌ فشل الحذف: ' + (data.message || ''))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">🏪 إدارة الفروع</h2>
        {isAdmin && !showAdd && (
          <button onClick={() => setShowAdd(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition">
            ➕ إضافة فرع
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      {/* نموذج إضافة فرع */}
      {showAdd && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200 mb-6">
          <h3 className="text-lg font-bold mb-4">➕ فرع جديد</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="text" placeholder="اسم الفرع *" required
              value={newBranch.name}
              onChange={e => setNewBranch({...newBranch, name: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none" />
            <input type="text" placeholder="الموقع"
              value={newBranch.location}
              onChange={e => setNewBranch({...newBranch, location: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none" />
            <input type="text" placeholder="اسم المدير"
              value={newBranch.manager_name}
              onChange={e => setNewBranch({...newBranch, manager_name: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none" />
            <div className="flex gap-2">
              <button type="submit"
                className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition">
                إضافة
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition">
                إلغاء
              </button>
            </div>
          </form>
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
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(branch)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition"
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(branch)}
                      className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold hover:bg-red-200 transition"
                    >
                      🗑️ حذف
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
