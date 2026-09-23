import { getToken } from '../utils/token'
import { hasPerm } from '../utils/permissions'
import { useState, useEffect } from 'react'
import { visibleBranches, isBranchLocked } from '../utils/branchScope'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// عرض الكمية بدون أصفار زائدة (30 بدل 30.000)
const fmtQty = (v) => {
  const n = parseFloat(v)
  if (isNaN(n)) return v ?? ''
  return String(Number(n.toFixed(3)))
}

export default function Receiving({ user }) {
  const token = getToken()
  const headers = { Authorization: `Bearer ${token}` }
  const branchLocked = isBranchLocked(user)
  const canManage = hasPerm(user, 'receiving.manage')

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [invItems, setInvItems] = useState([])
  const [receipts, setReceipts] = useState([])
  const [search, setSearch] = useState('')
  const [pickItem, setPickItem] = useState('')
  const [suggestClosed, setSuggestClosed] = useState(false)
  const [qty, setQty] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers })
      .then(r => r.json())
      .then(data => {
        const visible = visibleBranches(user, data || [])
        setBranches(visible)
        if (visible.length > 0) setSelectedBranch(visible[0].id)
      })
  }, [])

  useEffect(() => {
    if (!selectedBranch) return
    fetch(`${API_URL}/inventory/items/${selectedBranch}`, { headers })
      .then(r => r.json())
      .then(d => setInvItems(d || []))
      .catch(() => setInvItems([]))
  }, [selectedBranch])

  useEffect(() => { loadReceipts() }, [])

  const loadReceipts = () => {
    fetch(`${API_URL}/operations/receiving`, { headers })
      .then(r => r.json())
      .then(d => setReceipts(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  // اقتراحات تظهر أثناء الكتابة (أول 8 نتائج)
  const suggestions = search.trim() && !suggestClosed
    ? invItems.filter(i => i.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : []

  const pickSuggestion = (item) => {
    setPickItem(String(item.id))
    setSearch(item.name)
    setSuggestClosed(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const q = parseFloat(qty)
    if (!pickItem) return show('❌ اختر المادة أولاً')
    if (!q || q <= 0) return show('❌ أدخل كمية صحيحة أكبر من صفر')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/operations/receiving`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: parseInt(selectedBranch),
          inventory_item_id: parseInt(pickItem),
          quantity: q,
          unit_price: unitPrice ? parseFloat(unitPrice) : undefined,
          supplier: supplier || undefined,
          notes: notes || undefined
        })
      })
      const data = await res.json()
      if (res.ok) {
        show('✅ تم تسجيل الاستلام وإضافة الكمية للمخزون')
        setPickItem('')
        setSearch('')
        setSuggestClosed(false)
        setQty('')
        setUnitPrice('')
        setSupplier('')
        setNotes('')
        loadReceipts()
        fetch(`${API_URL}/inventory/items/${selectedBranch}`, { headers })
          .then(r => r.json())
          .then(d => setInvItems(d || []))
      } else {
        show('❌ فشل: ' + (data.message || ''))
      }
    } catch {
      show('❌ خطأ في الاتصال')
    }
    setSaving(false)
  }

  const deleteReceipt = async (rec) => {
    if (!window.confirm(`حذف استلام #${rec.id} نهائياً؟\nراح ينعكس أثر الكمية من المخزون.`)) return
    try {
      const res = await fetch(`${API_URL}/operations/receiving/${rec.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { show('✅ ' + (data.message || 'تم الحذف')); loadReceipts() }
      else show('❌ ' + (data.message || 'فشل الحذف'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  const show = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div dir="rtl">
      <PageHeader title="🧾 المشتريات — استلام شراء فعلي" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      {canManage ? (
        <div className="card-ios p-6 mb-6">
          <div className="section-title"><h3 className="mb-4">📝 تسجيل استلام جديد</h3></div>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-ios">الفرع</label>
                <select value={selectedBranch}
                  onChange={e => { setSelectedBranch(e.target.value); setPickItem(''); setSearch('') }}
                  disabled={branchLocked} className="input-ios disabled:opacity-60">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-ios">الكمية</label>
                <input type="number" min="0" step="0.001" value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="مثلاً: 10" className="input-ios" />
              </div>
            </div>

            <div>
              <label className="label-ios">المادة</label>
              <div className="relative">
                <input type="text" value={search}
                  onChange={e => { setSearch(e.target.value); setSuggestClosed(false); setPickItem('') }}
                  onBlur={() => setTimeout(() => setSuggestClosed(true), 150)}
                  onFocus={() => setSuggestClosed(false)}
                  placeholder="🔍 اكتب اسم المادة..."
                  className="input-ios w-full" />
                {suggestions.length > 0 && (
                  <div className="absolute z-30 top-full right-0 left-0 mt-1 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-ios-sep shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                    {suggestions.map(item => (
                      <button key={item.id} type="button" onMouseDown={(e) => { e.preventDefault(); pickSuggestion(item) }}
                        className={`w-full text-right px-3 py-2.5 text-sm font-semibold border-b border-ios-sep last:border-0 ${
                          parseInt(pickItem) === item.id ? 'bg-ios-blue/10 text-ios-blue' : 'text-ios-text hover:bg-ios-fill'
                        }`}>
                        {item.name} <span className="text-xs text-ios-label font-normal">{item.unit ? `(${item.unit})` : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {pickItem && invItems.find(i => i.id === parseInt(pickItem)) && (
                <p className="text-xs text-ios-label mt-1 font-semibold">
                  المادة المختارة: {invItems.find(i => i.id === parseInt(pickItem)).name}
                </p>
              )}
              {invItems.length === 0 && (
                <p className="text-ios-orange text-sm font-semibold mt-1">⚠️ هذا الفرع ما بيه مواد جرد — أضفها من الإدارة العامة أولاً</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label-ios">سعر الوحدة (اختياري)</label>
                <input type="number" min="0" step="0.01" value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  placeholder="0" className="input-ios" />
              </div>
              <div>
                <label className="label-ios">المورّد (اختياري)</label>
                <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
                  placeholder="اسم المورّد" className="input-ios" />
              </div>
              <div>
                <label className="label-ios">ملاحظات (اختياري)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="ملاحظات" className="input-ios" />
              </div>
            </div>

            <button type="submit" disabled={saving || !selectedBranch}
              className="btn-ios w-full md:w-auto disabled:opacity-40">
              {saving ? 'جاري التسجيل...' : '✅ تسجيل الاستلام'}
            </button>
          </form>
        </div>
      ) : (
        <p className="text-center text-ios-label py-4 font-semibold">👀 عرض فقط — ما عندك صلاحية تسجيل الاستلام</p>
      )}

      <div className="section-title">
        <h3>📋 سجلات الاستلام الأخيرة ({receipts.length})</h3>
      </div>
      {receipts.length === 0 ? (
        <p className="text-center text-ios-label py-8">لا توجد سجلات استلام</p>
      ) : (
        <>
          <div className="hidden md:block card-ios overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-ios min-w-[900px]">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الفرع</th>
                    <th>المادة</th>
                    <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>المورّد</th>
                    <th>التاريخ / المسجّل</th>
                    {user?.role === 'admin' && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {receipts.map(rec => (
                    <tr key={rec.id}>
                      <td className="font-bold text-ios-text whitespace-nowrap">#{rec.id}</td>
                      <td className="text-ios-label whitespace-nowrap">{rec.branch_name}</td>
                      <td className="font-semibold text-ios-text whitespace-nowrap">{rec.item_name}</td>
                      <td className="text-center font-bold text-ios-blue">{fmtQty(rec.quantity)} <span className="text-xs text-ios-label font-normal">{rec.unit || ''}</span></td>
                      <td className="td-num text-ios-label">{parseFloat(rec.unit_price || 0) > 0 ? parseFloat(rec.unit_price).toFixed(2) : '—'}</td>
                      <td className="text-xs text-ios-label max-w-[140px]">{rec.supplier || '—'}</td>
                      <td className="text-xs text-ios-label whitespace-nowrap">
                        {new Date(rec.created_at).toLocaleString('ar')}
                        <div>{rec.created_by_name || '—'}</div>
                      </td>
                      {user?.role === 'admin' && (
                        <td className="text-center">
                          <button onClick={() => deleteReceipt(rec)}
                            className="px-3 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {receipts.map(rec => (
              <div key={rec.id} className="card-ios p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ios-text">#{rec.id}</span>
                  {user?.role === 'admin' && (
                    <button onClick={() => deleteReceipt(rec)}
                      className="px-3 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">
                      🗑️ حذف
                    </button>
                  )}
                </div>
                <div className="text-sm"><span className="label-ios">الفرع</span>{rec.branch_name}</div>
                <div className="text-sm"><span className="label-ios">المادة</span>{rec.item_name}</div>
                <div className="text-sm"><span className="label-ios">الكمية</span><span className="font-bold text-ios-blue">{fmtQty(rec.quantity)} {rec.unit || ''}</span></div>
                {parseFloat(rec.unit_price || 0) > 0 && (
                  <div className="text-sm"><span className="label-ios">سعر الوحدة</span>{parseFloat(rec.unit_price).toFixed(2)}</div>
                )}
                {rec.supplier && <div className="text-sm"><span className="label-ios">المورّد</span>{rec.supplier}</div>}
                <div className="text-xs text-ios-label">
                  {new Date(rec.created_at).toLocaleString('ar')} — {rec.created_by_name || '—'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
