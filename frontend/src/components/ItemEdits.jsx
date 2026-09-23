import { getToken } from '../utils/token'
import { hasPerm } from '../utils/permissions'
import { useState, useEffect } from 'react'
import { visibleBranches, isBranchLocked } from '../utils/branchScope'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function ItemEdits({ user }) {
  const token = getToken()
  const headers = { Authorization: `Bearer ${token}` }
  const branchLocked = isBranchLocked(user)
  const allowed = hasPerm(user, 'items.edit')

  const [tab, setTab] = useState('inv') // 'inv' مواد الجرد | 'menu' أصناف البيع
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [invItems, setInvItems] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState({ name: '', unit: '', price: '' })
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
    if (tab !== 'inv' || !selectedBranch) return
    loadInvItems()
  }, [tab, selectedBranch])

  useEffect(() => {
    if (tab !== 'menu') return
    loadMenuItems()
  }, [tab])

  const loadInvItems = () => {
    fetch(`${API_URL}/inventory/items/${selectedBranch}`, { headers })
      .then(r => r.json())
      .then(d => setInvItems(Array.isArray(d) ? d : []))
      .catch(() => setInvItems([]))
  }

  const loadMenuItems = () => {
    fetch(`${API_URL}/sales/menu`, { headers })
      .then(r => r.json())
      .then(d => setMenuItems(Array.isArray(d) ? d : []))
      .catch(() => setMenuItems([]))
  }

  const show = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setDraft({
      name: item.name || '',
      unit: item.unit || '',
      price: String(item.unit !== undefined ? (item.cost_per_unit ?? '') : (item.price ?? ''))
    })
  }

  const cancelEdit = () => {
    setEditId(null)
    setDraft({ name: '', unit: '', price: '' })
  }

  const saveInvItem = async (item) => {
    if (!draft.name.trim()) return show('❌ اسم المادة مطلوب')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/inventory/items/${item.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          category: item.category,
          unit: draft.unit.trim() || item.unit,
          min_quantity: parseFloat(item.min_quantity) || 0,
          current_quantity: parseFloat(item.current_quantity) || 0,
          cost_per_unit: parseFloat(draft.price) || 0,
          barcode: item.barcode || null
        })
      })
      const data = await res.json()
      if (res.ok) { show('✅ تم حفظ تعديلات المادة'); cancelEdit(); loadInvItems() }
      else show('❌ فشل الحفظ: ' + (data.message || ''))
    } catch { show('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const saveMenuItem = async (item) => {
    if (!draft.name.trim()) return show('❌ اسم الصنف مطلوب')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/sales/menu/${item.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          category: item.category,
          price: parseFloat(draft.price) || 0,
          cost: parseFloat(item.cost) || 0
        })
      })
      const data = await res.json()
      if (res.ok) { show('✅ تم حفظ تعديلات الصنف'); cancelEdit(); loadMenuItems() }
      else show('❌ فشل الحفظ: ' + (data.message || ''))
    } catch { show('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  if (!allowed) {
    return (
      <div dir="rtl">
        <PageHeader title="✏️ التعديلات" />
        <p className="text-center text-ios-label py-12 font-semibold">🔒 هذه الصفحة لمدير النظام فقط</p>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const filteredInv = q ? invItems.filter(i => i.name.toLowerCase().includes(q)) : invItems
  const filteredMenu = q ? menuItems.filter(i => i.name.toLowerCase().includes(q)) : menuItems

  return (
    <div dir="rtl">
      <PageHeader title="✏️ التعديلات — تعديل بيانات الأصناف" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      <div className="segmented mb-5">
        <button type="button" onClick={() => { setTab('inv'); cancelEdit() }}
          className={`segmented-item ${tab === 'inv' ? 'segmented-item-active' : ''}`}>
          📦 مواد الجرد
        </button>
        <button type="button" onClick={() => { setTab('menu'); cancelEdit() }}
          className={`segmented-item ${tab === 'menu' ? 'segmented-item-active' : ''}`}>
          🍽️ أصناف البيع
        </button>
      </div>

      <div className="mb-4">
        {tab === 'inv' && (
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-3">
            <div>
              <label className="label-ios">الفرع</label>
              <select value={selectedBranch}
                onChange={e => { setSelectedBranch(e.target.value); cancelEdit() }}
                disabled={branchLocked} className="input-ios disabled:opacity-60">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-ios">بحث</label>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍 ابحث باسم المادة..." className="input-ios" />
            </div>
          </div>
        )}
        {tab === 'menu' && (
          <div>
            <label className="label-ios">بحث</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 ابحث باسم الصنف..." className="input-ios" />
          </div>
        )}
      </div>

      {tab === 'inv' && (
        filteredInv.length === 0 ? (
          <p className="text-center text-ios-label py-8">{q ? 'ماكو نتائج مطابقة للبحث' : 'هذا الفرع ما بيه مواد جرد'}</p>
        ) : (
          <div className="card-ios overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-ios min-w-[640px]">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th className="w-28">الوحدة</th>
                    <th className="w-32">سعر التكلفة</th>
                    <th className="w-36"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInv.map(item => (
                    <tr key={item.id}>
                      {editId === item.id ? (
                        <>
                          <td>
                            <input type="text" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                              className="input-ios !py-1.5 text-sm" />
                          </td>
                          <td>
                            <input type="text" value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}
                              className="input-ios !py-1.5 text-sm" />
                          </td>
                          <td>
                            <input type="number" min="0" step="0.01" value={draft.price}
                              onChange={e => setDraft({ ...draft, price: e.target.value })}
                              className="input-ios !py-1.5 text-sm" />
                          </td>
                          <td>
                            <div className="flex gap-1.5 whitespace-nowrap">
                              <button type="button" disabled={saving} onClick={() => saveInvItem(item)}
                                className="px-3 py-1.5 rounded-xl bg-ios-green/15 text-[#1F7A33] text-xs font-bold active:opacity-70 disabled:opacity-40">
                                💾 حفظ
                              </button>
                              <button type="button" onClick={cancelEdit}
                                className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold active:opacity-70">
                                إلغاء
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="font-semibold text-ios-text">{item.name}</td>
                          <td className="text-xs text-ios-label">{item.unit || '—'}</td>
                          <td className="td-num text-ios-label">{parseFloat(item.cost_per_unit || 0).toFixed(2)}</td>
                          <td>
                            <button type="button" onClick={() => startEdit(item)}
                              className="px-3 py-1.5 rounded-xl bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">
                              ✏️ تعديل
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {tab === 'menu' && (
        filteredMenu.length === 0 ? (
          <p className="text-center text-ios-label py-8">{q ? 'ماكو نتائج مطابقة للبحث' : 'ماكو أصناف بيع'}</p>
        ) : (
          <div className="card-ios overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-ios min-w-[640px]">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th className="w-28">القسم</th>
                    <th className="w-32">السعر</th>
                    <th className="w-36"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMenu.map(item => (
                    <tr key={item.id}>
                      {editId === item.id ? (
                        <>
                          <td>
                            <input type="text" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                              className="input-ios !py-1.5 text-sm" />
                          </td>
                          <td className="text-xs text-ios-label">{item.category || '—'}</td>
                          <td>
                            <input type="number" min="0" step="0.01" value={draft.price}
                              onChange={e => setDraft({ ...draft, price: e.target.value })}
                              className="input-ios !py-1.5 text-sm" />
                          </td>
                          <td>
                            <div className="flex gap-1.5 whitespace-nowrap">
                              <button type="button" disabled={saving} onClick={() => saveMenuItem(item)}
                                className="px-3 py-1.5 rounded-xl bg-ios-green/15 text-[#1F7A33] text-xs font-bold active:opacity-70 disabled:opacity-40">
                                💾 حفظ
                              </button>
                              <button type="button" onClick={cancelEdit}
                                className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold active:opacity-70">
                                إلغاء
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="font-semibold text-ios-text">{item.name}</td>
                          <td className="text-xs text-ios-label">{item.category || '—'}</td>
                          <td className="td-num text-ios-label">{parseFloat(item.price || 0).toFixed(2)}</td>
                          <td>
                            <button type="button" onClick={() => startEdit(item)}
                              className="px-3 py-1.5 rounded-xl bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">
                              ✏️ تعديل
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
