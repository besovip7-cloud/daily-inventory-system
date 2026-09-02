import { useState, useEffect } from 'react'

const API_URL = 'https://inventory-api-6lta.onrender.com/api'

export default function Sales() {
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [menuItems, setMenuItems] = useState([])
  const [sales, setSales] = useState({})
  const [paymentCard, setPaymentCard] = useState(0)
  const [paymentCash, setPaymentCash] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setBranches(data)
        if (data.length > 0) setSelectedBranch(data[0].id)
      })
  }, [])

  useEffect(() => {
    fetch(`${API_URL}/sales/menu`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setMenuItems(data)
        const init = {}
        data.forEach(item => {
          init[item.id] = { item_id: item.id, quantity_sold: 0, unit_price: item.price }
        })
        setSales(init)
      })
  }, [])

  const handleChange = (itemId, quantity) => {
    setSales(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity_sold: parseInt(quantity) || 0 }
    }))
  }

  const getTotalRevenue = () => {
    return Object.values(sales).reduce((sum, s) => sum + (s.quantity_sold * s.unit_price), 0)
  }

  const getTotalOrders = () => {
    return Object.values(sales).reduce((sum, s) => sum + s.quantity_sold, 0)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        branch_id: parseInt(selectedBranch),
        records: Object.values(sales).filter(s => s.quantity_sold > 0),
        payment_card: parseFloat(paymentCard) || 0,
        payment_cash: parseFloat(paymentCash) || 0
      }
      const res = await fetch(`${API_URL}/sales/daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('✅ تم حفظ المبيعات بنجاح!')
      } else {
        setMessage('❌ خطأ: ' + (data.message || 'فشل الحفظ'))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
    setSaving(false)
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">💰 جرد المبيعات اليومية</h2>

      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-2">الفرع</label>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-2">💳 كردت / فيزا</label>
          <input
            type="number"
            value={paymentCard}
            onChange={e => setPaymentCard(e.target.value)}
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-2">💵 كاش</label>
          <input
            type="number"
            value={paymentCash}
            onChange={e => setPaymentCash(e.target.value)}
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 text-right font-semibold text-gray-600">الصنف</th>
              <th className="p-4 text-center font-semibold text-gray-600">السعر</th>
              <th className="p-4 text-center font-semibold text-gray-600">الكمية المباعة</th>
              <th className="p-4 text-center font-semibold text-gray-600">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map(item => {
              const sale = sales[item.id] || { quantity_sold: 0, unit_price: item.price }
              const total = sale.quantity_sold * sale.unit_price
              return (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-semibold text-gray-900">{item.name}</td>
                  <td className="p-4 text-center text-gray-600">{item.price} دينار</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleChange(item.id, (sale.quantity_sold || 0) - 1)}
                        className="w-8 h-8 bg-gray-100 rounded-lg font-bold hover:bg-gray-200"
                      >−</button>
                      <input
                        type="number"
                        value={sale.quantity_sold || 0}
                        onChange={e => handleChange(item.id, e.target.value)}
                        className="w-16 p-2 border-2 border-gray-200 rounded-lg text-center font-bold focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleChange(item.id, (sale.quantity_sold || 0) + 1)}
                        className="w-8 h-8 bg-gray-100 rounded-lg font-bold hover:bg-gray-200"
                      >+</button>
                    </div>
                  </td>
                  <td className="p-4 text-center font-bold text-blue-600">{total} دينار
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-blue-600">{getTotalOrders()}</div>
            <div className="text-sm text-gray-600">عدد القطع</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-600">{getTotalRevenue()} دينار</div>
            <div className="text-sm text-gray-600">إجمالي المبيعات</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-purple-600">
              {getTotalOrders() > 0 ? Math.round(getTotalRevenue() / getTotalOrders()) : 0} دينار
            </div>
            <div className="text-sm text-gray-600">متوسط الطلب</div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full md:w-auto bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition disabled:bg-gray-400"
      >
        {saving ? 'جاري الحفظ...' : '💾 حفظ المبيعات اليومية'}
      </button>
    </div>
  )
}