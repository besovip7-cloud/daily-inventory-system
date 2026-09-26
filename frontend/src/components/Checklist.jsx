import { getToken } from '../utils/token'
import { hasPerm } from '../utils/permissions'
import { useState, useEffect } from 'react'
import { visibleBranches } from '../utils/branchScope'
import { printReport } from '../utils/export'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const PERIODS = { morning: '🌅 صباحي', evening: '🌙 مسائي' }
const ITEM_PERIODS = { morning: 'صباحي', evening: 'مسائي', both: 'كلاهما' }

// عناوين مختصرة للطباعة فقط — أسماء الأقسام الكاملة تبقى بالواجهة
const PRINT_SHORT_TITLES = {
  'المنطقة الأمامية': 'الأمامية',
  'أجهزة التطبيقات': 'الأجهزة',
  'عارضة المقبلات': 'المقبلات',
}

// تاريخ اليوم بتوقيت العراق (UTC+3) — نفس حساب الباك إند حتى لا يختلف "اليوم" بين الطرفين بعد منتصف الليل
const todayStr = () => new Date(Date.now() + 3 * 3600e3).toISOString().split('T')[0]

// ضغط الصورة بالمتصفح: أبعاد قصوى 800px وجودة JPEG 0.7
const compressImage = (file) => new Promise((resolve, reject) => {
  const img = new Image()
  const url = URL.createObjectURL(file)
  img.onload = () => {
    const max = 800
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    resolve(canvas.toDataURL('image/jpeg', 0.7))
  }
  img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
  img.src = url
})

