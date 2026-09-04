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
      <h2 className="text-2xl font-bold mb-6 text-ios-text tracking-tight">👑 لوحة الإدارة</h2>

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      {selectedBranch ? (
        <div>
          <button onClick={() => { setSelectedBranch(null); setMessage('') }} className="mb-4 btn-ios-ghost">‹ رجوع للقائمة</button>
          <h3 className="text-xl font-bold mb-4 text-ios-text">{selectedBranch.name} - جرد اليوم</h3>

          {inventoryData.length > 0 && (
            <div className="bg-ios-blue/10 p-4 rounded-2xl mb-6">
              <h4 className="font-bold mb-2 text-ios-text">📋 بيانات الجرد المرسلة</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {inventoryData.map(rec => (
                  <div key={rec.id} className="bg-white p-2 rounded-xl">
                    <div className="font-semibold text-ios-text">{rec.item_name}</div>
                    <div className="text-ios-label">نهاية: {rec.closing_qty}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h4 className="font-bold text-lg mb-4 text-ios-text">💰 إدخال مبيعات اليوم</h4>

          {menuItems.length === 0 ? (
            <div className="text-center p-6 bg-ios-yellow/20 rounded-2xl">
              <p className="text-[#B25000] font-bold mb-2">⚠️ لا توجد أصناف مبيعات</p>
              <p className="text-[#B25000]/80 text-sm">أضف الأصناف من صفحة "🛠️ الإدارة العامة"</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {menuItems.map(item => {
                  const sale = sales[item.id] || { quantity_sold: 0 }
                  const total = sale.quantity_sold * item.price
                  return (
                    <div key={item.id} className="card-ios p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-bold text-ios-text">{item.name}</h5>
                        <span className="text-ios-blue font-bold">{item.price} د.ع</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleSalesChange(item.id, (sale.quantity_sold || 0) - 1)}
                          className="w-8 h-8 bg-ios-fill rounded-lg font-bold text-ios-text">−</button>
                        <input type="number" min="0"
                          value={sale.quantity_sold || 0}
                          onChange={e => handleSalesChange(item.id, e.target.value)}
                          className="flex-1 py-2 rounded-xl bg-[#F2F2F7] text-center font-bold focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        <button onClick={() => handleSalesChange(item.id, (sale.quantity_sold || 0) + 1)}
                          className="w-8 h-8 bg-ios-fill rounded-lg font-bold text-ios-text">+</button>
                      </div>
                      {total > 0 && (
                        <div className="mt-2 text-ios-green font-bold text-center">
                          الإجمالي: {total} د.ع
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <button onClick={submitSales} className="btn-ios w-full text-base">
                💾 حفظ المبيعات
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <h3 className="font-bold text-lg mb-4 text-ios-text">📥 جرد بانتظار المراجعة ({submittedBranches.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {branches.map(branch => {
              const hasInventory = submittedBranches.find(s => s.id === branch.id)
              return (
                <div key={branch.id} className={`p-6 rounded-2xl ${hasInventory ? 'bg-ios-green/10' : 'bg-ios-red/10'}`}>
                  <h3 className="font-bold text-lg mb-2 text-ios-text">{branch.name}</h3>
                  <p className="text-ios-label text-sm mb-4">{branch.location}</p>
                  {hasInventory ? (
                    <div className="text-ios-green font-bold mb-3">✅ تم استلام الجرد</div>
                  ) : (
                    <div className="text-ios-red font-bold mb-3">⏳ لم يتم الجرد</div>
                  )}
                  <button onClick={() => viewInventory(branch)} className="btn-ios w-full">
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
