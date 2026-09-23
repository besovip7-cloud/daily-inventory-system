import { getToken } from '../utils/token'
import { useState, useEffect } from 'react'
import PageHeader from './PageHeader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Groups() {
  const token = getToken()
  const headers = { Authorization: `Bearer ${token}` }

  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [newGroup, setNewGroup] = useState('')
  const [editGroup, setEditGroup] = useState(null) // {id, name}
  const [newDep, setNewDep] = useState('')
  const [editDep, setEditDep] = useState(null) // {id, name}
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { loadGroups() }, [])

  const loadGroups = () => {
    fetch(`${API_URL}/catalog/groups`, { headers })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : []
        setGroups(list)
        setSelectedGroup(prev => {
          if (!prev) return list[0]?.id ?? null
          return list.some(g => g.id === prev) ? prev : (list[0]?.id ?? null)
        })
      })
      .catch(() => {})
  }

  const show = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const post = async (url, method, body) => {
    const res = await fetch(url, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data }
  }

  // ── المجموعات ──
  const addGroup = async (e) => {
    e.preventDefault()
    if (!newGroup.trim()) return
    setSaving(true)
    const { ok, data } = await post(`${API_URL}/catalog/groups`, 'POST', { name: newGroup.trim() })
    if (ok) { show('✅ تمت إضافة المجموعة'); setNewGroup(''); loadGroups() }
    else show('❌ ' + (data.message || 'فشلت الإضافة'))
    setSaving(false)
  }

  const saveGroup = async (g) => {
    if (!editGroup.name.trim()) return
    setSaving(true)
    const { ok, data } = await post(`${API_URL}/catalog/groups/${g.id}`, 'PUT', { name: editGroup.name.trim() })
    if (ok) { show('✅ تم حفظ المجموعة'); setEditGroup(null); loadGroups() }
    else show('❌ ' + (data.message || 'فشل الحفظ'))
    setSaving(false)
  }

  const deleteGroup = async (g) => {
    const depCount = g.departments?.length || 0
    const warn = depCount > 0
      ? `حذف المجموعة "${g.name}"؟\nراح تنحذف وياها ${depCount} قسم — هذا الإجراء ما يكدر يتراجع عنه.`
      : `حذف المجموعة "${g.name}"؟`
    if (!window.confirm(warn)) return
    const { ok, data } = await post(`${API_URL}/catalog/groups/${g.id}`, 'DELETE')
    if (ok) { show('✅ ' + (data.message || 'تم الحذف')); loadGroups() }
    else show('❌ ' + (data.message || 'فشل الحذف'))
  }

  // ── الأقسام ──
  const selected = groups.find(g => g.id === selectedGroup)

  const addDep = async (e) => {
    e.preventDefault()
    if (!newDep.trim() || !selectedGroup) return
    setSaving(true)
    const { ok, data } = await post(`${API_URL}/catalog/departments`, 'POST', { group_id: selectedGroup, name: newDep.trim() })
    if (ok) { show('✅ تمت إضافة القسم'); setNewDep(''); loadGroups() }
    else show('❌ ' + (data.message || 'فشلت الإضافة'))
    setSaving(false)
  }

  const saveDep = async (dep) => {
    if (!editDep.name.trim()) return
    setSaving(true)
    const { ok, data } = await post(`${API_URL}/catalog/departments/${dep.id}`, 'PUT', { name: editDep.name.trim() })
    if (ok) { show('✅ تم حفظ القسم'); setEditDep(null); loadGroups() }
    else show('❌ ' + (data.message || 'فشل الحفظ'))
    setSaving(false)
  }

  const deleteDep = async (dep) => {
    if (!window.confirm(`حذف القسم "${dep.name}"؟`)) return
    const { ok, data } = await post(`${API_URL}/catalog/departments/${dep.id}`, 'DELETE')
    if (ok) { show('✅ ' + (data.message || 'تم الحذف')); loadGroups() }
    else show('❌ ' + (data.message || 'فشل الحذف'))
  }

  return (
    <div dir="rtl">
      <PageHeader title="🗂️ المجموعات والأقسام" subtitle="نظّم موادك الخام بمجموعات وأقسام فرعية" />

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold anim-pop ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* المجموعات */}
        <div className="card-ios p-4">
          <div className="section-title"><h3 className="mb-3">المجموعات ({groups.length})</h3></div>
          <form onSubmit={addGroup} className="flex gap-2 mb-3">
            <input type="text" value={newGroup} onChange={e => setNewGroup(e.target.value)}
              placeholder="اسم مجموعة جديدة..." className="input-ios flex-1" />
            <button type="submit" disabled={saving || !newGroup.trim()}
              className="btn-ios px-4 whitespace-nowrap disabled:opacity-40">➕ إضافة</button>
          </form>
          {groups.length === 0 ? (
            <p className="text-center text-ios-label py-6 text-sm">لا توجد مجموعات — أضف أول مجموعة</p>
          ) : (
            <div className="space-y-2">
              {groups.map(g => (
                <div key={g.id}
                  onClick={() => { setSelectedGroup(g.id); setEditDep(null) }}
                  className={`rounded-2xl border p-3 cursor-pointer transition active:opacity-70 ${
                    selectedGroup === g.id ? 'border-ios-blue/40 bg-ios-blue/10' : 'border-ios-sep bg-white hover:bg-ios-fill'
                  }`}>
                  {editGroup?.id === g.id ? (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <input type="text" value={editGroup.name} autoFocus
                        onChange={e => setEditGroup({ ...editGroup, name: e.target.value })}
                        className="input-ios !py-1.5 text-sm flex-1" />
                      <button type="button" disabled={saving} onClick={() => saveGroup(g)}
                        className="px-3 py-1.5 rounded-xl bg-ios-green/15 text-[#1F7A33] text-xs font-bold disabled:opacity-40">💾</button>
                      <button type="button" onClick={() => setEditGroup(null)}
                        className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ios-text text-sm flex-1">
                        🗂️ {g.name}
                        <span className="text-xs text-ios-label font-normal mr-2">({g.departments?.length || 0} قسم)</span>
                      </span>
                      <div className="flex gap-1 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => setEditGroup({ id: g.id, name: g.name })}
                          className="px-2.5 py-1.5 rounded-xl bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">✏️</button>
                        <button type="button" onClick={() => deleteGroup(g)}
                          className="px-2.5 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">🗑️</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* أقسام المجموعة المختارة */}
        <div className="card-ios p-4">
          <div className="section-title">
            <h3 className="mb-3">أقسام {selected ? `"${selected.name}"` : '—'} ({selected?.departments?.length || 0})</h3>
          </div>
          {selected ? (
            <>
              <form onSubmit={addDep} className="flex gap-2 mb-3">
                <input type="text" value={newDep} onChange={e => setNewDep(e.target.value)}
                  placeholder="اسم قسم جديد..." className="input-ios flex-1" />
                <button type="submit" disabled={saving || !newDep.trim()}
                  className="btn-ios px-4 whitespace-nowrap disabled:opacity-40">➕ إضافة</button>
              </form>
              {(selected.departments?.length || 0) === 0 ? (
                <p className="text-center text-ios-label py-6 text-sm">هذه المجموعة بدون أقسام</p>
              ) : (
                <div className="space-y-2">
                  {selected.departments.map(dep => (
                    <div key={dep.id} className="rounded-2xl border border-ios-sep bg-white p-3">
                      {editDep?.id === dep.id ? (
                        <div className="flex gap-2">
                          <input type="text" value={editDep.name} autoFocus
                            onChange={e => setEditDep({ ...editDep, name: e.target.value })}
                            className="input-ios !py-1.5 text-sm flex-1" />
                          <button type="button" disabled={saving} onClick={() => saveDep(dep)}
                            className="px-3 py-1.5 rounded-xl bg-ios-green/15 text-[#1F7A33] text-xs font-bold disabled:opacity-40">💾</button>
                          <button type="button" onClick={() => setEditDep(null)}
                            className="px-3 py-1.5 rounded-xl bg-ios-fill text-ios-text text-xs font-bold">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ios-text text-sm">📁 {dep.name}</span>
                          <div className="flex gap-1 whitespace-nowrap">
                            <button type="button" onClick={() => setEditDep({ id: dep.id, name: dep.name })}
                              className="px-2.5 py-1.5 rounded-xl bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">✏️</button>
                            <button type="button" onClick={() => deleteDep(dep)}
                              className="px-2.5 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">🗑️</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-ios-label py-6 text-sm">اختر مجموعة حتى تضيف أقسامها</p>
          )}
        </div>
      </div>
    </div>
  )
}
