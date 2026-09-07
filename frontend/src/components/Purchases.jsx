import { useState, useEffect } from 'react'
import { visibleBranches, isBranchLocked } from '../utils/branchScope'
import { printReport } from '../utils/export'
import { fetchSettings, getCachedSettings } from '../utils/settings'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const statusLabels = { pending: '⏳ معلق', received: '✅ مستلم', cancelled: '❌ ملغي' }
const statusStyles = {
  pending: 'bg-ios-orange/15 text-[#B25000]',
  received: 'bg-ios-green/15 text-[#1F7A33]',
  cancelled: 'bg-ios-fill text-ios-label',
}

export default function Purchases({ user }) {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const branchLocked = isBranchLocked(user)
  const canCreate = ['admin', 'manager', 'staff'].includes(user?.role)

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [invItems, setInvItems] = useState([])
  const [rows, setRows] = useState([{ inventory_item_id: '', quantity: '' }])
  const [notes, setNotes] = useState('')
  const [requests, setRequests] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [settings, setSettings] = useState(getCachedSettings())

  useEffect(() => { fetchSettings().then(setSettings) }, [])

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

  useEffect(() => { loadRequests() }, [])

  const loadRequests = () => {
    fetch(`${API_URL}/purchases`, { headers })
      .then(r => r.json())
      .then(d => setRequests(d || []))
      .catch(() => {})
  }

  const setRow = (i, field, value) => {
    setRows(prev => prev.map((row, j) => j === i ? { ...row, [field]: value } : row))
  }

  const addRow = () => setRows(prev => [...prev, { inventory_item_id: '', quantity: '' }])
  const removeRow = (i) => setRows(prev => prev.filter((_, j) => j !== i))

  const itemUnit = (id) => invItems.find(i => i.id === parseInt(id))?.unit || ''

  const submit = async (e) => {
    e.preventDefault()
    const clean = rows.filter(r => r.inventory_item_id && parseFloat(r.quantity) > 0)
    if (clean.length === 0) return show('❌ أضف مادة بكمية صحيحة أولاً')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/purchases`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: parseInt(selectedBranch),
          items: clean.map(r => ({ inventory_item_id: parseInt(r.inventory_item_id), quantity: parseFloat(r.quantity) })),
          notes: notes || undefined
        })
      })
      const data = await res.json()
      if (res.ok) {
        show('✅ تم إنشاء طلب الشراء — باقي معلق لحد تأكيد الاستلام')
        setRows([{ inventory_item_id: '', quantity: '' }])
        setNotes('')
        loadRequests()
      } else {
        show('❌ فشل: ' + (data.message || ''))
      }
    } catch {
      show('❌ خطأ في الاتصال')
    }
    setSaving(false)
  }

  const show = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const printRequest = (req) => {
    printReport({
      title: `طلب شراء #${req.id}`,
      subtitle: [
        `الفرع: ${req.branch_name}`,
        `التاريخ: ${new Date(req.created_at).toLocaleString('ar')}`,
        `طلب بواسطة: ${req.created_by_name || '—'}`,
        `الحالة: ${statusLabels[req.status] || req.status}`,
        req.notes ? `ملاحظات: ${req.notes}` : null,
        req.status === 'received' && req.confirmed_by_name ? `استلمها: ${req.confirmed_by_name}` : null
      ].filter(Boolean).join(' • '),
      columns: [
        { key: 'n', label: '#' },
        { key: 'item_name', label: 'المادة' },
        { key: 'quantity', label: 'الكمية' },
        { key: 'unit', label: 'الوحدة' },
      ],
      rows: req.items.map((it, i) => ({ n: i + 1, ...it })),
      totals: [{ label: 'عدد المواد', value: String(req.items.length) }],
      company: { name: settings.company_name, logo: settings.company_logo },
    })
  }

  const confirm = async (req) => {
    if (!window.confirm(`تأكيد استلام طلب #${req.id}؟\nراح تضاف الكميات لجرد "${req.branch_name}" تلقائياً.`)) return
    try {
      const res = await fetch(`${API_URL}/purchases/${req.id}/confirm`, { method: 'PUT', headers })
      const data = await res.json()
      if (res.ok) { show('✅ ' + data.message); loadRequests() }
      else show('❌ ' + (data.message || 'فشل التأكيد'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  const cancel = async (req) => {
    if (!window.confirm(`إلغاء طلب الشراء #${req.id}؟`)) return
    try {
      const res = await fetch(`${API_URL}/purchases/${req.id}/cancel`, { method: 'PUT', headers })
      const data = await res.json()
      if (res.ok) { show('✅ تم إلغاء الطلب'); loadRequests() }
      else show('❌ ' + (data.message || 'فشل الإلغاء'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-ios-text tracking-tight">🛒 طلبات الشراء</h2>

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      {canCreate && (
        <div className="card-ios p-6 mb-6">
          <h3 className="text-lg font-bold mb-4 text-ios-text">📝 طلب شراء جديد</h3>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-ios">الفرع</label>
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                  disabled={branchLocked} className="input-ios disabled:opacity-60">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-ios">ملاحظات (اختياري)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="مثلاً: ضروري قبل نهاية الأسبوع" className="input-ios" />
              </div>
            </div>

            <div>
              <label className="label-ios">المواد المطلوبة</label>
              {rows.map((row, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select value={row.inventory_item_id} onChange={e => setRow(i, 'inventory_item_id', e.target.value)}
                    required className="input-ios flex-1">
                    <option value="">— اختر المادة —</option>
                    {invItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} {item.unit ? `(${item.unit})` : ''}
                      </option>
                    ))}
                  </select>
                  <input type="number" min="0" step="0.001" value={row.quantity} required
                    onChange={e => setRow(i, 'quantity', e.target.value)}
                    placeholder="الكمية" className="input-ios w-32" />
                  <span className="self-center text-xs text-ios-label w-14">{itemUnit(row.inventory_item_id)}</span>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)}
                      className="text-ios-red font-bold px-2 active:opacity-60 self-center">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addRow}
                className="btn-ios-secondary text-sm px-4 py-2">➕ إضافة مادة</button>
            </div>

            <button type="submit" disabled={saving || invItems.length === 0}
              className="btn-ios w-full md:w-auto disabled:opacity-40">
              {saving ? 'جاري الإرسال...' : '📨 إرسال الطلب'}
            </button>
            {invItems.length === 0 && (
              <p className="text-ios-orange text-sm font-semibold">⚠️ هذا الفرع ما بيه مواد جرد — أضفها من الإدارة العامة أولاً</p>
            )}
          </form>
        </div>
      )}

      <h3 className="font-bold text-ios-text mb-3">📋 الطلبات ({requests.length})</h3>
      {requests.length === 0 ? (
        <p className="text-center text-ios-label py-8">لا توجد طلبات شراء</p>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="card-ios p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ios-text">طلب #{req.id}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusStyles[req.status]}`}>
                    {statusLabels[req.status]}
                  </span>
                </div>
                <span className="text-xs text-ios-label">
                  {new Date(req.created_at).toLocaleString('ar')} • {req.branch_name} • {req.created_by_name || '—'}
                </span>
                <button onClick={() => printRequest(req)}
                  className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold active:opacity-70">
                  🖨️ طباعة
                </button>
              </div>
              <div className="text-sm text-ios-text">
                {req.items.map(it => (
                  <span key={it.id} className="inline-block bg-ios-fill rounded-lg px-2 py-1 m-0.5">
                    {it.item_name} <b className="text-ios-blue">{it.quantity}</b> {it.unit || ''}
                  </span>
                ))}
              </div>
              {req.notes && <p className="text-xs text-ios-label mt-1">📝 {req.notes}</p>}
              {req.status === 'received' && req.confirmed_by_name && (
                <p className="text-xs text-ios-green mt-1 font-semibold">✓ استلمها: {req.confirmed_by_name} — {req.confirmed_at ? new Date(req.confirmed_at).toLocaleString('ar') : ''}</p>
              )}
              {req.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => confirm(req)}
                    className="btn-ios text-xs px-4 py-2">✅ تأكيد الاستلام</button>
                  <button onClick={() => cancel(req)}
                    className="btn-ios-danger text-xs px-4 py-2">إلغاء الطلب</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
