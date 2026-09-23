import { getToken, clearToken } from './utils/token'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Inventory from './components/Inventory'
import Branches from './components/Branches'
import Sales from './components/Sales'
import Alerts from './components/Alerts'
import AdminPanel from './components/AdminPanel'
import Reports from './components/Reports'
import Management from './components/Management'
import Profile from './components/Profile'
import Purchases from './components/Purchases'
import Receiving from './components/Receiving'
import Waste from './components/Waste'
import ItemEdits from './components/ItemEdits'
import Groups from './components/Groups'
import Units from './components/Units'
import Suppliers from './components/Suppliers'
import Recipes from './components/Recipes'
import { hasPerm, isAdmin } from './utils/permissions'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setAuthLoading(false)
      return
    }
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if(data.user) setUser(data.user) })
      .catch(() => clearToken())
      .finally(() => setAuthLoading(false))
  }, [])

  // شاشة انتظار أثناء التحقق من الجلسة حتى لا ينرمى لتسجيل الدخول عند تحديث الصفحة
  if (authLoading) {
    return (
      <div className="min-h-screen bg-ios-bg flex flex-col items-center justify-center gap-4" dir="rtl">
        <div className="text-4xl">📦</div>
        <div className="text-ios-label font-semibold">نظام الجرد اليومي</div>
        <div className="w-8 h-8 border-[3px] border-ios-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} apiUrl={API_URL} />} />
        <Route path="/" element={user ? <Layout user={user} /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard apiUrl={API_URL} user={user} />} />
          <Route path="inventory" element={<Inventory user={user} />} />
          <Route path="branches" element={<Branches user={user} />} />
          <Route path="sales" element={<Sales user={user} />} />
          <Route path="alerts" element={<Alerts user={user} />} />    
          <Route path="admin" element={isAdmin(user) ? <AdminPanel /> : <Navigate to="/" />} />
          <Route path="manage" element={
            ['users.manage', 'catalog.manage', 'settings.manage'].some(p => hasPerm(user, p))
              ? <Management user={user} /> : <Navigate to="/" />
          } />
          <Route path="reports" element={hasPerm(user, 'reports.view') ? <Reports user={user} /> : <Navigate to="/" />} />
          <Route path="profile" element={<Profile user={user} setUser={setUser} />} />
          <Route path="purchases" element={hasPerm(user, 'purchases.view') ? <Purchases user={user} /> : <Navigate to="/" />} />
          <Route path="receiving" element={hasPerm(user, 'receiving.view') ? <Receiving user={user} /> : <Navigate to="/" />} />
          <Route path="waste" element={hasPerm(user, 'waste.view') ? <Waste user={user} /> : <Navigate to="/" />} />
          <Route path="item-edits" element={hasPerm(user, 'items.edit') ? <ItemEdits user={user} /> : <Navigate to="/" />} />
          <Route path="catalog/groups" element={hasPerm(user, 'catalog.manage') ? <Groups /> : <Navigate to="/" />} />
          <Route path="catalog/units" element={hasPerm(user, 'catalog.manage') ? <Units /> : <Navigate to="/" />} />
          <Route path="catalog/recipes" element={hasPerm(user, 'catalog.manage') ? <Recipes /> : <Navigate to="/" />} />
          <Route path="catalog/suppliers" element={hasPerm(user, 'catalog.manage') ? <Suppliers /> : <Navigate to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App