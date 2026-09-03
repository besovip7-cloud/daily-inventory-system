import { useState, useEffect } from 'react'

const API_URL = 'https://inventory-api-6lta.onrender.com/api'

export default function AdminPanel() {
  const [branches, setBranches] = useState([])
  const [submittedBranches, setSubmittedBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [inventoryData, setInventoryData] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [sales, setSales] = useState({})
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('pending')

  const token = localStorage.getItem('token')
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadBranches()
  }, [])

  const loadBranches = () => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setBranches(data)
        checkSubmitted(data)
      })
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
    setMenuItems([])
    setSales({})
    setMessage('')
    
    try {
      // جلب بيانات الجرد (للعرض)
      const invRes = await fetch(`${API_URL}/inventory/daily/${branch.id}?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const invData = await invRes.json()
      setInventoryData(invData || [])
      
      // ✅ جلب أصناف المبيعات (Menu Items)
      const menuRes = await fetch(`${API_URL}/sales/menu`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const menuData = await menuRes.json()
      setMenuItems(menuData || [])
      
      // تهيئة المبيعات
      const init = {}
      menuData.forEach(item => {
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
        // مقارنة الفروقات
        compareAndAlert()
      } else {
        const data = await res.json()
        setMessage('❌ فشل إدخال المبيعات: ' + (data.message || ''))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const compareAndAlert = async () => {
    // مقارنة الجرد مع المبيعات
    for (const rec of inventoryData) {
      // هنا المنطق يعتمد على وصفة (recipe) لكل صنف
      // بشكل مبسط: إذا المخزون أقل من المبيعات × 2 (مثال)
      const saleQty = sales[rec.item_id]?.quantity_sold || 0
      if (saleQty > rec.closing_qty) {
        await createAlert(selectedBranch.id, rec.item_id, 
          `فروقات: المبيعات (${saleQty}) أكثر من المخزون (${rec.closing_qty})`)
      }
    }
  }

  const createAlert = async (branchId, itemId, msg) => {
    try {
      await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          branch_id: branchId,
          item_id: itemId,
          alert_type: 'warning',
          title: '⚠️ فروقات في الجرد',
          message: msg
        })
      })
    } catch (e) {}
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">👑 لوحة الإدارة</h2>

      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-bold ${activeTab === 'pending' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          📥 جرد بانتظار المراجعة ({submittedBranches.length})
        </button>
        <button onClick={() => setActiveTab('items')}
          className={`px-4 py-2 font-bold ${activeTab === 'items' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          📦 إدارة المواد
        </button>
        <button onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 font-bold ${activeTab === 'reports' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          📊 التقارير
        </button>
      </div>

      {activeTab === 'pending' && (
        <div>
          {selectedBranch ? (
            <div>
              <button onClick={() => { setSelectedBranch(null); setMessage('') }} className="mb-4 text-blue-600 font-bold">← رجوع للقائمة</button>
              <h3 className="text-xl font-bold mb-4">{selectedBranch.name} - جرد اليوم</h3>
              
              {/* عرض بيانات الجرد */}
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

              {/* ✅ إدخال المبيعات (من Menu Items) */}
              <h4 className="font-bold text-lg mb-4">💰 إدخال مبيعات اليوم</h4>
              {menuItems.length === 0 ? (
                <p>جاري تحميل الأصناف...</p>
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
                            <span className="text-blue-600 font-bold">{item.price} ﷼</span>
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
                              الإجمالي: {total} ﷼
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <button onClick={submitSales}
                    className="w-full bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition">
                    💾 حفظ المبيعات وإرسال الفروقات
                  </button>
                </>
              )}
            </div>
          ) : (
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
          )}
        </div>
      )}

      {activeTab === 'items' && (
        <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-gray-500">إدارة المواد من صفحة "جرد المخزون" ← اختر الفرع ← إضافة مادة</p>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-500">التقارير قريباً...</p>
        </div>
      )}
    </div>
  )
}