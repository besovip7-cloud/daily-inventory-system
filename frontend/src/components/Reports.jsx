import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { exportToExcel, printReport } from '../utils/export'

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
  const [movements, setMovements] = useState([])
  const [variance, setVariance] = useState([])
  const [varianceDate, setVarianceDate] = useState(fmtDate(today))
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

  useEffect(() => {
    if (selectedBranch && activeTab === 'variance') loadVariance()
  }, [selectedBranch, varianceDate])

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
      } else if (activeTab === 'movements') {
        const res = await fetch(`${API_URL}/reports/movements/${selectedBranch}?from=${from}&to=${to}`, { headers: authHeaders })
        setMovements(await res.json() || [])
      }
    } catch (e) {
      setError('فشل تحميل التقرير')
    }
    setLoading(false)
  }

  const loadVariance = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/reports/variance/${selectedBranch}?date=${varianceDate}`, { headers: authHeaders })
      setVariance(await res.json() || [])
    } catch (e) {
      setError('فشل تحميل الفروقات')
    }
    setLoading(false)
  }

  const salesTotal = sales.reduce((sum, r) => sum + parseFloat(r.total_revenue || 0), 0)
  const lowStockLabels = { out_of_stock: 'نفذ', critical: 'حرج', low: 'منخفض' }

  const branchName = branches.find(b => String(b.id) === selectedBranch)?.name || ''

  const reportConfig = () => ({
    sales: {
      title: 'تقرير المبيعات',
      filename: `مبيعات_${branchName}_${from}_${to}`,
      columns: [
        { key: 'record_date', label: 'التاريخ' },
        { key: 'name', label: 'الصنف' },
        { key: 'quantity_sold', label: 'الكمية' },
        { key: 'total_revenue', label: 'الإيراد (د.ع)' },
        { key: 'payment_card', label: 'شبكة (د.ع)' },
        { key: 'payment_cash', label: 'نقدي (د.ع)' },
      ],
      rows: sales.map(r => ({
        ...r,
        record_date: fmtDate(new Date(r.record_date)),
        total_revenue: parseFloat(r.total_revenue).toFixed(2),
        payment_card: parseFloat(r.payment_card).toFixed(2),
        payment_cash: parseFloat(r.payment_cash).toFixed(2),
      })),
      totals: [{ label: 'إجمالي الإيرادات', value: `${salesTotal.toFixed(2)} د.ع` }],
    },
    inventory: {
      title: 'تقرير الجرد',
      filename: `جرد_${branchName}_${from}_${to}`,
      columns: [
        { key: 'record_date', label: 'التاريخ' },
        { key: 'name', label: 'المادة' },
        { key: 'unit', label: 'الوحدة' },
        { key: 'opening_qty', label: 'افتتاحي' },
        { key: 'received_qty', label: 'مستلم' },
        { key: 'consumed_qty', label: 'مستهلك' },
        { key: 'closing_qty', label: 'ختامي' },
      ],
      rows: inventory.map(r => ({ ...r, record_date: fmtDate(new Date(r.record_date)) })),
      totals: [],
    },
    lowstock: {
      title: 'تقرير المخزون المنخفض',
      filename: `مخزون_منخفض_${branchName}`,
      columns: [
        { key: 'name', label: 'المادة' },
        { key: 'unit', label: 'الوحدة' },
        { key: 'current_quantity', label: 'الكمية الحالية' },
        { key: 'min_quantity', label: 'الحد الأدنى' },
        { key: 'status', label: 'الحالة' },
      ],
      rows: lowStock.map(r => ({ ...r, status: lowStockLabels[r.status] || r.status })),
      totals: [],
    },
    movements: {
      title: 'سجل حركات المخزون',
      filename: `حركات_${branchName}_${from}_${to}`,
      columns: [
        { key: 'created_at', label: 'الوقت' },
        { key: 'item_name', label: 'المادة' },
        { key: 'unit', label: 'الوحدة' },
        { key: 'quantity', label: 'الكمية' },
        { key: 'balance_before', label: 'قبل' },
        { key: 'balance_after', label: 'بعد' },
        { key: 'reference', label: 'البيان' },
        { key: 'created_by_name', label: 'المستخدم' },
      ],
      rows: movements.map(m => ({
        ...m,
        created_at: new Date(m.created_at).toLocaleString('ar'),
        reference: m.reference || '—',
        created_by_name: m.created_by_name || '—',
      })),
      totals: [],
    },
    variance: {
      title: `تقرير فروقات الجرد بتاريخ ${varianceDate}`,
      filename: `فروقات_${branchName}_${varianceDate}`,
      columns: [
        { key: 'name', label: 'المادة' },
        { key: 'unit', label: 'الوحدة' },
        { key: 'opening_qty', label: 'افتتاحي' },
        { key: 'received_qty', label: 'وارد' },
        { key: 'recipe_deductions', label: 'خصم الوصفات' },
        { key: 'expected', label: 'المتوقع' },
        { key: 'closing_qty', label: 'الفعلي (الختامي)' },
        { key: 'variance', label: 'الفرق' },
      ],
      rows: variance.map(r => ({ ...r, recipe_deductions: parseFloat(r.recipe_deductions).toFixed(3) })),
      totals: [],
    },
  })

  const activeConfig = reportConfig()[activeTab]

  const handleExportExcel = () => {
    if (!activeConfig || activeConfig.rows.length === 0) return
    exportToExcel({
      filename: activeConfig.filename,
      sheetName: activeConfig.title.slice(0, 31),
      columns: activeConfig.columns,
      rows: activeConfig.rows,
      totals: activeConfig.totals,
    })
  }

  const handlePrint = () => {
    if (!activeConfig || activeConfig.rows.length === 0) return
    const subtitle = activeTab === 'variance'
      ? `الفرع: ${branchName} • بتاريخ ${varianceDate}`
      : activeTab === 'lowstock'
        ? `الفرع: ${branchName}`
        : `الفرع: ${branchName} • من ${from} إلى ${to}`
    printReport({
      title: activeConfig.title,
      subtitle,
      columns: activeConfig.columns,
      rows: activeConfig.rows,
      totals: activeConfig.totals,
    })
  }

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
      <h2 className="text-2xl font-bold mb-6 text-ios-text tracking-tight">📈 التقارير</h2>

      {error && <div className="bg-ios-red/10 text-ios-red p-4 rounded-2xl mb-4 font-bold">{error}</div>}

      {/* الفلاتر */}
      <div className="card-ios p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label-ios">من تاريخ</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="input-ios" />
        </div>
        <div>
          <label className="label-ios">إلى تاريخ</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="input-ios" />
        </div>
        <div>
          <label className="label-ios">الفرع</label>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
            className="input-ios">
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* مقارنة الفروع */}
      <div className="card-ios p-6 mb-6">
        <h3 className="text-lg font-bold mb-4 text-ios-text">🏪 مقارنة الفروع (المبيعات)</h3>
        {comparison.length > 0 ? (
          <>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branch_name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total_revenue" name="الإيرادات" fill="#007AFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {comparison.map(c => (
                <div key={c.branch_name} className="bg-ios-bg p-4 rounded-xl text-center">
                  <div className="font-bold text-ios-text">{c.branch_name}</div>
                  <div className="text-ios-blue font-bold text-lg">{parseFloat(c.total_revenue).toFixed(2)} د.ع</div>
                  <div className="text-ios-label text-sm">{c.total_orders} عملية بيع</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-ios-label text-center py-6">لا توجد مبيعات بهذه الفترة</p>
        )}
      </div>

      {/* تبويبات تقارير الفرع */}
      <div className="segmented mb-4">
        <button onClick={() => setActiveTab('sales')}
          className={`segmented-item ${activeTab === 'sales' ? 'segmented-item-active' : ''}`}>
          💰 المبيعات
        </button>
        <button onClick={() => setActiveTab('inventory')}
          className={`segmented-item ${activeTab === 'inventory' ? 'segmented-item-active' : ''}`}>
          📦 الجرد
        </button>
        <button onClick={() => setActiveTab('lowstock')}
          className={`segmented-item ${activeTab === 'lowstock' ? 'segmented-item-active' : ''}`}>
          ⚠️ المخزون المنخفض
        </button>
        <button onClick={() => setActiveTab('movements')}
          className={`segmented-item ${activeTab === 'movements' ? 'segmented-item-active' : ''}`}>
          📜 الحركات
        </button>
        <button onClick={() => setActiveTab('variance')}
          className={`segmented-item ${activeTab === 'variance' ? 'segmented-item-active' : ''}`}>
          ⚖️ الفروقات
        </button>
      </div>

      <div className="card-ios overflow-hidden">
        {activeConfig && activeConfig.rows.length > 0 && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-ios-sep bg-[#F9F9FB]">
            <span className="font-bold text-ios-text text-sm">{activeConfig.title}</span>
            <div className="flex gap-2">
              <button onClick={handleExportExcel} className="btn-ios-secondary text-xs px-3 py-1.5">📊 Excel</button>
              <button onClick={handlePrint} className="btn-ios-secondary text-xs px-3 py-1.5">🖨️ طباعة / PDF</button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="text-center p-10 text-ios-label">جاري التحميل...</div>
        ) : activeTab === 'sales' ? (
          sales.length === 0 ? (
            <p className="text-ios-label text-center py-10">لا توجد مبيعات بهذه الفترة</p>
          ) : (
            <>
              <div className="p-4 bg-ios-blue/10 font-bold text-ios-blue">
                إجمالي الإيرادات: {salesTotal.toFixed(2)} د.ع
              </div>
              <table className="w-full text-right">
                <thead className="bg-[#F2F2F7]">
                  <tr>
                    <th className="p-3 font-bold text-ios-label text-xs">التاريخ</th>
                    <th className="p-3 font-bold text-ios-label text-xs">الصنف</th>
                    <th className="p-3 font-bold text-ios-label text-xs">الكمية</th>
                    <th className="p-3 font-bold text-ios-label text-xs">الإيراد</th>
                    <th className="p-3 font-bold text-ios-label text-xs">شبكة</th>
                    <th className="p-3 font-bold text-ios-label text-xs">نقدي</th>
                    {isAdmin && <th className="p-3 font-bold text-ios-label text-xs">إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((r, i) => (
                    editing && editing.table === 'sales' && editing.id === r.id ? (
                      <tr key={i} className="border-t border-ios-sep bg-ios-blue/10">
                        <td className="p-3 text-ios-label">{fmtDate(new Date(r.record_date))}</td>
                        <td className="p-3 font-semibold text-ios-text">{r.name}</td>
                        <td className="p-2">
                          <input type="number" min="0" value={editing.values.quantity_sold}
                            onChange={e => handleEditChange('quantity_sold', parseInt(e.target.value) || 0)}
                            className="w-20 py-1.5 rounded-xl bg-white text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        </td>
                        <td className="p-3 font-bold text-ios-green">{parseFloat(r.total_revenue).toFixed(2)} د.ع</td>
                        <td className="p-2">
                          <input type="number" min="0" value={editing.values.payment_card}
                            onChange={e => handleEditChange('payment_card', parseFloat(e.target.value) || 0)}
                            className="w-20 py-1.5 rounded-xl bg-white text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" value={editing.values.payment_cash}
                            onChange={e => handleEditChange('payment_cash', parseFloat(e.target.value) || 0)}
                            className="w-20 py-1.5 rounded-xl bg-white text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <button onClick={saveEdit} className="btn-ios text-xs px-3 py-1.5">حفظ</button>
                            <button onClick={() => setEditing(null)} className="btn-ios-secondary text-xs px-3 py-1.5">إلغاء</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={i} className="border-t border-ios-sep">
                        <td className="p-3 text-ios-label">{fmtDate(new Date(r.record_date))}</td>
                        <td className="p-3 font-semibold text-ios-text">{r.name}</td>
                        <td className="p-3">{r.quantity_sold}</td>
                        <td className="p-3 font-bold text-ios-green">{parseFloat(r.total_revenue).toFixed(2)} د.ع</td>
                        <td className="p-3">{parseFloat(r.payment_card).toFixed(2)}</td>
                        <td className="p-3">{parseFloat(r.payment_cash).toFixed(2)}</td>
                        {isAdmin && (
                          <td className="p-2">
                            <div className="flex gap-1">
                              <button onClick={() => startEdit('sales', r)} className="text-ios-blue font-bold text-sm px-2 active:opacity-70">✏️</button>
                              <button onClick={() => deleteRecord('sales', r)} className="text-ios-red font-bold text-sm px-2 active:opacity-70">🗑️</button>
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
            <p className="text-ios-label text-center py-10">لا توجد سجلات جرد بهذه الفترة</p>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-[#F2F2F7]">
                <tr>
                  <th className="p-3 font-bold text-ios-label text-xs">التاريخ</th>
                  <th className="p-3 font-bold text-ios-label text-xs">المادة</th>
                  <th className="p-3 font-bold text-ios-label text-xs">افتتاحي</th>
                  <th className="p-3 font-bold text-ios-label text-xs">مستلم</th>
                  <th className="p-3 font-bold text-ios-label text-xs">مستهلك</th>
                  <th className="p-3 font-bold text-ios-label text-xs">ختامي</th>
                  {isAdmin && <th className="p-3 font-bold text-ios-label text-xs">إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {inventory.map((r, i) => (
                  editing && editing.table === 'inventory' && editing.id === r.id ? (
                    <tr key={i} className="border-t border-ios-sep bg-ios-blue/10">
                      <td className="p-3 text-ios-label">{fmtDate(new Date(r.record_date))}</td>
                      <td className="p-3 font-semibold text-ios-text">{r.name} <span className="text-ios-label text-sm">({r.unit})</span></td>
                      {['opening_qty', 'received_qty', 'consumed_qty', 'closing_qty'].map(field => (
                        <td className="p-2" key={field}>
                          <input type="number" value={editing.values[field]}
                            onChange={e => handleEditChange(field, parseFloat(e.target.value) || 0)}
                            className="w-20 py-1.5 rounded-xl bg-white text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        </td>
                      ))}
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="btn-ios text-xs px-3 py-1.5">حفظ</button>
                          <button onClick={() => setEditing(null)} className="btn-ios-secondary text-xs px-3 py-1.5">إلغاء</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={i} className="border-t border-ios-sep">
                      <td className="p-3 text-ios-label">{fmtDate(new Date(r.record_date))}</td>
                      <td className="p-3 font-semibold text-ios-text">{r.name} <span className="text-ios-label text-sm">({r.unit})</span></td>
                      <td className="p-3">{r.opening_qty}</td>
                      <td className="p-3">{r.received_qty}</td>
                      <td className="p-3">{r.consumed_qty}</td>
                      <td className="p-3 font-bold">{r.closing_qty}</td>
                      {isAdmin && (
                        <td className="p-2">
                          <div className="flex gap-1">
                            <button onClick={() => startEdit('inventory', r)} className="text-ios-blue font-bold text-sm px-2 active:opacity-70">✏️</button>
                            <button onClick={() => deleteRecord('inventory', r)} className="text-ios-red font-bold text-sm px-2 active:opacity-70">🗑️</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )
        ) : activeTab === 'movements' ? (
          movements.length === 0 ? (
            <p className="text-ios-label text-center py-10">لا توجد حركات بهذه الفترة</p>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-[#F2F2F7]">
                <tr>
                  <th className="p-3 font-bold text-ios-label text-xs">الوقت</th>
                  <th className="p-3 font-bold text-ios-label text-xs">المادة</th>
                  <th className="p-3 font-bold text-ios-label text-xs">الكمية</th>
                  <th className="p-3 font-bold text-ios-label text-xs">قبل</th>
                  <th className="p-3 font-bold text-ios-label text-xs">بعد</th>
                  <th className="p-3 font-bold text-ios-label text-xs">البيان</th>
                  <th className="p-3 font-bold text-ios-label text-xs">المستخدم</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => {
                  const qty = parseFloat(m.quantity)
                  return (
                    <tr key={i} className="border-t border-ios-sep">
                      <td className="p-3 text-ios-label text-sm">{new Date(m.created_at).toLocaleString('ar')}</td>
                      <td className="p-3 font-semibold text-ios-text">{m.item_name} <span className="text-ios-label text-sm">({m.unit})</span></td>
                      <td className={`p-3 font-bold ${qty < 0 ? 'text-ios-red' : 'text-ios-green'}`}>{qty}</td>
                      <td className="p-3">{m.balance_before}</td>
                      <td className="p-3 font-bold">{m.balance_after}</td>
                      <td className="p-3 text-ios-label text-sm">{m.reference || '—'}</td>
                      <td className="p-3 text-ios-label text-sm">{m.created_by_name || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : activeTab === 'variance' ? (
          <>
            <div className="p-4 bg-ios-orange/10 border-b border-ios-sep flex flex-wrap items-center gap-3">
              <label className="font-bold text-ios-text">تاريخ الجرد:</label>
              <input type="date" value={varianceDate} onChange={e => setVarianceDate(e.target.value)}
                className="input-ios w-auto" />
              <span className="text-sm text-ios-label">الفرق السالب = هالك/فقد • الفرق الموجب = عدّ أعلى من المتوقع</span>
            </div>
            {variance.length === 0 ? (
              <p className="text-ios-label text-center py-10">لا توجد سجلات جرد بهذا اليوم</p>
            ) : (
              <table className="w-full text-right">
                <thead className="bg-[#F2F2F7]">
                  <tr>
                    <th className="p-3 font-bold text-ios-label text-xs">المادة</th>
                    <th className="p-3 font-bold text-ios-label text-xs">افتتاحي</th>
                    <th className="p-3 font-bold text-ios-label text-xs">وارد</th>
                    <th className="p-3 font-bold text-ios-label text-xs">خصم الوصفات</th>
                    <th className="p-3 font-bold text-ios-label text-xs">المتوقع</th>
                    <th className="p-3 font-bold text-ios-label text-xs">الفعلي (الختامي)</th>
                    <th className="p-3 font-bold text-ios-label text-xs">الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {variance.map((r, i) => {
                    const diff = parseFloat(r.variance)
                    return (
                      <tr key={i} className="border-t border-ios-sep">
                        <td className="p-3 font-semibold text-ios-text">{r.name} <span className="text-ios-label text-sm">({r.unit})</span></td>
                        <td className="p-3">{r.opening_qty}</td>
                        <td className="p-3">{r.received_qty}</td>
                        <td className="p-3">{parseFloat(r.recipe_deductions).toFixed(3)}</td>
                        <td className="p-3">{r.expected}</td>
                        <td className="p-3 font-bold">{r.closing_qty}</td>
                        <td className={`p-3 font-bold ${diff < 0 ? 'text-ios-red' : diff > 0 ? 'text-ios-green' : 'text-ios-label'}`}>{r.variance}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        ) : lowStock.length === 0 ? (
            <p className="text-ios-green text-center py-10 font-bold">✅ كل الأصناف فوق الحد الأدنى</p>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-[#F2F2F7]">
                <tr>
                  <th className="p-3 font-bold text-ios-label text-xs">المادة</th>
                  <th className="p-3 font-bold text-ios-label text-xs">الكمية الحالية</th>
                  <th className="p-3 font-bold text-ios-label text-xs">الحد الأدنى</th>
                  <th className="p-3 font-bold text-ios-label text-xs">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((r, i) => (
                  <tr key={i} className="border-t border-ios-sep">
                    <td className="p-3 font-semibold text-ios-text">{r.name} <span className="text-ios-label text-sm">({r.unit})</span></td>
                    <td className="p-3 font-bold">{r.current_quantity}</td>
                    <td className="p-3">{r.min_quantity}</td>
                    <td className="p-3">
                      <span className={`badge-ios ${
                        r.status === 'out_of_stock' ? 'bg-ios-red text-white' :
                        r.status === 'critical' ? 'bg-ios-red/15 text-ios-red' :
                        'bg-ios-yellow/25 text-[#B25000]'
                      }`}>
                        {lowStockLabels[r.status] || r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}
