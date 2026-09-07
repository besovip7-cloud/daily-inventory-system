import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const norm = s => String(s || '').trim().toLowerCase()

// قارئ ملف "مواد المخزن": عمودان — الرقم، الاسم
function parseItemsFile(rows) {
  // البحث عن سطر العنوان اللي يحتوي "الاسم"
  let headerIdx = rows.findIndex(r => r.some(c => norm(c) === 'الاسم'))
  const items = []
  if (headerIdx === -1) headerIdx = -1 // إذا ماكو عنوان، نحاول كل السطور
  for (const r of rows.slice(headerIdx + 1)) {
    const code = String(r[0] ?? '').trim()
    const name = String(r[1] ?? '').trim()
    if (!name) continue
    // كود رقمي أو سطر بيانات صالح
    if (!/^\d+$/.test(code) && !name) continue
    items.push({ code, name })
  }
  // دمج التكرارات داخل الملف نفسه
  const map = new Map()
  for (const it of items) {
    const k = norm(it.name)
    if (!map.has(k)) map.set(k, it)
  }
  return [...map.values()]
}

export default function ItemsImport({ headers, branches, selectedBranch, existingItems, onDone }) {
  const fileRef = useRef(null)
  const [parsed, setParsed] = useState(null) // {newItems, duplicates}
  const [selected, setSelected] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage('')
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })
      const items = parseItemsFile(rows)

      if (items.length === 0) {
        setParsed(null)
        setMessage('❌ ما لقيت مواد بالملف — الملف المدعوم: عمود "الرقم" + عمود "الاسم"')
        return
      }

      const existingSet = new Set((existingItems || []).map(i => norm(i.name)))
      const newItems = [], duplicates = []
      for (const it of items) {
        if (existingSet.has(norm(it.name))) duplicates.push(it)
        else newItems.push(it)
      }

      setParsed({ newItems, duplicates, total: items.length })
      setSelected(Object.fromEntries(newItems.map((_, i) => [i, true])))
    } catch {
      setParsed(null)
      setMessage('❌ تعذر قراءة الملف — تأكد أنه ملف Excel (.xlsx)')
    }
    e.target.value = ''
  }

  const selectedItems = parsed ? parsed.newItems.filter((_, i) => selected[i]) : []
  const branchName = branches.find(b => b.id.toString() === selectedBranch.toString())?.name || ''

  const toggleAll = () => {
    const allOn = parsed.newItems.every((_, i) => selected[i])
    setSelected(allOn ? {} : Object.fromEntries(parsed.newItems.map((_, i) => [i, true])))
  }

  const toggleRow = (i) => setSelected(s => ({ ...s, [i]: !s[i] }))

  const handleSave = async () => {
    if (selectedItems.length === 0) return
    setSaving(true)
    setMessage('')
    try {
      const results = await Promise.all(selectedItems.map(it =>
        fetch(`${API_URL}/inventory/items`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch_id: parseInt(selectedBranch),
            name: it.name,
            category: 'raw',
            unit: '',
            min_quantity: 0,
            current_quantity: 0,
            cost_per_unit: 0
          })
        }).then(async r => ({ ok: r.ok, name: it.name, message: (await r.json()).message }))
      ))
      const okCount = results.filter(x => x.ok).length
      const failed = results.filter(x => !x.ok)
      if (failed.length === 0) {
        setMessage(`✅ تم استيراد ${okCount} مادة إلى فرع "${branchName}"`)
      } else {
        setMessage(`⚠️ استوردت ${okCount} مادة — فشلت ${failed.length}: ${failed.slice(0, 5).map(f => f.name).join('، ')}${failed.length > 5 ? '...' : ''}`)
      }
      setParsed(null)
      onDone?.()
    } catch {
      setMessage('❌ خطأ في الاتصال')
    }
    setSaving(false)
  }

  return (
    <div className="bg-ios-purple/10 rounded-2xl p-6 mb-6">
      <h3 className="text-lg font-bold mb-1 text-ios-text">📥 استيراد مواد من Excel</h3>
      <p className="text-xs text-ios-label mb-4">
        الملف المطلوب: عمود "الرقم" + عمود "الاسم" (مثل ملف مواد المخزن). المواد تنضاف لفرع: <b>{branchName}</b> — اللي موجود مسبقاً ينتبه وما ينضاف.
      </p>

      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile}
        className="block w-full max-w-md text-xs text-ios-label bg-ios-fill rounded-xl p-2.5 mb-4" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : message.includes('⚠️') ? 'bg-ios-orange/15 text-[#B25000]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      {parsed && (
        <>
          <div className="card-ios p-4 mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span>📄 مواد بالملف: <b>{parsed.total}</b></span>
            <span>✅ جديدة: <b className="text-ios-green">{parsed.newItems.length}</b></span>
            {parsed.duplicates.length > 0 && (
              <span>⏭️ موجودة مسبقاً (تم تخطيها): <b className="text-ios-orange">{parsed.duplicates.length}</b></span>
            )}
          </div>

          {parsed.duplicates.length > 0 && (
            <details className="bg-ios-orange/10 text-[#B25000] p-4 rounded-2xl mb-4 text-sm">
              <summary className="font-semibold cursor-pointer">⚠️ عرض المواد الموجودة مسبقاً ({parsed.duplicates.length})</summary>
              <p className="mt-2">{parsed.duplicates.map(d => d.name).join('، ')}</p>
            </details>
          )}

          {parsed.newItems.length > 0 && (
            <div className="card-ios overflow-hidden mb-4 max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F2F2F7] sticky top-0">
                  <tr>
                    <th className="p-3 text-center w-10">
                      <input type="checkbox" className="w-4 h-4 accent-ios-blue cursor-pointer"
                        checked={parsed.newItems.length > 0 && parsed.newItems.every((_, i) => selected[i])}
                        onChange={toggleAll} title="تحديد الكل" />
                    </th>
                    <th className="p-3 text-center font-semibold text-ios-label text-xs">الرقم</th>
                    <th className="p-3 text-right font-semibold text-ios-label text-xs">اسم المادة</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.newItems.map((it, i) => (
                    <tr key={i} className={`border-t border-ios-sep ${selected[i] ? '' : 'opacity-40'}`}>
                      <td className="p-3 text-center">
                        <input type="checkbox" className="w-4 h-4 accent-ios-blue cursor-pointer"
                          checked={!!selected[i]} onChange={() => toggleRow(i)} />
                      </td>
                      <td className="p-3 text-center text-ios-label" style={{ direction: 'ltr' }}>{it.code}</td>
                      <td className="p-3 font-semibold text-ios-text">{it.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parsed.newItems.length > 0 ? (
            <button onClick={handleSave} disabled={saving || selectedItems.length === 0}
              className="btn-ios disabled:opacity-40">
              {saving ? 'جاري الاستيراد...' : `💾 استيراد ${selectedItems.length} مادة إلى ${branchName}`}
            </button>
          ) : (
            <p className="text-ios-label text-sm font-semibold">كل مواد الملف موجودة مسبقاً — ماكو شي جديد للاستيراد</p>
          )}
        </>
      )}

      {!parsed && !message && (
        <p className="text-ios-label text-sm">ارفع ملف الإكسل حتى تظهر المعاينة قبل الحفظ</p>
      )}
    </div>
  )
}
