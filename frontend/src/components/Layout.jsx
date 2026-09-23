import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import AlertBell from './AlertBell'
import { fetchSettings, getCachedSettings } from '../utils/settings'
import { hasPerm, isAdmin } from '../utils/permissions'
import { clearToken } from '../utils/token'

export default function Layout({ user }) {
  const [settings, setSettings] = useState(getCachedSettings())

  useEffect(() => {
    fetchSettings().then(setSettings)
  }, [])
  const logout = () => {
    clearToken()
    window.location.reload()
  }

  const location = useLocation()
  // الثيمات بالدور: فاتح ← داكن ← ذهبي
  const THEMES = ['light', 'dark', 'gold']
  const THEME_META = {
    light: { icon: '🌞', label: 'الوضع الفاتح' },
    dark: { icon: '🌙', label: 'الوضع الداكن' },
    gold: { icon: '🌟', label: 'الداكن الذهبي' },
  }
  const currentTheme = document.documentElement.classList.contains('theme-gold') ? 'gold'
    : document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  const [theme, setTheme] = useState(currentTheme)

  const cycleTheme = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
    setTheme(next)
    const el = document.documentElement
    el.classList.toggle('dark', next !== 'light')
    el.classList.toggle('theme-gold', next === 'gold')
    localStorage.setItem('theme', next)
  }

  const allNavItems = [
    { path: '/', label: '📊 لوحة التحكم', perm: 'dashboard.view', group: 'الرئيسية' },
    { path: '/alerts', label: '🔔 التنبيهات', perm: 'alerts.view', group: 'الرئيسية' },
    { path: '/branches', label: '🏪 إدارة الفروع', perm: 'branches.view', group: 'الرئيسية' },
    { path: '/sales', label: '💰 المبيعات', perm: 'sales.view', group: 'مركز العمليات' },
    { path: '/receiving', label: '🧾 المشتريات', perm: 'receiving.view', group: 'مركز العمليات' },
    { path: '/purchases', label: '🛒 طلبات الشراء', perm: 'purchases.view', group: 'مركز العمليات' },
    { path: '/waste', label: '🗑️ الهدر', perm: 'waste.view', group: 'مركز العمليات' },
    { path: '/item-edits', label: '✏️ التعديلات', perm: 'items.edit', group: 'مركز العمليات' },
    { path: '/inventory', label: '📦 جرد المخزون', perm: 'inventory.view', group: 'المتابعة' },
    { path: '/reports', label: '📈 التقارير', perm: 'reports.view', group: 'المتابعة' },
    { path: '/admin', label: '👑 الإدارة', adminOnly: true, group: 'الإدارة' },
    { path: '/manage', label: '🛠️ الإدارة العامة', adminOnly: true, group: 'الإدارة' },
  ]

  const navItems = allNavItems.filter(item =>
    item.adminOnly ? isAdmin(user) : hasPerm(user, item.perm)
  )
  const groups = [...new Set(navItems.map(i => i.group))]
  // أكورديون: المجموعة تنطوي وتنفتح بالضغط على عنوانها
  const [openGroups, setOpenGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebarGroups')) || groups }
    catch { return groups }
  })
  // طيّ السايد بار كله — شريط أيقونات نحيف
  const [rail, setRail] = useState(() => localStorage.getItem('sidebarRail') === '1')
  const toggleRail = () => {
    setRail(prev => {
      localStorage.setItem('sidebarRail', prev ? '0' : '1')
      return !prev
    })
  }
  // بحث داخل القائمة
  const [q, setQ] = useState('')
  const groupIcons = { 'الرئيسية': '🏠', 'مركز العمليات': '🏭', 'المتابعة': '📈', 'الإدارة': '⚙️' }
  const toggleGroup = (g) => {
    setOpenGroups(prev => {
      const next = prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
      localStorage.setItem('sidebarGroups', JSON.stringify(next))
      return next
    })
  }
  // الصفحة الحالية داخل مجموعة مطوية؟ انفتحها تلقائياً
  useEffect(() => {
    const activeItem = navItems.find(i => i.path === location.pathname)
    if (activeItem && !openGroups.includes(activeItem.group)) {
      setOpenGroups(prev => {
        const next = [...prev, activeItem.group]
        localStorage.setItem('sidebarGroups', JSON.stringify(next))
        return next
      })
    }
  }, [location.pathname])
  const showBell = isAdmin(user) || user?.role === 'manager'
  const roleLabels = { admin: 'مدير النظام', manager: 'مدير فرع', accountant: 'محاسب', staff: 'موظف' }
  const roleLabel = user?.custom_role_name || roleLabels[user?.role] || ''

  return (
    <div className="min-h-screen bg-ios-bg" dir="rtl">
      <nav className="bg-white/80 backdrop-blur border-b border-ios-sep sticky top-0 z-30">
        <div className="w-full flex justify-between items-center px-4 py-3">
          <h1 className="text-lg font-semibold text-ios-text flex items-center gap-2">
            {settings.company_logo
              ? <img src={settings.company_logo} alt="logo" className="w-8 h-8 rounded-lg object-contain" />
              : <span>📦</span>}
            <span className="hidden sm:inline">{settings.company_name}</span>
          </h1>
          <div className="flex gap-3 items-center">
            <button onClick={cycleTheme} title={THEME_META[theme].label}
              className="w-9 h-9 rounded-full bg-ios-fill flex items-center justify-center text-lg active:scale-90 transition">
              {THEME_META[theme].icon}
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

      <div className="w-full flex flex-col md:flex-row">
        {/* Sidebar — desktop only: كامل أو شريط أيقونات نحيف */}
        <aside className={`hidden md:block shrink-0 transition-all ${rail ? 'w-20 p-3' : 'w-64 p-3'}`}>
          <button type="button" onClick={toggleRail}
            title={rail ? 'توسيع القائمة' : 'طيّ القائمة'}
            className="w-full mb-3 py-2 rounded-2xl bg-white border border-ios-sep text-ios-label text-sm font-bold active:opacity-60 transition">
            {rail ? '☰' : '⇥ طيّ القائمة'}
          </button>

          {rail ? (
            /* الوضع النحيف: أيقونات بس مع تلميح */
            <div className="flex flex-col items-center gap-1">
              {navItems.map((item, idx) => {
                const active = location.pathname === item.path
                const [icon] = item.label.split(' ')
                const prev = idx > 0 ? navItems[idx - 1] : null
                return (
                  <div key={item.path} className="flex flex-col items-center">
                    {(!prev || prev.group !== item.group) && idx > 0 && (
                      <div className="w-8 h-px bg-ios-sep my-1.5" />
                    )}
                    <Link to={item.path} title={item.label}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl transition active:scale-90 ${active ? 'bg-ios-blue/15' : 'hover:bg-ios-fill'}`}>
                      {icon}
                    </Link>
                  </div>
                )
              })}
            </div>
          ) : (
            /* الوضع الكامل: ☰ + 🏠 + بحث + صفوف قابلة للطيّ */
            <>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={toggleRail} title="طيّ القائمة"
                  className="w-11 h-11 rounded-xl bg-white border border-ios-sep flex items-center justify-center text-lg text-ios-text active:opacity-60 transition">
                  ☰
                </button>
                <Link to="/" title="لوحة التحكم"
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center text-lg transition active:opacity-60 ${location.pathname === '/' ? 'bg-ios-blue/15 border-ios-blue/30' : 'bg-white border-ios-sep'}`}>
                  🏠
                </Link>
                <div className="flex-1 relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-label">🔍</span>
                  <input type="text" value={q} onChange={e => setQ(e.target.value)}
                    placeholder="بحث..."
                    className="input-ios !h-11 pr-9 text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                {(q
                  ? [{ group: 'نتائج البحث', items: navItems.filter(i => i.label.replace(/^\S+\s/, '').includes(q.trim())) }]
                  : groups.map(g => ({ group: g, items: navItems.filter(i => i.group === g) }))
                ).map(({ group, items }) => {
                  const open = q ? true : openGroups.includes(group)
                  if (!items.length && q) return null
                  return (
                    <div key={group} className="card-ios overflow-hidden">
                      <button type="button" onClick={() => !q && toggleGroup(group)}
                        className="nav-item w-full !py-3.5 cursor-pointer">
                        <span className="flex items-center gap-2.5">
                          <span>{groupIcons[group] || '📁'}</span>
                          <span>{group}</span>
                        </span>
                        {!q && (
                          <span className={`text-xs transition-transform duration-200 ${open ? 'text-ios-blue' : '-rotate-90 text-ios-label'}`}>▾</span>
                        )}
                      </button>
                      {open && items.map(item => {
                        const active = location.pathname === item.path
                        const [icon, ...rest] = item.label.split(' ')
                        return (
                          <Link key={item.path} to={item.path}
                            className={`flex items-center gap-2.5 px-4 py-3 pr-12 text-sm font-semibold border-t border-ios-sep transition active:opacity-60 ${active ? 'bg-ios-blue/10 text-ios-blue' : 'text-ios-text hover:bg-ios-bg'}`}>
                            <span>{icon}</span>
                            <span className="flex-1">{rest.join(' ')}</span>
                            {active && <span className="w-1.5 h-1.5 rounded-full bg-ios-blue" />}
                          </Link>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </>
          )}
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
