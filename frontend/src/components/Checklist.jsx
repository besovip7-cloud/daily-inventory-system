import { getToken } from '../utils/token'
import { useState, useEffect } from 'react'
import { visibleBranches } from '../utils/branchScope'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const PERIODS = { morning: '🌅 صباحي', evening: '🌙 مسائي' }
const ITEM_PERIODS = { morning: 'صباحي', evening: 'مسائي', both: 'كلاهما' }

const todayStr = () => new Date().toISOString().split('T')[0]

export default function Checklist({ user }) {
  const token = getToken()
  const headers = { Authorization: `Bearer ${token}` }
  const isAdmin = user?.role === 'admin'

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [date, setDate] = useState(todayStr())
  const [period, setPeriod] = useState('morning')
  const [items, setItems] = useState([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [pending, setPending] = useState(new Set())
  const [message, setMessage] = useState('')
  const [overview, setOverview] = useState([])

  // إدارة البنود (أدمن)
  const [showManage, setShowManage] = useState(false)
  const [allItems, setAllItems] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [newPeriod, setNewPeriod] = useState('both')
  const [editItem, setEditItem] = useState(null) // {id, title, period}
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers })
      .then(r => r.json())
      .then(data => {
        const visible = visibleBranches(user, data || [])
        setBranches(visible)
        if (visible.length > 0) setSelectedBranch(String(visible[0].id))
      })
  }, [])

  useEffect(() => { loadChecks() }, [selectedBranch, date, period])

  useEffect(() => {
    if (isAdmin) loadOverview()
  }, [isAdmin, date])

  useEffect(() => {
    if (isAdmin && showManage) loadAllItems()
  }, [isAdmin, showManage])

  const loadChecks = () => {
    if (!selectedBranch) return
    const branchParam = isAdmin ? `branch_id=${selectedBranch}&` : ''
    fetch(`${API_URL}/checklist/checks?${branchParam}date=${date}&period=${period}`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setItems(d.items || [])
        setProgress(d.progress || { done: 0, total: 0 })
      })
      .catch(() => {})
  }

  const loadOverview = () => {
    fetch(`${API_URL}/checklist/overview?date=${date}`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setOverview(Array.isArray(d) ? d : []))
      .catch(() => setOverview([]))
  }

  const loadAllItems = () => {
    fetch(`${API_URL}/checklist/items`, { headers })
      .then(r => r.json())
      .then(d => setAllItems(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  const show = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggle = async (item) => {
    const target = !item.checked
    // تحديث متفائل بالواجهة أولاً
    setPending(prev => new Set(prev).add(item.id))
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, checked: target, checked_by_name: target ? (user?.name || 'أنا') : null, checked_at: target ? new Date().toISOString() : null }
      : i))
    setProgress(prev => ({ ...prev, done: prev.done + (target ? 1 : -1) }))
    try {
      const res = await fetch(`${API_URL}/checklist/checks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          date,
          period,
          checked: target,
          ...(isAdmin ? { branch_id: parseInt(selectedBranch) } : {})
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // ارجع التغيير
        setItems(prev => prev.map(i => i.id === item.id ? item : i))
        setProgress(prev => ({ ...prev, done: prev.done + (target ? -1 : 1) }))
        show('❌ ' + (data.message || 'فشل الحفظ'))
      }
    } catch {
      setItems(prev => prev.map(i => i.id === item.id ? item : i))
      setProgress(prev => ({ ...prev, done: prev.done + (target ? -1 : 1) }))
      show('❌ خطأ في الاتصال')
    }
    setPending(prev => {
      const next = new Set(prev)
      next.delete(item.id)
      return next
    })
  }

  // ── إدارة البنود (أدمن) ──
  const addItem = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/checklist/items`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), period: newPeriod })
      })
      const data = await res.json()
      if (res.ok) { show('✅ تمت إضافة البند'); setNewTitle(''); setNewPeriod('both'); loadAllItems(); loadChecks() }
      else show('❌ ' + (data.message || 'فشلت الإضافة'))
    } catch { show('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const saveItem = async (it) => {
    if (!editItem.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/checklist/items/${it.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editItem.title.trim(), period: editItem.period })
      })
      const data = await res.json()
      if (res.ok) { show('✅ تم حفظ البند'); setEditItem(null); loadAllItems(); loadChecks() }
      else show('❌ ' + (data.message || 'فشل الحفظ'))
    } catch { show('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const toggleActive = async (it) => {
    try {
      const res = await fetch(`${API_URL}/checklist/items/${it.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: it.title, period: it.period, is_active: !it.is_active })
      })
      const data = await res.json()
      if (res.ok) { show(data.is_active ? '✅ تم تفعيل البند' : '✅ تم إيقاف البند'); loadAllItems(); loadChecks() }
      else show('❌ ' + (data.message || 'فشل التحديث'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  const deleteItem = async (it) => {
    if (!window.confirm(`حذف البند "${it.title}"؟\nراح ينحذف تعليمه بالأيام السابقة أيضاً.`)) return
    try {
      const res = await fetch(`${API_URL}/checklist/items/${it.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { show('✅ ' + (data.message || 'تم الحذف')); loadAllItems(); loadChecks() }
      else show('❌ ' + (data.message || 'فشل الحذف'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  const reorder = async (index, dir) => {
    const target = index + dir
    if (target < 0 || target >= allItems.length) return
    const next = [...allItems]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setAllItems(next)
    try {
      await fetch(`${API_URL}/checklist/items/reorder`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map(i => i.id) })
      })
    } catch { show('❌ خطأ في حفظ الترتيب') }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const isOldDay = date < todayStr()

  return (
    <div dir="rtl">
      <PageHeader title="📋 قائمة الفحص" subtitle="فحص يومي للفرع — صباحي ومسائي" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      {/* صف التحكم: فرع + تاريخ + فترة */}
      <div className="card-ios p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {isAdmin && (
            <div>
              <label className="label-ios">الفرع</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                className="input-ios">
                {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label-ios">التاريخ</label>
            <input type="date" value={date} max={todayStr()}
              onChange={e => setDate(e.target.value)} className="input-ios" />
          </div>
          <div>
            <label className="label-ios">الفترة</label>
            <div className="segmented">
              {Object.entries(PERIODS).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setPeriod(key)}
                  className={`segmented-item ${period === key ? 'segmented-item-active' : ''}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {!isAdmin && (
          <p className="text-xs text-ios-label font-semibold mt-2">🏪 {branches[0]?.name || 'فرعك'}</p>
        )}
      </div>

      {/* شريط التقدم */}
      <div className="card-ios p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-ios-text text-sm">التقدم — {PERIODS[period]}</span>
          <span className="font-bold text-ios-blue text-sm">{progress.done} / {progress.total} ({pct}%)</span>
        </div>
        <div className="h-3 rounded-full bg-ios-fill overflow-hidden">
          <div className="h-full rounded-full bg-ios-green transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* البنود */}
      {items.length === 0 ? (
        <p className="text-center text-ios-label py-10">لا توجد بنود لهذه الفترة</p>
      ) : (
        <div className="space-y-2 mb-6">
          {items.map(item => (
            <button key={item.id} type="button" onClick={() => !pending.has(item.id) && toggle(item)}
              disabled={pending.has(item.id)}
              className={`w-full text-right rounded-2xl border p-4 transition active:opacity-70 flex items-center gap-3 ${
                item.checked ? 'border-ios-green/40 bg-ios-green/10' : 'border-ios-sep bg-white'
              } ${pending.has(item.id) ? 'opacity-60' : ''}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0 ${
                item.checked ? 'bg-ios-green text-white' : 'border-2 border-ios-sep text-transparent'
              }`}>
                ✓
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block font-semibold text-sm ${item.checked ? 'text-ios-text line-through opacity-70' : 'text-ios-text'}`}>
                  {item.title}
                </span>
                {item.checked && (
                  <span className="block text-[11px] text-ios-green font-semibold mt-0.5">
                    ✓ بواسطة {item.checked_by_name || '—'} — {item.checked_at ? new Date(item.checked_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
      {isOldDay && (
        <p className="text-center text-ios-orange text-sm font-semibold mb-6">⚠️ تعرض يوماً سابقاً — التعليم متاح للعرض فقط (ما تكدر تلغي تعليم أيام سابقة)</p>
      )}

      {/* نظرة على الفروع (أدمن) */}
      {isAdmin && (
        <div className="card-ios p-4 mb-6">
          <div className="section-title"><h3 className="mb-3">🏪 نظرة على الفروع — {date}</h3></div>
          {overview.length === 0 ? (
            <p className="text-ios-label text-sm">لا توجد فروع</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {overview.map(o => {
                const complete = o.morning.done >= o.morning.total && o.evening.done >= o.evening.total
                return (
                  <span key={o.branch_id} title={o.missing_titles.join('\n') || 'مكتمل'}
                    className={`text-xs font-bold px-3 py-2 rounded-2xl cursor-default ${
                      complete ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-orange/15 text-[#B25000]'
                    }`}>
                    {complete ? '✅' : '⚠️'} {o.branch_name}
                    <span className="block text-[10px] font-normal opacity-80">
                      ص {o.morning.done}/{o.morning.total} • م {o.evening.done}/{o.evening.total}
                    </span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* إدارة البنود (أدمن) */}
      {isAdmin && (
        <div className="card-ios overflow-hidden mb-6">
          <button type="button" onClick={() => setShowManage(v => !v)}
            className="nav-item w-full !py-4 cursor-pointer">
            <span className="flex items-center gap-2.5 font-bold text-ios-text">
              <span>🛠️</span>
              <span>إدارة البنود ({allItems.length})</span>
            </span>
            <span className={`text-xs transition-transform duration-200 ${showManage ? 'text-ios-blue' : '-rotate-90 text-ios-label'}`}>▾</span>
          </button>
          {showManage && (
            <div className="p-4 border-t border-ios-sep">
              <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-[1fr_170px_auto] gap-2 mb-4">
                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="عنوان البند الجديد..." className="input-ios" />
                <select value={newPeriod} onChange={e => setNewPeriod(e.target.value)} className="input-ios">
                  <option value="both">🌗 كلاهما</option>
                  <option value="morning">🌅 صباحي</option>
                  <option value="evening">🌙 مسائي</option>
                </select>
                <button type="submit" disabled={saving || !newTitle.trim()}
                  className="btn-ios px-5 whitespace-nowrap disabled:opacity-40">➕ إضافة</button>
              </form>

              <div className="space-y-2">
                {allItems.map((it, idx) => (
                  <div key={it.id} className={`rounded-2xl border border-ios-sep bg-white p-3 ${!it.is_active ? 'opacity-55' : ''}`}>
                    {editItem?.id === it.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="text" value={editItem.title} autoFocus
                          onChange={e => setEditItem({ ...editItem, title: e.target.value })}
                          className="input-ios !py-1.5 text-sm flex-1 min-w-[140px]" />
                        <select value={editItem.period} onChange={e => setEditItem({ ...editItem, period: e.target.value })}
                          className="input-ios !py-1.5 text-sm w-32">
                          <option value="both">كلاهما</option>
                          <option value="morning">صباحي</option>
                          <option value="evening">مسائي</option>
                        </select>
                        <button type="button" disabled={saving} onClick={() => saveItem(it)}
                          className="px-3 py-1.5 rounded-xl bg-ios-green/15 text-[#1F7A33] text-xs font-bold disabled:opacity-40">💾 حفظ</button>
                        <button type="button" onClick={() => setEditItem(null)}
                          className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold">إلغاء</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <button type="button" onClick={() => reorder(idx, -1)} disabled={idx === 0}
                            className="text-ios-label text-xs px-1.5 py-0.5 rounded bg-ios-fill disabled:opacity-30 active:opacity-60">▲</button>
                          <button type="button" onClick={() => reorder(idx, 1)} disabled={idx === allItems.length - 1}
                            className="text-ios-label text-xs px-1.5 py-0.5 rounded bg-ios-fill disabled:opacity-30 active:opacity-60">▼</button>
                        </div>
                        <span className="font-semibold text-ios-text text-sm flex-1 min-w-0">
                          {it.title}
                          {!it.is_active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-ios-fill text-ios-label mr-2">موقوف</span>}
                        </span>
                        <span className="text-[10px] text-ios-label font-bold whitespace-nowrap">{ITEM_PERIODS[it.period]}</span>
                        <div className="flex gap-1 whitespace-nowrap">
                          <button type="button" onClick={() => setEditItem({ id: it.id, title: it.title, period: it.period })}
                            className="px-2 py-1.5 rounded-xl bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">✏️</button>
                          <button type="button" onClick={() => toggleActive(it)}
                            className="px-2 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold active:opacity-70">
                            {it.is_active ? '⏸️' : '▶️'}
                          </button>
                          <button type="button" onClick={() => deleteItem(it)}
                            className="px-2 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {allItems.length === 0 && (
                  <p className="text-center text-ios-label text-sm py-4">لا توجد بنود</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
