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
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` }})
        .then(r => r.json())
        .then(data => { if(data.user) setUser(data.user) })
        .catch(() => localStorage.removeItem('token'))
    }
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} apiUrl={API_URL} />} />
        <Route path="/" element={user ? <Layout user={user} /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard apiUrl={API_URL} />} />
          <Route path="inventory" element={<Inventory user={user} />} />
          <Route path="branches" element={<Branches user={user} />} />
          <Route path="sales" element={<Sales />} />
          <Route path="alerts" element={<Alerts />} />    
          <Route path="admin" element={<AdminPanel />} />
          <Route path="reports" element={['admin', 'accountant'].includes(user?.role) ? <Reports user={user} /> : <Navigate to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App