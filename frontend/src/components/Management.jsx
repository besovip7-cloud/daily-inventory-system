import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const roleLabels = { admin: 'مدير النظام', manager: 'مدير فرع', staff: 'موظف', accountant: 'محاسب' }

const itemCategories = [
  { value: 'raw', label: 'مواد خام' },
  { value: 'packaging', label: 'تغليف' },
  { value: 'beverages', label: 'مشروبات' },
  { value: 'cleaning', label: 'مواد تنظيف' }
]

const menuCategories = [
  { value: 'main', label: 'وجبة رئيسية' },
  { value: 'appetizer', label: 'مقبلات' },
  { value: 'drink', label: 'مشروب' },
  { value: 'side', label: 'جانبي' }
]

const emptyItemForm = { name: '', category: 'raw', unit: '', min_quantity: '', current_quantity: '', cost_per_unit: '' }
const emptyMenuForm = { name: '', category: 'main', price: '', cost: '' }

// تحويل الكمية من وحدة المستخدم إلى وحدة مادة الجرد
const unitGroups = [
  { 'غرام': 1, 'كغم': 1000 },
  { 'مليلتر': 1, 'لتر': 1000 },
  { 'قطعة': 1 }
]

const toItemUnit = (qty, fromUnit, itemUnit) => {
  if (!itemUnit || !fromUnit || fromUnit === itemUnit) return qty
  const group = unitGroups.find(g => g[fromUnit] !== undefined && g[itemUnit] !== undefined)
  if (!group) return qty
  return qty * group[fromUnit] / group[itemUnit]
}

