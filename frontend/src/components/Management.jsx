import { useState, useEffect } from 'react'
import { hasPerm } from '../utils/permissions'

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

export default function Management({ user }) {
  const [activeTab, setActiveTab] = useState('users')
  const [message, setMessage] = useState('')
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const canUsers = hasPerm(user, 'users.manage')
  const canCatalog = hasPerm(user, 'catalog.manage')
  const canSettings = hasPerm(user, 'settings.manage')

  const tabs = [
    canUsers && { key: 'users', label: '👥 المستخدمون' },
    canUsers && { key: 'roles', label: '🎭 الأدوار والصلاحيات' },
    canCatalog && { key: 'branches', label: '🏪 الفروع' },
    canCatalog && { key: 'items', label: '📦 مواد الجرد' },
    canCatalog && { key: 'menu', label: '🍽️ أصناف المبيعات' },
    canCatalog && { key: 'recipes', label: '🧪 المكونات' },
    canSettings && { key: 'settings', label: '⚙️ الإعدادات' },
  ].filter(Boolean)

  // أول تبويب متاح افتراضياً
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(t => t.key === activeTab)) setActiveTab(tabs[0].key)
  }, [])

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

      <div className="segmented mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`segmented-item ${activeTab === t.key ? 'segmented-item-active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && canUsers && <UsersTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'roles' && canUsers && <RolesTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'branches' && canCatalog && <BranchesTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'items' && canCatalog && <ItemsTab showMsg={showMsg} headers={headers} user={user} />}
      {activeTab === 'menu' && canCatalog && <MenuTab showMsg={showMsg} headers={headers} user={user} />}
      {activeTab === 'recipes' && canCatalog && <RecipesTab showMsg={showMsg} headers={headers} />}
      {activeTab === 'settings' && canSettings && <SettingsTab showMsg={showMsg} headers={headers} />}
    </div>
  )
}

