import { getToken } from '../utils/token'
import { useState, useEffect } from 'react'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const emptyForm = { name: '', phone: '', whatsapp: '', email: '', notes: '' }

export default function Suppliers() {
  const token = getToken()
  const headers = { Authorization: `Bearer ${token}` }

  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { loadSuppliers() }, [])

  const loadSuppliers = () => {
    fetch(`${API_URL}/catalog/suppliers`, { headers })
      .then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  const show = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return show('❌ اسم المورّد مطلوب')
    setSaving(true)
    try {
      const isEdit = !!editing
      const body = { ...form, name: form.name.trim(), phone: form.phone || null, whatsapp: form.whatsapp || null, email: form.email || null, notes: form.notes || null }
      const res = await fetch(isEdit ? `${API_URL}/catalog/suppliers/${editing}` : `${API_URL}/catalog/suppliers`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok) {
        show(isEdit ? '✅ تم حفظ تعديلات المورّد' : '✅ تمت إضافة المورّد')
        setForm(emptyForm)
        setEditing(null)
        loadSuppliers()
      } else show('❌ ' + (data.message || 'فشل الحفظ'))
    } catch { show('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const startEdit = (s) => {
    setEditing(s.id)
    setForm({ name: s.name || '', phone: s.phone || '', whatsapp: s.whatsapp || '', email: s.email || '', notes: s.notes || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleActive = async (s) => {
    try {
      const res = await fetch(`${API_URL}/catalog/suppliers/${s.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: s.name, is_active: !s.is_active })
      })
      const data = await res.json()
      if (res.ok) { show(data.is_active ? '✅ تم تفعيل المورّد' : '✅ تم إيقاف المورّد'); loadSuppliers() }
      else show('❌ ' + (data.message || 'فشل التحديث'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  const deleteSupplier = async (s) => {
    if (!window.confirm(`حذف المورّد "${s.name}" نهائياً؟`)) return
    try {
      const res = await fetch(`${API_URL}/catalog/suppliers/${s.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { show('✅ ' + (data.message || 'تم الحذف')); loadSuppliers() }
      else show('❌ ' + (data.message || 'فشل الحذف'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  return (
    <div dir="rtl">
      <PageHeader title="🚚 الموردون" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      <div className={`card-ios p-6 mb-6 ${editing ? 'ring-2 ring-ios-blue' : ''}`}>
        <div className="section-title"><h3 className="mb-4">{editing ? '✏️ تعديل مورّد' : '➕ إضافة مورّد'}</h3></div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input type="text" placeholder="اسم المورّد *" required value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} className="input-ios" />
          <input type="text" placeholder="الهاتف" value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })} className="input-ios" />
          <input type="text" placeholder="واتساب" value={form.whatsapp}
            onChange={e => setForm({ ...form, whatsapp: e.target.value })} className="input-ios" />
          <input type="email" placeholder="البريد الإلكتروني" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} className="input-ios" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-ios flex-1 disabled:opacity-40">
              {saving ? 'جاري الحفظ...' : editing ? 'حفظ' : 'إضافة'}
            </button>
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setForm(emptyForm) }}
                className="btn-ios-secondary">إلغاء</button>
            )}
          </div>
          <textarea placeholder="ملاحظات" value={form.notes} rows={2}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            className="input-ios md:col-span-5 resize-none" />
        </form>
      </div>

      <div className="section-title"><h3>قائمة الموردين ({suppliers.length})</h3></div>
      {suppliers.length === 0 ? (
        <p className="text-center text-ios-label py-8">لا يوجد موردون</p>
      ) : (
        <>
          <div className="hidden md:block card-ios overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-ios min-w-[760px]">
                <thead>
                  <tr>
                    <th>المورّد</th>
                    <th>الهاتف</th>
                    <th>واتساب</th>
                    <th>ملاحظات</th>
                    <th>الحالة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.id} className={!s.is_active ? 'opacity-50' : ''}>
                      <td className="font-semibold text-ios-text whitespace-nowrap">{s.name}</td>
                      <td className="text-ios-label whitespace-nowrap">{s.phone || '—'}</td>
                      <td className="text-ios-label whitespace-nowrap">{s.whatsapp || '—'}</td>
                      <td className="text-xs text-ios-label max-w-[200px]">{s.notes || '—'}</td>
                      <td>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.is_active ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-fill text-ios-label'}`}>
                          {s.is_active ? '✅ فعال' : '⏸️ موقوف'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1.5 whitespace-nowrap justify-center">
                          <button onClick={() => startEdit(s)}
                            className="px-3 py-1.5 rounded-xl bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">✏️ تعديل</button>
                          <button onClick={() => toggleActive(s)}
                            className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold active:opacity-70">
                            {s.is_active ? '⏸️ إيقاف' : '▶️ تفعيل'}
                          </button>
                          <button onClick={() => deleteSupplier(s)}
                            className="px-3 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {suppliers.map(s => (
              <div key={s.id} className={`card-ios p-4 space-y-2 ${!s.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ios-text">{s.name}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.is_active ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-fill text-ios-label'}`}>
                    {s.is_active ? '✅ فعال' : '⏸️ موقوف'}
                  </span>
                </div>
                {s.phone && <div className="text-sm"><span className="label-ios">الهاتف</span>{s.phone}</div>}
                {s.whatsapp && <div className="text-sm"><span className="label-ios">واتساب</span>{s.whatsapp}</div>}
                {s.notes && <div className="text-xs text-ios-label">{s.notes}</div>}
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => startEdit(s)}
                    className="px-3 py-1.5 rounded-xl bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">✏️ تعديل</button>
                  <button onClick={() => toggleActive(s)}
                    className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold active:opacity-70">
                    {s.is_active ? '⏸️ إيقاف' : '▶️ تفعيل'}
                  </button>
                  <button onClick={() => deleteSupplier(s)}
                    className="px-3 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">🗑️ حذف</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
