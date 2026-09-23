import { getToken } from '../utils/token'
import { useState, useEffect } from 'react'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Units() {
  const token = getToken()
  const headers = { Authorization: `Bearer ${token}` }

  const [units, setUnits] = useState([])
  const [newUnit, setNewUnit] = useState('')
  const [editUnit, setEditUnit] = useState(null) // {id, name}
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { loadUnits() }, [])

  const loadUnits = () => {
    fetch(`${API_URL}/catalog/units`, { headers })
      .then(r => r.json())
      .then(d => setUnits(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  const show = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addUnit = async (e) => {
    e.preventDefault()
    if (!newUnit.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/catalog/units`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUnit.trim() })
      })
      const data = await res.json()
      if (res.ok) { show('✅ تمت إضافة الوحدة'); setNewUnit(''); loadUnits() }
      else show('❌ ' + (data.message || 'فشلت الإضافة'))
    } catch { show('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const saveUnit = async (u) => {
    if (!editUnit.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/catalog/units/${u.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editUnit.name.trim() })
      })
      const data = await res.json()
      if (res.ok) { show('✅ تم حفظ الوحدة'); setEditUnit(null); loadUnits() }
      else show('❌ ' + (data.message || 'فشل الحفظ'))
    } catch { show('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const deleteUnit = async (u) => {
    if (!window.confirm(`حذف الوحدة "${u.name}"؟`)) return
    try {
      const res = await fetch(`${API_URL}/catalog/units/${u.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { show('✅ ' + (data.message || 'تم الحذف')); loadUnits() }
      else show('❌ ' + (data.message || 'فشل الحذف'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  return (
    <div dir="rtl">
      <PageHeader title="📏 الوحدات" subtitle="وحدات قياس المواد الخام — تظهر كاقتراحات بنموذج إضافة المادة" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      <div className="card-ios p-4 md:p-6">
        <form onSubmit={addUnit} className="flex gap-2 mb-4">
          <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)}
            placeholder="اسم وحدة جديدة — مثلاً: كرتون" className="input-ios flex-1" />
          <button type="submit" disabled={saving || !newUnit.trim()}
            className="btn-ios px-5 whitespace-nowrap disabled:opacity-40">➕ إضافة</button>
        </form>

        {units.length === 0 ? (
          <p className="text-center text-ios-label py-8">لا توجد وحدات</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {units.map(u => (
              <div key={u.id} className="rounded-2xl border border-ios-sep bg-white p-3">
                {editUnit?.id === u.id ? (
                  <div className="flex gap-1.5">
                    <input type="text" value={editUnit.name} autoFocus
                      onChange={e => setEditUnit({ ...editUnit, name: e.target.value })}
                      className="input-ios !py-1.5 text-sm flex-1 min-w-0" />
                    <button type="button" disabled={saving} onClick={() => saveUnit(u)}
                      className="px-2.5 py-1.5 rounded-xl bg-ios-green/15 text-[#1F7A33] text-xs font-bold disabled:opacity-40">💾</button>
                    <button type="button" onClick={() => setEditUnit(null)}
                      className="px-2.5 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-ios-text text-sm truncate">{u.name}</span>
                    <div className="flex gap-1 whitespace-nowrap">
                      <button type="button" onClick={() => setEditUnit({ id: u.id, name: u.name })}
                        className="px-2 py-1 rounded-lg bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">✏️</button>
                      <button type="button" onClick={() => deleteUnit(u)}
                        className="px-2 py-1 rounded-lg bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