export default function Checklist({ user }) {
  const token = getToken()
  const headers = { Authorization: `Bearer ${token}` }
  const isAdmin = user?.role === 'admin'
  const canApprove = hasPerm(user, 'checklist.approve')

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [date, setDate] = useState(todayStr())
  const [view, setView] = useState('daily') // 'daily' | 'monthly'
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [monthData, setMonthData] = useState(null)
  const [checks, setChecks] = useState({ morning: null, evening: null }) // كل فترة: {items, progress}
  const [approval, setApproval] = useState({ approved: false, approved_by_name: null, approved_at: null, approval_note: null })
  const [approveNote, setApproveNote] = useState('')
  const [pending, setPending] = useState(new Set())
  const [message, setMessage] = useState('')
  const [overview, setOverview] = useState([])

  // الملاحظات والصور
  const [noteEditor, setNoteEditor] = useState(null) // row المفتوح
  const [reasonPeriod, setReasonPeriod] = useState(null) // فترة وضع السبب (✗ على بند غير مقيّم)
  const [cellAction, setCellAction] = useState(null) // {row, period} لبند مقيّم — خيارات التعديل/المسح
  const [clearingDay, setClearingDay] = useState(null) // رقم اليوم الجاري مسحه بالشهرية
  const [drafts, setDrafts] = useState({}) // {morning: {note, photo}, evening: {...}}
  const [noteSaving, setNoteSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)

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

  useEffect(() => { loadChecks() }, [selectedBranch, date])

  useEffect(() => { if (view === 'monthly') loadMonth() }, [view, selectedBranch, month])

  useEffect(() => {
    if (isAdmin) loadOverview()
  }, [isAdmin, date])

  useEffect(() => {
    if (isAdmin && showManage) loadAllItems()
  }, [isAdmin, showManage])

  const fetchPeriod = (period) => {
    const branchParam = isAdmin ? `branch_id=${selectedBranch}&` : ''
    return fetch(`${API_URL}/checklist/checks?${branchParam}date=${date}&period=${period}`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => ({ items: d.items || [], progress: d.progress || { done: 0, total: 0 } }))
  }

  const loadChecks = () => {
    if (!selectedBranch) return
    setChecks({ morning: null, evening: null })
    Promise.all([fetchPeriod('morning'), fetchPeriod('evening')])
      .then(([m, e]) => setChecks({ morning: m, evening: e }))
      .catch(() => setChecks({ morning: { items: [], progress: { done: 0, total: 0 } }, evening: { items: [], progress: { done: 0, total: 0 } } }))
    // حالة الاعتماد تيجي مع رد الفترة الصباحية
    const branchParam = isAdmin ? `branch_id=${selectedBranch}&` : ''
    fetch(`${API_URL}/checklist/checks?${branchParam}date=${date}&period=morning`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setApproval({
        approved: !!d.approved,
        approved_by_name: d.approved_by_name || null,
        approved_at: d.approved_at || null,
        approval_note: d.approval_note || null
      }))
      .catch(() => {})
  }

  const loadMonth = () => {
    if (!selectedBranch) return
    const branchParam = isAdmin ? `branch_id=${selectedBranch}&` : ''
    fetch(`${API_URL}/checklist/month?${branchParam}month=${month}`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setMonthData(d))
      .catch(() => setMonthData(null))
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

  // دمج بنود الفترتين في صف واحد (المفتاح id البند)
  const rows = []
  const rowById = {}
  const merge = (periodData, key) => {
    if (!periodData) return
    periodData.items.forEach(i => {
      if (!rowById[i.id]) {
        rowById[i.id] = { id: i.id, title: i.title, period: i.period, m: null, e: null }
        rows.push(rowById[i.id])
      }
      if (i.checked) rowById[i.id][key] = i
    })
  }
  merge(checks.morning, 'm')
  merge(checks.evening, 'e')

  const applicable = (item, period) => item.period === 'both' || item.period === period

  // عدد خلايا "غير نظيف" (fail) بكل الفترات — للعرض والاعتماد
  const failCount = rows.reduce((n, row) =>
    n + (applicable(row, 'morning') && row.m?.status === 'fail' ? 1 : 0)
      + (applicable(row, 'evening') && row.e?.status === 'fail' ? 1 : 0), 0)

  // تحديث متفائل لعنصر بند بفترة معينة
  const patchItem = (period, itemId, patch) => setChecks(prev => ({
    ...prev,
    [period]: {
      ...prev[period],
      items: prev[period].items.map(i => i.id === itemId ? { ...i, ...patch } : i)
    }
  }))

  const bumpProgress = (period, delta) => setChecks(prev => ({
    ...prev,
    [period]: { ...prev[period], progress: { ...prev[period].progress, done: Math.max(0, prev[period].progress.done + delta) } }
  }))

  // إرسال الحالة للسيرفر — يرجع true عند النجاح
  const postStatus = async (row, period, status, extra = {}) => {
    const pendKey = `${row.id}:${period}`
    setPending(prev => new Set(prev).add(pendKey))
    let ok = false
    try {
      const res = await fetch(`${API_URL}/checklist/checks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: row.id,
          date,
          period,
          status,
          ...extra,
          ...(isAdmin ? { branch_id: parseInt(selectedBranch) } : {})
        })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) ok = true
      else { show('❌ ' + (data.message || 'فشل الحفظ')); loadChecks() }
    } catch {
      show('❌ خطأ في الاتصال')
      loadChecks()
    }
    setPending(prev => {
      const next = new Set(prev)
      next.delete(pendKey)
      return next
    })
    return ok
  }

  // ✓ على بند غير مقيّم — تقييم فوري "نظيف"
  const markPass = async (row, period) => {
    patchItem(period, row.id, {
      checked: true, status: 'pass',
      checked_by_name: user?.name || 'أنا', checked_at: new Date().toISOString(),
      note: null, photo: null
    })
    bumpProgress(period, 1)
    await postStatus(row, period, 'pass')
  }

  // تغيير بند مقيّم (خطأ) إلى نظيف
  const changeToPass = async (row, period) => {
    patchItem(period, row.id, {
      status: 'pass',
      checked_by_name: user?.name || 'أنا', checked_at: new Date().toISOString()
    })
    await postStatus(row, period, 'pass')
  }

  // مسح تعليم بند (ما يشتغل على أيام سابقة — السيرفر يرفض)
  const clearCheck = async (row, period) => {
    if (!window.confirm('مسح تعليم هذا البند؟')) return false
    patchItem(period, row.id, {
      checked: false, status: null,
      checked_by_name: null, checked_at: null, note: null, photo: null
    })
    bumpProgress(period, -1)
    return postStatus(row, period, null)
  }

  // مسح كل تعليمات يوم من الشهرية — للأدمن في أي يوم (الباك إند يرفض غير الأدمن)
  const clearDay = async (d) => {
    const day = dayMap[d]
    const entries = Object.entries(day?.checks || {}).filter(([, c]) => c.m || c.e)
    if (entries.length === 0) return
    if (!window.confirm(`مسح كل تعليمات يوم ${d} (${entries.length} قسم)؟`)) return
    setClearingDay(d)
    let failed = 0
    for (const [itemId, c] of entries) {
      for (const [key, period] of [['m', 'morning'], ['e', 'evening']]) {
        if (!c[key]) continue
        const ok = await postStatus({ id: parseInt(itemId) }, period, null)
        if (!ok) failed++
      }
    }
    setClearingDay(null)
    show(failed === 0 ? '✅ تم مسح تعليمات اليوم' : `⚠️ مسح جزئي — ${failed} عملية فشلت`)
    loadMonth()
  }

  // ── الملاحظات والصور ──
  // reasonPeriod: وضع السبب — يعرض فترة وحدة ويلزم كتابة السبب ويرسل status:'fail'
  const openNoteEditor = (row, reasonPeriod = null) => {
    const d = {}
    Object.keys(PERIODS).forEach(p => {
      const c = p === 'morning' ? row.m : row.e
      d[p] = { note: c?.note || '', photo: c?.photo || null }
    })
    setDrafts(d)
    setReasonPeriod(reasonPeriod)
    setNoteEditor(row)
  }

  const closeNoteEditor = () => { setNoteEditor(null); setReasonPeriod(null) }

  const pickPhoto = async (e, period) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await compressImage(file)
      if (dataUrl.length > 700000) return show('❌ الصورة كبيرة جداً — أعد تصويرها')
      setDrafts(prev => ({ ...prev, [period]: { ...prev[period], photo: dataUrl } }))
    } catch { show('❌ ما كدرت أقرأ الصورة') }
  }

  const saveNotes = async () => {
    setNoteSaving(true)
    let okCount = 0
    const periods = reasonPeriod ? [reasonPeriod] : Object.keys(PERIODS)
    for (const period of periods) {
      if (!applicable(noteEditor, period)) continue
      const current = checks[period]?.items.find(i => i.id === noteEditor.id)
      const draft = drafts[period] || { note: '', photo: null }
      const isReason = reasonPeriod === period
      // وضع السبب: السبب المطلوب مضمون (زر الحفظ معطّل بدونه)
      if (isReason && !draft.note.trim()) continue
      // الوضع العادي: لا تنشئ سجلاً فارغاً لبند غير معلّم بدون ملاحظة ولا صورة
      if (!isReason && !current?.checked && !draft.note.trim() && !draft.photo) continue
      try {
        const res = await fetch(`${API_URL}/checklist/checks`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: noteEditor.id,
            date,
            period,
            status: isReason ? 'fail' : (current?.status || 'pass'),
            note: draft.note,
            ...(draft.photo ? { photo: draft.photo } : {}),
            ...(isAdmin ? { branch_id: parseInt(selectedBranch) } : {})
          })
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) okCount++
        else show('❌ ' + (data.message || 'فشل حفظ الملاحظة'))
      } catch { show('❌ خطأ في الاتصال') }
    }
    if (okCount > 0) show(reasonPeriod ? '✅ تم حفظ السبب' : '✅ تم حفظ الملاحظات')
    setNoteSaving(false)
    setNoteEditor(null)
    setReasonPeriod(null)
    loadChecks()
  }

  // ── الاعتماد ──
  const approve = async () => {
    try {
      const res = await fetch(`${API_URL}/checklist/approve`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, note: approveNote || undefined, ...(isAdmin ? { branch_id: parseInt(selectedBranch) } : {}) })
      })
      const data = await res.json()
      if (res.ok) {
        show('✅ تم اعتماد سجل اليوم')
        setApproveNote('')
        setApproval({ approved: true, approved_by_name: user?.name, approved_at: new Date().toISOString(), approval_note: approveNote || null })
      } else show('❌ ' + (data.message || 'فشل الاعتماد'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  const unapprove = async () => {
    if (!window.confirm('إلغاء اعتماد هذا اليوم؟')) return
    try {
      const res = await fetch(`${API_URL}/checklist/approve`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...(isAdmin ? { branch_id: parseInt(selectedBranch) } : {}) })
      })
      const data = await res.json()
      if (res.ok) {
        show('✅ تم إلغاء الاعتماد')
        setApproval({ approved: false, approved_by_name: null, approved_at: null, approval_note: null })
      } else show('❌ ' + (data.message || 'فشل إلغاء الاعتماد'))
    } catch { show('❌ خطأ في الاتصال') }
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
      if (res.ok) { show(data.is_active ? '✅ تم تفعيل البند' : '✅ تم إيقاف البند'); loadAllItems(); loadChecks(); if (view === 'monthly') loadMonth() }
      else show('❌ ' + (data.message || 'فشل التحديث'))
    } catch { show('❌ خطأ في الاتصال') }
  }

  const deleteItem = async (it) => {
    if (!window.confirm(`حذف البند "${it.title}"؟\nراح ينحذف تعليمه بالأيام السابقة أيضاً.`)) return
    try {
      const res = await fetch(`${API_URL}/checklist/items/${it.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { show('✅ ' + (data.message || 'تم الحذف')); loadAllItems(); loadChecks(); if (view === 'monthly') loadMonth() }
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

  // خلية التقييم: بند غير مقيّم = زرا ✓/✗ مباشرين؛ بند مقيّم = الضغط يفتح خيارات التعديل والمسح
  const checkCell = (row, period, key) => {
    if (!applicable(row, period)) {
      return <span className="text-ios-label text-sm">—</span>
    }
    const c = row[key]
    const pendKey = `${row.id}:${period}`
    const isPending = pending.has(pendKey)
    const btnBase = 'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition active:scale-90 disabled:opacity-50'
    if (!c) {
      return (
        <div className="flex items-center justify-center gap-1.5">
          <button type="button" onClick={() => markPass(row, period)} disabled={isPending}
            title={`${PERIODS[period]} — نظيف`}
            className={`${btnBase} border-2 border-ios-green text-ios-green hover:bg-ios-green/10`}>✓</button>
          <button type="button" onClick={() => openNoteEditor(row, period)} disabled={isPending}
            title={`${PERIODS[period]} — خطأ (يلزم كتابة السبب)`}
            className={`${btnBase} border-2 border-ios-red text-ios-red hover:bg-ios-red/10`}>✗</button>
        </div>
      )
    }
    const isFail = c.status === 'fail'
    // المختار ملوّن صافي وغير المختار يبهت رمادياً لتبيان الحالة بلمحة
    return (
      <div className="flex items-center justify-center gap-1.5">
        <button type="button" onClick={() => setCellAction({ row, period })} disabled={isPending}
          title={`${PERIODS[period]} — ${isFail ? 'غير نظيف' : 'نظيف'} — اضغط للتعديل`}
          className={`${btnBase} ${isFail ? 'bg-ios-fill/70 text-ios-label' : 'bg-ios-green text-white shadow-sm'}`}>✓</button>
        <button type="button" onClick={() => setCellAction({ row, period })} disabled={isPending}
          title={`${PERIODS[period]} — ${isFail ? 'غير نظيف' : 'نظيف'} — اضغط للتعديل`}
          className={`${btnBase} ${isFail ? 'bg-ios-red text-white shadow-sm' : 'bg-ios-fill/70 text-ios-label'}`}>✗</button>
        {isAdmin && (
          <button type="button" onClick={() => clearCheck(row, period)} disabled={isPending}
            title={`${PERIODS[period]} — مسح التعليم (أدمن)`}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-ios-red/10 text-ios-red hover:bg-ios-red/25 active:scale-90 disabled:opacity-40">🗑️</button>
        )}
      </div>
    )
  }

  // مؤشر الملاحظة/الصورة بالعنوان
  const noteBtn = (row) => {
    const hasContent = ['m', 'e'].some(k => row[k] && (row[k].note || row[k].photo))
    return (
      <button type="button" onClick={() => openNoteEditor(row)} title="ملاحظة وصورة"
        className={`text-sm px-1.5 py-0.5 rounded-lg active:opacity-60 ${hasContent ? 'bg-ios-blue/15' : 'bg-ios-fill/60'}`}>
        {hasContent ? '📝📷' : '📝'}
      </button>
    )
  }

  const checkLine = (c, label) => c
    ? `${label} ✓ ${c.checked_by_name || '—'} ${c.checked_at ? new Date(c.checked_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) : ''}`
    : null

  // سطور حالة البند تحت العنوان: أسباب حمراء للخطأ + سطور خضراء للنظيف
  const rowStatusLines = (row) => {
    const pass = [
      row.m && row.m.status !== 'fail' ? checkLine(row.m, '🌅 صباحي') : null,
      row.e && row.e.status !== 'fail' ? checkLine(row.e, '🌙 مسائي') : null
    ].filter(Boolean)
    const fail = [
      row.m?.status === 'fail' ? `🌅 صباحي ✗${row.m.note ? ' ' + row.m.note : ''}` : null,
      row.e?.status === 'fail' ? `🌙 مسائي ✗${row.e.note ? ' ' + row.e.note : ''}` : null
    ].filter(Boolean)
    return { pass, fail }
  }

  const statusLinesBlock = (row, cls) => {
    const { pass, fail } = rowStatusLines(row)
    if (pass.length === 0 && fail.length === 0) return null
    return (
      <span className={cls}>
        {fail.map((l, i) => <span key={'f' + i} className="block text-ios-red">{l}</span>)}
        {pass.length > 0 && <span className="block text-ios-green">{pass.join(' · ')}</span>}
      </span>
    )
  }

  // سطر حالة خلية وحدة بالجدول الأفقي: أخضر (الموقّع والوقت) للنظيف وأحمر للسبب
  const cellStatusLine = (item, period) => {
    const c = period === 'morning' ? item.m : item.e
    if (!c) return null
    if (c.status === 'fail') {
      return <span className="block text-[10px] font-semibold text-ios-red mt-0.5">✗{c.note ? ' ' + c.note : ''}</span>
    }
    return (
      <span className="block text-[10px] font-semibold text-ios-green mt-0.5">
        ✓ {c.checked_by_name || '—'} {c.checked_at ? new Date(c.checked_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) : ''}
      </span>
    )
  }

  // ── الشهرية ──
  const daysInMonth = (() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(Date.UTC(y, m, 0)).getUTCDate()
  })()
  const dayMap = {}
  ;(monthData?.days || []).forEach(d => { dayMap[d.day] = d })

  const itemStatus = (item, dayChecks) => {
    // dayChecks: خريطة البند → {m, e, mn, en} — m/e حالة التقييم 'pass'|'fail' أو null
    const total = item.period === 'both' ? 2 : 1
    const c = dayChecks?.[item.id]
    let done = 0, passCount = 0, fail = false
    if (c) {
      const keys = item.period === 'both' ? ['m', 'e'] : [item.period === 'morning' ? 'm' : 'e']
      keys.forEach(k => {
        if (c[k]) { done++; if (c[k] === 'pass') passCount++; else fail = true }
      })
    }
    return { done, total, fail, passCount }
  }

  const sectionItems = monthData?.items || []

  // الانتقال من الشبكة الشهرية لعرض يوم معين
  const goToDay = (d) => {
    setDate(`${month}-${String(d).padStart(2, '0')}`)
    setView('daily')
  }

  const printMonthly = () => {
    if (!monthData) return
    const [y, m] = month.split('-')
    const branchName = branches.find(b => String(b.id) === String(selectedBranch))?.name || ''
    const shortTitle = t => PRINT_SHORT_TITLES[t] || t
    // عمود ملاحظات آخر عمود (أقصى اليسار بالاتجاه RTL) لأسباب الخطأ
    const columns = [
      { key: 'day', label: 'اليوم' },
      ...sectionItems.map(i => ({ key: `s${i.id}`, label: shortTitle(i.title) })),
      { key: 'status', label: 'الحالة' },
      { key: 'notes', label: 'ملاحظات' }
    ]
    const clip = s => (s.length > 40 ? s.slice(0, 40) + '…' : s)
    const rowsPrint = []
    for (let d = 1; d <= daysInMonth; d++) {
      const day = dayMap[d]
      const row = { day: String(d) }
      const dayNotes = []
      sectionItems.forEach(i => {
        const { done, total, fail } = itemStatus(i, day?.checks)
        row[`s${i.id}`] = total === 0 ? '' : (fail ? '✗' : (done >= total ? '✓' : '—'))
        const c = day?.checks?.[i.id]
        if (c?.mn) dayNotes.push(`${shortTitle(i.title)}: ${clip(c.mn)}`)
        if (c?.en) dayNotes.push(`${shortTitle(i.title)}: ${clip(c.en)}`)
      })
      row.status = day
        ? (day.approved ? '✅ معتمد' : (day.morning.done + day.evening.done > 0 ? `ناقص ${day.missing_titles.length}` : '—'))
        : '—'
      row.notes = dayNotes.length > 2 ? dayNotes.slice(0, 2).join('؛ ') + ' ...' : dayNotes.join('؛ ')
      rowsPrint.push(row)
    }
    // نسبة الالتزام = التقييمات الناجحة / كل التقييمات المسجلة بأيام الشهر
    let passed = 0, evaluated = 0
    ;(monthData.days || []).forEach(d => {
      sectionItems.forEach(i => {
        const { done, passCount } = itemStatus(i, d.checks)
        evaluated += done
        passed += passCount
      })
    })
    const pct = evaluated > 0 ? Math.round((passed / evaluated) * 100) : 0
    const footerHtml = `
      <div style="display:flex;justify-content:space-between;margin-top:10mm;font-size:11pt;font-weight:700">
        <span>توقيع مسؤول القسم: ____________________</span>
        <span>توقيع مسؤول الجودة: ____________________</span>
      </div>`
    printReport({
      title: 'سجل التنظيف اليومي',
      subtitle: `شركة صاج الريف للمنتجات الغذائية وإدارة المطاعم واستثمارها — SJ-PRP-F06 • الفرع: ${branchName} • الشهر: ${m}/${y}`,
      columns,
      rows: rowsPrint,
      totals: [{ label: 'نسبة الالتزام', value: `${pct}% (${passed}/${evaluated})` }],
      landscape: true,
      footerHtml
    })
  }

  const progressBar = (period) => {
    const p = checks[period]?.progress || { done: 0, total: 0 }
    const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
    return { p, pct }
  }
  const morning = progressBar('morning')
  const evening = progressBar('evening')
  const isOldDay = date < todayStr()
  const commitmentPct = monthData?.commitment?.total > 0 ? Math.round((monthData.commitment.done / monthData.commitment.total) * 100) : 0
  const todayNum = parseInt(todayStr().slice(8, 10))
  const currentMonth = todayStr().slice(0, 7)

  return (
    <div dir="rtl" className="-mx-4 md:-mx-6">
      <PageHeader title="📋 سجل التنظيف اليومي" subtitle="قائمة الفحص — صباحي ومسائي" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      {/* تبديل العرض: يومي / شهري */}
      <div className="segmented mb-4">
        <button type="button" onClick={() => setView('daily')}
          className={`segmented-item ${view === 'daily' ? 'segmented-item-active' : ''}`}>
          📆 يومي
        </button>
        <button type="button" onClick={() => setView('monthly')}
          className={`segmented-item ${view === 'monthly' ? 'segmented-item-active' : ''}`}>
          🗓️ شهري
        </button>
      </div>

      {/* صف التحكم */}
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
          {view === 'daily' ? (
            <div>
              <label className="label-ios">التاريخ</label>
              <input type="date" value={date} max={todayStr()}
                onChange={e => setDate(e.target.value)} className="input-ios" />
            </div>
          ) : (
            <div>
              <label className="label-ios">الشهر</label>
              <input type="month" value={month} max={currentMonth}
                onChange={e => setMonth(e.target.value)} className="input-ios" />
            </div>
          )}
          <div>
            {view === 'monthly' && (
              <button type="button" onClick={printMonthly} disabled={!monthData}
                className="btn-ios-secondary px-4 py-2.5 text-sm whitespace-nowrap disabled:opacity-40 w-full md:w-auto">
                🖨️ طباعة التقرير الشهري
              </button>
            )}
          </div>
        </div>
        {!isAdmin && (
          <p className="text-xs text-ios-label font-semibold mt-2">🏪 {branches[0]?.name || 'فرعك'}</p>
        )}
      </div>

      {view === 'daily' && (
        <>
          {/* شريطا التقدم: صباحي + مسائي جنب بعض */}
          <div className="card-ios p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'morning', data: morning, cls: 'bg-ios-blue' },
                { key: 'evening', data: evening, cls: 'bg-ios-orange' }
              ].map(({ key, data, cls }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-ios-text text-sm">{PERIODS[key]}</span>
                    <span className="font-bold text-ios-label text-sm">{data.p.done} / {data.p.total} ({data.pct}%)</span>
                  </div>
                  <div className="h-3 rounded-full bg-ios-fill overflow-hidden">
                    <div className={`h-full rounded-full ${cls} transition-all duration-300`} style={{ width: `${data.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {failCount > 0 && (
              <p className="text-ios-red text-sm font-bold mt-3">🔴 {failCount} {failCount === 1 ? 'قسم غير نظيف' : 'أقسام غير نظيفة'}</p>
            )}
          </div>

          {/* بطاقة الاعتماد */}
          <div className={`card-ios p-4 mb-4 ${approval.approved ? 'border-ios-green/40 bg-ios-green/5' : 'border-ios-orange/40 bg-ios-orange/5'}`}>
            {failCount > 0 && (
              <p className="mb-2 px-3 py-2 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold">
                ⚠️ يوجد {failCount} {failCount === 1 ? 'قسم غير نظيف' : 'أقسام غير نظيفة'} — راجع الأسباب قبل الاعتماد
              </p>
            )}
            {approval.approved ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-[#1F7A33] text-sm">
                  ✅ معتمد — {approval.approved_by_name || '—'}
                  <span className="block text-[11px] font-normal text-ios-label">
                    {approval.approved_at ? new Date(approval.approved_at).toLocaleString('ar') : ''}
                    {approval.approval_note ? ` • ${approval.approval_note}` : ''}
                  </span>
                </p>
                {canApprove && (
                  <button type="button" onClick={unapprove}
                    className="px-3 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">
                    إلغاء الاعتماد
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="font-bold text-[#B25000] text-sm mb-2">✍️ بانتظار اعتماد مسؤول الجودة</p>
                {canApprove && (
                  <div className="flex flex-wrap gap-2">
                    <input type="text" value={approveNote} onChange={e => setApproveNote(e.target.value)}
                      placeholder="ملاحظة الاعتماد (اختياري)" className="input-ios flex-1 min-w-[180px]" />
                    <button type="button" onClick={approve}
                      className="btn-ios px-4 py-2 text-sm whitespace-nowrap">✍️ اعتماد اليوم</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* جدول البنود — شكل الكشف الورقي */}
          {rows.length === 0 ? (
            <p className="text-center text-ios-label py-10">لا توجد بنود</p>
          ) : (
            <>
              {/* سطح المكتب: جدول أفقي — الأقسام أعمدة والفترات (صباحي/مسائي) صفوف */}
              <div className="hidden md:block card-ios overflow-hidden mb-6">
                <div className="overflow-x-auto">
                <table className="table-ios w-full">
                  <thead>
                    <tr>
                      <th className="sticky right-0 z-10 bg-[#F2F2F7] w-20 text-center text-xs px-1">الفترة</th>
                      {rows.map(row => (
                        <th key={row.id} className="text-center px-1">
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-sm font-extrabold text-ios-text">{PRINT_SHORT_TITLES[row.title] || row.title}</span>
                            {noteBtn(row)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                    <tbody>
                      {Object.keys(PERIODS).map(period => (
                        <tr key={period}>
                          <td className="sticky right-0 z-10 bg-white text-center font-bold text-sm text-ios-text whitespace-nowrap">{PERIODS[period]}</td>
                          {rows.map(row => applicable(row, period) ? (
                            <td key={row.id} className="text-center align-top">
                              {checkCell(row, period, period === 'morning' ? 'm' : 'e')}
                              {cellStatusLine(row, period)}
                            </td>
                          ) : (
                            <td key={row.id} className="text-center text-ios-label">—</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                </table>
                </div>
              </div>

              {/* الجوال: كروت بصفّي تعليم معنونين */}
              <div className="md:hidden space-y-2 mb-6">
                {rows.map(row => (
                  <div key={row.id} className="card-ios p-3 bg-white">
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="font-extrabold text-ios-text text-base">{row.title}</span>
                      {noteBtn(row)}
                    </div>
                    {statusLinesBlock(row, 'block text-[11px] font-semibold mb-2')}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between rounded-2xl bg-ios-fill/60 px-3 py-2">
                        <span className="text-xs font-bold text-ios-label">{PERIODS.morning}</span>
                        {checkCell(row, 'morning', 'm')}
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-ios-fill/60 px-3 py-2">
                        <span className="text-xs font-bold text-ios-label">{PERIODS.evening}</span>
                        {checkCell(row, 'evening', 'e')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {isOldDay && (
            <p className="text-center text-ios-orange text-sm font-semibold mb-6">⚠️ تعرض يوماً سابقاً — المسح متاح للأدمن فقط</p>
          )}
        </>
      )}

      {view === 'monthly' && (
        <>
          {/* شريط إحصائيات الشهر */}
          <div className="card-ios p-4 mb-4 flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[140px]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-ios-text text-sm">نسبة الالتزام</span>
                <span className="font-bold text-ios-blue text-sm">{commitmentPct}%</span>
              </div>
              <div className="h-3 rounded-full bg-ios-fill overflow-hidden">
                <div className="h-full rounded-full bg-ios-blue transition-all duration-300" style={{ width: `${commitmentPct}%` }} />
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-ios-text">{monthData?.approved_days ?? 0}</div>
              <div className="text-[11px] text-ios-label font-bold">أيام معتمدة 📋✅</div>
            </div>
          </div>

          {/* شبكة الشهر */}
          {!monthData ? (
            <p className="text-center text-ios-label py-10">جاري التحميل...</p>
          ) : (
            <div className="card-ios overflow-hidden mb-6">
              <div className="overflow-x-auto">
              <table className="table-ios w-full">
                <thead>
                  <tr>
                    <th className="sticky right-0 z-10 bg-[#F2F2F7] w-20 text-right text-xs px-1">القسم</th>
                    {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map(d => {
                      const isTodayCol = month === currentMonth && d === todayNum
                      const dayChecks = dayMap[d]?.checks || {}
                      const canClearDay = isAdmin
                        && Object.values(dayChecks).some(c => c.m || c.e)
                      return (
                        <th key={d} onClick={() => goToDay(d)} title={`اليوم ${d}`}
                          className={`text-center text-[10px] cursor-pointer px-0.5 ${isTodayCol ? 'bg-ios-blue/20 text-ios-blue' : ''}`}>
                          {d}
                          {canClearDay && (
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); clearDay(d) }}
                              disabled={clearingDay === d}
                              title={`مسح كل تعليمات يوم ${d} (أدمن)`}
                              className="block mx-auto mt-0.5 text-[9px] opacity-80 hover:opacity-100 active:scale-90 disabled:opacity-30">
                              {clearingDay === d ? '⏳' : '🗑️'}
                            </button>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sectionItems.map(i => (
                    <tr key={i.id}>
                      <td className="sticky right-0 z-10 bg-white font-extrabold text-xs text-ios-text whitespace-nowrap px-1">{PRINT_SHORT_TITLES[i.title] || i.title}</td>
                      {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map(d => {
                        const day = dayMap[d]
                        const isFuture = !day && month === currentMonth && d > todayNum
                        const { done, total, fail } = itemStatus(i, day?.checks)
                        const cell = total === 0 ? '' : (fail ? '🔴' : done >= total ? '🟢' : (done > 0 ? '🟠' : (day ? '⚪' : '')))
                        return (
                          <td key={d} onClick={() => goToDay(d)}
                            className={`text-center text-sm cursor-pointer px-0.5 ${isFuture ? 'opacity-40' : 'hover:bg-ios-fill/50'}`}>
                            {cell}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-ios-sep">
                    <td className="sticky right-0 z-10 bg-white font-bold text-[11px] text-ios-label whitespace-nowrap px-1">حالة اليوم</td>
                    {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map(d => {
                      const day = dayMap[d]
                      return (
                        <td key={d} onClick={() => goToDay(d)}
                          className="text-center text-[10px] font-bold cursor-pointer px-0.5">
                          {day?.approved ? '📋✅' : (day ? (day.morning.done + day.evening.done > 0 ? `⚠️${day.missing_titles.length}` : '—') : '—')}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
              </div>
              <div className="px-4 py-2.5 border-t border-ios-sep text-[11px] text-ios-label font-semibold flex gap-3 flex-wrap">
                <span>🟢 مكتمل</span><span>🟠 جزئي</span><span>⚪ غير مكتمل</span><span>🔴 غير نظيف</span><span>📋✅ معتمد</span>
                <span className="mr-auto">اضغط على خلية أو رقم يوم للانتقال للعرض اليومي</span>
              </div>
            </div>
          )}
        </>
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

      {/* نافذة الملاحظة والصورة */}
      {noteEditor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={closeNoteEditor}>
          <div className="bg-white dark:bg-[#1c1c1e] w-full md:max-w-lg rounded-t-3xl md:rounded-3xl p-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-ios-text">
                {reasonPeriod ? `⚠️ سبب الخطأ — ${noteEditor.title}` : `📝 ملاحظات — ${noteEditor.title}`}
              </h3>
              <button type="button" onClick={closeNoteEditor}
                className="px-2.5 py-1 rounded-xl bg-ios-fill text-ios-text text-sm font-bold active:opacity-60">✕</button>
            </div>
            {Object.keys(PERIODS).filter(p => applicable(noteEditor, p) && (!reasonPeriod || p === reasonPeriod)).map(p => {
              const draft = drafts[p] || { note: '', photo: null }
              const isReason = reasonPeriod === p
              return (
                <div key={p} className={`rounded-2xl border p-3 mb-3 ${isReason ? 'border-ios-red/40' : 'border-ios-sep'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold ${isReason ? 'text-ios-red' : 'text-ios-label'}`}>
                      {isReason ? `${PERIODS[p]} — السبب (مطلوب)` : PERIODS[p]}
                    </span>
                    <label className="text-xs font-bold text-ios-blue cursor-pointer active:opacity-60">
                      📷 إرفاق صورة
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => pickPhoto(e, p)} />
                    </label>
                  </div>
                  <textarea value={draft.note} rows={2}
                    onChange={e => setDrafts(prev => ({ ...prev, [p]: { ...prev[p], note: e.target.value } }))}
                    placeholder={isReason ? 'مثلاً: يحتاج صابون / تسريب ماء...' : 'مثلاً: يحتاج مواد تنظيف'}
                    className="input-ios resize-none w-full" />
                  {draft.photo && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={draft.photo} alt="" onClick={() => setLightbox(draft.photo)}
                        className="w-16 h-16 rounded-xl object-cover cursor-pointer border border-ios-sep" />
                      <button type="button" onClick={() => setDrafts(prev => ({ ...prev, [p]: { ...prev[p], photo: null } }))}
                        className="text-ios-red text-xs font-bold px-2 py-1 rounded-lg bg-ios-red/10 active:opacity-60">🗑️ إزالة الصورة</button>
                    </div>
                  )}
                </div>
              )
            })}
            <div className="flex gap-2">
              <button type="button"
                disabled={noteSaving || (reasonPeriod && !(drafts[reasonPeriod]?.note || '').trim())}
                onClick={saveNotes}
                className="btn-ios flex-1 disabled:opacity-40">{noteSaving ? 'جاري الحفظ...' : (reasonPeriod ? '💾 حفظ الخطأ' : '💾 حفظ')}</button>
              <button type="button" onClick={closeNoteEditor}
                className="btn-ios-secondary">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* خيارات البند المقيّم: تغيير / تعديل / مسح */}
      {cellAction && (() => {
        const { row, period } = cellAction
        const c = period === 'morning' ? row.m : row.e
        const isFail = c?.status === 'fail'
        const busy = pending.has(`${row.id}:${period}`)
        const close = () => setCellAction(null)
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4"
            onClick={close}>
            <div className="bg-white dark:bg-[#1c1c1e] w-full md:max-w-sm rounded-t-3xl md:rounded-3xl p-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-ios-text text-sm">{row.title}</h3>
                <button type="button" onClick={close}
                  className="px-2.5 py-1 rounded-xl bg-ios-fill text-ios-text text-sm font-bold active:opacity-60">✕</button>
              </div>
              <p className={`text-xs font-bold mb-3 ${isFail ? 'text-ios-red' : 'text-[#1F7A33]'}`}>
                {PERIODS[period]} — الحالية: {isFail ? '✗ غير نظيف' : '✓ نظيف'}
                {c?.checked_by_name ? ` (${c.checked_by_name})` : ''}
              </p>
              <div className="space-y-2">
                {isFail && (
                  <button type="button" disabled={busy}
                    onClick={async () => { close(); await changeToPass(row, period) }}
                    className="w-full py-2.5 rounded-2xl bg-ios-green text-white font-bold text-sm active:opacity-80 disabled:opacity-40">
                    ✓ تغيير إلى نظيف
                  </button>
                )}
                <button type="button" disabled={busy}
                  onClick={() => { close(); openNoteEditor(row, isFail ? period : null) }}
                  className="w-full py-2.5 rounded-2xl bg-ios-blue/10 text-ios-blue font-bold text-sm active:opacity-70 disabled:opacity-40">
                  📝 {isFail ? 'تعديل السبب والصورة' : 'تعديل الملاحظة والصورة'}
                </button>
                {isAdmin && (
                  <button type="button" disabled={busy}
                    onClick={async () => { if (await clearCheck(row, period)) close() }}
                    className="w-full py-2.5 rounded-2xl bg-ios-red/10 text-ios-red font-bold text-sm active:opacity-70 disabled:opacity-40">
                    🗑️ مسح التعليم
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* عرض الصورة كاملة */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  )
}
