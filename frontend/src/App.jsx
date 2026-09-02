import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

const API_URL = 'https://inventory-api-6lta.onrender.com/api'

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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} apiUrl={API_URL} />} />
        <Route path="/" element={user ? <Layout user={user} /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard apiUrl={API_URL} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
