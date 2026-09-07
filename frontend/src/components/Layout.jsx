import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import AlertBell from './AlertBell'
import { fetchSettings, getCachedSettings } from '../utils/settings'
import { hasPerm, isAdmin } from '../utils/permissions'

export default function Layout({ user }) {
  const [settings, setSettings] = useState(getCachedSettings())

  useEffect(() => {
    fetchSettings().then(setSettings)
  }, [])
  const logout = () => {
    localStorage.removeItem('token')
    window.location.reload()
  }

  const location = useLocation()
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'))

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const allNavItems = [
    { path: '/', label: '📊 لوحة التحكم', perm: 'dashboard.view', group: 'الرئيسية' },
    { path: '/inventory', label: '📦 جرد المخزون', perm: 'inventory.view', group: 'العمليات اليومية' },
    { path: '/sales', label: '💰 المبيعات', perm: 'sales.view', group: 'العمليات اليومية' },
    { path: '/purchases', label: '🛒 طلبات الشراء', perm: 'purchases.view', group: 'العمليات اليومية' },
    { path: '/alerts', label: '🔔 التنبيهات', perm: 'alerts.view', group: 'المتابعة' },
    { path: '/reports', label: '📈 التقارير', perm: 'reports.view', group: 'المتابعة' },
    { path: '/branches', label: '🏪 إدارة الفروع', perm: 'branches.view', group: 'الإدارة' },
    { path: '/admin', label: '👑 الإدارة', adminOnly: true, group: 'الإدارة' },
    { path: '/manage', label: '🛠️ الإدارة العامة', adminOnly: true, group: 'الإدارة' },
  ]

  const navItems = allNavItems.filter(item =>
    item.adminOnly ? isAdmin(user) : hasPerm(user, item.perm)
  )
  const groups = [...new Set(navItems.map(i => i.group))]
  const showBell = isAdmin(user) || user?.role === 'manager'
  const roleLabels = { admin: 'مدير النظام', manager: 'مدير فرع', accountant: 'محاسب', staff: 'موظف' }
  const roleLabel = user?.custom_role_name || roleLabels[user?.role] || ''

  return (
    <div className="min-h-screen bg-ios-bg" dir="rtl">
      <nav className="bg-white/80 backdrop-blur border-b border-ios-sep sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-3">
          <h1 className="text-lg font-semibold text-ios-text flex items-center gap-2">
            {settings.company_logo
              ? <img src={settings.company_logo} alt="logo" className="w-8 h-8 rounded-lg object-contain" />
              : <span>📦</span>}
            <span className="hidden sm:inline">{settings.company_name}</span>
          </h1>
          <div className="flex gap-3 items-center">
            <button onClick={toggleDark} title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
              className="w-9 h-9 rounded-full bg-ios-fill flex items-center justify-center text-lg active:scale-90 transition">
              {dark ? '☀️' : '🌙'}
            </button>
            {showBell && <AlertBell />}
            <Link to="/profile" className="flex items-center gap-2 active:opacity-60">
              <span className="w-8 h-8 rounded-full bg-ios-blue text-white text-sm font-extrabold flex items-center justify-center overflow-hidden">
                {user?.avatar
                  ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  : (user?.name || '?').trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:flex flex-col leading-tight">
                <span className="text-xs font-bold text-ios-text">{user?.name}</span>
                {roleLabel && <span className="text-[10px] text-ios-label">{roleLabel}</span>}
              </span>
            </Link>
            <button onClick={logout} className="btn-ios-danger text-xs px-3 py-1.5">خروج</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* Sidebar — desktop only, iOS grouped list */}
        <aside className="hidden md:block w-full md:w-72 shrink-0 p-4">
          {groups.map(g => (
            <div key={g} className="mb-2">
              <p className="nav-group-title">{g}</p>
              <div className="card-ios overflow-hidden">
                {navItems.filter(i => i.group === g).map(item => {
                  const active = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`nav-item border-b border-ios-sep last:border-b-0 ${active ? 'nav-item-active' : 'hover:bg-ios-bg'}`}
                    >
                      <span className="flex items-center gap-1.5">{item.label}</span>
                      <span className={active ? 'text-ios-blue' : 'text-ios-label'}>‹</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          <div key={location.pathname} className="anim-page">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom tab bar — mobile only, scrollable */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur border-t border-ios-sep pb-[env(safe-area-inset-bottom)]">
        <div className="flex overflow-x-auto no-scrollbar">
          {navItems.map(item => {
            const active = location.pathname === item.path
            const [icon, ...rest] = item.label.split(' ')
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-none w-[72px] py-2 text-center text-[10px] font-semibold transition active:opacity-60 ${
                  active ? 'text-ios-blue' : 'text-ios-label'
                }`}
              >
                <div className={`w-9 h-9 mx-auto mb-0.5 rounded-full flex items-center justify-center text-lg transition ${active ? 'bg-ios-blue/15' : ''}`}>
                  {icon}
                </div>
                <div className="truncate px-0.5">{rest.join(' ')}</div>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
