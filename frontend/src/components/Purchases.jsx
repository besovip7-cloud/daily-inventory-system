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

// عرض الكمية كما أُدخلت يدوياً بدون أصفار زائدة (30 بدل 30.000)
const fmtQty = (v) => {
  const n = parseFloat(v)
  if (isNaN(n)) return v ?? ''
  return String(Number(n.toFixed(3)))
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
      rows: req.items.map((it, i) => ({ n: i + 1, item_name: it.item_name, quantity: fmtQty(it.quantity), unit: it.unit || '' })),
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

  const deleteRequest = async (req) => {
    if (!window.confirm(`حذف طلب #${req.id} نهائياً؟\nهذا الإجراء ما يكدر يتراجع عنه.`)) return
    try {
      const res = await fetch(`${API_URL}/purchases/${req.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { show('✅ ' + (data.message || 'تم الحذف')); loadRequests() }
      else show('❌ ' + (data.message || 'فشل الحذف'))
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
              <div className="card-ios overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right min-w-[560px]">
                    <thead className="bg-[#F2F2F7]">
                      <tr>
                        <th className="p-3 font-bold text-ios-label text-xs w-10">#</th>
                        <th className="p-3 font-bold text-ios-label text-xs">المادة</th>
                        <th className="p-3 font-bold text-ios-label text-xs w-36">الكمية</th>
                        <th className="p-3 font-bold text-ios-label text-xs w-20">الوحدة</th>
                        <th className="p-3 font-bold text-ios-label text-xs w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-t border-ios-sep align-middle">
                          <td className="p-2 text-ios-label text-sm font-bold">{i + 1}</td>
                          <td className="p-2">
                            <select value={row.inventory_item_id} onChange={e => setRow(i, 'inventory_item_id', e.target.value)}
                              required className="input-ios w-full">
                              <option value="">— اختر المادة —</option>
                              {invItems.map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.name} {item.unit ? `(${item.unit})` : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input type="number" min="0" step="0.001" value={row.quantity} required
                              onChange={e => setRow(i, 'quantity', e.target.value)}
                              placeholder="الكمية" className="input-ios w-full" />
                          </td>
                          <td className="p-2 text-xs text-ios-label whitespace-nowrap">{itemUnit(row.inventory_item_id) || '—'}</td>
                          <td className="p-2 text-center">
                            {rows.length > 1 && (
                              <button type="button" onClick={() => removeRow(i)}
                                className="text-ios-red font-bold px-2 active:opacity-60">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-ios-sep">
                  <button type="button" onClick={addRow}
                    className="btn-ios-secondary text-sm px-4 py-2">➕ إضافة مادة</button>
                </div>
              </div>
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
        <div className="card-ios overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[900px]">
              <thead className="bg-[#F2F2F7]">
                <tr>
                  <th className="p-3 font-bold text-ios-label text-xs whitespace-nowrap">#</th>
                  <th className="p-3 font-bold text-ios-label text-xs whitespace-nowrap">الحالة</th>
                  <th className="p-3 font-bold text-ios-label text-xs whitespace-nowrap">الفرع</th>
                  <th className="p-3 font-bold text-ios-label text-xs whitespace-nowrap">المواد المطلوبة</th>
                  <th className="p-3 font-bold text-ios-label text-xs whitespace-nowrap">ملاحظات</th>
                  <th className="p-3 font-bold text-ios-label text-xs whitespace-nowrap">التاريخ / الطالب</th>
                  <th className="p-3 font-bold text-ios-label text-xs whitespace-nowrap">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} className="border-t border-ios-sep align-top">
                    <td className="p-3 font-bold text-ios-text whitespace-nowrap">طلب #{req.id}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusStyles[req.status]}`}>
                        {statusLabels[req.status]}
                      </span>
                      {req.status === 'received' && req.confirmed_by_name && (
                        <div className="text-[10px] text-ios-green mt-1 font-semibold">✓ {req.confirmed_by_name}</div>
                      )}
                    </td>
                    <td className="p-3 text-ios-label whitespace-nowrap">{req.branch_name}</td>
                    <td className="p-3">
                      <div className="space-y-1">
                        {req.items.map(it => (
                          <div key={it.id} className="flex items-center justify-between gap-2 bg-ios-fill rounded-lg px-2 py-1 text-xs whitespace-nowrap">
                            <span className="font-semibold text-ios-text">{it.item_name}</span>
                            <span className="text-ios-blue font-bold">{fmtQty(it.quantity)} {it.unit || ''}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-ios-label max-w-[140px]">{req.notes || '—'}</td>
                    <td className="p-3 text-xs text-ios-label whitespace-nowrap">
                      {new Date(req.created_at).toLocaleString('ar')}
                      <div>{req.created_by_name || '—'}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5 whitespace-nowrap">
                        {req.status === 'pending' && (
                          <>
                            <button onClick={() => confirm(req)}
                              className="px-3 py-1.5 rounded-xl bg-ios-green/15 text-[#1F7A33] text-xs font-bold active:opacity-70">
                              ✅ تأكيد
                            </button>
                            <button onClick={() => cancel(req)}
                              className="px-3 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">
                              إلغاء
                            </button>
                          </>
                        )}
                        <button onClick={() => printRequest(req)}
                          className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold active:opacity-70">
                          🖨️ طباعة
                        </button>
                        {user?.role === 'admin' && req.status !== 'pending' && (
                          <button onClick={() => deleteRequest(req)}
                            className="px-3 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
