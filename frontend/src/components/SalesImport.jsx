import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const norm = s => String(s || '').trim().toLowerCase()
const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? null : n }

// قارئ تقرير Omega POS "Sales by Items By Group"
function parsePosFile(rows) {
  const items = []
  let group = '', division = '', branch = ''
  let qtyIdx = 2, amtIdx = 3, pctIdx = -1
  let fileTotal = null, dateTo = null

  for (const r of rows) {
    const c0 = String(r[0] ?? '').trim()
    if (/^description$/i.test(c0)) {
      // عمود الكمية هو العمود اللي قبل "Total Amount" مباشرة
      amtIdx = r.findIndex(c => /^total amount$/i.test(String(c).trim()))
      qtyIdx = amtIdx > 0 && /^qty$/i.test(String(r[amtIdx - 1] ?? '').trim()) ? amtIdx - 1 : 2
      pctIdx = r.findIndex(c => /^%$/i.test(String(c).trim()))
      continue
    }
    if (/^branch:/i.test(c0)) { branch = c0.replace(/^branch:/i, '').trim(); continue }
    if (/^division:/i.test(c0)) { division = c0.replace(/^division:/i, '').trim(); continue }
    if (/^group:/i.test(c0)) { group = c0.replace(/^group:/i, '').trim(); continue }
    // تاريخ الفترة ممكن يكون بأي عمود بالسطر
    const dateCell = r.find(c => /From Date:/.test(String(c ?? '')))
    if (dateCell) {
      const m = String(dateCell).match(/To Date:\s*(\d{2})-(\w{3})-(\d{4})/)
      const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
      if (m && months[m[2].toLowerCase()]) dateTo = `${m[3]}-${months[m[2].toLowerCase()]}-${m[1]}`
      continue
    }
    if (!c0 || /^(malls projects|sales by items)/i.test(c0)) continue
    if (/^page \d+ of/i.test(c0) || /copyright/i.test(c0)) continue
    const q = num(r[qtyIdx]), a = num(r[amtIdx])
    if (q === null || a === null) continue
    // سطر الإجمالي العام (اسم الفرع)
    if (branch && norm(c0) === norm(branch)) { fileTotal = { qty: q, amount: a }; continue }
    // سطور مجاميع المجموعة/القسم (الاسم مطابق)
    if (norm(c0) === norm(group) || norm(c0) === norm(division)) continue
    const pct = pctIdx >= 0 ? num(r[pctIdx]) : null
    items.push({ name: c0, qty: q, amount: a, group, pct })
  }

  // كشف سطور مجاميع إضافية: نسبة 100% وقيمتها تساوي مجموع باقي أصناف مجموعتها
  const filtered = items.filter((it, i) => {
    if (it.pct === null || Math.abs(it.pct - 100) > 0.001) return true
    const others = items.filter((x, j) => j !== i && norm(x.group) === norm(it.group))
    if (others.length === 0) return true
    const sq = others.reduce((s, x) => s + x.qty, 0)
    const sa = others.reduce((s, x) => s + x.amount, 0)
    return !(Math.abs(sq - it.qty) < 0.01 && Math.abs(sa - it.amount) < 0.01)
  })

  // دمج الأصناف المتكررة (قد يظهر نفس الصنف بأكثر من مجموعة)
  const map = new Map()
  for (const it of filtered) {
    const k = norm(it.name)
    if (!map.has(k)) map.set(k, { name: it.name, qty: 0, amount: 0 })
    const e = map.get(k)
    e.qty += it.qty
    e.amount += it.amount
  }
  return { items: [...map.values()], fileTotal, dateTo, branch }
}

