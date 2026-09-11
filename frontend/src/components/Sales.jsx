import { useState, useEffect, useMemo } from 'react'
import { visibleBranches, isBranchLocked } from '../utils/branchScope'
import SalesImport from './SalesImport'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const categoryLabels = { main: '🍽️ رئيسية', appetizer: '🥗 مقبلات', drink: '🥤 مشروب', side: '🍟 جانبي' }

export default function Sales({ user }) {
  const branchLocked = isBranchLocked(user)
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [menuItems, setMenuItems] = useState([])
  const [sales, setSales] = useState({})
  const [paymentCard, setPaymentCard] = useState(0)
  const [paymentCash, setPaymentCash] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [entryMode, setEntryMode] = useState('manual') // 'manual' | 'import'
  // فلاتر سريعة
  const [catFilter, setCatFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [soldOnly, setSoldOnly] = useState(false)

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        const visible = visibleBranches(user, data || [])
        setBranches(visible)
        if (visible.length > 0) setSelectedBranch(visible[0].id)
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
      [itemId]: { ...prev[itemId], quantity_sold: Math.max(0, parseInt(quantity) || 0) }
    }))
  }

  const getTotalRevenue = () => {
    return Object.values(sales).reduce((sum, s) => sum + (s.quantity_sold * s.unit_price), 0)
  }

  const getTotalOrders = () => {
    return Object.values(sales).reduce((sum, s) => sum + s.quantity_sold, 0)
  }

  // الفلترة: فئة + بحث + المباع فقط
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      if (catFilter !== 'all' && item.category !== catFilter) return false
      if (search && !item.name.includes(search.trim())) return false
      const qty = sales[item.id]?.quantity_sold || 0
      if (soldOnly && qty === 0) return false
      return true
    })
  }, [menuItems, sales, catFilter, search, soldOnly])

  // الفئات الموجودة فعلاً بالقائمة (حتى ما نعرض فئات فاضية)
  const presentCategories = useMemo(
    () => [...new Set(menuItems.map(i => i.category).filter(Boolean))],
    [menuItems]
  )

  const fillPayment = mode => {
    const total = getTotalRevenue()
    if (mode === 'cash') { setPaymentCash(total); setPaymentCard(0) }
    else if (mode === 'card') { setPaymentCard(total); setPaymentCash(0) }
    else { setPaymentCash(Math.round(total / 2)); setPaymentCard(Math.round(total / 2)) }
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
        setMessage(`✅ تم حفظ ${getTotalOrders()} قطعة بإجمالي ${getTotalRevenue().toLocaleString('ar-IQ')} د.ع!`)
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
      <PageHeader title="💰 جرد المبيعات اليومية" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      <div className="segmented mb-6 max-w-md">
        <button onClick={() => setEntryMode('manual')}
          className={`segmented-item ${entryMode === 'manual' ? 'segmented-item-active' : ''}`}>
          ✍️ إدخال يدوي
        </button>
        <button onClick={() => setEntryMode('import')}
          className={`segmented-item ${entryMode === 'import' ? 'segmented-item-active' : ''}`}>
          📥 استيراد من Excel
        </button>
      </div>

      {entryMode === 'import' ? (
        <SalesImport user={user} branches={branches} />
      ) : (
      <>
      {/* إعدادات الفرع والدفع */}
      <div className="card-ios p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label-ios">الفرع</label>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              disabled={branchLocked}
              className="input-ios disabled:opacity-60"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-ios">💳 كردت / فيزا (د.ع)</label>
            <input
              type="number"
              value={paymentCard}
              onChange={e => setPaymentCard(e.target.value)}
              className="input-ios"
            />
          </div>
          <div>
            <label className="label-ios">💵 كاش (د.ع)</label>
            <input
              type="number"
              value={paymentCash}
              onChange={e => setPaymentCash(e.target.value)}
              className="input-ios"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => fillPayment('cash')} className="btn-ios-secondary text-xs px-3 py-1.5">💵 كلها كاش</button>
          <button onClick={() => fillPayment('card')} className="btn-ios-secondary text-xs px-3 py-1.5">💳 كلها كردت</button>
          <button onClick={() => fillPayment('half')} className="btn-ios-secondary text-xs px-3 py-1.5">⚖️ نص ونص</button>
          <span className="text-xs text-ios-label self-center mr-auto font-bold">
            {parseFloat(paymentCard) + parseFloat(paymentCash) === getTotalRevenue() && getTotalRevenue() > 0
              ? '✓ التوزيع مضبوط'
              : `المتبقي: ${(getTotalRevenue() - (parseFloat(paymentCard) + parseFloat(paymentCash))).toLocaleString('ar-IQ')} د.ع`}
          </span>
        </div>
      </div>

      {/* فلاتر سريعة */}
      <div className="mb-4 space-y-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ابحث عن صنف..."
          className="input-ios w-full"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCatFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${catFilter === 'all' ? 'bg-ios-blue text-white' : 'bg-ios-fill text-ios-text active:opacity-70'}`}>
            الكل ({menuItems.length})
          </button>
          {presentCategories.map(c => (
            <button key={c} onClick={() => setCatFilter(catFilter === c ? 'all' : c)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${catFilter === c ? 'bg-ios-blue text-white' : 'bg-ios-fill text-ios-text active:opacity-70'}`}>
              {categoryLabels[c] || c}
            </button>
          ))}
          <button onClick={() => setSoldOnly(!soldOnly)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all mr-auto ${soldOnly ? 'bg-ios-green text-white' : 'bg-ios-green/15 text-[#1F7A33] active:opacity-70'}`}>
            ✓ المباع فقط ({getTotalOrders()})
          </button>
        </div>
      </div>

      {/* شبكة الأصناف — أزرار كبيرة للمس السريع */}
      {filteredItems.length === 0 ? (
        <p className="text-ios-label text-center py-10">لا توجد أصناف مطابقة</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
          {filteredItems.map(item => {
            const qty = sales[item.id]?.quantity_sold || 0
            const total = qty * item.price
            return (
              <div key={item.id}
                className={`rounded-2xl p-3 transition-all select-none ${qty > 0 ? 'bg-ios-blue/5 border-2 border-ios-blue shadow-sm' : 'bg-white border-2 border-transparent opacity-80'}`}>
                <div className="font-bold text-ios-text text-sm leading-snug mb-1">{item.name}</div>
                <div className="text-ios-label text-xs mb-2">{parseFloat(item.price).toLocaleString('ar-IQ')} د.ع</div>

                {qty === 0 ? (
                  <button
                    onClick={() => handleChange(item.id, 1)}
                    className="w-full py-2.5 rounded-xl bg-ios-blue text-white font-bold text-sm active:scale-95 transition-transform"
                  >➕ بيع</button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        onClick={() => handleChange(item.id, qty - 1)}
                        className="w-9 h-9 rounded-xl bg-ios-fill font-bold text-ios-text text-lg active:scale-95 transition-transform"
                      >−</button>
                      <input
                        type="number"
                        value={qty}
                        onChange={e => handleChange(item.id, e.target.value)}
                        className="w-12 py-1.5 rounded-xl bg-white border border-ios-sep text-center font-bold text-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue"
                      />
                      <button
                        onClick={() => handleChange(item.id, qty + 1)}
                        className="w-9 h-9 rounded-xl bg-ios-blue text-white font-bold text-lg active:scale-95 transition-transform"
                      >+</button>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleChange(item.id, qty + 5)}
                        className="flex-1 py-1 rounded-lg bg-ios-fill text-[11px] font-bold text-ios-text active:opacity-70">+5</button>
                      <button onClick={() => handleChange(item.id, qty + 10)}
                        className="flex-1 py-1 rounded-lg bg-ios-fill text-[11px] font-bold text-ios-text active:opacity-70">+10</button>
                      <button onClick={() => handleChange(item.id, 0)}
                        className="flex-1 py-1 rounded-lg bg-ios-red/10 text-[11px] font-bold text-ios-red active:opacity-70">مسح</button>
                    </div>
                    <div className="text-center text-xs font-bold text-ios-green pt-0.5">{total.toLocaleString('ar-IQ')} د.ع</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* شريط ملخص ثابت + حفظ */}
      <div className="sticky bottom-3 z-10">
        <div className="card-ios p-4 shadow-xl border border-ios-sep">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-5 text-center">
              <div>
                <div className="text-xl font-bold text-ios-blue">{getTotalOrders()}</div>
                <div className="text-[10px] text-ios-label">قطعة</div>
              </div>
              <div>
                <div className="text-xl font-bold text-ios-green">{getTotalRevenue().toLocaleString('ar-IQ')} <span className="text-xs">د.ع</span></div>
                <div className="text-[10px] text-ios-label">الإجمالي</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-xl font-bold text-ios-orange">
                  {getTotalOrders() > 0 ? Math.round(getTotalRevenue() / getTotalOrders()).toLocaleString('ar-IQ') : 0}
                </div>
                <div className="text-[10px] text-ios-label">متوسط الطلب</div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || getTotalOrders() === 0}
              className="btn-ios text-base px-8 disabled:opacity-40 flex-1 sm:flex-none"
            >
              {saving ? 'جاري الحفظ...' : `💾 حفظ (${getTotalOrders()} قطعة)`}
            </button>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  )
}
