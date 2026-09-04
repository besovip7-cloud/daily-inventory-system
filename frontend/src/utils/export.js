import * as XLSX from 'xlsx'

/**
 * تصدير البيانات إلى ملف Excel
 * columns: [{ key, label }]
 * rows: كائنات بالمفتاح key
 */
export function exportToExcel({ filename, sheetName = 'التقرير', columns, rows, totals = [] }) {
  const data = rows.map(row => {
    const obj = {}
    columns.forEach(c => { obj[c.label] = row[c.key] })
    return obj
  })

  if (totals.length > 0) {
    data.push({})
    totals.forEach(t => {
      data.push({ [columns[0].label]: t.label, [columns[1].label]: t.value })
    })
  }

  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.label) })
  ws['!cols'] = columns.map(c => ({ wch: Math.max(14, String(c.label).length + 6) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * طباعة التقرير (أو حفظه PDF من نافذة الطباعة)
 * columns: [{ key, label }]
 */
export function printReport({ title, subtitle = '', columns, rows, totals = [] }) {
  const area = document.getElementById('print-area') || (() => {
    const el = document.createElement('div')
    el.id = 'print-area'
    document.body.appendChild(el)
    return el
  })()

  const esc = v => String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))

  area.innerHTML = `
    <div class="print-header">
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
    </div>
    <table class="print-table">
      <thead>
        <tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(row =>
          `<tr>${columns.map(c => `<td>${esc(row[c.key])}</td>`).join('')}</tr>`
        ).join('')}
      </tbody>
      ${totals.length > 0 ? `
      <tfoot>
        ${totals.map(t => `<tr class="print-total"><td>${esc(t.label)}</td><td colspan="${columns.length - 1}">${esc(t.value)}</td></tr>`).join('')}
      </tfoot>` : ''}
    </table>
  `

  const cleanup = () => { area.innerHTML = '' }
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
}
