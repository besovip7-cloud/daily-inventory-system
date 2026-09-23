import { getToken } from '../utils/token'
import { useState, useEffect } from 'react'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// عرض الكمية بدون أصفار زائدة
const fmtQty = (v) => {
  const n = parseFloat(v)
  if (isNaN(n)) return v ?? ''
  return String(Number(n.toFixed(3)))
}

// وصفات المنتجات: ربط أصناف البيع بمواد الجرد الخام لكل فرع
// يستخدم نفس نقاط /sales/recipes و /sales/menu الموجودة
export default function Recipes() {
  const token = getToken()
  const headers = { Authorization: `Bearer ${token}` }

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [menuItems, setMenuItems] = useState([])
  const [selectedMenu, setSelectedMenu] = useState('')
  const [menuSearch, setMenuSearch] = useState('')
  const [invItems, setInvItems] = useState([])
  const [recipes, setRecipes] = useState([])
  const [newItem, setNewItem] = useState('')
  const [newQty, setNewQty] = useState('')
  const [editRow, setEditRow] = useState(null) // {id, quantity}
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers })
      .then(r => r.json())
      .then(d => {
        const list = d || []
        setBranches(list)
        if (list.length > 0) setSelectedBranch(list[0].id.toString())
      })
    fetch(`${API_URL}/sales/menu`, { headers })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : []
        setMenuItems(list)
        if (list.length > 0) setSelectedMenu(list[0].id.toString())
      })
  }, [])

  useEffect(() => {
    if (!selectedBranch) return
    fetch(`${API_URL}/inventory/items/${selectedBranch}`, { headers })
      .then(r => r.json())
      .then(d => setInvItems(Array.isArray(d) ? d : []))
      .catch(() => setInvItems([]))
  }, [selectedBranch])

  useEffect(() => {
    if (selectedBranch && selectedMenu) loadRecipes()
  }, [selectedBranch, selectedMenu])

  const loadRecipes = () => {
    fetch(`${API_URL}/sales/recipes?branch_id=${selectedBranch}&menu_id=${selectedMenu}`, { headers })
      .then(r => r.json())
      .then(d => setRecipes(Array.isArray(d) ? d : []))
      .catch(() => setRecipes([]))
  }

  const show = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addRecipe = async (e) => {
    e.preventDefault()
    const qty = parseFloat(newQty)
    if (!newItem) return show('❌ اختر المادة الخام')
    if (!qty || qty <= 0) return show('❌ أدخل كمية صحيحة أكبر من صفر')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/sales/recipes`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: parseInt(selectedBranch),
          menu_item_id: parseInt(selectedMenu),
          inventory_item_id: parseInt(newItem),
          quantity: qty
        })
      })
      const data = await res.json()
      if (res.ok) {
        show('✅ تم حفظ المكوّن')
        setNewItem('')
        setNewQty('')
        loadRecipes()
      } else show('❌ فشل الحفظ: ' + (data.message || ''))
    } catch { show('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const saveQty = async (row) => {
    const qty = parseFloat(editRow.quantity)
    if (!qty || qty <= 0) return show('❌ الكمية غير صحيحة')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/sales/recipes`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: parseInt(selectedBranch),
          menu_item_id: parseInt(selectedMenu),
          inventory_item_id: row.inventory_item_id,
          quantity: qty
        })
      })
      if (res.ok) {
        show('✅ تم تعديل الكمية')
        setEditRow(null)
        loadRecipes()
      } else {
        const data = await res.json().catch(() => ({}))
        show('❌ فشل التعديل: ' + (data.message || ''))
      }
    } catch { show('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const deleteRecipe = async (row) => {
    if (!window.confirm(`حذف مكوّن "${row.inventory_name}" من هذه الوصفة؟`)) return
    try {
      const res = await fetch(`${API_URL}/sales/recipes/${row.id}`, { method: 'DELETE', headers })
      if (res.ok) { show('✅ تم حذف المكوّن'); loadRecipes() }
      else show('❌ فشل الحذف')
    } catch { show('❌ خطأ في الاتصال') }
  }

  const q = menuSearch.trim().toLowerCase()
  const filteredMenu = q ? menuItems.filter(m => m.name.toLowerCase().includes(q)) : menuItems
  const pickedMenu = menuItems.find(m => m.id.toString() === selectedMenu)

  return (
    <div dir="rtl">
      <PageHeader title="🍳 وصفات المنتجات" subtitle="اربط كل صنف بيع بالمواد الخام وكمياتها — تنخصم تلقائياً من المخزون عند حفظ المبيعات" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      <div className="card-ios p-4 mb-4">
        <label className="label-ios">الفرع</label>
        <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
          className="input-ios md:w-80">
          {branches.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start">
        {/* أصناف البيع */}
        <div className="card-ios p-4">
          <div className="section-title"><h3 className="mb-3">أصناف البيع ({menuItems.length})</h3></div>
          <input type="text" value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
            placeholder="🔍 بحث باسم الصنف..." className="input-ios mb-3" />
          <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
            {filteredMenu.map(m => (
              <button key={m.id} type="button" onClick={() => { setSelectedMenu(m.id.toString()); setEditRow(null) }}
                className={`w-full text-right rounded-2xl border px-3 py-2.5 text-sm font-semibold transition active:opacity-70 ${
                  selectedMenu === m.id.toString() ? 'border-ios-blue/40 bg-ios-blue/10 text-ios-blue' : 'border-ios-sep bg-white text-ios-text hover:bg-ios-fill'
                }`}>
                {m.name}
                <span className="block text-[10px] text-ios-label font-normal">{m.category || ''}</span>
              </button>
            ))}
            {filteredMenu.length === 0 && (
              <p className="text-center text-ios-label py-4 text-sm">{q ? 'لا توجد نتائج' : 'لا توجد أصناف بيع'}</p>
            )}
          </div>
        </div>

        {/* وصفة الصنف المختار */}
        <div className="card-ios p-4">
          <div className="section-title">
            <h3 className="mb-3">مكوّنات {pickedMenu ? `"${pickedMenu.name}"` : '—'} ({recipes.length})</h3>
          </div>

          {pickedMenu && (
            <form onSubmit={addRecipe} className="grid grid-cols-1 md:grid-cols-[1fr_130px_auto] gap-2 mb-4">
              <select value={newItem} onChange={e => setNewItem(e.target.value)} className="input-ios">
                <option value="">— اختر المادة الخام —</option>
                {invItems.map(i => (
                  <option key={i.id} value={i.id}>{i.name} {i.unit ? `(${i.unit})` : ''}</option>
                ))}
              </select>
              <input type="number" min="0" step="0.001" value={newQty}
                onChange={e => setNewQty(e.target.value)}
                placeholder="الكمية" className="input-ios" />
              <button type="submit" disabled={saving || !selectedBranch}
                className="btn-ios px-5 whitespace-nowrap disabled:opacity-40">➕ إضافة</button>
            </form>
          )}

          {recipes.length === 0 ? (
            <p className="text-center text-ios-label py-8 text-sm">
              {pickedMenu ? 'هذا الصنف بدون مكوّنات — أضف أول مادة خام' : 'اختر صنفاً من القائمة'}
            </p>
          ) : (
            <div className="space-y-2">
              {recipes.map(row => (
                <div key={row.id} className="rounded-2xl border border-ios-sep bg-white p-3">
                  {editRow?.id === row.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ios-text text-sm flex-1 min-w-[120px]">{row.inventory_name}</span>
                      <input type="number" min="0" step="0.001" value={editRow.quantity} autoFocus
                        onChange={e => setEditRow({ ...editRow, quantity: e.target.value })}
                        className="input-ios !py-1.5 text-sm w-28" />
                      <span className="text-xs text-ios-label">{row.unit || ''}</span>
                      <button type="button" disabled={saving} onClick={() => saveQty(row)}
                        className="px-3 py-1.5 rounded-xl bg-ios-green/15 text-[#1F7A33] text-xs font-bold disabled:opacity-40">💾 حفظ</button>
                      <button type="button" onClick={() => setEditRow(null)}
                        className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold">إلغاء</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ios-text text-sm">
                        {row.inventory_name}
                        <span className="text-ios-blue font-bold mr-2">
                          {fmtQty(row.quantity)} <span className="text-xs text-ios-label font-normal">{row.unit || ''}</span>
                        </span>
                      </span>
                      <div className="flex gap-1 whitespace-nowrap">
                        <button type="button" onClick={() => setEditRow({ id: row.id, quantity: String(parseFloat(row.quantity)) })}
                          className="px-2.5 py-1.5 rounded-xl bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">✏️</button>
                        <button type="button" onClick={() => deleteRecipe(row)}
                          className="px-2.5 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">🗑️</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {invItems.length === 0 && selectedBranch && (
            <p className="text-ios-orange text-sm font-semibold mt-3">⚠️ هذا الفرع ما بيه مواد جرد — أضفها من الإدارة العامة أولاً</p>
          )}
        </div>
      </div>
    </div>
  )
}
