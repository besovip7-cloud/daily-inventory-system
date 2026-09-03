import { useState, useEffect } from 'react'

const API_URL = 'https://inventory-api-6lta.onrender.com/api'

export default function AdminPanel() {
  const [branches, setBranches] = useState([])
  const [pendingBranches, setPendingBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [inventoryData, setInventoryData] = useState([])
  const [sales, setSales] = useState({})
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('pending') // pending | items | reports

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
        // التحقق من الفروع اللي ما سوّت جرد اليوم
        checkPending(data)
      })
  }

  const checkPending = async (branchList) => {
    const pending = []
    for (const branch of branchList) {
      try {
        const res = await fetch(`${API_URL}/inventory/daily/${branch.id}?date=${today}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!data || data.length === 0) {
          pending.push(branch)
        }
      } catch (e) {}
    }
    setPendingBranches(pending)
  }

  const viewInventory = (branch) => {
    setSelectedBranch(branch)
    fetch(`${API_URL}/inventory/daily/${branch.id}?date=${today}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setInventoryData(data)
        // تهيئة المبيعات
        const init = {}
        data.forEach(rec => {
          init[rec.item_id] = { quantity_sold: 0, unit_price: 0 }
        })
        setSales(init)
      })
  }

  const handleSalesChange = (itemId, qty) => {
    setSales(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity_sold: parseInt(qty) || 0 }
    }))
  }

  const submitSales = async () => {
    try {
      const records = Object.entries(sales).map(([item_id, data]) => ({
        item_id: parseInt(item_id),
        quantity_sold: data.quantity_sold,
        unit_price: data.unit_price || 0
      })).filter(r => r.quantity_sold > 0)

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
        // هنا نسوي مقارنة ونرسل تنبيهات الفروقات
        compareAndAlert()
      } else {
        setMessage('❌ فشل إدخال المبيعات')
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const compareAndAlert = () => {
    // مقارنة الجرد مع المبيعات وإنشاء تنبيهات بالفروقات
    inventoryData.forEach(rec => {
      const sale = sales[rec.item_id]
      const sold = sale?.quantity_sold || 0
      const expected = rec.closing_qty - sold
      if (expected < 0) {
        // فروقات سلبية (نقص)
        createAlert(selectedBranch.id, rec.item_id, `فروقات: ${Math.abs(expected)} ${rec.unit} ناقصة`)
      } else if (expected > rec.closing_qty * 0.1) {
        // فروقات إيجابية (زيادة غير مبررة)
        createAlert(selectedBranch.id, rec.item_id, `فروقات: ${expected} ${rec.unit} زائدة`)
      }
    })
  }

  const createAlert = async (branchId, itemId, msg) => {
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
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">👑 لوحة الإدارة</h2>

      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      {/* تبويبات */}
      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-bold ${activeTab === 'pending' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          📥 جرد بانتظار المراجعة ({pendingBranches.length})
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
              <button onClick={() => setSelectedBranch(null)} className="mb-4 text-blue-600 font-bold">← رجوع للقائمة</button>
              <h3 className="text-xl font-bold mb-4">{selectedBranch.name} - جرد اليوم</h3>
              
              {inventoryData.length === 0 ? (
                <p>لا يوجد جرد لهذا الفرع اليوم</p>
              ) : (
                <>
                  <table className="w-full text-sm bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-right">المادة</th>
                        <th className="p-3 text-center">بداية</th>
                        <th className="p-3 text-center">وارد</th>
                        <th className="p-3 text-center">منصرف</th>
                        <th className="p-3 text-center">نهاية (الجرد)</th>
                        <th className="p-3 text-center">مبيعات (إدخال)</th>
                        <th className="p-3 text-center">الفرق المتوقع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryData.map(rec => {
                        const sold = sales[rec.item_id]?.quantity_sold || 0
                        const expected = rec.closing_qty - sold
                        return (
                          <tr key={rec.id} className="border-b">
                            <td className="p-3 font-semibold">{rec.item_name}</td>
                            <td className="p-3 text-center">{rec.opening_qty}</td>
                            <td className="p-3 text-center text-green-600">+{rec.received_qty}</td>
                            <td className="p-3 text-center text-red-600">-{rec.consumed_qty}</td>
                            <td className="p-3 text-center font-bold bg-gray-100">{rec.closing_qty}</td>
                            <td className="p-3 text-center">
                              <input type="number" min="0"
                                value={sold}
                                onChange={e => handleSalesChange(rec.item_id, e.target.value)}
                                className="w-20 p-2 border-2 border-blue-200 rounded-lg text-center font-bold text-blue-700 focus:border-blue-500 focus:outline-none" />
                            </td>
                            <td className={`p-3 text-center font-bold ${expected < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {expected}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

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
                const isPending = pendingBranches.find(p => p.id === branch.id)
                return (
                  <div key={branch.id} className={`p-6 rounded-xl shadow-sm border ${isPending ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                    <h3 className="font-bold text-lg mb-2">{branch.name}</h3>
                    <p className="text-gray-500 text-sm mb-4">{branch.location}</p>
                    {isPending ? (
                      <div className="text-red-600 font-bold mb-3">⏳ لم يتم الجرد</div>
                    ) : (
                      <div className="text-green-600 font-bold mb-3">✅ تم استلام الجرد</div>
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
