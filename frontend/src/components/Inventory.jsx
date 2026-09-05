import { useState, useEffect } from 'react'
import { visibleBranches, isBranchLocked } from '../utils/branchScope'

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
  const branchLocked = isBranchLocked(user)
  const managerBranch = branchLocked ? user?.branch_id : null

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
  const [addToAll, setAddToAll] = useState(false)

  const token = localStorage.getItem('token')

  // ✅ تاريخ محلي (مو UTC) عشان يتوافق مع السيرفر
  const today = new Date().toLocaleDateString('en-CA')

  // جلب الفروع
  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        const visible = visibleBranches(user, data || [])
        setBranches(visible)
        if (managerBranch) {
          setSelectedBranch(managerBranch.toString())
        } else if (visible.length > 0 && !selectedBranch) {
          setSelectedBranch(visible[0].id.toString())
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
    const buildBody = (branchId) => JSON.stringify({
      branch_id: parseInt(branchId),
      name: itemForm.name,
      category: itemForm.category,
      unit: itemForm.unit,
      min_quantity: parseFloat(itemForm.min_quantity) || 0,
      current_quantity: parseFloat(itemForm.current_quantity) || 0,
      cost_per_unit: parseFloat(itemForm.cost_per_unit) || 0
    })
    const postHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    try {
      const isEdit = !!editingItem

      // إضافة المادة لكل الفروع دفعة واحدة (للأدمن فقط)
      if (!isEdit && addToAll && branches.length > 1) {
        const results = await Promise.all(branches.map(b =>
          fetch(`${API_URL}/inventory/items`, { method: 'POST', headers: postHeaders, body: buildBody(b.id) })
            .then(async r => ({ ok: r.ok, branch: b.name, message: (await r.json()).message }))
        ))
        const okCount = results.filter(x => x.ok).length
        const failed = results.filter(x => !x.ok)
        if (failed.length === 0) {
          setMessage(`✅ تمت إضافة "${itemForm.name}" إلى ${okCount} فرع`)
        } else {
          setMessage(`⚠️ أُضيفت المادة إلى ${okCount} فرع — فشلت في: ${failed.map(f => f.branch).join('، ')} (${failed[0].message || 'موجودة مسبقاً'})`)
        }
        setItemForm(emptyItemForm)
        setAddToAll(false)
        loadItems()
        return
      }

      const url = isEdit ? `${API_URL}/inventory/items/${editingItem}` : `${API_URL}/inventory/items`
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: postHeaders,
        body: buildBody(selectedBranch)
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
    if (qty <= 0) return { text: 'نفذ 🔴', class: 'bg-ios-red/15 text-ios-red' }
    if (qty <= min * 0.5) return { text: 'حرج 🚨', class: 'bg-ios-red/15 text-ios-red' }
    if (qty <= min) return { text: 'منخفض 🟡', class: 'bg-ios-yellow/25 text-[#B25000]' }
    return { text: 'متوفر ✅', class: 'bg-ios-green/15 text-ios-green' }
  }

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-ios-text tracking-tight">📦 جرد المخزون اليومي</h2>
        {canManage && selectedBranch && (
          <button onClick={() => { setShowManage(!showManage); setEditingItem(null); setItemForm(emptyItemForm) }}
            className="btn-ios-secondary">
            🧾 {showManage ? 'إخفاء إدارة المواد' : 'إدارة المواد'}
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      {/* ✅ اختيار الفرع — مقفل لمدير/موظف الفرع على فرعه */}
      <div className="card-ios p-4 mb-6">
        <label className="label-ios">اختر الفرع</label>
        <select
          value={selectedBranch}
          onChange={e => setSelectedBranch(e.target.value)}
          disabled={branchLocked}
          className="input-ios md:w-80 disabled:opacity-60"
        >
          <option value="">-- اختر الفرع --</option>
          {branches.map(b => (
            <option key={b.id} value={b.id.toString()}>{b.name}</option>
          ))}
        </select>
        {branchLocked && <p className="text-sm text-ios-label mt-1">مقيد على فرعك فقط</p>}
      </div>

      {/* ===== لوحة إدارة المواد ===== */}
      {showManage && canManage && selectedBranch && (
        <div className="bg-ios-blue/10 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold mb-4 text-ios-text">
            {editingItem ? '✏️ تعديل مادة' : '➕ إضافة مادة جديدة'}
          </h3>
          <form onSubmit={handleItemSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">
            <input type="text" placeholder="اسم المادة *" required
              value={itemForm.name}
              onChange={e => setItemForm({...itemForm, name: e.target.value})}
              className="input-ios" />
            <select value={itemForm.category}
              onChange={e => setItemForm({...itemForm, category: e.target.value})}
              className="input-ios">
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={itemForm.unit}
              onChange={e => setItemForm({...itemForm, unit: e.target.value})}
              className="input-ios">
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
              className="input-ios" />
            <input type="number" placeholder="الكمية الحالية" min="0" step="0.01"
              value={itemForm.current_quantity}
              onChange={e => setItemForm({...itemForm, current_quantity: e.target.value})}
              className="input-ios" />
            <div className="flex flex-col gap-2">
              {user?.role === 'admin' && !editingItem && (
                <label className="flex items-center gap-2 text-sm font-semibold text-ios-text cursor-pointer select-none">
                  <input type="checkbox" checked={addToAll} onChange={e => setAddToAll(e.target.checked)}
                    className="w-4 h-4 accent-ios-blue" />
                  🏪 كل الفروع ({branches.length})
                </label>
              )}
              <div className="flex gap-2">
                <button type="submit" className="btn-ios flex-1">
                  {editingItem ? 'حفظ' : 'إضافة'}
                </button>
                {editingItem && (
                  <button type="button" onClick={() => { setEditingItem(null); setItemForm(emptyItemForm) }}
                    className="btn-ios-secondary">
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* قائمة المواد */}
          {items.length === 0 ? (
            <p className="text-ios-label text-center py-4">لا توجد مواد — أضف أول مادة من النموذج أعلاه</p>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F2F2F7]">
                  <tr>
                    <th className="p-3 text-right font-semibold text-ios-label text-xs">المادة</th>
                    <th className="p-3 text-center font-semibold text-ios-label text-xs">الفئة</th>
                    <th className="p-3 text-center font-semibold text-ios-label text-xs">الوحدة</th>
                    <th className="p-3 text-center font-semibold text-ios-label text-xs">الحد الأدنى</th>
                    <th className="p-3 text-center font-semibold text-ios-label text-xs">الكمية</th>
                    <th className="p-3 text-center font-semibold text-ios-label text-xs">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const status = getStatus(item)
                    return (
                      <tr key={item.id} className="border-b border-ios-sep last:border-b-0">
                        <td className="p-3 font-semibold text-ios-text">{item.name}</td>
                        <td className="p-3 text-center text-ios-label">{categories.find(c => c.value === item.category)?.label || item.category}</td>
                        <td className="p-3 text-center text-ios-label">{item.unit || '—'}</td>
                        <td className="p-3 text-center text-ios-label">{item.min_quantity}</td>
                        <td className="p-3 text-center">
                          <span className={`badge-ios ${status.class}`}>{item.current_quantity}</span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => startItemEdit(item)}
                              className="btn-ios-ghost text-xs px-2">✏️ تعديل</button>
                            <button onClick={() => handleItemDelete(item)}
                              className="text-ios-red font-bold text-xs px-2 active:opacity-70">🗑️ حذف</button>
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
        <div className="text-center p-10 text-ios-label">جاري التحميل...</div>
      ) : !selectedBranch ? (
        <div className="text-center p-10 card-ios">
          <p className="text-ios-label">اختر فرعاً لبدء الجرد</p>
        </div>
      ) : todayRecords ? (
        // ✅ تم الجرد
        <div className="card-ios p-6">
          <div className="text-center mb-6">
            <div className="text-6xl mb-2">📤</div>
            <h3 className="text-xl font-bold text-ios-blue">تم إرسال الجرد للإدارة</h3>
            <p className="text-ios-label">في انتظار إدخال المبيعات من قبل الإدارة</p>
            <p className="text-sm text-ios-label mt-1">التاريخ: {today}</p>
          </div>

          <h4 className="font-bold text-lg mb-4 text-ios-text border-b border-ios-sep pb-2">📋 ملخص الجرد المرسل</h4>
          <table className="w-full text-sm">
            <thead className="bg-[#F2F2F7]">
              <tr>
                <th className="p-3 text-right font-semibold text-ios-label text-xs">المادة</th>
                <th className="p-3 text-center font-semibold text-ios-label text-xs">بداية</th>
                <th className="p-3 text-center font-semibold text-ios-label text-xs">وارد</th>
                <th className="p-3 text-center font-semibold text-ios-label text-xs">منصرف</th>
                <th className="p-3 text-center font-semibold text-ios-label text-xs">نهاية</th>
              </tr>
            </thead>
            <tbody>
              {todayRecords.map((rec, idx) => (
                <tr key={idx} className="border-b border-ios-sep last:border-b-0">
                  <td className="p-3 font-semibold text-ios-text">{rec.item_name || items.find(i => i.id === rec.item_id)?.name || '—'}</td>
                  <td className="p-3 text-center">{rec.opening_qty}</td>
                  <td className="p-3 text-center text-ios-green">+{rec.received_qty}</td>
                  <td className="p-3 text-center text-ios-red">-{rec.consumed_qty}</td>
                  <td className="p-3 text-center font-bold">{rec.closing_qty}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 p-4 bg-ios-yellow/20 rounded-2xl text-center">
            <p className="text-[#B25000] font-bold">⏳ في انتظار إدخال المبيعات من الإدارة</p>
            <p className="text-[#B25000]/80 text-sm mt-1">سيتم إشعارك بالفروقات (إن وجدت)</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center p-10 card-ios">
          <div className="text-6xl mb-4">📭</div>
          <div className="text-xl font-bold text-ios-text">لا توجد مواد في هذا الفرع</div>
          {canManage ? (
            <button onClick={() => setShowManage(true)}
              className="btn-ios mt-4">
              🧾 إضافة المواد الآن
            </button>
          ) : (
            <div className="text-ios-label mt-2">تواصل مع الإدارة لإضافة المواد</div>
          )}
        </div>
      ) : (
        // نموذج إدخال الجرد
        <>
          <div className="bg-ios-yellow/20 p-4 rounded-2xl mb-6 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-[#B25000] font-bold">تذكير: أدخل الكميات بدقة</p>
              <p className="text-[#B25000]/80 text-sm">بعد الضغط على "حفظ وإرسال" لا يمكن التعديل إلا من قبل الإدارة</p>
            </div>
          </div>

          <div className="card-ios overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-[#F2F2F7]">
                <tr>
                  <th className="p-4 text-right font-semibold text-ios-label text-xs">المادة</th>
                  <th className="p-4 text-center font-semibold text-ios-label text-xs">الوحدة</th>
                  <th className="p-4 text-center font-semibold text-ios-label text-xs">الحد الأدنى</th>
                  <th className="p-4 text-center font-semibold text-ios-label text-xs">الحالة</th>
                  <th className="p-4 text-center font-semibold text-ios-label text-xs">بداية اليوم</th>
                  <th className="p-4 text-center font-semibold text-ios-label text-xs">وارد</th>
                  <th className="p-4 text-center font-semibold text-ios-label text-xs">منصرف</th>
                  <th className="p-4 text-center font-semibold text-ios-label text-xs">نهاية اليوم</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const status = getStatus(item)
                  const rec = records[item.id] || {}
                  return (
                    <tr key={item.id} className="border-b border-ios-sep last:border-b-0 hover:bg-ios-bg">
                      <td className="p-4 font-semibold text-ios-text">{item.name}</td>
                      <td className="p-4 text-center text-ios-label">{item.unit}</td>
                      <td className="p-4 text-center text-ios-label">{item.min_quantity}</td>
                      <td className="p-4 text-center">
                        <span className={`badge-ios ${status.class}`}>{status.text}</span>
                      </td>
                      <td className="p-4 text-center">
                        <input type="number" value={rec.opening_qty || 0}
                          onChange={e => handleChange(item.id, 'opening_qty', e.target.value)}
                          className="w-20 py-2 rounded-xl bg-[#F2F2F7] text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                      </td>
                      <td className="p-4 text-center">
                        <input type="number" value={rec.received_qty || 0}
                          onChange={e => handleChange(item.id, 'received_qty', e.target.value)}
                          className="w-20 py-2 rounded-xl bg-[#F2F2F7] text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                      </td>
                      <td className="p-4 text-center">
                        <input type="number" value={rec.consumed_qty || 0}
                          onChange={e => handleChange(item.id, 'consumed_qty', e.target.value)}
                          className="w-20 py-2 rounded-xl bg-[#F2F2F7] text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                      </td>
                      <td className="p-4 text-center">
                        <input type="number" value={rec.closing_qty || 0}
                          onChange={e => handleChange(item.id, 'closing_qty', e.target.value)}
                          className="w-20 py-2 rounded-xl bg-[#F2F2F7] text-center font-bold focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="btn-ios w-full md:w-auto text-base disabled:opacity-40">
            {saving ? 'جاري الإرسال...' : '📤 حفظ وإرسال للإدارة'}
          </button>
        </>
      )}
    </div>
  )
}
