// فحص الصلاحيات بالواجهة — تطابق منطق الباك إند
const BUILT_IN = {
  admin: ['*'],
  manager: ['dashboard.view', 'inventory.view', 'inventory.edit', 'branches.view',
    'sales.view', 'sales.create', 'purchases.view', 'purchases.create', 'purchases.confirm', 'alerts.view'],
  staff: ['dashboard.view', 'inventory.view', 'inventory.edit', 'branches.view',
    'sales.view', 'sales.create', 'purchases.view', 'purchases.create', 'purchases.confirm', 'alerts.view'],
  accountant: ['sales.view', 'reports.view'],
}

export const hasPerm = (user, perm) => {
  if (!user) return false
  if (user.role === 'admin') return true
  const perms = user.permissions || BUILT_IN[user.role] || []
  return perms.includes('*') || perms.includes(perm)
}

export const isAdmin = (user) => user?.role === 'admin'
