import { Outlet, Link, useLocation } from 'react-router-dom'
import AlertBell from './AlertBell'

export default function Layout({ user }) {
  const logout = () => {
    localStorage.removeItem('token')
    window.location.reload()
  }

  const location = useLocation()

  const allNavItems = [
    { path: '/', label: '📊 لوحة التحكم', roles: ['admin', 'manager', 'staff'] },
    { path: '/inventory', label: '📦 جرد المخزون', roles: ['admin', 'manager', 'staff'] },
    { path: '/branches', label: '🏪 إدارة الفروع', roles: ['admin', 'manager', 'staff'] },
    { path: '/sales', label: '💰 المبيعات', roles: ['admin', 'manager', 'staff', 'accountant'] },
    { path: '/alerts', label: '🔔 التنبيهات', roles: ['admin', 'manager', 'staff'] },
    { path: '/reports', label: '📈 التقارير', roles: ['admin', 'accountant'] },
    { path: '/admin', label: '👑 الإدارة', roles: ['admin'] },
    { path: '/manage', label: '🛠️ الإدارة العامة', roles: ['admin'] },
  ]

  const navItems = allNavItems.filter(item => item.roles.includes(user?.role))
  const showBell = user?.role === 'admin' || user?.role === 'manager'

  return (
    <div className="min-h-screen bg-ios-bg" dir="rtl">
      <nav className="bg-white/80 backdrop-blur border-b border-ios-sep sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-3">
          <h1 className="text-lg font-semibold text-ios-text">📦 نظام الجرد اليومي</h1>
          <div className="flex gap-3 items-center">
            {showBell && <AlertBell />}
            <span className="text-xs text-ios-label">{user?.name}</span>
            <button onClick={logout} className="btn-ios-danger text-xs px-3 py-1.5">خروج</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* Sidebar — desktop only, iOS grouped list */}
        <aside className="hidden md:block w-full md:w-72 shrink-0 p-4">
          <div className="card-ios overflow-hidden">
            {navItems.map(item => {
              const active = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`list-row transition active:opacity-60 ${
                    active
                      ? 'bg-ios-blue/10 text-ios-blue font-bold'
                      : 'text-ios-text hover:bg-ios-bg'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={active ? 'text-ios-blue' : 'text-ios-label'}>‹</span>
                </Link>
              )
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          <div key={location.pathname} className="anim-page">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur border-t border-ios-sep flex pb-[env(safe-area-inset-bottom)]">
        {navItems.map(item => {
          const active = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 py-2 text-center text-[11px] font-semibold transition active:opacity-60 ${
                active ? 'text-ios-blue' : 'text-ios-label'
              }`}
            >
              <div className="text-xl leading-none mb-1">{item.label.split(' ')[0]}</div>
              <div className="truncate px-0.5">{item.label.split(' ').slice(1).join(' ')}</div>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