/* ================= 👥 المستخدمون ================= */
function UsersTab({ showMsg, headers }) {
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [customRoles, setCustomRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'manager', branch_id: '', custom_role_id: '' })
  const [resetPwFor, setResetPwFor] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [editingUser, setEditingUser] = useState(null) // { id, name, email, role, branch_id, custom_role_id }

  useEffect(() => {
    loadUsers()
    fetch(`${API_URL}/branches`, { headers }).then(r => r.json()).then(d => setBranches(d || []))
    fetch(`${API_URL}/roles`, { headers }).then(r => r.json()).then(d => setCustomRoles(d || []))
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
          branch_id: newUser.role === 'admin' ? null : (newUser.branch_id || null),
          custom_role_id: newUser.custom_role_id || null
        })
      })
      const data = await res.json()
      if (res.ok) {
        showMsg('✅ تم إضافة المستخدم بنجاح!')
        setNewUser({ name: '', email: '', password: '', role: 'manager', branch_id: '', custom_role_id: '' })
        loadUsers()
      } else {
        showMsg('❌ فشل: ' + (data.message || ''))
      }
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          role: editingUser.role,
          branch_id: editingUser.role === 'admin' ? null : (editingUser.branch_id || null),
          custom_role_id: editingUser.custom_role_id || null
        })
      })
      const data = await res.json()
      if (res.ok) {
        showMsg(`✅ تم تعديل بيانات ${editingUser.name}`)
        setEditingUser(null)
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
        <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
          <select value={newUser.custom_role_id}
            onChange={e => setNewUser({...newUser, custom_role_id: e.target.value})}
            className="input-ios" title="دور مخصص يتجاوز الصلاحيات المدمجة">
            <option value="">🎭 بدون دور مخصص</option>
            {customRoles.map(r => <option key={r.id} value={r.id}>🎭 {r.name}</option>)}
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
              className="btn-ios md:col-span-2 lg:col-span-6">
              إضافة المستخدم
            </button>
          )}
        </form>
        <p className="text-xs text-ios-label mt-2">الدور المخصص (🎭) يتجاوز صلاحيات الدور المدمج — اتركه "بدون دور مخصص" لاستخدام الصلاحيات الافتراضية.</p>
      </div>

      {editingUser && (
        <div className="card-ios p-6 mb-6 border-2 border-ios-blue">
          <h3 className="text-lg font-bold mb-4 text-ios-text">✏️ تعديل المستخدم: {editingUser.name}</h3>
          <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <input type="text" placeholder="الاسم" required value={editingUser.name}
              onChange={e => setEditingUser({...editingUser, name: e.target.value})}
              className="input-ios" />
            <input type="email" placeholder="البريد الإلكتروني" required value={editingUser.email}
              onChange={e => setEditingUser({...editingUser, email: e.target.value})}
              className="input-ios" />
            <select value={editingUser.role}
              onChange={e => setEditingUser({...editingUser, role: e.target.value})}
              className="input-ios">
              <option value="manager">مدير فرع</option>
              <option value="staff">موظف</option>
              <option value="accountant">محاسب</option>
              <option value="admin">مدير النظام</option>
            </select>
            <select value={editingUser.custom_role_id || ''}
              onChange={e => setEditingUser({...editingUser, custom_role_id: e.target.value})}
              className="input-ios">
              <option value="">🎭 بدون دور مخصص</option>
              {customRoles.map(r => <option key={r.id} value={r.id}>🎭 {r.name}</option>)}
            </select>
            {editingUser.role !== 'admin' ? (
              <select required value={editingUser.branch_id || ''}
                onChange={e => setEditingUser({...editingUser, branch_id: e.target.value ? parseInt(e.target.value) : ''})}
                className="input-ios">
                <option value="">اختر الفرع...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : (
              <div className="flex items-center text-ios-label text-sm">الأدمن يشوف كل الفروع</div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-ios flex-1">💾 حفظ التعديلات</button>
              <button type="button" onClick={() => setEditingUser(null)}
                className="btn-ios-secondary">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center p-10 text-ios-label">جاري التحميل...</div>
      ) : (
        <div className="card-ios overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-right min-w-[860px]">
            <thead className="bg-[#F2F2F7]">
              <tr>
                <th className="p-4 font-bold text-ios-label text-xs whitespace-nowrap">الاسم</th>
                <th className="p-4 font-bold text-ios-label text-xs whitespace-nowrap">البريد الإلكتروني</th>
                <th className="p-4 font-bold text-ios-label text-xs whitespace-nowrap">الصلاحية</th>
                <th className="p-4 font-bold text-ios-label text-xs whitespace-nowrap">الفرع</th>
                <th className="p-4 font-bold text-ios-label text-xs whitespace-nowrap">الحالة</th>
                <th className="p-4 font-bold text-ios-label text-xs whitespace-nowrap">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-t border-ios-sep align-top">
                  <td className="p-4 font-semibold text-ios-text whitespace-nowrap">{user.name}</td>
                  <td className="p-4 text-ios-label" style={{ direction: 'ltr', textAlign: 'right' }}>{user.email}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`badge-ios ${
                      user.custom_role_name ? 'bg-ios-purple/15 text-ios-purple' :
                      user.role === 'admin' ? 'bg-ios-purple/15 text-ios-purple' :
                      user.role === 'manager' ? 'bg-ios-blue/10 text-ios-blue' :
                      user.role === 'accountant' ? 'bg-ios-orange/15 text-ios-orange' :
                      'bg-ios-fill text-ios-text'
                    }`}>
                      {user.custom_role_name ? `🎭 ${user.custom_role_name}` : (roleLabels[user.role] || user.role)}
                    </span>
                  </td>
                  <td className="p-4 text-ios-label whitespace-nowrap">{user.branch_name || '—'}</td>
                  <td className="p-4 whitespace-nowrap">
                    {user.is_active
                      ? <span className="text-ios-green font-bold">✅ نشط</span>
                      : <span className="text-ios-red font-bold">⛔ معطل</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 items-center whitespace-nowrap">
                      <button onClick={() => toggleActive(user)}
                        className={`px-2 py-1 rounded-lg font-bold text-xs active:opacity-70 ${
                          user.is_active ? 'bg-ios-red/10 text-ios-red' : 'bg-ios-green/15 text-ios-green'
                        }`}>
                        {user.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button onClick={() => { setResetPwFor(resetPwFor === user.id ? null : user.id); setNewPassword('') }}
                        className="px-2 py-1 rounded-lg font-bold text-xs bg-ios-blue/10 text-ios-blue active:opacity-70">
                        🔑 كلمة السر
                      </button>
                      <button onClick={() => { setEditingUser({ id: user.id, name: user.name, email: user.email, role: user.role, branch_id: user.branch_id }); setResetPwFor(null) }}
                        className="px-2 py-1 rounded-lg font-bold text-xs bg-ios-blue/10 text-ios-blue active:opacity-70">
                        ✏️ تعديل
                      </button>
                      <button onClick={() => deleteUser(user)}
                        className="px-2 py-1 rounded-lg font-bold text-xs bg-ios-fill text-ios-text active:opacity-70">
                        🗑️ حذف
                      </button>
                    </div>
                    {resetPwFor === user.id && (
                      <div className="flex gap-2 mt-2">
                        <input type="password" placeholder="كلمة مرور جديدة (6+ أحرف)" value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#F2F2F7] text-sm focus:ring-2 focus:ring-ios-blue focus:outline-none" />
                        <button onClick={() => resetPassword(user)}
                          className="btn-ios text-xs px-3 py-1.5 whitespace-nowrap">حفظ</button>
                        <button onClick={() => setResetPwFor(null)}
                          className="btn-ios-secondary text-xs px-3 py-1.5 whitespace-nowrap">إلغاء</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
function ItemsTab({ showMsg, headers, user }) {
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [items, setItems] = useState([])
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [editingItem, setEditingItem] = useState(null)
  const [addToAll, setAddToAll] = useState(false)
  const [selected, setSelected] = useState([])
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers }).then(r => r.json()).then(d => {
      setBranches(d || [])
      if (d && d.length > 0) setSelectedBranch(d[0].id.toString())
    })
  }, [])

  useEffect(() => { if (selectedBranch) loadItems() }, [selectedBranch])

  const loadItems = () => {
    setSelected([])
    fetch(`${API_URL}/inventory/items/${selectedBranch}`, { headers })
      .then(r => r.json()).then(d => setItems(d || []))
  }

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    setSelected(prev => prev.length === items.length ? [] : items.map(i => i.id))
  }

  const deleteSelected = async () => {
    if (!window.confirm(`حذف ${selected.length} مادة نهائياً؟ (السجلات السابقة تبقى محفوظة)`)) return
    try {
      const res = await fetch(`${API_URL}/inventory/items`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected })
      })
      const data = await res.json()
      if (res.ok) { showMsg(`✅ ${data.message || `تم حذف ${selected.length} مادة`}`); loadItems() }
      else showMsg('❌ فشل الحذف: ' + (data.message || ''))
    } catch { showMsg('❌ خطأ في الاتصال') }
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
    const buildBody = (branchId) => JSON.stringify({
      branch_id: parseInt(branchId),
      name: itemForm.name, category: itemForm.category, unit: itemForm.unit,
      min_quantity: parseFloat(itemForm.min_quantity) || 0,
      current_quantity: parseFloat(itemForm.current_quantity) || 0,
      cost_per_unit: parseFloat(itemForm.cost_per_unit) || 0
    })
    try {
      const isEdit = !!editingItem

      // إضافة المادة لكل الفروع دفعة واحدة
      if (!isEdit && addToAll && branches.length > 1) {
        const results = await Promise.all(branches.map(b =>
          fetch(`${API_URL}/inventory/items`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: buildBody(b.id)
          }).then(async r => ({ ok: r.ok, branch: b.name, message: (await r.json()).message }))
        ))
        const okCount = results.filter(x => x.ok).length
        const failed = results.filter(x => !x.ok)
        if (failed.length === 0) {
          showMsg(`✅ تمت إضافة "${itemForm.name}" إلى ${okCount} فرع`)
        } else {
          showMsg(`⚠️ أُضيفت المادة إلى ${okCount} فرع — فشلت في: ${failed.map(f => f.branch).join('، ')} (${failed[0].message || 'موجودة مسبقاً'})`)
        }
        setItemForm(emptyItemForm)
        setAddToAll(false)
        loadItems()
        return
      }

      const res = await fetch(isEdit ? `${API_URL}/inventory/items/${editingItem}` : `${API_URL}/inventory/items`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: buildBody(selectedBranch)
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
            {itemForm.unit && !['كغم', 'غرام', 'لتر', 'مليلتر', 'قطعة', 'متر'].includes(itemForm.unit) && (
              <option value={itemForm.unit}>{itemForm.unit} (حالية)</option>
            )}
            <option value="كغم">كغم</option>
            <option value="غرام">غرام</option>
            <option value="لتر">لتر</option>
            <option value="مليلتر">مليلتر</option>
            <option value="قطعة">قطعة</option>
            <option value="متر">متر</option>
          </select>
          <input type="number" placeholder="الحد الأدنى" min="0" step="0.01" value={itemForm.min_quantity}
            onChange={e => setItemForm({...itemForm, min_quantity: e.target.value})}
            className="input-ios" />
          <input type="number" placeholder="الكمية الحالية" min="0" step="0.01" value={itemForm.current_quantity}
            onChange={e => setItemForm({...itemForm, current_quantity: e.target.value})}
            className="input-ios" />
          <div className="flex flex-col gap-2">
            {!editingItem && (
              <label className="flex items-center gap-2 text-sm font-semibold text-ios-text cursor-pointer select-none">
                <input type="checkbox" checked={addToAll} onChange={e => setAddToAll(e.target.checked)}
                  className="w-4 h-4 accent-ios-blue" />
                🏪 كل الفروع ({branches.length})
              </label>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-ios flex-1">
                {editingItem ? 'حفظ' : 'إضافة'}
              </button>
              {editingItem && (
                <button type="button" onClick={() => { setEditingItem(null); setItemForm(emptyItemForm) }}
                  className="btn-ios-secondary">إلغاء</button>
              )}
            </div>
          </div>
        </form>
      </div>

      {isAdmin && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-ios-label">
            {selected.length > 0 ? `تم تحديد ${selected.length} مادة` : 'حدد المواد بعلامة ✔ ثم احذف'}
          </p>
          {selected.length > 0 && (
            <button onClick={deleteSelected}
              className="px-4 py-2 rounded-xl bg-ios-red/10 text-ios-red text-sm font-bold active:opacity-70 anim-pop">
              🗑️ حذف المحدد ({selected.length})
            </button>
          )}
        </div>
      )}

      <div className="card-ios overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F2F2F7]">
            <tr>
              {isAdmin && (
                <th className="p-3 w-10 text-center">
                  <input type="checkbox" checked={items.length > 0 && selected.length === items.length}
                    onChange={toggleSelectAll} className="w-4 h-4 accent-ios-blue cursor-pointer" />
                </th>
              )}
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
                {isAdmin && (
                  <td className="p-3 text-center">
                    <input type="checkbox" checked={selected.includes(item.id)}
                      onChange={() => toggleSelect(item.id)} className="w-4 h-4 accent-ios-blue cursor-pointer" />
                  </td>
                )}
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
              <tr><td colSpan={isAdmin ? 7 : 6} className="p-6 text-center text-ios-label">لا توجد مواد في هذا الفرع</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================= 🍽️ أصناف المبيعات ================= */
function MenuTab({ showMsg, headers, user }) {
  const [menuItems, setMenuItems] = useState([])
  const [menuForm, setMenuForm] = useState(emptyMenuForm)
  const [editingMenu, setEditingMenu] = useState(null)
  const [menuSearch, setMenuSearch] = useState('')
  const [selected, setSelected] = useState([])
  const isAdmin = user?.role === 'admin'

  const filteredMenu = menuSearch
    ? menuItems.filter(i => i.name.toLowerCase().includes(menuSearch.trim().toLowerCase()))
    : menuItems

  useEffect(() => { loadMenu() }, [])

  const loadMenu = () => {
    setSelected([])
    fetch(`${API_URL}/sales/menu`, { headers }).then(r => r.json()).then(d => setMenuItems(d || []))
  }

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    setSelected(prev => prev.length === filteredMenu.length ? [] : filteredMenu.map(i => i.id))
  }

  const deleteSelected = async () => {
    if (!window.confirm(`حذف ${selected.length} صنف نهائياً؟ (سجلات البيع السابقة تبقى محفوظة)`)) return
    try {
      const res = await fetch(`${API_URL}/sales/menu`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected })
      })
      const data = await res.json()
      if (res.ok) { showMsg(`✅ ${data.message || `تم حذف ${selected.length} صنف`}`); loadMenu() }
      else showMsg('❌ فشل الحذف: ' + (data.message || ''))
    } catch { showMsg('❌ خطأ في الاتصال') }
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

      {menuItems.length > 0 && (
        <div className="mb-3">
          <input type="text" placeholder="🔍 بحث باسم الصنف..." value={menuSearch}
            onChange={e => setMenuSearch(e.target.value)}
            className="input-ios max-w-sm" />
        </div>
      )}

      {isAdmin && menuItems.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-ios-label">
            {selected.length > 0 ? `تم تحديد ${selected.length} صنف` : 'حدد الأصناف بعلامة ✔ ثم احذف'}
          </p>
          {selected.length > 0 && (
            <button onClick={deleteSelected}
              className="px-4 py-2 rounded-xl bg-ios-red/10 text-ios-red text-sm font-bold active:opacity-70 anim-pop">
              🗑️ حذف المحدد ({selected.length})
            </button>
          )}
        </div>
      )}

      <div className="card-ios overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F2F2F7]">
            <tr>
              {isAdmin && (
                <th className="p-3 w-10 text-center">
                  <input type="checkbox" checked={filteredMenu.length > 0 && selected.length === filteredMenu.length}
                    onChange={toggleSelectAll} className="w-4 h-4 accent-ios-blue cursor-pointer" />
                </th>
              )}
              <th className="p-3 text-right font-semibold text-ios-label text-xs">اسم الصنف</th>
              <th className="p-3 text-right font-semibold text-ios-label text-xs">المجموعة</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">السعر (د.ع)</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">التكلفة</th>
              <th className="p-3 text-center font-semibold text-ios-label text-xs">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredMenu.map(item => (
              <tr key={item.id} className="border-t border-ios-sep last:border-b-0">
                {isAdmin && (
                  <td className="p-3 text-center">
                    <input type="checkbox" checked={selected.includes(item.id)}
                      onChange={() => toggleSelect(item.id)} className="w-4 h-4 accent-ios-blue cursor-pointer" />
                  </td>
                )}
                <td className="p-3 font-semibold text-ios-text">{item.name}</td>
                <td className="p-3 text-ios-label">{menuCategories.find(c => c.value === item.category)?.label || item.category}</td>
                <td className="p-3 text-center font-bold text-ios-blue">{item.price}</td>
                <td className="p-3 text-center text-ios-label">{item.cost || '—'}</td>
                <td className="p-3 text-center whitespace-nowrap">
                  <button onClick={() => startEdit(item)}
                    className="text-ios-blue font-bold text-xs px-2 active:opacity-70">✏️ تعديل</button>
                  <button onClick={() => handleDelete(item)}
                    className="text-ios-red font-bold text-xs px-2 active:opacity-70">🗑️ حذف</button>
                </td>
              </tr>
            ))}
            {filteredMenu.length === 0 && (
              <tr><td colSpan={isAdmin ? 6 : 5} className="p-6 text-center text-ios-label">
                {menuSearch ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد أصناف مبيعات'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {menuItems.length === 0 && !menuSearch && (
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
  const [addToAll, setAddToAll] = useState(false)
  const [view, setView] = useState('matrix')
  const [allRecipes, setAllRecipes] = useState([])

  const loadAllRecipes = () => {
    fetch(`${API_URL}/sales/recipes?branch_id=${selectedBranch}`, { headers })
      .then(r => r.json()).then(d => setAllRecipes(d || []))
  }

  useEffect(() => {
    if (!selectedBranch) return
    loadAllRecipes()
  }, [selectedBranch])

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

  const postRecipe = async (branchId, inventoryItemId, qty) => {
    const res = await fetch(`${API_URL}/sales/recipes`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: parseInt(branchId),
        menu_item_id: parseInt(selectedMenu),
        inventory_item_id: inventoryItemId,
        quantity: qty
      })
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, message: data.message }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const invItem = invItems.find(i => i.id === parseInt(newRecipe.inventory_item_id))

    // نفس المكون لكل الفروع: نبحث عن مادة بنفس الاسم بكل فرع ونحفظ الوصفة هناك
    if (addToAll && branches.length > 1) {
      const results = await Promise.all(branches.map(async b => {
        try {
          const r = await fetch(`${API_URL}/inventory/items/${b.id}`, { headers })
          const items = await r.json()
          const match = (items || []).find(i => i.name.trim().toLowerCase() === invItem?.name.trim().toLowerCase())
          if (!match) return { ok: false, branch: b.name, message: 'ما بيه مادة بهذا الاسم' }
          const qty = toItemUnit(parseFloat(newRecipe.quantity), newRecipe.unit, match.unit)
          const { ok, message } = await postRecipe(b.id, match.id, qty)
          return { ok, branch: b.name, message: ok ? '' : (message || 'فشل الحفظ') }
        } catch { return { ok: false, branch: b.name, message: 'خطأ في الاتصال' } }
      }))
      const okCount = results.filter(x => x.ok).length
      const failed = results.filter(x => !x.ok)
      if (failed.length === 0) {
        showMsg(`✅ تم حفظ المكون لكل الفروع (${okCount})`)
      } else {
        showMsg(`⚠️ حُفظ في ${okCount} فرع — تجاوز: ${failed.map(f => `${f.branch} (${f.message})`).join('، ')}`)
      }
      setNewRecipe({ inventory_item_id: '', quantity: '', unit: 'غرام' })
      setAddToAll(false)
      loadRecipes()
      loadAllRecipes()
      return
    }

    const finalQty = toItemUnit(parseFloat(newRecipe.quantity), newRecipe.unit, invItem?.unit)
    try {
      const { ok, message } = await postRecipe(selectedBranch, parseInt(newRecipe.inventory_item_id), finalQty)
      if (ok) {
        const converted = finalQty !== parseFloat(newRecipe.quantity)
        showMsg(`✅ تم حفظ المكون بنجاح!${converted ? ` (تم التحويل: ${newRecipe.quantity} ${newRecipe.unit} = ${finalQty} ${invItem?.unit})` : ''}`)
        setNewRecipe({ inventory_item_id: '', quantity: '', unit: 'غرام' })
        loadRecipes()
        loadAllRecipes()
      } else {
        showMsg('❌ فشل: ' + (message || ''))
      }
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const handleDelete = async (recipe) => {
    if (!window.confirm(`حذف مكون "${recipe.inventory_name}" من هذا الصنف؟`)) return
    try {
      const res = await fetch(`${API_URL}/sales/recipes/${recipe.id}`, { method: 'DELETE', headers })
      if (res.ok) { showMsg('✅ تم حذف المكون'); loadRecipes(); loadAllRecipes() }
      else showMsg('❌ فشل الحذف')
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  const byMenuId = {}
  allRecipes.forEach(r => {
    if (!byMenuId[r.menu_item_id]) byMenuId[r.menu_item_id] = []
    byMenuId[r.menu_item_id].push(r)
  })
  const matrixRows = menuItems.map(m => ({ menu: m.name, components: byMenuId[m.id] || [] }))
  const maxComponents = Math.max(0, ...matrixRows.map(r => r.components.length))

  return (
    <div>
      <div className="bg-ios-blue/10 rounded-2xl p-4 mb-6 text-sm text-ios-blue">
        💡 <b>كيف يعمل؟</b> اربط كل صنف بيع بمواد الجرد وكمياتها — مثلاً "صاج لحم" يستهلك 0.15 كغم شاورما لحم.
        عند حفظ المبيعات تنقص الكميات تلقائياً من مخزون الفرع.
      </div>

      <div className="card-ios p-4 mb-4 flex flex-wrap gap-4">
        <div>
          <label className="label-ios">الفرع</label>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
            className="input-ios">
            {branches.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
          </select>
        </div>
        {view === 'manage' && (
          <div>
            <label className="label-ios">صنف البيع</label>
            <select value={selectedMenu} onChange={e => setSelectedMenu(e.target.value)}
              className="input-ios">
              {menuItems.map(m => <option key={m.id} value={m.id.toString()}>{m.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="segmented mb-6">
        <button onClick={() => setView('matrix')}
          className={`segmented-item ${view === 'matrix' ? 'segmented-item-active' : ''}`}>
          📋 جدول الأصناف
        </button>
        <button onClick={() => setView('manage')}
          className={`segmented-item ${view === 'manage' ? 'segmented-item-active' : ''}`}>
          ⚙️ إدارة المكونات
        </button>
      </div>

      {view === 'matrix' ? (
        <div className="card-ios overflow-hidden">
          <div className="px-4 py-3 border-b border-ios-sep bg-[#F9F9FB]">
            <span className="font-bold text-ios-text text-sm">📋 مكونات كل صنف مبيعات</span>
            <span className="text-ios-label text-xs mr-2">({branches.find(b => b.id.toString() === selectedBranch)?.name || ''})</span>
          </div>
          {maxComponents === 0 ? (
            <p className="text-ios-label text-center py-10">لا توجد مكونات بعد — أضفها من تبويب "⚙️ إدارة المكونات"</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-[#F2F2F7]">
                  <tr>
                    <th className="p-3 text-right font-semibold text-ios-label text-xs min-w-[120px]">صنف المبيعات</th>
                    {Array.from({ length: maxComponents }, (_, i) => (
                      <th key={i} className="p-3 text-center font-semibold text-ios-label text-xs">مكون {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map(row => (
                    <tr key={row.menu} className="border-t border-ios-sep last:border-b-0 align-top">
                      <td className="p-3 font-bold text-ios-text">{row.menu}</td>
                      {Array.from({ length: maxComponents }, (_, i) => {
                        const c = row.components[i]
                        return (
                          <td key={i} className="p-3 text-center">
                            {c ? (
                              <>
                                <div className="font-semibold text-ios-text">{c.inventory_name}</div>
                                <div className="text-ios-blue font-bold text-xs">{c.quantity} {c.unit || ''}</div>
                              </>
                            ) : (
                              <span className="text-ios-sep">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <>

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
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-ios-text cursor-pointer select-none">
              <input type="checkbox" checked={addToAll} onChange={e => setAddToAll(e.target.checked)}
                className="w-4 h-4 accent-ios-blue" />
              🏪 كل الفروع ({branches.length})
            </label>
            <button type="submit" className="btn-ios">
              إضافة المكون
            </button>
          </div>
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
      </>
      )}
    </div>
  )
}

/* ================= ⚙️ الإعدادات ================= */
function SettingsTab({ showMsg, headers }) {
  const [companyName, setCompanyName] = useState('')
  const [logo, setLogo] = useState('') // data URL
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/settings`, { headers })
      .then(r => r.json())
      .then(d => {
        setCompanyName(d.company_name || '')
        setLogo(d.company_logo || '')
      })
      .catch(() => {})
  }, [])

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      showMsg('❌ صيغة غير مدعومة — استخدم PNG أو JPG')
      return
    }
    if (file.size > 1000000) {
      showMsg('❌ حجم الصورة كبير — الحد الأقصى 1MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogo(reader.result)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!companyName.trim()) {
      showMsg('❌ اسم الشركة مطلوب')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName.trim(), company_logo: logo })
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('app_settings', JSON.stringify(data))
        showMsg('✅ تم حفظ الإعدادات بنجاح!')
      } else {
        showMsg('❌ فشل الحفظ: ' + (data.message || ''))
      }
    } catch {
      showMsg('❌ خطأ في الاتصال')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="card-ios p-5 space-y-4 max-w-lg">
        <h3 className="font-bold text-ios-text">🏷️ اسم الشركة</h3>
        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
          className="input-ios" placeholder="اسم الشركة" />

        <h3 className="font-bold text-ios-text pt-2">🖼️ شعار الشركة</h3>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-ios-fill flex items-center justify-center overflow-hidden">
            {logo
              ? <img src={logo} alt="logo" className="w-full h-full object-contain" />
              : <span className="text-3xl">📦</span>}
          </div>
          <div className="flex-1">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoFile}
              className="block w-full text-xs text-ios-label bg-ios-fill rounded-xl p-2" />
            <p className="text-xs text-ios-label mt-1">PNG أو JPG — حد أقصى 1MB</p>
            {logo && (
              <button onClick={() => setLogo('')} className="text-ios-red text-xs font-bold mt-1 active:opacity-70">
                🗑️ إزالة الشعار
              </button>
            )}
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className="btn-ios w-full py-3 disabled:opacity-60">
          {saving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
        </button>
      </div>
      <p className="text-ios-label text-sm mt-3 max-w-lg">
        💡 الاسم والشعار يظهرون بصفحة الدخول والقائمة العلوية وكل تقرير مطبوع.
      </p>
    </div>
  )
}

/* ================= 🎭 الأدوار والصلاحيات ================= */
function RolesTab({ showMsg, headers }) {
  const [roles, setRoles] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingRole, setEditingRole] = useState(null) // null = وضع إضافة
  const [name, setName] = useState('')
  const [perms, setPerms] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadRoles()
    fetch(`${API_URL}/roles/permissions`, { headers }).then(r => r.json()).then(d => setCatalog(d || []))
  }, [])

  const loadRoles = () => {
    setLoading(true)
    fetch(`${API_URL}/roles`, { headers })
      .then(r => r.json())
      .then(d => { setRoles(d || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  const togglePerm = (key) => {
    setPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }

  const startEdit = (role) => {
    setEditingRole(role)
    setName(role.name)
    setPerms(role.permissions || [])
  }

  const startAdd = () => {
    setEditingRole(null)
    setName('')
    setPerms([])
  }

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) { showMsg('❌ أدخل اسم الدور'); return }
    if (perms.length === 0) { showMsg('❌ اختر صلاحية واحدة على الأقل'); return }
    setSaving(true)
    try {
      const url = editingRole ? `${API_URL}/roles/${editingRole.id}` : `${API_URL}/roles`
      const res = await fetch(url, {
        method: editingRole ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), permissions: perms })
      })
      const data = await res.json()
      if (res.ok) {
        showMsg(editingRole ? '✅ تم تعديل الدور بنجاح' : `✅ تم إنشاء دور "${name.trim()}"`)
        startAdd()
        loadRoles()
      } else {
        showMsg('❌ فشل: ' + (data.message || ''))
      }
    } catch { showMsg('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const deleteRole = async (role) => {
    const msg = role.users_count > 0
      ? `الدور "${role.name}" مربوط بـ ${role.users_count} مستخدم. حذفه سيرجعهم لأدوارهم المدمجة. متابعة؟`
      : `حذف الدور "${role.name}"؟`
    if (!window.confirm(msg)) return
    try {
      const res = await fetch(`${API_URL}/roles/${role.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) {
        showMsg(`✅ تم حذف الدور "${role.name}"`)
        if (editingRole?.id === role.id) startAdd()
        loadRoles()
      } else showMsg('❌ ' + (data.message || 'فشل الحذف'))
    } catch { showMsg('❌ خطأ في الاتصال') }
  }

  return (
    <div>
      <div className="card-ios p-6 mb-6">
        <h3 className="text-lg font-bold mb-1 text-ios-text">
          {editingRole ? `✏️ تعديل الدور: ${editingRole.name}` : '➕ إنشاء دور جديد'}
        </h3>
        <p className="text-xs text-ios-label mb-4">
          أنشئ دوراً بأي اسم وحدد صلاحياته بالتفصيل، ثم اربطه بمستخدم من تبويب "المستخدمون".
          الدور المخصص يتجاوز صلاحيات الدور المدمج (مدير فرع / موظف / محاسب).
        </p>
        <form onSubmit={save}>
          <input type="text" placeholder="اسم الدور — مثال: مشرف جرد، موظف استلام..." value={name}
            onChange={e => setName(e.target.value)}
            className="input-ios mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
            {catalog.map(p => (
              <label key={p.key}
                className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer border-2 transition-colors ${
                  perms.includes(p.key) ? 'border-ios-blue bg-ios-blue/5' : 'border-ios-sep bg-ios-fill/50'
                }`}>
                <input type="checkbox" checked={perms.includes(p.key)} onChange={() => togglePerm(p.key)}
                  className="w-4 h-4 accent-ios-blue" />
                <span className="text-sm font-semibold text-ios-text">{p.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-ios flex-1 disabled:opacity-60">
              {saving ? 'جاري الحفظ...' : editingRole ? '💾 حفظ التعديلات' : '➕ إنشاء الدور'}
            </button>
            {editingRole && (
              <button type="button" onClick={startAdd} className="btn-ios-secondary">إلغاء</button>
            )}
          </div>
        </form>
      </div>

      {loading ? (
        <div className="text-center p-10 text-ios-label">جاري التحميل...</div>
      ) : roles.length === 0 ? (
        <div className="card-ios p-8 text-center text-ios-label">لا توجد أدوار مخصصة بعد — أنشئ أول دور من الأعلى</div>
      ) : (
        <div className="card-ios overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[640px]">
              <thead className="bg-[#F2F2F7]">
                <tr>
                  <th className="p-4 font-bold text-ios-label text-xs whitespace-nowrap">الدور</th>
                  <th className="p-4 font-bold text-ios-label text-xs whitespace-nowrap">المستخدمون</th>
                  <th className="p-4 font-bold text-ios-label text-xs">الصلاحيات</th>
                  <th className="p-4 font-bold text-ios-label text-xs whitespace-nowrap">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr key={role.id} className="border-t border-ios-sep align-top">
                    <td className="p-4 whitespace-nowrap">
                      <span className="badge-ios bg-ios-purple/15 text-ios-purple">🎭 {role.name}</span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-semibold text-ios-text">
                      {role.users_count > 0 ? `${role.users_count} 👤` : '—'}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(role.permissions || []).map(p => {
                          const c = catalog.find(x => x.key === p)
                          return (
                            <span key={p} className="badge-ios bg-ios-blue/10 text-ios-blue">
                              {c ? c.label : p}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 whitespace-nowrap">
                        <button onClick={() => startEdit(role)}
                          className="px-3 py-1.5 rounded-xl bg-ios-blue/10 text-ios-blue text-xs font-bold active:opacity-70">
                          ✏️ تعديل
                        </button>
                        <button onClick={() => deleteRole(role)}
                          className="px-3 py-1.5 rounded-xl bg-ios-red/10 text-ios-red text-xs font-bold active:opacity-70">
                          🗑️ حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-ios-label text-sm mt-3">
        💡 تغيير صلاحيات دور ينطبق على مستخدميه من جلسة الدخول التالية (عند تسجيل الدخول مجدداً).
      </p>
    </div>
  )
}
