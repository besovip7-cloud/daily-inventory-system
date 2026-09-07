const pool = require('../config/database');

// كتالوج الصلاحيات التفصيلية
const PERMISSIONS = [
  { key: 'dashboard.view', label: '📊 لوحة التحكم — عرض' },
  { key: 'inventory.view', label: '📦 الجرد — عرض' },
  { key: 'inventory.edit', label: '📦 الجرد — إدخال وتعديل الكميات' },
  { key: 'branches.view', label: '🏪 الفروع — عرض' },
  { key: 'sales.view', label: '💰 المبيعات — عرض' },
  { key: 'sales.create', label: '💰 المبيعات — إدخال واستيراد' },
  { key: 'purchases.view', label: '🛒 طلبات الشراء — عرض' },
  { key: 'purchases.create', label: '🛒 طلبات الشراء — إنشاء وإلغاء' },
  { key: 'purchases.confirm', label: '🛒 طلبات الشراء — تأكيد الاستلام' },
  { key: 'alerts.view', label: '🔔 التنبيهات — عرض ومعالجة' },
  { key: 'reports.view', label: '📈 التقارير — عرض وتصدير' },
  { key: 'users.manage', label: '👥 إدارة المستخدمين' },
  { key: 'catalog.manage', label: '🗂️ إدارة الأصناف والمواد والوصفات والفروع' },
  { key: 'settings.manage', label: '⚙️ إعدادات النظام واللوكو' },
];

// الأدوار المدمجة الافتراضية
const BUILT_IN = {
  admin: ['*'],
  manager: ['dashboard.view', 'inventory.view', 'inventory.edit', 'branches.view',
    'sales.view', 'sales.create', 'purchases.view', 'purchases.create', 'purchases.confirm', 'alerts.view'],
  staff: ['dashboard.view', 'inventory.view', 'inventory.edit', 'branches.view',
    'sales.view', 'sales.create', 'purchases.view', 'purchases.create', 'purchases.confirm', 'alerts.view'],
  accountant: ['sales.view', 'reports.view'],
};

// صلاحيات المستخدم الفعلية: الدور المخصص إن وجد، وإلا الدور المدمج
const getEffectivePermissions = async (user) => {
  if (user.role === 'admin') return ['*'];
  if (user.custom_role_id) {
    const r = await pool.query('SELECT permissions FROM custom_roles WHERE id = $1', [user.custom_role_id]);
    if (r.rows.length > 0) return r.rows[0].permissions || [];
  }
  return BUILT_IN[user.role] || [];
};

// وسيط الصلاحيات للمسارات
const requirePerm = (perm) => async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return next();
    const perms = await getEffectivePermissions(req.user);
    if (perms.includes('*') || perms.includes(perm)) return next();
    res.status(403).json({ message: 'ما عندك صلاحية لهذا الإجراء' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { PERMISSIONS, BUILT_IN, getEffectivePermissions, requirePerm };
