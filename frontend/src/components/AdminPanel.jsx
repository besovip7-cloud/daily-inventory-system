import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const roleLabels = { admin: 'مدير النظام', manager: 'مدير فرع', staff: 'موظف', accountant: 'محاسب' }

export default function AdminPanel() {
  const [branches, setBranches] = useState([])
  const [submittedBranches, setSubmittedBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [inventoryData, setInventoryData] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [sales, setSales] = useState({})
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [loadingMenu, setLoadingMenu] = useState(false)

  // نموذج إضافة صنف جديد
  const [newItem, setNewItem] = useState({ name: '', category: 'main', price: '', cost: '' })

  // إدارة المستخدمين
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'manager', branch_id: '' })
  const [resetPwFor, setResetPwFor] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const token = localStorage.getItem('token')
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadBranches()
    loadMenuItems()
  }, [])

  useEffect(() => {
    if (activeTab === 'users') loadUsers()
  }, [activeTab])

  const loadBranches = () => {
    fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setBranches(data)
        checkSubmitted(data)
      })
  }

  const loadMenuItems = () => {
    setLoadingMenu(true)
    fetch(`${API_URL}/sales/menu`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        setMenuItems(data || [])
        setLoadingMenu(false)
      })
      .catch(() => setLoadingMenu(false))
  }

  const loadUsers = () => {
    setLoadingUsers(true)
    fetch(`${API_URL}/auth/users`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(data => {
        setUsers(data || [])
        setLoadingUsers(false)
      })
      .catch(() => {
        setLoadingUsers(false)
        setMessage('❌ فشل تحميل المستخدمين')
      })
  }

  const addUser = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          branch_id: newUser.role === 'admin' ? null : (newUser.branch_id || null)
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('✅ تم إضافة المستخدم بنجاح!')
        setNewUser({ name: '', email: '', password: '', role: 'manager', branch_id: '' })
        loadUsers()
      } else {
        setMessage('❌ فشل إضافة المستخدم: ' + (data.message || ''))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const toggleUserActive = async (user) => {
    try {
      const res = await fetch(`${API_URL}/auth/users/${user.id}/active`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !user.is_active })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ تم ${user.is_active ? 'تعطيل' : 'تفعيل'} المستخدم`)
        loadUsers()
      } else {
        setMessage('❌ ' + (data.message || 'فشل التحديث'))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const resetPassword = async (user) => {
    if (!newPassword || newPassword.length < 6) {
      setMessage('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    try {
      const res = await fetch(`${API_URL}/auth/users/${user.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ تم تغيير كلمة مرور ${user.name}`)
        setResetPwFor(null)
        setNewPassword('')
      } else {
        setMessage('❌ ' + (data.message || 'فشل تغيير كلمة المرور'))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const deleteUser = async (user) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${user.name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return
    try {
      const res = await fetch(`${API_URL}/auth/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ تم حذف ${user.name}`)
        loadUsers()
      } else {
        setMessage('❌ ' + (data.message || 'فشل الحذف'))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const checkSubmitted = async (branchList) => {
    const submitted = []
    for (const branch of branchList) {
      try {
        const res = await fetch(`${API_URL}/inventory/daily/${branch.id}?date=${today}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (data && data.length > 0) {
          submitted.push(branch)
        }
      } catch (e) {}
    }
    setSubmittedBranches(submitted)
  }

  const viewInventory = async (branch) => {
    setSelectedBranch(branch)
    setInventoryData([])
    setSales({})
    setMessage('')
    
    try {
      const invRes = await fetch(`${API_URL}/inventory/daily/${branch.id}?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const invData = await invRes.json()
      setInventoryData(invData || [])
      
      // تهيئة المبيعات من الأصناف الموجودة
      const init = {}
      menuItems.forEach(item => {
        init[item.id] = { item_id: item.id, quantity_sold: 0, unit_price: item.price }
      })
      setSales(init)
      
    } catch (err) {
      console.error(err)
      setMessage('❌ خطأ في جلب البيانات')
    }
  }

  const handleSalesChange = (itemId, qty) => {
    setSales(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity_sold: parseInt(qty) || 0 }
    }))
  }

  const submitSales = async () => {
    try {
      const records = Object.values(sales)
        .filter(s => s.quantity_sold > 0)
        .map(s => ({
          item_id: s.item_id,
          quantity_sold: s.quantity_sold,
          unit_price: s.unit_price
        }))

      if (records.length === 0) {
        setMessage('❌ أدخل كمية مبيعات أولاً')
        return
      }

      const payload = {
        branch_id: selectedBranch.id,
        records,
        payment_card: 0,
        payment_cash: 0
      }

      const res = await fetch(`${API_URL}/sales/daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setMessage('✅ تم إدخال المبيعات بنجاح!')
      } else {
        const data = await res.json()
        setMessage('❌ فشل إدخال المبيعات: ' + (data.message || ''))
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  const addMenuItem = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/sales/menu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newItem.name,
          category: newItem.category,
          price: parseFloat(newItem.price),
          cost: parseFloat(newItem.cost) || 0
        })
      })
      if (res.ok) {
        setMessage('✅ تم إضافة الصنف بنجاح!')
        setNewItem({ name: '', category: 'main', price: '', cost: '' })
        loadMenuItems()
      } else {
        setMessage('❌ فشل إضافة الصنف')
      }
    } catch (err) {
      setMessage('❌ خطأ في الاتصال')
    }
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">👑 لوحة الإدارة</h2>

      {message && (
        <div className={`p-4 rounded-lg mb-4 font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-bold ${activeTab === 'pending' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          📥 جرد بانتظار المراجعة ({submittedBranches.length})
        </button>
        <button onClick={() => setActiveTab('items')}
          className={`px-4 py-2 font-bold ${activeTab === 'items' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          📦 الأصناف ({menuItems.length})
        </button>
        <button onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-bold ${activeTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          👥 المستخدمون ({users.length})
        </button>
        <button onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 font-bold ${activeTab === 'reports' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          📊 التقارير
        </button>
      </div>

      {activeTab === 'pending' && (
        <div>
          {selectedBranch ? (
            <div>
              <button onClick={() => { setSelectedBranch(null); setMessage('') }} className="mb-4 text-blue-600 font-bold">← رجوع للقائمة</button>
              <h3 className="text-xl font-bold mb-4">{selectedBranch.name} - جرد اليوم</h3>
              
              {inventoryData.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg mb-6">
                  <h4 className="font-bold mb-2">📋 بيانات الجرد المرسلة</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {inventoryData.map(rec => (
                      <div key={rec.id} className="bg-white p-2 rounded">
                        <div className="font-semibold">{rec.item_name}</div>
                        <div className="text-gray-600">نهاية: {rec.closing_qty}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h4 className="font-bold text-lg mb-4">💰 إدخال مبيعات اليوم</h4>
              
              {menuItems.length === 0 ? (
                <div className="text-center p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-yellow-800 font-bold mb-2">⚠️ لا توجد أصناف مبيعات</p>
                  <p className="text-yellow-700 text-sm mb-4">أضف أصناف من تبويب "📦 الأصناف" أولاً</p>
                  <button onClick={() => setActiveTab('items')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">
                    الذهاب لإضافة أصناف
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {menuItems.map(item => {
                      const sale = sales[item.id] || { quantity_sold: 0 }
                      const total = sale.quantity_sold * item.price
                      return (
                        <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="font-bold">{item.name}</h5>
                            <span className="text-blue-600 font-bold">{item.price} ﷼</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleSalesChange(item.id, (sale.quantity_sold || 0) - 1)}
                              className="w-8 h-8 bg-gray-100 rounded-lg font-bold">−</button>
                            <input type="number" min="0"
                              value={sale.quantity_sold || 0}
                              onChange={e => handleSalesChange(item.id, e.target.value)}
                              className="flex-1 p-2 border-2 border-gray-200 rounded-lg text-center font-bold" />
                            <button onClick={() => handleSalesChange(item.id, (sale.quantity_sold || 0) + 1)}
                              className="w-8 h-8 bg-gray-100 rounded-lg font-bold">+</button>
                          </div>
                          {total > 0 && (
                            <div className="mt-2 text-green-600 font-bold text-center">
                              الإجمالي: {total} ﷼
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <button onClick={submitSales}
                    className="w-full bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition">
                    💾 حفظ المبيعات
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {branches.map(branch => {
                const hasInventory = submittedBranches.find(s => s.id === branch.id)
                return (
                  <div key={branch.id} className={`p-6 rounded-xl shadow-sm border ${hasInventory ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-bold text-lg mb-2">{branch.name}</h3>
                    <p className="text-gray-500 text-sm mb-4">{branch.location}</p>
                    {hasInventory ? (
                      <div className="text-green-600 font-bold mb-3">✅ تم استلام الجرد</div>
                    ) : (
                      <div className="text-red-600 font-bold mb-3">⏳ لم يتم الجرد</div>
                    )}
                    <button onClick={() => viewInventory(branch)}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition">
                      عرض / إدخال مبيعات
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'items' && (
        <div>
          {/* نموذج إضافة صنف */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <h3 className="text-lg font-bold mb-4">➕ إضافة صنف مبيعات جديد</h3>
            <form onSubmit={addMenuItem} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input type="text" placeholder="اسم الصنف" required
                value={newItem.name}
                onChange={e => setNewItem({...newItem, name: e.target.value})}
                className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              <select
                value={newItem.category}
                onChange={e => setNewItem({...newItem, category: e.target.value})}
                className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none">
                <option value="main">وجبة رئيسية</option>
                <option value="appetizer">مقبلات</option>
                <option value="drink">مشروب</option>
                <option value="side">جانبي</option>
              </select>
              <input type="number" placeholder="السعر" required
                value={newItem.price}
                onChange={e => setNewItem({...newItem, price: e.target.value})}
                className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              <button type="submit"
                className="bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition">
                إضافة
              </button>
            </form>
          </div>

          {/* قائمة الأصناف */}
          {loadingMenu ? (
            <div className="text-center p-10">جاري التحميل...</div>
          ) : menuItems.length === 0 ? (
            <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500">لا توجد أصناف مبيعات</p>
              <p className="text-gray-400 text-sm">أضف صنفاً أولاً</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {menuItems.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h4 className="font-bold">{item.name}</h4>
                  <p className="text-gray-500 text-sm">{item.category}</p>
                  <p className="text-blue-600 font-bold mt-2">{item.price} ﷼</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          {/* نموذج إضافة مستخدم */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <h3 className="text-lg font-bold mb-4">➕ إضافة مستخدم جديد</h3>
            <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input type="text" placeholder="الاسم" required
                value={newUser.name}
                onChange={e => setNewUser({...newUser, name: e.target.value})}
                className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              <input type="email" placeholder="البريد الإلكتروني" required
                value={newUser.email}
                onChange={e => setNewUser({...newUser, email: e.target.value})}
                className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              <input type="password" placeholder="كلمة المرور (6+ أحرف)" required minLength={6}
                value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})}
                className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              <select
                value={newUser.role}
                onChange={e => setNewUser({...newUser, role: e.target.value, branch_id: e.target.value === 'admin' ? '' : newUser.branch_id})}
                className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none">
                <option value="manager">مدير فرع</option>
                <option value="staff">موظف</option>
                <option value="accountant">محاسب</option>
                <option value="admin">مدير النظام</option>
              </select>
              {newUser.role !== 'admin' ? (
                <select required
                  value={newUser.branch_id}
                  onChange={e => setNewUser({...newUser, branch_id: e.target.value})}
                  className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none">
                  <option value="">اختر الفرع...</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              ) : (
                <button type="submit"
                  className="bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition">
                  إضافة
                </button>
              )}
              {newUser.role !== 'admin' && (
                <button type="submit"
                  className="bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition md:col-span-5">
                  إضافة المستخدم
                </button>
              )}
            </form>
          </div>

          {/* قائمة المستخدمين */}
          {loadingUsers ? (
            <div className="text-center p-10">جاري التحميل...</div>
          ) : users.length === 0 ? (
            <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500">لا يوجد مستخدمون</p>
            </div>
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
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {roleLabels[user.role] || user.role}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600">{user.branch_name || '—'}</td>
                      <td className="p-4">
                        {user.is_active ? (
                          <span className="text-green-600 font-bold">✅ نشط</span>
                        ) : (
                          <span className="text-red-600 font-bold">⛔ معطل</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2 items-center">
                          <button onClick={() => toggleUserActive(user)}
                            className={`px-3 py-1 rounded-lg font-bold text-sm ${
                              user.is_active
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
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
                              className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold text-sm">
                              حفظ
                            </button>
                            <button onClick={() => setResetPwFor(null)}
                              className="bg-gray-200 text-gray-600 px-3 py-1 rounded-lg font-bold text-sm">
                              إلغاء
                            </button>
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
      )}

      {activeTab === 'reports' && (
        <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-500">التقارير قريباً...</p>
        </div>
      )}
    </div>
  )
}
