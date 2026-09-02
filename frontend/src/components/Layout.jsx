import { Outlet, Link, useNavigate } from 'react-router-dom'

export default function Layout({ user }) {
  const navigate = useNavigate()

  const logout = () => {
    localStorage.removeItem('token')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <nav className="bg-gray-900 text-white p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">📦 نظام الجرد اليومي</h1>
          <div className="flex gap-4 items-center">
            <span className="text-sm text-gray-300">{user?.name}</span>
            <button onClick={logout} className="text-sm bg-red-600 px-3 py-1 rounded">خروج</button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
