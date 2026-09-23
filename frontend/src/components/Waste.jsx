import { getToken } from '../utils/token'
import { hasPerm } from '../utils/permissions'
import { useState, useEffect } from 'react'
import { visibleBranches, isBranchLocked } from '../utils/branchScope'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const REASONS = ['تلف', 'انتهاء صلاحية', 'سقط بالأرض', 'خطأ تحضير', 'أخرى']

// عرض الكمية بدون أصفار زائدة (30 بدل 30.000)
const fmtQty = (v) => {
  const n = parseFloat(v)
  if (isNaN(n)) return v ?? ''
  return String(Number(n.toFixed(3)))
}

export default function Waste({ user }) {
  const token = getToken()
  const headers = { Authorization: `Bearer ${token}` }
  const branchLocked = isBranchLocked(user)
  const canManage = hasPerm(user, 'waste.manage')

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [invItems, setInvItems] = useState([])
  const [records, setRecords] = useState([])
  const [search, setSearch] = useState('')
  const [pickItem, setPickItem] = useState('')
  const [suggestClosed, setSuggestClosed] = useState(false)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState(REASONS[0])
  const [otherReason, setOtherReason] = useState('')
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

  useEffect(() => { loadRecords() }, [])

  const loadRecords = () => {
    fetch(`${API_URL}/operations/waste`, { headers })
      .then(r => r.json())
      .then(d => setRecords(Array.isArray(d) ? d : []))
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

  const pickedInfo = invItems.find(i => i.id === parseInt(pickItem))
  const available = pickedInfo ? parseFloat(pickedInfo.current_quantity) : null
  const qtyNum = parseFloat(qty)
  const overStock = available !== null && !isNaN(qtyNum) && qtyNum > available

  const finalReason = reason === 'أخرى' ? otherReason.trim() : reason

  const submit = async (e) => {
    e.preventDefault()
    if (!pickItem) return show('❌ اختر المادة أولاً')
    if (!qtyNum || qtyNum <= 0) return show('❌ أدخل كمية صحيحة أكبر من صفر')
    if (available !== null && qtyNum > available) return show('❌ الكمية المهدوَرة أكبر من الموجود بالمخزون')
    if (!finalReason) return show('❌ اكتب سبب الهدر')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/operations/waste`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: parseInt(selectedBranch),
          inventory_item_id: parseInt(pickItem),
          quantity: qtyNum,
          reason: finalReason,
          notes: notes || undefined
        })
      })
      const data = await res.json()
      if (res.ok) {
        show('✅ تم تسجيل الهدر وخصم الكمية من المخزون')
        setPickItem('')
        setSearch('')
        setSuggestClosed(false)
        setQty('')
        setReason(REASONS[0])
        setOtherReason('')
        setNotes('')
        loadRecords()
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

  const deleteRecord = async (rec) => {
    if (!window.confirm(`حذف هدر #${rec.id} نهائياً؟\nراح ترجع الكمية للمخزون.`)) return
    try {
      const res = await fetch(`${API_URL}/operations/waste/${rec.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { show('✅ ' + (data.message || 'تم الحذف')); loadRecords() }
      else show('❌ ' + (data.message || 'فشل الحذف'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  const show = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div dir="rtl">
      <PageHeader title="🗑️ الهدر" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      {canManage ? (
        <div className="card-ios p-6 mb-6">
          <div className="section-title"><h3 className="mb-4">📝 تسجيل هدر جديد</h3></div>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-ios">الفرع</label>
                <select value={selectedBranch}
                  onChange={e => { setSelectedBranch(e.target.value); setPickItem(''); setSearch(''); setQty('') }}
                  disabled={branchLocked} className="input-ios disabled:opacity-60">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-ios">السبب</label>
                <select value={reason} onChange={e => setReason(e.target.value)} className="input-ios">
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {reason === 'أخرى' && (
              <div>
                <label className="label-ios">اكتب السبب</label>
                <input type="text" value={otherReason} onChange={e => setOtherReason(e.target.value)}
                  placeholder="سبب الهدر" className="input-ios" />
              </div>
            )}

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
              {pickedInfo && (
                <p className={`text-xs mt-1 font-semibold ${available <= 0 ? 'text-ios-red' : 'text-ios-label'}`}>
                  📦 المخزون الحالي: {fmtQty(pickedInfo.current_quantity)} {pickedInfo.unit || ''}
                </p>
              )}
              {invItems.length === 0 && (
                <p className="text-ios-orange text-sm font-semibold mt-1">⚠️ هذا الفرع ما بيه مواد جرد — أضفها من الإدارة العامة أولاً</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-ios">الكمية المهدوَرة</label>
                <input type="number" min="0" step="0.001" value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder={available !== null ? `الحد الأقصى: ${fmtQty(available)}` : '0'}
                  className={`input-ios ${overStock ? '!border-ios-red' : ''}`} />
                {overStock && (
                  <p className="text-ios-red text-xs font-bold mt-1">⚠️ الكمية أكبر من الموجود بالمخزون ({fmtQty(available)} {pickedInfo?.unit || ''})</p>
                )}
              </div>
              <div>
                <label className="label-ios">ملاحظات (اختياري)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="ملاحظات" className="input-ios" />
              </div>
            </div>

            <button type="submit" disabled={saving || !selectedBranch || overStock || (pickedInfo && available <= 0)}
              className="btn-ios w-full md:w-auto disabled:opacity-40">
              {saving ? 'جاري التسجيل...' : '🗑️ تسجيل الهدر'}
            </button>
          </form>
        </div>
      ) : (
        <p className="text-center text-ios-label py-4 font-semibold">👀 عرض فقط — ما عندك صلاحية تسجيل الهدر</p>
      )}

      <div className="section-title">
        <h3>📋 سجلات الهدر الأخيرة ({records.length})</h3>
      </div>
      {records.length === 0 ? (
        <p className="text-center text-ios-label py-8">لا توجد سجلات هدر</p>
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
                    <th>السبب</th>
                    <th>التاريخ / المسجّل</th>
                    {user?.role === 'admin' && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map(rec => (
                    <tr key={rec.id}>
                      <td className="font-bold text-ios-text whitespace-nowrap">#{rec.id}</td>
                      <td className="text-ios-label whitespace-nowrap">{rec.branch_name}</td>
                      <td className="font-semibold text-ios-text whitespace-nowrap">{rec.item_name}</td>
                      <td className="text-center font-bold text-ios-red">{fmtQty(rec.quantity)} <span className="text-xs text-ios-label font-normal">{rec.unit || ''}</span></td>
                      <td className="text-xs text-ios-label max-w-[160px]">
                        {rec.reason || '—'}
                        {rec.notes && <div className="text-[10px]">{rec.notes}</div>}
                      </td>
                      <td className="text-xs text-ios-label whitespace-nowrap">
                        {new Date(rec.created_at).toLocaleString('ar')}
                        <div>{rec.created_by_name || '—'}</div>
                      </td>
                      {user?.role === 'admin' && (
                        <td className="text-center">
                          <button onClick={() => deleteRecord(rec)}
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
            {records.map(rec => (
              <div key={rec.id} className="card-ios p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ios-text">#{rec.id}</span>
                  {user?.role === 'admin' && (
                    <button onClick={() => deleteRecord(rec)}
                      className="px-3 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">
                      🗑️ حذف
                    </button>
                  )}
                </div>
                <div className="text-sm"><span className="label-ios">الفرع</span>{rec.branch_name}</div>
                <div className="text-sm"><span className="label-ios">المادة</span>{rec.item_name}</div>
                <div className="text-sm"><span className="label-ios">الكمية</span><span className="font-bold text-ios-red">{fmtQty(rec.quantity)} {rec.unit || ''}</span></div>
                <div className="text-sm"><span className="label-ios">السبب</span>{rec.reason || '—'}</div>
                {rec.notes && <div className="text-sm"><span className="label-ios">ملاحظات</span>{rec.notes}</div>}
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