export default function Management() {
  const [activeTab, setActiveTab] = useState('users')
  const [message, setMessage] = useState('')
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const showMsg = (m) => {
    setMessage(m)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-ios-text tracking-tight">🛠️ الإدارة العامة</h2>

      {message && (
        <div className={`p-4 rounded-2xl mb-4 font-bold ${message.includes('✅') ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
          {message}
        </div>
      )}

      <div className="segmented mb-6">
        <button onClick={() => setActiveTab('users')}
          className={`segmented-item ${activeTab === 'users' ? 'segmented-item-active' : ''}`}>
          👥 المستخدمون
        </button>
        <button onClick={() => setActiveTab('branches')}
          className={`segmented-item ${activeTab === 'branches' ? 'segmented-item-active' : ''}`}>
          🏪 الفروع
        </button>
        <button onClick={() => setActiveTab('items')}
          className={`segmented-item ${activeTab === 'items' ? 'segmented-item-active' : ''}`}>
          📦 مواد الجرد
        </button>
        <button onClick={() => setActiveTab('menu')}
          className={`segmented-item ${activeTab === 'menu' ? 'segmented-item-active' : ''}`}>
          🍽️ أصناف المبيعات
        </button>
        <button onClick={() => setActiveTab('recipes')}
          className={`segmented-item ${activeTab === 'recipes' ? 'segmented-item-active' : ''}`}>
          🧪 المكونات
        </button>
      </div>

      {activeTab === 'users' && <UsersTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'branches' && <BranchesTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'items' && <ItemsTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'menu' && <MenuTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'recipes' && <RecipesTab showMsg={showMsg} headers={headers} />}
    </div>
  )
}

/* ================= 👥 المستخدمون ================= */
function UsersTab({ showMsg, headers }) {
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'manager', branch_id: '' })
  const [resetPwFor, setResetPwFor] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    loadUsers()
    fetch(`${API_URL}/branches`, { headers }).then(r => r.json()).then(d => setBranches(d || []))
  }, [])

  const loadUsers = () => {
    setLoading(true)
    fetch(`${API_URL}/auth/users`, { headers })
      .then(r => r.json())
      .then(d => { setUsers(d || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  const addUser = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/auth/users`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUser.name, email: newUser.email, password: newUser.password,
          role: newUser.role,
          branch_id: newUser.role === 'admin' ? null : (newUser.branch_id || null)
        })
      })
      const data = await res.json()
      if (res.ok) {
        showMsg('✅ تم إضافة المستخدم بنجاح!')
        setNewUser({ name: '', email: '', password: '', role: 'manager', branch_id: '' })
        loadUsers()
      } else {
        showMsg('❌ فشل: ' + (data.message || ''))
      }
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const toggleActive = async (user) => {
    try {
      const res = await fetch(`${API_URL}/auth/users/${user.id}/active`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active })
      })
      const data = await res.json()
      if (res.ok) { showMsg(`✅ تم ${user.is_active ? 'تعطيل' : 'تفعيل'} المستخدم`); loadUsers() }
      else showMsg('❌ ' + (data.message || 'فشل التحديث'))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const resetPassword = async (user) => {
    if (!newPassword || newPassword.length < 6) {
      showMsg('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    try {
      const res = await fetch(`${API_URL}/auth/users/${user.id}/password`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      })
      const data = await res.json()
      if (res.ok) {
        showMsg(`✅ تم تغيير كلمة مرور ${user.name}`)
        setResetPwFor(null); setNewPassword('')
      } else showMsg('❌ ' + (data.message || 'فشل تغيير كلمة المرور'))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const deleteUser = async (user) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${user.name}" نهائياً؟`)) return
    try {
      const res = await fetch(`${API_URL}/auth/users/${user.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { showMsg(`✅ تم حذف ${user.name}`); loadUsers() }
      else showMsg('❌ ' + (data.message || 'فشل الحذف'))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  return (
    <div>
      <div className="card-ios p-6 mb-6">
        <h3 className="text-lg font-bold mb-4 text-ios-text">➕ إضافة مستخدم جديد</h3>
        <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <input type="text" placeholder="الاسم" required value={newUser.name}
            onChange={e => setNewUser({...newUser, name: e.target.value})}
            className="input-ios" />
          <input type="email" placeholder="البريد الإلكتروني" required value={newUser.email}
            onChange={e => setNewUser({...newUser, email: e.target.value})}
            className="input-ios" />
          <input type="password" placeholder="كلمة المرور (6+ أحرف)" required minLength={6} value={newUser.password}
            onChange={e => setNewUser({...newUser, password: e.target.value})}
            className="input-ios" />
          <select value={newUser.role}
            onChange={e => setNewUser({...newUser, role: e.target.value})}
            className="input-ios">
            <option value="manager">مدير فرع</option>
            <option value="staff">موظف</option>
            <option value="accountant">محاسب</option>
            <option value="admin">مدير النظام</option>
          </select>
          {newUser.role !== 'admin' ? (
            <select required value={newUser.branch_id}
              onChange={e => setNewUser({...newUser, branch_id: e.target.value})}
              className="input-ios">
              <option value="">اختر الفرع...</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : (
            <button type="submit" className="btn-ios">
              إضافة المستخدم
            </button>
          )}
          {newUser.role !== 'admin' && (
            <button type="submit"
              className="btn-ios md:col-span-2 lg:col-span-5">
              إضافة المستخدم
            </button>
          )}
        </form>
      </div>

      {loading ? (
        <div className="text-center p-10 text-ios-label">جاري التحميل...</div>
      ) : (
        <div className="card-ios overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-[#F2F2F7]">
              <tr>
                <th className="p-4 font-bold text-ios-label text-xs">الاسم</th>
                <th className="p-4 font-bold text-ios-label text-xs">البريد الإلكتروني</th>
                <th className="p-4 font-bold text-ios-label text-xs">الصلاحية</th>
                <th className="p-4 font-bold text-ios-label text-xs">الفرع</th>
                <th className="p-4 font-bold text-ios-label text-xs">الحالة</th>
                <th className="p-4 font-bold text-ios-label text-xs">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-t border-ios-sep">
                  <td className="p-4 font-semibold text-ios-text">{user.name}</td>
                  <td className="p-4 text-ios-label">{user.email}</td>
                  <td className="p-4">
                    <span className={`badge-ios ${
                      user.role === 'admin' ? 'bg-ios-purple/15 text-ios-purple' :
                      user.role === 'manager' ? 'bg-ios-blue/10 text-ios-blue' :
                      user.role === 'accountant' ? 'bg-ios-orange/15 text-ios-orange' :
                      'bg-ios-fill text-ios-text'
                    }`}>
                      {roleLabels[user.role] || user.role}
                    </span>
                  </td>
                  <td className="p-4 text-ios-label">{user.branch_name || '—'}</td>
                  <td className="p-4">
                    {user.is_active
                      ? <span className="text-ios-green font-bold">✅ نشط</span>
                      : <span className="text-ios-red font-bold">⛔ معطل</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2 items-center">
                      <button onClick={() => toggleActive(user)}
                        className={`px-3 py-1 rounded-lg font-bold text-sm active:opacity-70 ${
                          user.is_active ? 'bg-ios-red/10 text-ios-red' : 'bg-ios-green/15 text-ios-green'
                        }`}>
                        {user.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button onClick={() => { setResetPwFor(resetPwFor === user.id ? null : user.id); setNewPassword('') }}
                        className="px-3 py-1 rounded-lg font-bold text-sm bg-ios-blue/10 text-ios-blue active:opacity-70">
                        🔑 كلمة المرور
                      </button>
                      <button onClick={() => deleteUser(user)}
                        className="px-3 py-1 rounded-lg font-bold text-sm bg-ios-fill text-ios-text active:opacity-70">
                        🗑️ حذف
                      </button>
                    </div>
                    {resetPwFor === user.id && (
                      <div className="flex gap-2 mt-2">
                        <input type="password" placeholder="كلمة مرور جديدة (6+ أحرف)" value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#F2F2F7] text-sm focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        <button onClick={() => resetPassword(user)}
                          className="btn-ios text-xs px-3 py-1.5">حفظ</button>
                        <button onClick={() => setResetPwFor(null)}
                          className="btn-ios-secondary text-xs px-3 py-1.5">إلغاء</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ================= 🏪 الفروع ================= */
function BranchesTab({ showMsg, headers }) {
  const [branches, setBranches] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', location: '', manager_name: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [newBranch, setNewBranch] = useState({ name: '', location: '', manager_name: '' })

  useEffect(() => { loadBranches() }, [])

  const loadBranches = () => {
    fetch(`${API_URL}/branches`, { headers }).then(r => r.json()).then(d => setBranches(d || []))
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/branches`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(newBranch)
      })
      const data = await res.json()
      if (res.ok) {
        showMsg('✅ تم إضافة الفرع بنجاح!')
        setNewBranch({ name: '', location: '', manager_name: '' })
        setShowAdd(false)
        loadBranches()
      } else showMsg('❌ فشل الإضافة: ' + (data.message || ''))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const handleSave = async (id) => {
    try {
      const res = await fetch(`${API_URL}/branches/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (res.ok) { showMsg('✅ تم التحديث بنجاح!'); setEditing(null); loadBranches() }
      else showMsg('❌ فشل التحديث: ' + (data.message || ''))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const handleDelete = async (branch) => {
    if (!window.confirm(
      `⚠️ تحذير: حذف "${branch.name}" سيمحو نهائياً:\n• كل مواد المخزون وسجلات الجرد\n• كل سجلات المبيعات\n• كل التنبيهات\n\nهل أنت متأكد؟`
    )) return
    try {
      const res = await fetch(`${API_URL}/branches/${branch.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { showMsg(`✅ تم حذف ${branch.name}`); loadBranches() }
      else showMsg('❌ فشل الحذف: ' + (data.message || ''))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="btn-ios">
            ➕ إضافة فرع
          </button>
        )}
      </div>

      {showAdd && (
        <div className="card-ios p-6 mb-6">
          <h3 className="text-lg font-bold mb-4 text-ios-text">➕ فرع جديد</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="text" placeholder="اسم الفرع *" required value={newBranch.name}
              onChange={e => setNewBranch({...newBranch, name: e.target.value})}
              className="input-ios" />
            <input type="text" placeholder="الموقع" value={newBranch.location}
              onChange={e => setNewBranch({...newBranch, location: e.target.value})}
              className="input-ios" />
            <input type="text" placeholder="اسم المدير" value={newBranch.manager_name}
              onChange={e => setNewBranch({...newBranch, manager_name: e.target.value})}
              className="input-ios" />
            <div className="flex gap-2">
              <button type="submit" className="btn-ios flex-1">إضافة</button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="btn-ios-secondary">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map(branch => (
          <div key={branch.id} className="card-ios p-6">
            {editing === branch.id ? (
              <div className="space-y-3">
                <input type="text" value={form.name} placeholder="اسم الفرع"
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="input-ios" />
                <input type="text" value={form.location} placeholder="الموقع"
                  onChange={e => setForm({...form, location: e.target.value})}
                  className="input-ios" />
                <input type="text" value={form.manager_name} placeholder="اسم المدير"
                  onChange={e => setForm({...form, manager_name: e.target.value})}
                  className="input-ios" />
                <div className="flex gap-2">
                  <button onClick={() => handleSave(branch.id)} className="btn-ios">💾 حفظ</button>
                  <button onClick={() => setEditing(null)} className="btn-ios-secondary">إلغاء</button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-bold text-lg text-ios-text mb-2">{branch.name}</h3>
                <p className="text-ios-label text-sm mb-1">📍 {branch.location || '—'}</p>
                <p className="text-ios-label text-sm mb-4">👤 المدير: {branch.manager_name || '—'}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(branch.id); setForm({ name: branch.name, location: branch.location || '', manager_name: branch.manager_name || '' }) }}
                    className="btn-ios-secondary">✏️ تعديل</button>
                  <button onClick={() => handleDelete(branch)}
                    className="btn-ios-danger">🗑️ حذف</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================= 📦 مواد الجرد ================= */
function ItemsTab({ showMsg, headers }) {
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [items, setItems] = useState([])
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [editingItem, setEditingItem] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers }).then(r => r.json()).then(d => {
      setBranches(d || [])
      if (d && d.length > 0) setSelectedBranch(d[0].id.toString())
    })
  }, [])

  useEffect(() => { if (selectedBranch) loadItems() }, [selectedBranch])

  const loadItems = () => {
    fetch(`${API_URL}/inventory/items/${selectedBranch}`, { headers })
      .then(r => r.json()).then(d => setItems(d || []))
  }

  const startEdit = (item) => {
    setEditingItem(item.id)
    setItemForm({
      name: item.name, category: item.category || 'raw', unit: item.unit || '',
      min_quantity: item.min_quantity ?? '', current_quantity: item.current_quantity ?? '',
      cost_per_unit: item.cost_per_unit ?? ''
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const isEdit = !!editingItem
      const res = await fetch(isEdit ? `${API_URL}/inventory/items/${editingItem}` : `${API_URL}/inventory/items`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: parseInt(selectedBranch),
          name: itemForm.name, category: itemForm.category, unit: itemForm.unit,
          min_quantity: parseFloat(itemForm.min_quantity) || 0,
          current_quantity: parseFloat(itemForm.current_quantity) || 0,
          cost_per_unit: parseFloat(itemForm.cost_per_unit) || 0
        })
      })
      const data = await res.json()
      if (res.ok) {
        showMsg(isEdit ? '✅ تم تعديل المادة بنجاح!' : '✅ تمت إضافة المادة بنجاح!')
        setItemForm(emptyItemForm)
        setEditingItem(null)
        loadItems()
      } else showMsg('❌ فشل: ' + (data.message || ''))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`هل أنت متأكد من حذف مادة "${item.name}"؟ (السجلات السابقة تبقى محفوظة)`)) return
    try {
      const res = await fetch(`${API_URL}/inventory/items/${item.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { showMsg(`✅ تم حذف ${item.name}`); loadItems() }
      else showMsg('❌ فشل الحذف: ' + (data.message || ''))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  return (
    <div>
      <div className="card-ios p-4 mb-6">
        <label className="label-ios">الفرع</label>
        <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
          className="input-ios md:w-80">
          {branches.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-ios-blue/10 rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-bold mb-4 text-ios-text">{editingItem ? '✏️ تعديل مادة' : '➕ إضافة مادة جديدة'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input type="text" placeholder="اسم المادة *" required value={itemForm.name}
            onChange={e => setItemForm({...itemForm, name: e.target.value})}
            className="input-ios" />
          <select value={itemForm.category}
            onChange={e => setItemForm({...itemForm, category: e.target.value})}
            className="input-ios">
            {itemCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={itemForm.unit}
            onChange={e => setItemForm({...itemForm, unit: e.target.value})}
            className="input-ios">
            <option value="">بدون وحدة (اختياري)</option>
            {itemForm.unit && !['كغم', 'غرام', 'لتر', 'مليلتر', 'قطعة'].includes(itemForm.unit) && (
              <option value={itemForm.unit}>{itemForm.unit} (حالية)</option>
            )}
            <option value="كغم">كغم</option>
            <option value="غرام">غرام</option>
            <option value="لتر">لتر</option>
            <option value="مليلتر">مليلتر</option>
            <option value="قطعة">قطعة</option>
          </select>
          <input type="number" placeholder="الحد الأدنى" min="0" step="0.01" value={itemForm.min_quantity}
            onChange={e => setItemForm({...itemForm, min_quantity: e.target.value})}
            className="input-ios" />
          <input type="number" placeholder="الكمية الحالية" min="0" step="0.01" value={itemForm.current_quantity}
            onChange={e => setItemForm({...itemForm, current_quantity: e.target.value})}
            className="input-ios" />
          <div className="flex gap-2">
            <button type="submit" className="btn-ios flex-1">
              {editingItem ? 'حفظ' : 'إضافة'}
            </button>
            {editingItem && (
              <button type="button" onClick={() => { setEditingItem(null); setItemForm(emptyItemForm) }}
                className="btn-ios-secondary">إلغاء</button>
            )}
          </div>
        </form>
      </div>

      <div className="card-ios overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F2F2F7]">
            <tr>
              <th className="p-3 text-right font-semibold text-ios-label text-xs">المادة</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">الفئة</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">الوحدة</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">الحد الأدنى</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">الكمية</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-ios-sep last:border-b-0">
                <td className="p-3 font-semibold text-ios-text">{item.name}</td>
                <td className="p-3 text-center text-ios-label">{itemCategories.find(c => c.value === item.category)?.label || item.category}</td>
                <td className="p-3 text-center text-ios-label">{item.unit || '—'}</td>
                <td className="p-3 text-center text-ios-label">{item.min_quantity}</td>
                <td className="p-3 text-center font-bold">{item.current_quantity}</td>
                <td className="p-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => startEdit(item)}
                      className="text-ios-blue font-bold text-xs px-2 active:opacity-70">✏️ تعديل</button>
                    <button onClick={() => handleDelete(item)}
                      className="text-ios-red font-bold text-xs px-2 active:opacity-70">🗑️ حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan="6" className="p-6 text-center text-ios-label">لا توجد مواد في هذا الفرع</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================= 🍽️ أصناف المبيعات ================= */
function MenuTab({ showMsg, headers }) {
  const [menuItems, setMenuItems] = useState([])
  const [menuForm, setMenuForm] = useState(emptyMenuForm)
  const [editingMenu, setEditingMenu] = useState(null)

  useEffect(() => { loadMenu() }, [])

  const loadMenu = () => {
    fetch(`${API_URL}/sales/menu`, { headers }).then(r => r.json()).then(d => setMenuItems(d || []))
  }

  const startEdit = (item) => {
    setEditingMenu(item.id)
    setMenuForm({ name: item.name, category: item.category || 'main', price: item.price ?? '', cost: item.cost ?? '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const isEdit = !!editingMenu
      const res = await fetch(isEdit ? `${API_URL}/sales/menu/${editingMenu}` : `${API_URL}/sales/menu`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: menuForm.name, category: menuForm.category,
          price: parseFloat(menuForm.price), cost: parseFloat(menuForm.cost) || 0
        })
      })
      const data = await res.json()
      if (res.ok) {
        showMsg(isEdit ? '✅ تم تعديل الصنف بنجاح!' : '✅ تمت إضافة الصنف بنجاح!')
        setMenuForm(emptyMenuForm)
        setEditingMenu(null)
        loadMenu()
      } else showMsg('❌ فشل: ' + (data.message || ''))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`هل أنت متأكد من حذف صنف "${item.name}"؟ (سجلات البيع السابقة تبقى محفوظة)`)) return
    try {
      const res = await fetch(`${API_URL}/sales/menu/${item.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) { showMsg(`✅ تم حذف ${item.name}`); loadMenu() }
      else showMsg('❌ فشل الحذف: ' + (data.message || ''))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  return (
    <div>
      <div className="card-ios p-6 mb-6">
        <h3 className="text-lg font-bold mb-4 text-ios-text">{editingMenu ? '✏️ تعديل صنف' : '➕ إضافة صنف مبيعات'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input type="text" placeholder="اسم الصنف *" required value={menuForm.name}
            onChange={e => setMenuForm({...menuForm, name: e.target.value})}
            className="input-ios" />
          <select value={menuForm.category}
            onChange={e => setMenuForm({...menuForm, category: e.target.value})}
            className="input-ios">
            {menuCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input type="number" placeholder="السعر (د.ع) *" required step="0.01" min="0" value={menuForm.price}
            onChange={e => setMenuForm({...menuForm, price: e.target.value})}
            className="input-ios" />
          <input type="number" placeholder="التكلفة" step="0.01" min="0" value={menuForm.cost}
            onChange={e => setMenuForm({...menuForm, cost: e.target.value})}
            className="input-ios" />
          <div className="flex gap-2">
            <button type="submit" className="btn-ios flex-1">
              {editingMenu ? 'حفظ' : 'إضافة'}
            </button>
            {editingMenu && (
              <button type="button" onClick={() => { setEditingMenu(null); setMenuForm(emptyMenuForm) }}
                className="btn-ios-secondary">إلغاء</button>
            )}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {menuItems.map(item => (
          <div key={item.id} className="card-ios p-4">
            <h4 className="font-bold text-ios-text">{item.name}</h4>
            <p className="text-ios-label text-sm">{menuCategories.find(c => c.value === item.category)?.label || item.category}</p>
            <p className="text-ios-blue font-bold mt-2">{item.price} د.ع</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => startEdit(item)}
                className="flex-1 text-ios-blue py-1 rounded-lg font-bold text-sm bg-ios-blue/10 active:opacity-70">✏️ تعديل</button>
              <button onClick={() => handleDelete(item)}
                className="flex-1 text-ios-red py-1 rounded-lg font-bold text-sm bg-ios-red/10 active:opacity-70">🗑️ حذف</button>
            </div>
          </div>
        ))}
      </div>
      {menuItems.length === 0 && (
        <p className="text-center text-ios-label py-10">لا توجد أصناف مبيعات</p>
      )}
    </div>
  )
}

/* ================= 🧪 مكونات الأصناف ================= */
function RecipesTab({ showMsg, headers }) {
  const [branches, setBranches] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [invItems, setInvItems] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedMenu, setSelectedMenu] = useState('')
  const [recipes, setRecipes] = useState([])
  const [newRecipe, setNewRecipe] = useState({ inventory_item_id: '', quantity: '', unit: 'غرام' })

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers }).then(r => r.json()).then(d => {
      setBranches(d || [])
      if (d && d.length > 0) setSelectedBranch(d[0].id.toString())
    })
    fetch(`${API_URL}/sales/menu`, { headers }).then(r => r.json()).then(d => {
      setMenuItems(d || [])
      if (d && d.length > 0) setSelectedMenu(d[0].id.toString())
    })
  }, [])

  useEffect(() => {
    if (!selectedBranch) return
    fetch(`${API_URL}/inventory/items/${selectedBranch}`, { headers })
      .then(r => r.json()).then(d => setInvItems(d || []))
  }, [selectedBranch])

  useEffect(() => {
    if (selectedBranch && selectedMenu) loadRecipes()
  }, [selectedBranch, selectedMenu])

  const loadRecipes = () => {
    fetch(`${API_URL}/sales/recipes?branch_id=${selectedBranch}&menu_id=${selectedMenu}`, { headers })
      .then(r => r.json()).then(d => setRecipes(d || []))
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const invItem = invItems.find(i => i.id === parseInt(newRecipe.inventory_item_id))
    const finalQty = toItemUnit(parseFloat(newRecipe.quantity), newRecipe.unit, invItem?.unit)
    try {
      const res = await fetch(`${API_URL}/sales/recipes`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: parseInt(selectedBranch),
          menu_item_id: parseInt(selectedMenu),
          inventory_item_id: parseInt(newRecipe.inventory_item_id),
          quantity: finalQty
        })
      })
      const data = await res.json()
      if (res.ok) {
        const converted = finalQty !== parseFloat(newRecipe.quantity)
        showMsg(`✅ تم حفظ المكون بنجاح!${converted ? ` (تم التحويل: ${newRecipe.quantity} ${newRecipe.unit} = ${finalQty} ${invItem?.unit})` : ''}`)
        setNewRecipe({ inventory_item_id: '', quantity: '', unit: 'غرام' })
        loadRecipes()
      } else {
        showMsg('❌ فشل: ' + (data.message || ''))
      }
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const handleDelete = async (recipe) => {
    if (!window.confirm(`حذف مكون "${recipe.inventory_name}" من هذا الصنف؟`)) return
    try {
      const res = await fetch(`${API_URL}/sales/recipes/${recipe.id}`, { method: 'DELETE', headers })
      if (res.ok) { showMsg('✅ تم حذف المكون'); loadRecipes() }
      else showMsg('❌ فشل الحذف')
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  return (
    <div>
      <div className="bg-ios-blue/10 rounded-2xl p-4 mb-6 text-sm text-ios-blue">
        💡 <b>كيف يعمل؟</b> اربط كل صنف بيع بمواد الجرد وكمياتها — مثلاً "صاج لحم" يستهلك 0.15 كغم شاورما لحم.
        عند حفظ المبيعات تنقص الكميات تلقائياً من مخزون الفرع.
      </div>

      <div className="card-ios p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="label-ios">الفرع</label>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
            className="input-ios">
            {branches.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-ios">صنف البيع</label>
          <select value={selectedMenu} onChange={e => setSelectedMenu(e.target.value)}
            className="input-ios">
            {menuItems.map(m => <option key={m.id} value={m.id.toString()}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card-ios p-6 mb-6">
        <h3 className="text-lg font-bold mb-4 text-ios-text">➕ إضافة مكون</h3>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select required value={newRecipe.inventory_item_id}
            onChange={e => setNewRecipe({...newRecipe, inventory_item_id: e.target.value})}
            className="input-ios">
            <option value="">اختر مادة من الجرد...</option>
            {invItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit || 'بدون وحدة'})</option>)}
          </select>
          <input type="number" placeholder="الكمية لكل صنف واحد" required min="0.001" step="0.001"
            value={newRecipe.quantity}
            onChange={e => setNewRecipe({...newRecipe, quantity: e.target.value})}
            className="input-ios" />
          <select value={newRecipe.unit}
            onChange={e => setNewRecipe({...newRecipe, unit: e.target.value})}
            className="input-ios">
            <option value="غرام">غرام</option>
            <option value="كغم">كغم</option>
            <option value="لتر">لتر</option>
            <option value="مليلتر">مليلتر</option>
            <option value="قطعة">قطعة</option>
          </select>
          <button type="submit" className="btn-ios">
            إضافة المكون
          </button>
        </form>
        <p className="text-ios-label text-sm mt-3">
          💡 إذا اخترت وحدة مختلفة عن وحدة المادة (مثلاً غرام لمادة بوحدة كغم)، يتم التحويل تلقائياً
        </p>
        {invItems.length === 0 && (
          <p className="text-[#B25000] text-sm mt-3">⚠️ هذا الفرع ما بيه مواد جرد — أضفها من تبويب "📦 مواد الجرد" أولاً</p>
        )}
      </div>

      <div className="card-ios overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F2F2F7]">
            <tr>
              <th className="p-3 text-right font-semibold text-ios-label text-xs">مادة الجرد</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">الكمية لكل صنف</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map(r => (
              <tr key={r.id} className="border-t border-ios-sep last:border-b-0">
                <td className="p-3 font-semibold text-ios-text">{r.inventory_name} <span className="text-ios-label text-xs">({r.unit || 'بدون وحدة'})</span></td>
                <td className="p-3 text-center font-bold text-ios-blue">{r.quantity}</td>
                <td className="p-3 text-center">
                  <button onClick={() => handleDelete(r)}
                    className="text-ios-red font-bold text-xs px-2 active:opacity-70">🗑️ حذف</button>
                </td>
              </tr>
            ))}
            {recipes.length === 0 && (
              <tr><td colSpan="3" className="p-6 text-center text-ios-label">
                لا توجد مكونات لهذا الصنف — أضفها من النموذج أعلاه
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
