import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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
      <h2 className="text-2xl font-bold mb-6 text-ios-text tracking-tight">💰 جرد المبيعات اليومية</h2>

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-ios p-4">
          <label className="label-ios">الفرع</label>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="input-ios"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="card-ios p-4">
          <label className="label-ios">💳 كردت / فيزا</label>
          <input
            type="number"
            value={paymentCard}
            onChange={e => setPaymentCard(e.target.value)}
            className="input-ios"
          />
        </div>

        <div className="card-ios p-4">
          <label className="label-ios">💵 كاش</label>
          <input
            type="number"
            value={paymentCash}
            onChange={e => setPaymentCash(e.target.value)}
            className="input-ios"
          />
        </div>
      </div>

      <div className="card-ios overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-[#F2F2F7]">
            <tr>
              <th className="p-4 text-right font-semibold text-ios-label text-xs">الصنف</th>
              <th className="p-4 text-center font-semibold text-ios-label text-xs">السعر</th>
              <th className="p-4 text-center font-semibold text-ios-label text-xs">الكمية المباعة</th>
              <th className="p-4 text-center font-semibold text-ios-label text-xs">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map(item => {
              const sale = sales[item.id] || { quantity_sold: 0, unit_price: item.price }
              const total = sale.quantity_sold * sale.unit_price
              return (
                <tr key={item.id} className="border-b border-ios-sep last:border-b-0 hover:bg-ios-bg">
                  <td className="p-4 font-semibold text-ios-text">{item.name}</td>
                  <td className="p-4 text-center text-ios-label">{item.price} دينار</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleChange(item.id, (sale.quantity_sold || 0) - 1)}
                        className="w-8 h-8 bg-ios-fill rounded-lg font-bold text-ios-text active:opacity-70"
                      >−</button>
                      <input
                        type="number"
                        value={sale.quantity_sold || 0}
                        onChange={e => handleChange(item.id, e.target.value)}
                        className="w-16 py-2 rounded-xl bg-[#F2F2F7] text-center font-bold focus:ring-2 focus:ring-ios-blue focus:outline-none"
                      />
                      <button
                        onClick={() => handleChange(item.id, (sale.quantity_sold || 0) + 1)}
                        className="w-8 h-8 bg-ios-fill rounded-lg font-bold text-ios-text active:opacity-70"
                      >+</button>
                    </div>
                  </td>
                  <td className="p-4 text-center font-bold text-ios-blue">{total} دينار
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card-ios p-6 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-ios-blue">{getTotalOrders()}</div>
            <div className="text-sm text-ios-label">عدد القطع</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-ios-green">{getTotalRevenue()} دينار</div>
            <div className="text-sm text-ios-label">إجمالي المبيعات</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-ios-orange">
              {getTotalOrders() > 0 ? Math.round(getTotalRevenue() / getTotalOrders()) : 0} دينار
            </div>
            <div className="text-sm text-ios-label">متوسط الطلب</div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-ios w-full md:w-auto text-base disabled:opacity-40"
      >
        {saving ? 'جاري الحفظ...' : '💾 حفظ المبيعات اليومية'}
      </button>
    </div>
  )
}