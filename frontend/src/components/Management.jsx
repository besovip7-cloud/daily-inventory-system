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
      <h2 className="text-2xl font-bold mb-6 text-gray-900">🛠️ الإدارة العامة</h2>

      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b flex-wrap">
        <button onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-bold ${activeTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          👥 المستخدمون
        </button>
        <button onClick={() => setActiveTab('branches')}
          className={`px-4 py-2 font-bold ${activeTab === 'branches' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          🏪 الفروع
        </button>
        <button onClick={() => setActiveTab('items')}
          className={`px-4 py-2 font-bold ${activeTab === 'items' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          📦 مواد الجرد
        </button>
        <button onClick={() => setActiveTab('menu')}
          className={`px-4 py-2 font-bold ${activeTab === 'menu' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          🍽️ أصناف المبيعات
        </button>
      </div>

      {activeTab === 'users' && <UsersTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'branches' && <BranchesTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'items' && <ItemsTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'menu' && <MenuTab showMsg={showMsg} headers={headers} />}
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
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h3 className="text-lg font-bold mb-4">➕ إضافة مستخدم جديد</h3>
        <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <input type="text" placeholder="الاسم" required value={newUser.name}
            onChange={e => setNewUser({...newUser, name: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
          <input type="email" placeholder="البريد الإلكتروني" required value={newUser.email}
            onChange={e => setNewUser({...newUser, email: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
          <input type="password" placeholder="كلمة المرور (6+ أحرف)" required minLength={6} value={newUser.password}
            onChange={e => setNewUser({...newUser, password: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
          <select value={newUser.role}
            onChange={e => setNewUser({...newUser, role: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none">
            <option value="manager">مدير فرع</option>
            <option value="staff">موظف</option>
            <option value="accountant">محاسب</option>
            <option value="admin">مدير النظام</option>
          </select>
          {newUser.role !== 'admin' ? (
            <select required value={newUser.branch_id}
              onChange={e => setNewUser({...newUser, branch_id: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none">
              <option value="">اختر الفرع...</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : (
            <button type="submit"
              className="bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition">
              إضافة المستخدم
            </button>
          )}
          {newUser.role !== 'admin' && (
            <button type="submit"
              className="bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition md:col-span-2 lg:col-span-5">
              إضافة المستخدم
            </button>
          )}
        </form>
      </div>

      {loading ? (
        <div className="text-center p-10">جاري التحميل...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 font-bold">الاسم</th>
                <th className="p-4 font-bold">البريد الإلكتروني</th>
                <th className="p-4 font-bold">الصلاحية</th>
                <th className="p-4 font-bold">الفرع</th>
                <th className="p-4 font-bold">الحالة</th>
                <th className="p-4 font-bold">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-t border-gray-100">
                  <td className="p-4 font-semibold">{user.name}</td>
                  <td className="p-4 text-gray-600">{user.email}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                      user.role === 'accountant' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {roleLabels[user.role] || user.role}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">{user.branch_name || '—'}</td>
                  <td className="p-4">
                    {user.is_active
                      ? <span className="text-green-600 font-bold">✅ نشط</span>
                      : <span className="text-red-600 font-bold">⛔ معطل</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2 items-center">
                      <button onClick={() => toggleActive(user)}
                        className={`px-3 py-1 rounded-lg font-bold text-sm ${
                          user.is_active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}>
                        {user.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button onClick={() => { setResetPwFor(resetPwFor === user.id ? null : user.id); setNewPassword('') }}
                        className="px-3 py-1 rounded-lg font-bold text-sm bg-blue-100 text-blue-700 hover:bg-blue-200">
                        🔑 كلمة المرور
                      </button>
                      <button onClick={() => deleteUser(user)}
                        className="px-3 py-1 rounded-lg font-bold text-sm bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700">
                        🗑️ حذف
                      </button>
                    </div>
                    {resetPwFor === user.id && (
                      <div className="flex gap-2 mt-2">
                        <input type="password" placeholder="كلمة مرور جديدة (6+ أحرف)" value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="p-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
                        <button onClick={() => resetPassword(user)}
                          className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold text-sm">حفظ</button>
                        <button onClick={() => setResetPwFor(null)}
                          className="bg-gray-200 text-gray-600 px-3 py-1 rounded-lg font-bold text-sm">إلغاء</button>
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
          <button onClick={() => setShowAdd(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition">
            ➕ إضافة فرع
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200 mb-6">
          <h3 className="text-lg font-bold mb-4">➕ فرع جديد</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="text" placeholder="اسم الفرع *" required value={newBranch.name}
              onChange={e => setNewBranch({...newBranch, name: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none" />
            <input type="text" placeholder="الموقع" value={newBranch.location}
              onChange={e => setNewBranch({...newBranch, location: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none" />
            <input type="text" placeholder="اسم المدير" value={newBranch.manager_name}
              onChange={e => setNewBranch({...newBranch, manager_name: e.target.value})}
              className="p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none" />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition">إضافة</button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map(branch => (
          <div key={branch.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            {editing === branch.id ? (
              <div className="space-y-3">
                <input type="text" value={form.name} placeholder="اسم الفرع"
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
                <input type="text" value={form.location} placeholder="الموقع"
                  onChange={e => setForm({...form, location: e.target.value})}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
                <input type="text" value={form.manager_name} placeholder="اسم المدير"
                  onChange={e => setForm({...form, manager_name: e.target.value})}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => handleSave(branch.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition">💾 حفظ</button>
                  <button onClick={() => setEditing(null)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300 transition">إلغاء</button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{branch.name}</h3>
                <p className="text-gray-500 text-sm mb-1">📍 {branch.location || '—'}</p>
                <p className="text-gray-500 text-sm mb-4">👤 المدير: {branch.manager_name || '—'}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(branch.id); setForm({ name: branch.name, location: branch.location || '', manager_name: branch.manager_name || '' }) }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition">✏️ تعديل</button>
                  <button onClick={() => handleDelete(branch)}
                    className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold hover:bg-red-200 transition">🗑️ حذف</button>
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
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">الفرع</label>
        <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
          className="w-full md:w-80 p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none">
          {branches.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-bold mb-4 text-purple-900">{editingItem ? '✏️ تعديل مادة' : '➕ إضافة مادة جديدة'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input type="text" placeholder="اسم المادة *" required value={itemForm.name}
            onChange={e => setItemForm({...itemForm, name: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none" />
          <select value={itemForm.category}
            onChange={e => setItemForm({...itemForm, category: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none">
            {itemCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input type="text" placeholder="الوحدة (كجم/لتر/قطعة)" required value={itemForm.unit}
            onChange={e => setItemForm({...itemForm, unit: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none" />
          <input type="number" placeholder="الحد الأدنى" min="0" step="0.01" value={itemForm.min_quantity}
            onChange={e => setItemForm({...itemForm, min_quantity: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none" />
          <input type="number" placeholder="الكمية الحالية" min="0" step="0.01" value={itemForm.current_quantity}
            onChange={e => setItemForm({...itemForm, current_quantity: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none" />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-700 transition">
              {editingItem ? 'حفظ' : 'إضافة'}
            </button>
            {editingItem && (
              <button type="button" onClick={() => { setEditingItem(null); setItemForm(emptyItemForm) }}
                className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition">إلغاء</button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-right font-semibold">المادة</th>
              <th className="p-3 text-center font-semibold">الفئة</th>
              <th className="p-3 text-center font-semibold">الوحدة</th>
              <th className="p-3 text-center font-semibold">الحد الأدنى</th>
              <th className="p-3 text-center font-semibold">الكمية</th>
              <th className="p-3 text-center font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-gray-100">
                <td className="p-3 font-semibold">{item.name}</td>
                <td className="p-3 text-center text-gray-600">{itemCategories.find(c => c.value === item.category)?.label || item.category}</td>
                <td className="p-3 text-center text-gray-600">{item.unit}</td>
                <td className="p-3 text-center text-gray-600">{item.min_quantity}</td>
                <td className="p-3 text-center font-bold">{item.current_quantity}</td>
                <td className="p-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => startEdit(item)}
                      className="bg-blue-100 text-blue-700 px-3 py-1 rounded font-bold text-xs hover:bg-blue-200">✏️ تعديل</button>
                    <button onClick={() => handleDelete(item)}
                      className="bg-red-100 text-red-700 px-3 py-1 rounded font-bold text-xs hover:bg-red-200">🗑️ حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan="6" className="p-6 text-center text-gray-400">لا توجد مواد في هذا الفرع</td></tr>
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
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h3 className="text-lg font-bold mb-4">{editingMenu ? '✏️ تعديل صنف' : '➕ إضافة صنف مبيعات'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input type="text" placeholder="اسم الصنف *" required value={menuForm.name}
            onChange={e => setMenuForm({...menuForm, name: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
          <select value={menuForm.category}
            onChange={e => setMenuForm({...menuForm, category: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none">
            {menuCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input type="number" placeholder="السعر (د.ع) *" required step="0.01" min="0" value={menuForm.price}
            onChange={e => setMenuForm({...menuForm, price: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
          <input type="number" placeholder="التكلفة" step="0.01" min="0" value={menuForm.cost}
            onChange={e => setMenuForm({...menuForm, cost: e.target.value})}
            className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition">
              {editingMenu ? 'حفظ' : 'إضافة'}
            </button>
            {editingMenu && (
              <button type="button" onClick={() => { setEditingMenu(null); setMenuForm(emptyMenuForm) }}
                className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition">إلغاء</button>
            )}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {menuItems.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h4 className="font-bold">{item.name}</h4>
            <p className="text-gray-500 text-sm">{menuCategories.find(c => c.value === item.category)?.label || item.category}</p>
            <p className="text-blue-600 font-bold mt-2">{item.price} د.ع</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => startEdit(item)}
                className="flex-1 bg-blue-100 text-blue-700 py-1 rounded font-bold text-sm hover:bg-blue-200">✏️ تعديل</button>
              <button onClick={() => handleDelete(item)}
                className="flex-1 bg-red-100 text-red-700 py-1 rounded font-bold text-sm hover:bg-red-200">🗑️ حذف</button>
            </div>
          </div>
        ))}
      </div>
      {menuItems.length === 0 && (
        <p className="text-center text-gray-400 py-10">لا توجد أصناف مبيعات</p>
      )}
    </div>
  )
}
