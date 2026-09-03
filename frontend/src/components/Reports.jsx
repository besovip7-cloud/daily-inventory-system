import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const fmtDate = (d) => d.toISOString().split('T')[0]

export default function Reports({ user }) {
  const token = localStorage.getItem('token')
  const isAdmin = user?.role === 'admin'
  const today = new Date()
  const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7)

  const [branches, setBranches] = useState([])
  const [from, setFrom] = useState(fmtDate(weekAgo))
  const [to, setTo] = useState(fmtDate(today))
  const [selectedBranch, setSelectedBranch] = useState('')
  const [activeTab, setActiveTab] = useState('sales')
  const [comparison, setComparison] = useState([])
  const [sales, setSales] = useState([])
  const [inventory, setInventory] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const authHeaders = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        setBranches(data || [])
        if (data && data.length > 0) setSelectedBranch(String(data[0].id))
      })
      .catch(() => setError('فشل تحميل الفروع'))
  }, [])

  useEffect(() => {
    loadComparison()
  }, [from, to])

  useEffect(() => {
    if (selectedBranch) loadBranchReports()
  }, [selectedBranch, from, to, activeTab])

  const loadComparison = async () => {
    try {
      const res = await fetch(`${API_URL}/reports/comparison?from=${from}&to=${to}`, { headers: authHeaders })
      const data = await res.json()
      setComparison(data || [])
    } catch (e) {
      setError('فشل تحميل مقارنة الفروع')
    }
  }

  const loadBranchReports = async () => {
    setLoading(true)
    setError('')
    try {
      if (activeTab === 'sales') {
        const res = await fetch(`${API_URL}/reports/sales/${selectedBranch}?from=${from}&to=${to}`, { headers: authHeaders })
        setSales(await res.json() || [])
      } else if (activeTab === 'inventory') {
        const res = await fetch(`${API_URL}/reports/inventory/${selectedBranch}?from=${from}&to=${to}`, { headers: authHeaders })
        setInventory(await res.json() || [])
      } else if (activeTab === 'lowstock') {
        const res = await fetch(`${API_URL}/reports/low-stock/${selectedBranch}`, { headers: authHeaders })
        setLowStock(await res.json() || [])
      }
    } catch (e) {
      setError('فشل تحميل التقرير')
    }
    setLoading(false)
  }

  const salesTotal = sales.reduce((sum, r) => sum + parseFloat(r.total_revenue || 0), 0)
  const lowStockLabels = { out_of_stock: 'نفذ', critical: 'حرج', low: 'منخفض' }

  // تعديل/حذف السجلات (للأدمن فقط)
  const [editing, setEditing] = useState(null) // {table: 'sales'|'inventory', id, values: {}}

  const startEdit = (table, record) => {
    setEditing({
      table,
      id: record.id,
      values: table === 'sales'
        ? { quantity_sold: record.quantity_sold, payment_card: record.payment_card, payment_cash: record.payment_cash, notes: record.notes || '' }
        : { opening_qty: record.opening_qty, received_qty: record.received_qty, consumed_qty: record.consumed_qty, closing_qty: record.closing_qty, notes: record.notes || '' }
    })
  }

  const handleEditChange = (field, value) => {
    setEditing(prev => ({ ...prev, values: { ...prev.values, [field]: value } }))
  }

  const saveEdit = async () => {
    const base = editing.table === 'sales' ? 'sales' : 'inventory'
    try {
      const res = await fetch(`${API_URL}/${base}/daily/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editing.values)
      })
      const data = await res.json()
      if (res.ok) {
        setError('')
        setEditing(null)
        loadBranchReports()
        if (editing.table === 'sales') loadComparison()
      } else {
        setError('❌ فشل التعديل: ' + (data.message || ''))
      }
    } catch (e) {
      setError('❌ خطأ في الاتصال')
    }
  }

  const deleteRecord = async (table, record) => {
    const label = table === 'sales' ? `بيع ${record.name}` : `جرد ${record.name}`
    if (!window.confirm(`هل أنت متأكد من حذف سجل "${label}" بتاريخ ${fmtDate(new Date(record.record_date))}؟`)) return
    const base = table === 'sales' ? 'sales' : 'inventory'
    try {
      const res = await fetch(`${API_URL}/${base}/daily/${record.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setEditing(null)
        loadBranchReports()
        if (table === 'sales') loadComparison()
      } else {
        const data = await res.json()
        setError('❌ فشل الحذف: ' + (data.message || ''))
      }
    } catch (e) {
      setError('❌ خطأ في الاتصال')
    }
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">📈 التقارير</h2>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4 font-bold">{error}</div>}

      {/* الفلاتر */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">من تاريخ</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">إلى تاريخ</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">الفرع</label>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
            className="p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none">
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* مقارنة الفروع */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h3 className="text-lg font-bold mb-4">🏪 مقارنة الفروع (المبيعات)</h3>
        {comparison.length > 0 ? (
          <>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branch_name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total_revenue" name="الإيرادات" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {comparison.map(c => (
                <div key={c.branch_name} className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="font-bold text-gray-700">{c.branch_name}</div>
                  <div className="text-blue-600 font-bold text-lg">{parseFloat(c.total_revenue).toFixed(2)} ﷼</div>
                  <div className="text-gray-400 text-sm">{c.total_orders} عملية بيع</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-center py-6">لا توجد مبيعات بهذه الفترة</p>
        )}
      </div>

      {/* تبويبات تقارير الفرع */}
      <div className="flex gap-2 mb-4 border-b">
        <button onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 font-bold ${activeTab === 'sales' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          💰 المبيعات
        </button>
        <button onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 font-bold ${activeTab === 'inventory' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          📦 الجرد
        </button>
        <button onClick={() => setActiveTab('lowstock')}
          className={`px-4 py-2 font-bold ${activeTab === 'lowstock' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          ⚠️ المخزون المنخفض
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center p-10">جاري التحميل...</div>
        ) : activeTab === 'sales' ? (
          sales.length === 0 ? (
            <p className="text-gray-400 text-center py-10">لا توجد مبيعات بهذه الفترة</p>
          ) : (
            <>
              <div className="p-4 bg-blue-50 font-bold text-blue-800">
                إجمالي الإيرادات: {salesTotal.toFixed(2)} ﷼
              </div>
              <table className="w-full text-right">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 font-bold">التاريخ</th>
                    <th className="p-3 font-bold">الصنف</th>
                    <th className="p-3 font-bold">الكمية</th>
                    <th className="p-3 font-bold">الإيراد</th>
                    <th className="p-3 font-bold">شبكة</th>
                    <th className="p-3 font-bold">نقدي</th>
                    {isAdmin && <th className="p-3 font-bold">إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((r, i) => (
                    editing && editing.table === 'sales' && editing.id === r.id ? (
                      <tr key={i} className="border-t border-blue-200 bg-blue-50">
                        <td className="p-3 text-gray-600">{fmtDate(new Date(r.record_date))}</td>
                        <td className="p-3 font-semibold">{r.name}</td>
                        <td className="p-2">
                          <input type="number" min="0" value={editing.values.quantity_sold}
                            onChange={e => handleEditChange('quantity_sold', parseInt(e.target.value) || 0)}
                            className="w-20 p-1 border-2 border-blue-300 rounded text-center" />
                        </td>
                        <td className="p-3 font-bold text-green-600">{parseFloat(r.total_revenue).toFixed(2)} ﷼</td>
                        <td className="p-2">
                          <input type="number" min="0" value={editing.values.payment_card}
                            onChange={e => handleEditChange('payment_card', parseFloat(e.target.value) || 0)}
                            className="w-20 p-1 border-2 border-blue-300 rounded text-center" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" value={editing.values.payment_cash}
                            onChange={e => handleEditChange('payment_cash', parseFloat(e.target.value) || 0)}
                            className="w-20 p-1 border-2 border-blue-300 rounded text-center" />
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <button onClick={saveEdit} className="bg-green-600 text-white px-3 py-1 rounded font-bold text-sm">حفظ</button>
                            <button onClick={() => setEditing(null)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded font-bold text-sm">إلغاء</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-3 text-gray-600">{fmtDate(new Date(r.record_date))}</td>
                        <td className="p-3 font-semibold">{r.name}</td>
                        <td className="p-3">{r.quantity_sold}</td>
                        <td className="p-3 font-bold text-green-600">{parseFloat(r.total_revenue).toFixed(2)} ﷼</td>
                        <td className="p-3">{parseFloat(r.payment_card).toFixed(2)}</td>
                        <td className="p-3">{parseFloat(r.payment_cash).toFixed(2)}</td>
                        {isAdmin && (
                          <td className="p-2">
                            <div className="flex gap-1">
                              <button onClick={() => startEdit('sales', r)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded font-bold text-sm hover:bg-blue-200">✏️</button>
                              <button onClick={() => deleteRecord('sales', r)} className="bg-red-100 text-red-700 px-3 py-1 rounded font-bold text-sm hover:bg-red-200">🗑️</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </>
          )
        ) : activeTab === 'inventory' ? (
          inventory.length === 0 ? (
            <p className="text-gray-400 text-center py-10">لا توجد سجلات جرد بهذه الفترة</p>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 font-bold">التاريخ</th>
                  <th className="p-3 font-bold">المادة</th>
                  <th className="p-3 font-bold">افتتاحي</th>
                  <th className="p-3 font-bold">مستلم</th>
                  <th className="p-3 font-bold">مستهلك</th>
                  <th className="p-3 font-bold">ختامي</th>
                  {isAdmin && <th className="p-3 font-bold">إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {inventory.map((r, i) => (
                  editing && editing.table === 'inventory' && editing.id === r.id ? (
                    <tr key={i} className="border-t border-blue-200 bg-blue-50">
                      <td className="p-3 text-gray-600">{fmtDate(new Date(r.record_date))}</td>
                      <td className="p-3 font-semibold">{r.name} <span className="text-gray-400 text-sm">({r.unit})</span></td>
                      {['opening_qty', 'received_qty', 'consumed_qty', 'closing_qty'].map(field => (
                        <td className="p-2" key={field}>
                          <input type="number" value={editing.values[field]}
                            onChange={e => handleEditChange(field, parseFloat(e.target.value) || 0)}
                            className="w-20 p-1 border-2 border-blue-300 rounded text-center" />
                        </td>
                      ))}
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="bg-green-600 text-white px-3 py-1 rounded font-bold text-sm">حفظ</button>
                          <button onClick={() => setEditing(null)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded font-bold text-sm">إلغاء</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="p-3 text-gray-600">{fmtDate(new Date(r.record_date))}</td>
                      <td className="p-3 font-semibold">{r.name} <span className="text-gray-400 text-sm">({r.unit})</span></td>
                      <td className="p-3">{r.opening_qty}</td>
                      <td className="p-3">{r.received_qty}</td>
                      <td className="p-3">{r.consumed_qty}</td>
                      <td className="p-3 font-bold">{r.closing_qty}</td>
                      {isAdmin && (
                        <td className="p-2">
                          <div className="flex gap-1">
                            <button onClick={() => startEdit('inventory', r)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded font-bold text-sm hover:bg-blue-200">✏️</button>
                            <button onClick={() => deleteRecord('inventory', r)} className="bg-red-100 text-red-700 px-3 py-1 rounded font-bold text-sm hover:bg-red-200">🗑️</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )
        ) : (
          lowStock.length === 0 ? (
            <p className="text-green-600 text-center py-10 font-bold">✅ كل الأصناف فوق الحد الأدنى</p>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 font-bold">المادة</th>
                  <th className="p-3 font-bold">الكمية الحالية</th>
                  <th className="p-3 font-bold">الحد الأدنى</th>
                  <th className="p-3 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-3 font-semibold">{r.name} <span className="text-gray-400 text-sm">({r.unit})</span></td>
                    <td className="p-3 font-bold">{r.current_quantity}</td>
                    <td className="p-3">{r.min_quantity}</td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        r.status === 'out_of_stock' ? 'bg-red-200 text-red-800' :
                        r.status === 'critical' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {lowStockLabels[r.status] || r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
