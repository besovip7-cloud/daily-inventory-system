import { useState, useEffect } from 'react'

const API_URL = 'https://inventory-api-6lta.onrender.com/api'

export default function Inventory() {
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [items, setItems] = useState([])
  const [todayRecords, setTodayRecords] = useState(null)
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const today = new Date().toISOString().split('T')[0]

  const myBranchId = user.branch_id

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setBranches(data)
        if (myBranchId) {
          setSelectedBranch(myBranchId.toString())
        } else if (data.length > 0) {
          setSelectedBranch(data[0].id.toString())
        }
      })
  }, [])

  const loadData = () => {
    if (!selectedBranch) return
    setLoading(true)
    
    fetch(`${API_URL}/inventory/items/${selectedBranch}`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setItems(data)
        return fetch(`${API_URL}/inventory/daily/${selectedBranch}?date=${today}`, { 
          headers: { Authorization: `Bearer ${token}` }
        })
      })
      .then(r => r.json())
      .then(dailyData => {
        if (dailyData && dailyData.length > 0) {
          setTodayRecords(dailyData)
          setRecords({})
        } else {
          setTodayRecords(null)
          // ✅ الخطأ كان هنا: استخدمنا items بدل data
          // الحل: نستخدم data اللي رجعت من الـ API مباشرة
          // بس لأن setItems غيرتها، نبني من data اللي عندنا
          // نعيد جلبها أو نستخدم items الحالية
          const init = {}
          items.forEach(item => {
            init[item.id] = {
              item_id: item.id,
              opening_qty: item.current_quantity || 0,
              received_qty: 0,
              consumed_qty: 0,
              closing_qty: item.current_quantity || 0,
              notes: ''
            }
          })
          setRecords(init)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [selectedBranch])

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
      // ❌ شيل: record_date: today
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
        loadData()
      } else {
        setMessage('❌ خطأ: ' + (data.message || 'فشل الحفظ'))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
    setSaving(false)
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
      <h2 className="text-2xl font-bold mb-6 text-gray-900">📦 جرد المخزون اليومي</h2>

      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-sm text-gray-500">الفرع:</span>
            <span className="font-bold text-gray-900 mr-2">
              {branches.find(b => b.id == selectedBranch)?.name || '—'}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-500">التاريخ:</span>
            <span className="font-bold text-gray-900 mr-2">{today}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-10">جاري التحميل...</div>
      ) : todayRecords ? (
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
              {todayRecords.map(rec => (
                <tr key={rec.id} className="border-b border-gray-100">
                  <td className="p-3 font-semibold">{rec.item_name || '—'}</td>
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
          <div className="text-gray-500">تواصل مع الإدارة لإضافة المواد</div>
        </div>
      ) : (
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