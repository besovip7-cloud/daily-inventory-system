import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function AdminPanel() {
  const [branches, setBranches] = useState([])
  const [submittedBranches, setSubmittedBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [inventoryData, setInventoryData] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [sales, setSales] = useState({})
  const [message, setMessage] = useState('')
  const [loadingMenu, setLoadingMenu] = useState(false)

  const token = localStorage.getItem('token')
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadBranches()
    loadMenuItems()
  }, [])

  const loadBranches = () => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setBranches(data)
        checkSubmitted(data)
      })
  }

  const loadMenuItems = () => {
    setLoadingMenu(true)
    fetch(`${API_URL}/sales/menu`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setMenuItems(data || [])
        setLoadingMenu(false)
      })
      .catch(() => setLoadingMenu(false))
  }

  const checkSubmitted = async (branchList) => {
    const submitted = []
    for (const branch of branchList) {
      try {
        const res = await fetch(`${API_URL}/inventory/daily/${branch.id}?date=${today}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (data && data.length > 0) {
          submitted.push(branch)
        }
      } catch (e) {}
    }
    setSubmittedBranches(submitted)
  }

  const viewInventory = async (branch) => {
    setSelectedBranch(branch)
    setInventoryData([])
    setSales({})
    setMessage('')

    try {
      const invRes = await fetch(`${API_URL}/inventory/daily/${branch.id}?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const invData = await invRes.json()
      setInventoryData(invData || [])

      // تهيئة المبيعات من الأصناف الموجودة
      const init = {}
      menuItems.forEach(item => {
        init[item.id] = { item_id: item.id, quantity_sold: 0, unit_price: item.price }
      })
      setSales(init)

    } catch (err) {
      console.error(err)
      setMessage('❌ خطأ في جلب البيانات')
    }
  }

  const handleSalesChange = (itemId, qty) => {
    setSales(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity_sold: parseInt(qty) || 0 }
    }))
  }

  const submitSales = async () => {
    try {
      const records = Object.values(sales)
        .filter(s => s.quantity_sold > 0)
        .map(s => ({
          item_id: s.item_id,
          quantity_sold: s.quantity_sold,
          unit_price: s.unit_price
        }))

      if (records.length === 0) {
        setMessage('❌ أدخل كمية مبيعات أولاً')
        return
      }

      const payload = {
        branch_id: selectedBranch.id,
        records,
        payment_card: 0,
        payment_cash: 0
      }

      const res = await fetch(`${API_URL}/sales/daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setMessage('✅ تم إدخال المبيعات بنجاح!')
      } else {
        const data = await res.json()
        setMessage('❌ فشل إدخال المبيعات: ' + (data.message || ''))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">👑 لوحة الإدارة</h2>

      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      {selectedBranch ? (
        <div>
          <button onClick={() => { setSelectedBranch(null); setMessage('') }} className="mb-4 text-blue-600 font-bold">← رجوع للقائمة</button>
          <h3 className="text-xl font-bold mb-4">{selectedBranch.name} - جرد اليوم</h3>

          {inventoryData.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h4 className="font-bold mb-2">📋 بيانات الجرد المرسلة</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {inventoryData.map(rec => (
                  <div key={rec.id} className="bg-white p-2 rounded">
                    <div className="font-semibold">{rec.item_name}</div>
                    <div className="text-gray-600">نهاية: {rec.closing_qty}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h4 className="font-bold text-lg mb-4">💰 إدخال مبيعات اليوم</h4>

          {menuItems.length === 0 ? (
            <div className="text-center p-6 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-yellow-800 font-bold mb-2">⚠️ لا توجد أصناف مبيعات</p>
              <p className="text-yellow-700 text-sm">أضف الأصناف من صفحة "🛠️ الإدارة العامة"</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {menuItems.map(item => {
                  const sale = sales[item.id] || { quantity_sold: 0 }
                  const total = sale.quantity_sold * item.price
                  return (
                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-bold">{item.name}</h5>
                        <span className="text-blue-600 font-bold">{item.price} د.ع</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleSalesChange(item.id, (sale.quantity_sold || 0) - 1)}
                          className="w-8 h-8 bg-gray-100 rounded-lg font-bold">−</button>
                        <input type="number" min="0"
                          value={sale.quantity_sold || 0}
                          onChange={e => handleSalesChange(item.id, e.target.value)}
                          className="flex-1 p-2 border-2 border-gray-200 rounded-lg text-center font-bold" />
                        <button onClick={() => handleSalesChange(item.id, (sale.quantity_sold || 0) + 1)}
                          className="w-8 h-8 bg-gray-100 rounded-lg font-bold">+</button>
                      </div>
                      {total > 0 && (
                        <div className="mt-2 text-green-600 font-bold text-center">
                          الإجمالي: {total} د.ع
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <button onClick={submitSales}
                className="w-full bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition">
                💾 حفظ المبيعات
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <h3 className="font-bold text-lg mb-4">📥 جرد بانتظار المراجعة ({submittedBranches.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {branches.map(branch => {
              const hasInventory = submittedBranches.find(s => s.id === branch.id)
              return (
                <div key={branch.id} className={`p-6 rounded-xl shadow-sm border ${hasInventory ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <h3 className="font-bold text-lg mb-2">{branch.name}</h3>
                  <p className="text-gray-500 text-sm mb-4">{branch.location}</p>
                  {hasInventory ? (
                    <div className="text-green-600 font-bold mb-3">✅ تم استلام الجرد</div>
                  ) : (
                    <div className="text-red-600 font-bold mb-3">⏳ لم يتم الجرد</div>
                  )}
                  <button onClick={() => viewInventory(branch)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition">
                    عرض / إدخال مبيعات
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
