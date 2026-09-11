import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { exportToExcel, printReport } from '../utils/export'
import { fetchSettings, getCachedSettings } from '../utils/settings'
import PageHeader from './PageHeader'

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
  const [salesView, setSalesView] = useState('detailed')
  const [comparison, setComparison] = useState([])
  const [sales, setSales] = useState([])
  const [inventory, setInventory] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [movements, setMovements] = useState([])
  const [variance, setVariance] = useState([])
  const [varianceDate, setVarianceDate] = useState(fmtDate(today))
  const [purchases, setPurchases] = useState([])
  const [costRows, setCostRows] = useState([])
  const [costGrandTotal, setCostGrandTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(getCachedSettings())
  const [selected, setSelected] = useState({}) // صفوف محددة بتقرير المبيعات المفصل

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
    fetchSettings().then(setSettings)
  }, [])

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
        setSelected({})
      } else if (activeTab === 'inventory') {
        const res = await fetch(`${API_URL}/reports/inventory/${selectedBranch}?from=${from}&to=${to}`, { headers: authHeaders })
        setInventory(await res.json() || [])
      } else if (activeTab === 'lowstock') {
        const res = await fetch(`${API_URL}/reports/low-stock/${selectedBranch}`, { headers: authHeaders })
        setLowStock(await res.json() || [])
      } else if (activeTab === 'movements') {
        const res = await fetch(`${API_URL}/reports/movements/${selectedBranch}?from=${from}&to=${to}`, { headers: authHeaders })
        setMovements(await res.json() || [])
      } else if (activeTab === 'purchases') {
        const res = await fetch(`${API_URL}/purchases`, { headers: authHeaders })
        const all = await res.json() || []
        // فلترة حسب الفرع والفترة (الإندبوينت يرجع آخر 200 لكل الفروع للأدمن)
        setPurchases(all.filter(p =>
          String(p.branch_id) === String(selectedBranch) &&
          p.created_at && fmtDate(new Date(p.created_at)) >= from && fmtDate(new Date(p.created_at)) <= to
        ))
      } else if (activeTab === 'costs') {
        const [recRes, invRes, menuRes] = await Promise.all([
          fetch(`${API_URL}/sales/recipes?branch_id=${selectedBranch}`, { headers: authHeaders }),
          fetch(`${API_URL}/inventory/items/${selectedBranch}`, { headers: authHeaders }),
          fetch(`${API_URL}/sales/menu`, { headers: authHeaders }),
        ])
        const recipes = await recRes.json() || []
        const invItems = await invRes.json() || []
        const menuItems = await menuRes.json() || []
        const costById = {}
        invItems.forEach(i => { costById[i.id] = parseFloat(i.cost_per_unit) || 0 })
        const priceById = {}
        menuItems.forEach(m => { priceById[m.id] = parseFloat(m.price) || 0 })

        // تجميع الوصفات حسب صنف البيع مع حساب التكاليف
        const byMenu = {}
        recipes.forEach(r => {
          (byMenu[r.menu_item_id] = byMenu[r.menu_item_id] || []).push(r)
        })
        const rows = []
        let grand = 0
        Object.values(byMenu)
          .sort((a, b) => a[0].menu_name.localeCompare(b[0].menu_name, 'ar'))
          .forEach(group => {
            const menuName = group[0].menu_name
            const itemTotal = group.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (costById[r.inventory_item_id] || 0), 0)
            grand += itemTotal
            group.forEach((r, i) => {
              const qty = parseFloat(r.quantity) || 0
              const unitCost = costById[r.inventory_item_id] || 0
              rows.push({
                menu_name: i === 0 ? menuName : '',
                component: r.inventory_name,
                qty: qty,
                unit: r.unit || '',
                unit_cost: unitCost.toFixed(2),
                line_cost: (qty * unitCost).toFixed(2),
                item_total: i === 0 ? itemTotal.toFixed(2) : '',
                price: i === 0 ? (priceById[group[0].menu_item_id] || 0).toFixed(0) : '',
                profit: i === 0 ? ((priceById[group[0].menu_item_id] || 0) - itemTotal).toFixed(2) : '',
              })
            })
          })
        setCostRows(rows)
        setCostGrandTotal(grand)
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

  const groupedSales = Object.values(
    sales.reduce((acc, r) => {
      if (!acc[r.name]) acc[r.name] = { name: r.name, quantity_sold: 0, total_revenue: 0, payment_card: 0, payment_cash: 0 }
      acc[r.name].quantity_sold += parseInt(r.quantity_sold) || 0
      acc[r.name].total_revenue += parseFloat(r.total_revenue) || 0
      acc[r.name].payment_card += parseFloat(r.payment_card) || 0
      acc[r.name].payment_cash += parseFloat(r.payment_cash) || 0
      return acc
    }, {})
  ).map(g => ({
    ...g,
    total_revenue: g.total_revenue.toFixed(2),
    payment_card: g.payment_card.toFixed(2),
    payment_cash: g.payment_cash.toFixed(2),
  }))
  const lowStockLabels = { out_of_stock: 'نفذ', critical: 'حرج', low: 'منخفض' }
  const purchaseStatusLabels = { pending: '⏳ معلق', received: '✅ مستلم', cancelled: '❌ ملغي' }

  const branchName = branches.find(b => String(b.id) === selectedBranch)?.name || ''

  const reportConfig = () => ({
    sales: salesView === 'grouped' ? {
      title: 'تقرير المبيعات المجمّعة',
      filename: `مبيعات-مجمعة_${branchName}_${from}_${to}`,
      columns: [
        { key: 'name', label: 'الصنف' },
        { key: 'quantity_sold', label: 'إجمالي الكمية' },
        { key: 'total_revenue', label: 'إجمالي الإيراد (د.ع)' },
        { key: 'payment_card', label: 'شبكة (د.ع)' },
        { key: 'payment_cash', label: 'نقدي (د.ع)' },
      ],
      rows: groupedSales,
      totals: [{ label: 'الإجمالي', value: `${salesTotal.toFixed(2)} د.ع` }],
    } : {
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
    purchases: {
      title: 'تقرير طلبات الشراء',
      filename: `طلبات-شراء_${branchName}_${from}_${to}`,
      columns: [
        { key: 'created_at', label: 'التاريخ' },
        { key: 'items', label: 'المواد' },
        { key: 'status', label: 'الحالة' },
        { key: 'notes', label: 'ملاحظات' },
        { key: 'created_by_name', label: 'طلب بواسطة' },
      ],
      rows: purchases.map(p => ({
        ...p,
        created_at: fmtDate(new Date(p.created_at)),
        items: (p.items || []).map(i => `${i.item_name} (${i.quantity} ${i.unit || ''})`).join('، '),
        status: purchaseStatusLabels[p.status] || p.status,
        notes: p.notes || '—',
        created_by_name: p.created_by_name || '—',
      })),
      totals: [{ label: 'عدد الطلبات', value: purchases.length }],
    },
    costs: {
      title: 'تقرير تكاليف مواد الأصناف',
      filename: `تكاليف-المواد_${branchName}`,
      columns: [
        { key: 'menu_name', label: 'صنف البيع' },
        { key: 'component', label: 'المكوّن' },
        { key: 'qty', label: 'الكمية' },
        { key: 'unit', label: 'الوحدة' },
        { key: 'unit_cost', label: 'تكلفة الوحدة (د.ع)' },
        { key: 'line_cost', label: 'تكلفة المكوّن (د.ع)' },
        { key: 'item_total', label: 'تكلفة الصنف (د.ع)' },
        { key: 'price', label: 'سعر البيع (د.ع)' },
        { key: 'profit', label: 'هامش الربح (د.ع)' },
      ],
      rows: costRows,
      totals: [{ label: 'إجمالي تكلفة جميع الأصناف', value: `${costGrandTotal.toFixed(2)} د.ع` }],
    },
  })

  const activeConfig = reportConfig()[activeTab]

  // التصدير والطباعة يطبقان على الصفوف المحددة فقط إذا فيه تحديد بتقرير المبيعات
  const selectedCount = Object.values(selected).filter(Boolean).length
  const effectiveConfig = (activeTab === 'sales' && salesView === 'detailed' && selectedCount > 0) ? {
    ...activeConfig,
    rows: activeConfig.rows.filter((_, i) => selected[i]),
    totals: [{
      label: `إجمالي الإيرادات (محدد ${selectedCount})`,
      value: `${sales.filter((_, i) => selected[i]).reduce((s, r) => s + parseFloat(r.total_revenue || 0), 0).toFixed(2)} د.ع`
    }],
  } : activeConfig

  const toggleSelectAll = () => {
    const allOn = sales.length > 0 && sales.every((_, i) => selected[i])
    setSelected(allOn ? {} : Object.fromEntries(sales.map((_, i) => [i, true])))
  }
  const toggleRowSelect = (i) => setSelected(s => ({ ...s, [i]: !s[i] }))

  const handleExportExcel = () => {
    if (!effectiveConfig || effectiveConfig.rows.length === 0) return
    exportToExcel({
      filename: effectiveConfig.filename,
      sheetName: effectiveConfig.title.slice(0, 31),
      columns: effectiveConfig.columns,
      rows: effectiveConfig.rows,
      totals: effectiveConfig.totals,
    })
  }

  const handlePrint = () => {
    if (!effectiveConfig || effectiveConfig.rows.length === 0) return
    const subtitle = activeTab === 'variance'
      ? `الفرع: ${branchName} • بتاريخ ${varianceDate}`
      : activeTab === 'lowstock' || activeTab === 'costs'
        ? `الفرع: ${branchName}`
        : `الفرع: ${branchName} • من ${from} إلى ${to}`
    printReport({
      title: effectiveConfig.title,
      subtitle,
      columns: effectiveConfig.columns,
      rows: effectiveConfig.rows,
      totals: effectiveConfig.totals,
      company: { name: settings.company_name, logo: settings.company_logo },
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

  const deleteSelected = async () => {
    const rows = sales.filter((_, i) => selected[i])
    if (rows.length === 0) return
    if (!window.confirm(`⚠️ هل أنت متأكد من حذف ${rows.length} سجل بيع محدد؟\nراح يترجع خصم المكونات لمواد الجرد.`)) return
    try {
      const res = await fetch(`${API_URL}/sales/daily`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: rows.map(r => r.id) })
      })
      if (res.ok) {
        setSelected({})
        loadBranchReports()
        loadComparison()
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
      <PageHeader title="📈 التقارير" />

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
        <div className="section-title"><h3 className="mb-4">🏪 مقارنة الفروع (المبيعات)</h3></div>
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
        <button onClick={() => setActiveTab('purchases')}
          className={`segmented-item ${activeTab === 'purchases' ? 'segmented-item-active' : ''}`}>
          🛒 طلبات الشراء
        </button>
        <button onClick={() => setActiveTab('costs')}
          className={`segmented-item ${activeTab === 'costs' ? 'segmented-item-active' : ''}`}>
          🧾 تكاليف المواد
        </button>
      </div>

      <div className="card-ios overflow-hidden">
        {activeConfig && activeConfig.rows.length > 0 && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-ios-sep bg-[#F9F9FB]">
            <span className="font-bold text-ios-text text-sm">{activeConfig.title}</span>
            {selectedCount > 0 && (
              <span className="text-xs font-bold bg-ios-blue/10 text-ios-blue px-2.5 py-1 rounded-full">
                🎯 محدد {selectedCount} من {sales.length}
                <button onClick={() => setSelected({})} className="mr-1 active:opacity-60">✕</button>
              </span>
            )}
            {isAdmin && activeTab === 'sales' && selectedCount > 0 && (
              <button onClick={deleteSelected}
                className="text-xs font-bold bg-ios-red/10 text-ios-red px-3 py-1.5 rounded-full active:opacity-60">
                🗑️ حذف المحدد ({selectedCount})
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'sales' && (
                <div className="segmented">
                  <button onClick={() => setSalesView('detailed')}
                    className={`segmented-item ${salesView === 'detailed' ? 'segmented-item-active' : ''}`}>
                    مفصل
                  </button>
                  <button onClick={() => setSalesView('grouped')}
                    className={`segmented-item ${salesView === 'grouped' ? 'segmented-item-active' : ''}`}>
                    مجمّع بالصنف
                  </button>
                </div>
              )}
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
              {salesView === 'grouped' ? (
                <table className="table-ios">
                  <thead>
                    <tr>
                      <th>الصنف</th>
                      <th>إجمالي الكمية</th>
                      <th>إجمالي الإيراد</th>
                      <th>شبكة</th>
                      <th>نقدي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedSales.map((g, i) => (
                      <tr key={i}>
                        <td className="font-semibold text-ios-text">{g.name}</td>
                        <td className="font-bold">{g.quantity_sold}</td>
                        <td className="font-bold text-ios-green">{g.total_revenue} د.ع</td>
                        <td>{g.payment_card}</td>
                        <td>{g.payment_cash}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-ios-sep bg-[#F2F2F7] font-bold">
                      <td>الإجمالي</td>
                      <td>{groupedSales.reduce((s, g) => s + g.quantity_sold, 0)}</td>
                      <td className="text-ios-green">{salesTotal.toFixed(2)} د.ع</td>
                      <td>{groupedSales.reduce((s, g) => s + parseFloat(g.payment_card), 0).toFixed(2)}</td>
                      <td>{groupedSales.reduce((s, g) => s + parseFloat(g.payment_cash), 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
              <table className="table-ios">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input type="checkbox" className="w-4 h-4 accent-ios-blue cursor-pointer"
                        checked={sales.length > 0 && sales.every((_, i) => selected[i])}
                        onChange={toggleSelectAll} title="تحديد الكل" />
                    </th>
                    <th>التاريخ</th>
                    <th>الصنف</th>
                    <th>الكمية</th>
                    <th>الإيراد</th>
                    <th>شبكة</th>
                    <th>نقدي</th>
                    {isAdmin && <th>إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((r, i) => (
                    editing && editing.table === 'sales' && editing.id === r.id ? (
                      <tr key={i} className={`bg-ios-blue/10 ${selected[i] ? '' : 'opacity-50'}`}>
                        <td className="text-center">
                          <input type="checkbox" className="w-4 h-4 accent-ios-blue cursor-pointer"
                            checked={!!selected[i]} onChange={() => toggleRowSelect(i)} />
                        </td>
                        <td className="text-ios-label">{fmtDate(new Date(r.record_date))}</td>
                        <td className="font-semibold text-ios-text">{r.name}</td>
                        <td>
                          <input type="number" min="0" value={editing.values.quantity_sold}
                            onChange={e => handleEditChange('quantity_sold', parseInt(e.target.value) || 0)}
                            className="w-20 py-1.5 rounded-xl bg-white text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        </td>
                        <td className="font-bold text-ios-green">{parseFloat(r.total_revenue).toFixed(2)} د.ع</td>
                        <td>
                          <input type="number" min="0" value={editing.values.payment_card}
                            onChange={e => handleEditChange('payment_card', parseFloat(e.target.value) || 0)}
                            className="w-20 py-1.5 rounded-xl bg-white text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        </td>
                        <td>
                          <input type="number" min="0" value={editing.values.payment_cash}
                            onChange={e => handleEditChange('payment_cash', parseFloat(e.target.value) || 0)}
                            className="w-20 py-1.5 rounded-xl bg-white text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={saveEdit} className="btn-ios text-xs px-3 py-1.5">حفظ</button>
                            <button onClick={() => setEditing(null)} className="btn-ios-secondary text-xs px-3 py-1.5">إلغاء</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={i} className={`${selected[i] ? '' : 'opacity-50'}`}>
                        <td className="text-center">
                          <input type="checkbox" className="w-4 h-4 accent-ios-blue cursor-pointer"
                            checked={!!selected[i]} onChange={() => toggleRowSelect(i)} />
                        </td>
                        <td className="text-ios-label">{fmtDate(new Date(r.record_date))}</td>
                        <td className="font-semibold text-ios-text">{r.name}</td>
                        <td>{r.quantity_sold}</td>
                        <td className="font-bold text-ios-green">{parseFloat(r.total_revenue).toFixed(2)} د.ع</td>
                        <td>{parseFloat(r.payment_card).toFixed(2)}</td>
                        <td>{parseFloat(r.payment_cash).toFixed(2)}</td>
                        {isAdmin && (
                          <td>
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
              )}
            </>
          )
        ) : activeTab === 'inventory' ? (
          inventory.length === 0 ? (
            <p className="text-ios-label text-center py-10">لا توجد سجلات جرد بهذه الفترة</p>
          ) : (
            <table className="table-ios">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المادة</th>
                  <th>افتتاحي</th>
                  <th>مستلم</th>
                  <th>مستهلك</th>
                  <th>ختامي</th>
                  {isAdmin && <th>إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {inventory.map((r, i) => (
                  editing && editing.table === 'inventory' && editing.id === r.id ? (
                    <tr key={i} className="bg-ios-blue/10">
                      <td className="text-ios-label">{fmtDate(new Date(r.record_date))}</td>
                      <td className="font-semibold text-ios-text">{r.name} <span className="text-ios-label text-sm">({r.unit})</span></td>
                      {['opening_qty', 'received_qty', 'consumed_qty', 'closing_qty'].map(field => (
                        <td key={field}>
                          <input type="number" value={editing.values[field]}
                            onChange={e => handleEditChange(field, parseFloat(e.target.value) || 0)}
                            className="w-20 py-1.5 rounded-xl bg-white text-center focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        </td>
                      ))}
                      <td>
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="btn-ios text-xs px-3 py-1.5">حفظ</button>
                          <button onClick={() => setEditing(null)} className="btn-ios-secondary text-xs px-3 py-1.5">إلغاء</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td className="text-ios-label">{fmtDate(new Date(r.record_date))}</td>
                      <td className="font-semibold text-ios-text">{r.name} <span className="text-ios-label text-sm">({r.unit})</span></td>
                      <td>{r.opening_qty}</td>
                      <td>{r.received_qty}</td>
                      <td>{r.consumed_qty}</td>
                      <td className="font-bold">{r.closing_qty}</td>
                      {isAdmin && (
                        <td>
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
            <table className="table-ios">
              <thead>
                <tr>
                  <th>الوقت</th>
                  <th>المادة</th>
                  <th>الكمية</th>
                  <th>قبل</th>
                  <th>بعد</th>
                  <th>البيان</th>
                  <th>المستخدم</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => {
                  const qty = parseFloat(m.quantity)
                  return (
                    <tr key={i}>
                      <td className="text-ios-label text-sm">{new Date(m.created_at).toLocaleString('ar')}</td>
                      <td className="font-semibold text-ios-text">{m.item_name} <span className="text-ios-label text-sm">({m.unit})</span></td>
                      <td className={`font-bold ${qty < 0 ? 'text-ios-red' : 'text-ios-green'}`}>{qty}</td>
                      <td>{m.balance_before}</td>
                      <td className="font-bold">{m.balance_after}</td>
                      <td className="text-ios-label text-sm">{m.reference || '—'}</td>
                      <td className="text-ios-label text-sm">{m.created_by_name || '—'}</td>
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
              <table className="table-ios">
                <thead>
                  <tr>
                    <th>المادة</th>
                    <th>افتتاحي</th>
                    <th>وارد</th>
                    <th>خصم الوصفات</th>
                    <th>المتوقع</th>
                    <th>الفعلي (الختامي)</th>
                    <th>الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {variance.map((r, i) => {
                    const diff = parseFloat(r.variance)
                    return (
                      <tr key={i}>
                        <td className="font-semibold text-ios-text">{r.name} <span className="text-ios-label text-sm">({r.unit})</span></td>
                        <td>{r.opening_qty}</td>
                        <td>{r.received_qty}</td>
                        <td>{parseFloat(r.recipe_deductions).toFixed(3)}</td>
                        <td>{r.expected}</td>
                        <td className="font-bold">{r.closing_qty}</td>
                        <td className={`font-bold ${diff < 0 ? 'text-ios-red' : diff > 0 ? 'text-ios-green' : 'text-ios-label'}`}>{r.variance}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        ) : activeTab === 'purchases' ? (
          purchases.length === 0 ? (
            <p className="text-ios-label text-center py-10">لا توجد طلبات شراء بهذه الفترة</p>
          ) : (
            <table className="table-ios">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المواد</th>
                  <th>الحالة</th>
                  <th>ملاحظات</th>
                  <th>طلب بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p, i) => (
                  <tr key={i}>
                    <td className="text-ios-label whitespace-nowrap">{fmtDate(new Date(p.created_at))}</td>
                    <td className="font-semibold text-ios-text">
                      {(p.items || []).map((it, j) => (
                        <div key={j} className="text-sm">{it.item_name} <span className="text-ios-blue font-bold">({it.quantity} {it.unit || ''})</span></div>
                      ))}
                    </td>
                    <td>
                      <span className={`badge-ios ${
                        p.status === 'received' ? 'bg-ios-green/15 text-ios-green' :
                        p.status === 'cancelled' ? 'bg-ios-fill text-ios-label' :
                        'bg-ios-orange/15 text-[#B25000]'
                      }`}>
                        {purchaseStatusLabels[p.status] || p.status}
                      </span>
                      {p.status === 'received' && p.confirmed_by_name && (
                        <div className="text-[10px] text-ios-green mt-1 font-semibold">✓ {p.confirmed_by_name}</div>
                      )}
                    </td>
                    <td className="text-ios-label text-sm">{p.notes || '—'}</td>
                    <td className="text-ios-label text-sm">{p.created_by_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : activeTab === 'costs' ? (
          costRows.length === 0 ? (
            <p className="text-ios-label text-center py-10">لا توجد مكونات لهذا الفرع — أضفها من الإدارة ← المكونات</p>
          ) : (
            <>
              <div className="p-4 bg-ios-blue/10 font-bold text-ios-blue">
                إجمالي تكلفة مواد جميع الأصناف: {costGrandTotal.toFixed(2)} د.ع
              </div>
              <div className="overflow-x-auto">
                <table className="table-ios min-w-[720px]">
                  <thead>
                    <tr>
                      <th>صنف البيع</th>
                      <th>المكوّن</th>
                      <th>الكمية</th>
                      <th>الوحدة</th>
                      <th>تكلفة الوحدة</th>
                      <th>تكلفة المكوّن</th>
                      <th>تكلفة الصنف</th>
                      <th>سعر البيع</th>
                      <th>هامش الربح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costRows.map((r, i) => {
                      const profit = parseFloat(r.profit)
                      return (
                        <tr key={i} className={r.menu_name ? 'border-t-2 border-ios-sep' : ''}>
                          <td className="font-bold text-ios-text">{r.menu_name || ''}</td>
                          <td className="font-semibold text-ios-text">{r.component}</td>
                          <td>{r.qty}</td>
                          <td className="text-ios-label">{r.unit}</td>
                          <td>{r.unit_cost}</td>
                          <td className="font-semibold">{r.line_cost}</td>
                          <td className="font-bold text-ios-blue">{r.item_total || ''}</td>
                          <td className="font-bold">{r.price || ''}</td>
                          <td className={`font-bold ${r.profit === '' ? '' : profit >= 0 ? 'text-ios-green' : 'text-ios-red'}`}>{r.profit || ''}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 border-ios-sep bg-[#F2F2F7] font-bold">
                      <td colSpan="6">الإجمالي</td>
                      <td className="text-ios-blue">{costGrandTotal.toFixed(2)} د.ع</td>
                      <td colSpan="2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : lowStock.length === 0 ? (
            <p className="text-ios-green text-center py-10 font-bold">✅ كل الأصناف فوق الحد الأدنى</p>
          ) : (
            <table className="table-ios">
              <thead>
                <tr>
                  <th>المادة</th>
                  <th>الكمية الحالية</th>
                  <th>الحد الأدنى</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((r, i) => (
                  <tr key={i}>
                    <td className="font-semibold text-ios-text">{r.name} <span className="text-ios-label text-sm">({r.unit})</span></td>
                    <td className="font-bold">{r.current_quantity}</td>
                    <td>{r.min_quantity}</td>
                    <td>
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
