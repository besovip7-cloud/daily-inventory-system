import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const categories = [
  { value: 'raw', label: 'مواد خام' },
  { value: 'packaging', label: 'تغليف' },
  { value: 'beverages', label: 'مشروبات' },
  { value: 'cleaning', label: 'مواد تنظيف' }
]

const emptyItemForm = { name: '', category: 'raw', unit: '', min_quantity: '', current_quantity: '', cost_per_unit: '' }

export default function Inventory({ user }) {
  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const managerBranch = user?.role === 'manager' ? user?.branch_id : null

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [items, setItems] = useState([])
  const [todayRecords, setTodayRecords] = useState(null)
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // إدارة المواد
  const [showManage, setShowManage] = useState(false)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [editingItem, setEditingItem] = useState(null)

  const token = localStorage.getItem('token')

  // ✅ تاريخ محلي (مو UTC) عشان يتوافق مع السيرفر
  const today = new Date().toLocaleDateString('en-CA')

  // جلب الفروع
  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setBranches(data)
        if (managerBranch) {
          setSelectedBranch(managerBranch.toString())
        } else if (data.length > 0 && !selectedBranch) {
          setSelectedBranch(data[0].id.toString())
        }
      })
  }, [])

  const loadItems = () => {
    if (!selectedBranch) return Promise.resolve()
    return fetch(`${API_URL}/inventory/items/${selectedBranch}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(itemsData => setItems(itemsData || []))
  }

  // ✅ جلب البيانات لما يتغير الفرع
  useEffect(() => {
    if (!selectedBranch) return

    setLoading(true)
    setTodayRecords(null)
    setRecords({})
    setMessage('')

    loadItems()
      .then(() => fetch(`${API_URL}/inventory/daily/${selectedBranch}?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      }))
      .then(r => r.json())
      .then(dailyData => {
        if (dailyData && dailyData.length > 0) {
          setTodayRecords(dailyData)
        } else {
          setTodayRecords(null)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [selectedBranch])

  // ✅ بناء records لما تتغير items (يحافظ على القيم المدخلة)
  useEffect(() => {
    if (todayRecords || items.length === 0) return

    setRecords(prev => {
      const init = {}
      items.forEach(item => {
        init[item.id] = prev[item.id] || {
          item_id: item.id,
          opening_qty: item.current_quantity || 0,
          received_qty: 0,
          consumed_qty: 0,
          closing_qty: item.current_quantity || 0,
          notes: ''
        }
      })
      return init
    })
  }, [items, todayRecords])

  const handleChange = (itemId, field, value) => {
    setRecords(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: parseFloat(value) || 0 }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        branch_id: parseInt(selectedBranch),
        records: Object.values(records)
      }

      const res = await fetch(`${API_URL}/inventory/daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok) {
        setMessage('✅ تم إرسال الجرد للإدارة بنجاح!')
        setTodayRecords(Object.values(records).map(r => ({
          ...r,
          item_name: items.find(i => i.id === r.item_id)?.name,
          unit: items.find(i => i.id === r.item_id)?.unit
        })))
      } else {
        setMessage('❌ خطأ: ' + (data.message || 'فشل الحفظ'))
      }
    } catch (err) {
      console.error(err)
      setMessage('❌ خطأ في الاتصال')
    }
    setSaving(false)
  }

  // ===== إدارة المواد =====
  const startItemEdit = (item) => {
    setEditingItem(item.id)
    setItemForm({
      name: item.name,
      category: item.category || 'raw',
      unit: item.unit || '',
      min_quantity: item.min_quantity ?? '',
      current_quantity: item.current_quantity ?? '',
      cost_per_unit: item.cost_per_unit ?? ''
    })
    setShowManage(true)
  }

  const handleItemSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      const isEdit = !!editingItem
      const url = isEdit ? `${API_URL}/inventory/items/${editingItem}` : `${API_URL}/inventory/items`
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          branch_id: parseInt(selectedBranch),
          name: itemForm.name,
          category: itemForm.category,
          unit: itemForm.unit,
          min_quantity: parseFloat(itemForm.min_quantity) || 0,
          current_quantity: parseFloat(itemForm.current_quantity) || 0,
          cost_per_unit: parseFloat(itemForm.cost_per_unit) || 0
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(isEdit ? '✅ تم تعديل المادة بنجاح!' : '✅ تمت إضافة المادة بنجاح!')
        setItemForm(emptyItemForm)
        setEditingItem(null)
        loadItems()
      } else {
        setMessage('❌ فشل: ' + (data.message || ''))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const handleItemDelete = async (item) => {
    if (!window.confirm(`هل أنت متأكد من حذف مادة "${item.name}"؟ (حذف مؤقت — السجلات السابقة تبقى محفوظة)`)) return
    try {
      const res = await fetch(`${API_URL}/inventory/items/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ تم حذف ${item.name}`)
        loadItems()
      } else {
        setMessage('❌ فشل الحذف: ' + (data.message || ''))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const getStatus = (item) => {
    const qty = item.current_quantity
    const min = item.min_quantity
    if (qty <= 0) return { text: 'نفذ 🔴', class: 'bg-red-100 text-red-700' }
    if (qty <= min * 0.5) return { text: 'حرج 🚨', class: 'bg-red-100 text-red-700' }
    if (qty <= min) return { text: 'منخفض 🟡', class: 'bg-yellow-100 text-yellow-700' }
    return { text: 'متوفر ✅', class: 'bg-green-100 text-green-700' }
  }

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📦 جرد المخزون اليومي</h2>
        {canManage && selectedBranch && (
          <button onClick={() => { setShowManage(!showManage); setEditingItem(null); setItemForm(emptyItemForm) }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 transition">
            🧾 {showManage ? 'إخفاء إدارة المواد' : 'إدارة المواد'}
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      {/* ✅ اختيار الفرع — مقفل للمدير على فرعه */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">اختر الفرع</label>
        <select
          value={selectedBranch}
          onChange={e => setSelectedBranch(e.target.value)}
          disabled={!!managerBranch}
          className="w-full md:w-80 p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="">-- اختر الفرع --</option>
          {branches.map(b => (
            <option key={b.id} value={b.id.toString()}>{b.name}</option>
          ))}
        </select>
        {managerBranch && <p className="text-sm text-gray-400 mt-1">مدير الفرع مقيد على فرعه فقط</p>}
      </div>

      {/* ===== لوحة إدارة المواد ===== */}
      {showManage && canManage && selectedBranch && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold mb-4 text-purple-900">
            {editingItem ? '✏️ تعديل مادة' : '➕ إضافة مادة جديدة'}
          </h3>
          <form onSubmit={handleItemSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">
            <input type="text" placeholder="اسم المادة *" required
              value={itemForm.name}
              onChange={e => setItemForm({...itemForm, name: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none" />
            <select value={itemForm.category}
              onChange={e => setItemForm({...itemForm, category: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none">
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={itemForm.unit}
              onChange={e => setItemForm({...itemForm, unit: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none">
              <option value="">بدون وحدة (اختياري)</option>
              {itemForm.unit && !['كغم', 'غرام', 'لتر', 'مليلتر', 'قطعة'].includes(itemForm.unit) && (
                <option value={itemForm.unit}>{itemForm.unit} (حالية)</option>
              )}
              <option value="كغم">كغم</option>
              <option value="غرام">غرام</option>
              <option value="لتر">لتر</option>
              <option value="مليلتر">مليلتر</option>
              <option value="قطعة">قطعة</option>
            </select>
            <input type="number" placeholder="الحد الأدنى" min="0" step="0.01"
              value={itemForm.min_quantity}
              onChange={e => setItemForm({...itemForm, min_quantity: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none" />
            <input type="number" placeholder="الكمية الحالية" min="0" step="0.01"
              value={itemForm.current_quantity}
              onChange={e => setItemForm({...itemForm, current_quantity: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none" />
            <div className="flex gap-2">
              <button type="submit"
                className="flex-1 bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-700 transition">
                {editingItem ? 'حفظ' : 'إضافة'}
              </button>
              {editingItem && (
                <button type="button" onClick={() => { setEditingItem(null); setItemForm(emptyItemForm) }}
                  className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition">
                  إلغاء
                </button>
              )}
            </div>
          </form>

          {/* قائمة المواد */}
          {items.length === 0 ? (
            <p className="text-gray-500 text-center py-4">لا توجد مواد — أضف أول مادة من النموذج أعلاه</p>
          ) : (
            <div className="bg-white rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-purple-100">
                  <tr>
                    <th className="p-3 text-right font-semibold">المادة</th>
                    <th className="p-3 text-center font-semibold">الفئة</th>
                    <th className="p-3 text-center font-semibold">الوحدة</th>
                    <th className="p-3 text-center font-semibold">الحد الأدنى</th>
                    <th className="p-3 text-center font-semibold">الكمية</th>
                    <th className="p-3 text-center font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const status = getStatus(item)
                    return (
                      <tr key={item.id} className="border-t border-gray-100">
                        <td className="p-3 font-semibold">{item.name}</td>
                        <td className="p-3 text-center text-gray-600">{categories.find(c => c.value === item.category)?.label || item.category}</td>
                        <td className="p-3 text-center text-gray-600">{item.unit || '—'}</td>
                        <td className="p-3 text-center text-gray-600">{item.min_quantity}</td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${status.class}`}>{item.current_quantity}</span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => startItemEdit(item)}
                              className="bg-blue-100 text-blue-700 px-3 py-1 rounded font-bold text-xs hover:bg-blue-200">✏️ تعديل</button>
                            <button onClick={() => handleItemDelete(item)}
                              className="bg-red-100 text-red-700 px-3 py-1 rounded font-bold text-xs hover:bg-red-200">🗑️ حذف</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center p-10">جاري التحميل...</div>
      ) : !selectedBranch ? (
        <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500">اختر فرعاً لبدء الجرد</p>
        </div>
      ) : todayRecords ? (
        // ✅ تم الجرد
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center mb-6">
            <div className="text-6xl mb-2">📤</div>
            <h3 className="text-xl font-bold text-blue-700">تم إرسال الجرد للإدارة</h3>
            <p className="text-gray-500">في انتظار إدخال المبيعات من قبل الإدارة</p>
            <p className="text-sm text-gray-400 mt-1">التاريخ: {today}</p>
          </div>

          <h4 className="font-bold text-lg mb-4 border-b pb-2">📋 ملخص الجرد المرسل</h4>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-right font-semibold">المادة</th>
                <th className="p-3 text-center font-semibold">بداية</th>
                <th className="p-3 text-center font-semibold">وارد</th>
                <th className="p-3 text-center font-semibold">منصرف</th>
                <th className="p-3 text-center font-semibold">نهاية</th>
              </tr>
            </thead>
            <tbody>
              {todayRecords.map((rec, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="p-3 font-semibold">{rec.item_name || items.find(i => i.id === rec.item_id)?.name || '—'}</td>
                  <td className="p-3 text-center">{rec.opening_qty}</td>
                  <td className="p-3 text-center text-green-600">+{rec.received_qty}</td>
                  <td className="p-3 text-center text-red-600">-{rec.consumed_qty}</td>
                  <td className="p-3 text-center font-bold">{rec.closing_qty}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg text-center border border-yellow-200">
            <p className="text-yellow-800 font-bold">⏳ في انتظار إدخال المبيعات من الإدارة</p>
            <p className="text-yellow-700 text-sm mt-1">سيتم إشعارك بالفروقات (إن وجدت)</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">📭</div>
          <div className="text-xl font-bold text-gray-700">لا توجد مواد في هذا الفرع</div>
          {canManage ? (
            <button onClick={() => setShowManage(true)}
              className="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition">
              🧾 إضافة المواد الآن
            </button>
          ) : (
            <div className="text-gray-500">تواصل مع الإدارة لإضافة المواد</div>
          )}
        </div>
      ) : (
        // نموذج إدخال الجرد
        <>
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-yellow-800 font-bold">تذكير: أدخل الكميات بدقة</p>
              <p className="text-yellow-700 text-sm">بعد الضغط على "حفظ وإرسال" لا يمكن التعديل إلا من قبل الإدارة</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4 text-right font-semibold text-gray-600">المادة</th>
                  <th className="p-4 text-center font-semibold text-gray-600">الوحدة</th>
                  <th className="p-4 text-center font-semibold text-gray-600">الحد الأدنى</th>
                  <th className="p-4 text-center font-semibold text-gray-600">الحالة</th>
                  <th className="p-4 text-center font-semibold text-gray-600">بداية اليوم</th>
                  <th className="p-4 text-center font-semibold text-gray-600">وارد</th>
                  <th className="p-4 text-center font-semibold text-gray-600">منصرف</th>
                  <th className="p-4 text-center font-semibold text-gray-600">نهاية اليوم</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const status = getStatus(item)
                  const rec = records[item.id] || {}
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 font-semibold text-gray-900">{item.name}</td>
                      <td className="p-4 text-center text-gray-600">{item.unit}</td>
                      <td className="p-4 text-center text-gray-600">{item.min_quantity}</td>
                      <td className="p-4 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full ${status.class}`}>{status.text}</span>
                      </td>
                      <td className="p-4 text-center">
                        <input type="number" value={rec.opening_qty || 0}
                          onChange={e => handleChange(item.id, 'opening_qty', e.target.value)}
                          className="w-20 p-2 border-2 border-gray-200 rounded-lg text-center focus:border-blue-500 focus:outline-none" />
                      </td>
                      <td className="p-4 text-center">
                        <input type="number" value={rec.received_qty || 0}
                          onChange={e => handleChange(item.id, 'received_qty', e.target.value)}
                          className="w-20 p-2 border-2 border-gray-200 rounded-lg text-center focus:border-blue-500 focus:outline-none" />
                      </td>
                      <td className="p-4 text-center">
                        <input type="number" value={rec.consumed_qty || 0}
                          onChange={e => handleChange(item.id, 'consumed_qty', e.target.value)}
                          className="w-20 p-2 border-2 border-gray-200 rounded-lg text-center focus:border-blue-500 focus:outline-none" />
                      </td>
                      <td className="p-4 text-center">
                        <input type="number" value={rec.closing_qty || 0}
                          onChange={e => handleChange(item.id, 'closing_qty', e.target.value)}
                          className="w-20 p-2 border-2 border-gray-200 rounded-lg text-center focus:border-blue-500 focus:outline-none font-bold" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-400">
            {saving ? 'جاري الإرسال...' : '📤 حفظ وإرسال للإدارة'}
          </button>
        </>
      )}
    </div>
  )
}