export default function SalesImport({ user, branches }) {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const fileRef = useRef(null)

  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0])
  const [menuItems, setMenuItems] = useState([])
  const [parsed, setParsed] = useState(null) // {items, fileTotal, dateTo, branch, matched[], unmatched[]}
  const [selected, setSelected] = useState({}) // {index: true} — الأصناف المختارة للاستيراد
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/sales/menu`, { headers })
      .then(r => r.json())
      .then(d => setMenuItems(d || []))
      .catch(() => {})
  }, [])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage('')
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false })
      const result = parsePosFile(rows)

      if (result.items.length === 0) {
        setParsed(null)
        setMessage('❌ ما لقيت بيانات مبيعات بالملف — تأكد أنه تقرير "Sales by Items By Group" من الكاشير')
        return
      }

      const menuMap = new Map(menuItems.map(m => [norm(m.name), m]))
      const matched = [], unmatched = [], skipped = []
      for (const it of result.items) {
        const m = menuMap.get(norm(it.name))
        if (!m) { unmatched.push(it); continue }
        if (it.amount <= 0 || it.qty <= 0) { skipped.push(it); continue }
        matched.push({ ...it, item_id: m.id, displayName: m.name })
      }

      setParsed({ ...result, matched, unmatched, skipped })
      setSelected(Object.fromEntries(matched.map((_, i) => [i, true])))
      if (result.dateTo) setImportDate(result.dateTo)
    } catch {
      setParsed(null)
      setMessage('❌ تعذر قراءة الملف — تأكد أنه ملف Excel (.xlsx)')
    }
    e.target.value = ''
  }

  const selectedItems = parsed ? parsed.matched.filter((_, i) => selected[i]) : []
  const totalQty = selectedItems.reduce((s, i) => s + i.qty, 0)
  const totalAmount = selectedItems.reduce((s, i) => s + i.amount, 0)
  const totalMatchesFile = parsed?.fileTotal &&
    Math.abs(totalAmount - parsed.fileTotal.amount) < 1

  const toggleAll = () => {
    const allOn = parsed.matched.every((_, i) => selected[i])
    setSelected(allOn ? {} : Object.fromEntries(parsed.matched.map((_, i) => [i, true])))
  }

  const toggleRow = (i) => setSelected(s => ({ ...s, [i]: !s[i] }))

  const handleSave = async () => {
    if (selectedItems.length === 0) return
    if (!selectedBranch) { setMessage('❌ اختر الفرع'); return }
    setSaving(true)
    setMessage('')
    try {
      const records = selectedItems.map(i => ({
        item_id: i.item_id,
        quantity_sold: Math.round(i.qty),
        unit_price: Math.round((i.amount / i.qty) * 10000) / 10000 // الإيراد الفعلي ÷ الكمية
      }))
      const res = await fetch(`${API_URL}/sales/daily`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: parseInt(selectedBranch),
          records,
          payment_card: 0,
          payment_cash: 0,
          record_date: importDate
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ تم استيراد ${records.length} صنف (${totalQty} قطعة / ${totalAmount.toLocaleString()} د.ع) بتاريخ ${importDate} — خُصمت المكونات من الجرد تلقائياً`)
        setParsed(null)
      } else {
        setMessage('❌ فشل الاستيراد: ' + (data.message || ''))
      }
    } catch {
      setMessage('❌ خطأ في الاتصال')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-ios p-4">
          <label className="label-ios">الفرع</label>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="input-ios">
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="card-ios p-4">
          <label className="label-ios">تاريخ المبيعات</label>
          <input type="date" value={importDate} onChange={e => setImportDate(e.target.value)} className="input-ios" />
        </div>
        <div className="card-ios p-4">
          <label className="label-ios">ملف الكاشير (Excel)</label>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile}
            className="block w-full text-xs text-ios-label bg-ios-fill rounded-xl p-2.5" />
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      {parsed && (
        <>
          <div className="card-ios p-4 mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span>📄 فرع الملف: <b>{parsed.branch || '—'}</b></span>
            <span>✅ مطابق: <b className="text-ios-green">{parsed.matched.length} صنف</b></span>
            {parsed.unmatched.length > 0 && <span>⚠️ غير مطابق: <b className="text-ios-orange">{parsed.unmatched.length}</b></span>}
            {parsed.skipped.length > 0 && <span>⏭️ صفرية: <b className="text-ios-label">{parsed.skipped.length}</b></span>}
            {parsed.fileTotal && (
              <span>📊 الإجمالي بالملف: <b>{parsed.fileTotal.qty.toLocaleString()} قطعة / {parsed.fileTotal.amount.toLocaleString()} د.ع</b>
                {totalMatchesFile ? ' ✓ يطابق المستورد' : ''}
              </span>
            )}
          </div>

          {parsed.unmatched.length > 0 && (
            <div className="bg-ios-orange/10 text-[#B25000] p-4 rounded-2xl mb-4 text-sm font-semibold">
              ⚠️ أصناف بالملف ما موجودة بنظامك (انحفظت بدونها): {parsed.unmatched.map(u => u.name).join('، ')}
            </div>
          )}

          <div className="card-ios overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-[#F2F2F7]">
                <tr>
                  <th className="p-3 text-center w-10">
                    <input type="checkbox" className="w-4 h-4 accent-ios-blue cursor-pointer"
                      checked={parsed.matched.length > 0 && parsed.matched.every((_, i) => selected[i])}
                      onChange={toggleAll} title="تحديد الكل" />
                  </th>
                  <th className="p-3 text-right font-semibold text-ios-label text-xs">الصنف</th>
                  <th className="p-3 text-center font-semibold text-ios-label text-xs">الكمية</th>
                  <th className="p-3 text-center font-semibold text-ios-label text-xs">الإيراد (د.ع)</th>
                  <th className="p-3 text-center font-semibold text-ios-label text-xs">متوسط السعر</th>
                </tr>
              </thead>
              <tbody>
                {parsed.matched.map((it, i) => (
                  <tr key={i} className={`border-t border-ios-sep ${selected[i] ? '' : 'opacity-40'}`}>
                    <td className="p-3 text-center">
                      <input type="checkbox" className="w-4 h-4 accent-ios-blue cursor-pointer"
                        checked={!!selected[i]} onChange={() => toggleRow(i)} />
                    </td>
                    <td className="p-3 font-semibold text-ios-text">{it.displayName}</td>
                    <td className="p-3 text-center font-bold">{it.qty.toLocaleString()}</td>
                    <td className="p-3 text-center font-bold text-ios-green">{it.amount.toLocaleString()}</td>
                    <td className="p-3 text-center text-ios-label">{Math.round(it.amount / it.qty).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ios-sep bg-[#F2F2F7] font-bold">
                  <td className="p-3"></td>
                  <td className="p-3">الإجمالي ({selectedItems.length} مختار)</td>
                  <td className="p-3 text-center">{totalQty.toLocaleString()}</td>
                  <td className="p-3 text-center text-ios-green">{totalAmount.toLocaleString()} د.ع</td>
                  <td className="p-3"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <button onClick={handleSave} disabled={saving || selectedItems.length === 0}
            className="btn-ios w-full md:w-auto text-base disabled:opacity-40">
            {saving ? 'جاري الاستيراد...' : `💾 حفظ ${selectedItems.length} صنف بتاريخ ${importDate}`}
          </button>
        </>
      )}

      {!parsed && !message && (
        <p className="text-center text-ios-label py-8">
          📥 ارفع ملف Excel من الكاشير (تقرير Sales by Items) — راح يتم مطابقة الأصناف تلقائياً وخصم المكونات من الجرد
        </p>
      )}
    </div>
  )
}
