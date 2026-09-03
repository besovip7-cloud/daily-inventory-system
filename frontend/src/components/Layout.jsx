import { Outlet, Link, useLocation } from 'react-router-dom'

export default function Layout({ user }) {
  const logout = () => {
    localStorage.removeItem('token')
    window.location.reload()
  }

  const location = useLocation()

  const navItems = [
    { path: '/', label: '📊 لوحة التحكم' },
    { path: '/inventory', label: '📦 جرد المخزون' },
    { path: '/branches', label: '🏪 إدارة الفروع' },
    { path: '/sales', label: '💰 المبيعات' },
    { path: '/alerts', label: '🔔 التنبيهات' },
    { path: '/admin', label: '👑 الإدارة' },
  ]

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

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white shadow-sm border-l border-gray-100">
          <div className="p-4">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`block p-3 rounded-lg mb-1 transition ${
                  location.pathname === item.path
                    ? 'bg-blue-50 text-blue-700 font-bold border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}