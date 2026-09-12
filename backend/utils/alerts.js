const pool = require('../config/database');
const { notifyBranch } = require('./whatsapp');

const checkAndCreateAlerts = async (branchId, itemId, currentQty, minQty, itemName) => {
  try {
    // هل كان فيه تنبيه حرج مفتوح لهذه المادة؟ (حتى ما نعيد إرسال واتساب)
    const existing = await pool.query(
      `SELECT alert_type FROM alerts WHERE branch_id = $1 AND item_id = $2 AND is_resolved = FALSE AND alert_type IN ('critical', 'warning')`,
      [branchId, itemId]
    );
    const hadCritical = existing.rows.some(r => r.alert_type === 'critical');

    // Delete existing unresolved stock alerts for this item (keep variance alerts)
    await pool.query(
      `DELETE FROM alerts WHERE branch_id = $1 AND item_id = $2 AND is_resolved = FALSE AND alert_type IN ('critical', 'warning')`,
      [branchId, itemId]
    );

    if (currentQty <= 0) {
      await pool.query(
        `INSERT INTO alerts (branch_id, item_id, alert_type, title, message)
         VALUES ($1, $2, 'critical', $3, $4)`,
        [branchId, itemId, `🚨 ${itemName} نفذ من المخزون!`, 
         `الكمية الحالية: ${currentQty} | الحد الأدنى: ${minQty}`]
      );
      if (!hadCritical) {
        const b = await pool.query('SELECT name FROM branches WHERE id = $1', [branchId]);
        await notifyBranch(branchId,
          `🚨 *تنبيه مخزون — ${b.rows[0]?.name || ''}*\n\n📦 ${itemName}\nالحالة: *نفذ من المخزون!*\nالكمية: ${currentQty} | الحد الأدنى: ${minQty}\n\nسجّل طلب شراء من النظام.`,
          `stock:${branchId}:${itemId}:out`)
      }
    } else if (currentQty <= minQty * 0.5) {
      await pool.query(
        `INSERT INTO alerts (branch_id, item_id, alert_type, title, message)
         VALUES ($1, $2, 'critical', $3, $4)`,
        [branchId, itemId, `🚨 ${itemName} ناقص جداً`, 
         `الكمية: ${currentQty} | الحد الأدنى: ${minQty}`]
      );
      if (!hadCritical) {
        const b = await pool.query('SELECT name FROM branches WHERE id = $1', [branchId]);
        await notifyBranch(branchId,
          `🚨 *تنبيه مخزون — ${b.rows[0]?.name || ''}*\n\n📦 ${itemName}\nالحالة: *ناقص جداً*\nالكمية: ${currentQty} | الحد الأدنى: ${minQty}`,
          `stock:${branchId}:${itemId}:critical`)
      }
    } else if (currentQty <= minQty) {
      await pool.query(
        `INSERT INTO alerts (branch_id, item_id, alert_type, title, message)
         VALUES ($1, $2, 'warning', $3, $4)`,
        [branchId, itemId, `⚠️ ${itemName} قريب من النفاد`, 
         `الكمية: ${currentQty} | الحد الأدنى: ${minQty}`]
      );
    }
  } catch (err) {
    console.error('Alert creation error:', err);
  }
};

const createInfoAlert = async (branchId, title, message) => {
  await pool.query(
    `INSERT INTO alerts (branch_id, alert_type, title, message)
     VALUES ($1, 'info', $2, $3)`,
    [branchId, title, message]
  );
  await notifyBranch(branchId, `ℹ️ *${title}*\n\n${message}`, `info:${branchId}:${title}`);
};

// After sales are entered, compare expected (opening + received - recipe
// deductions) with the actual closing count. If a variance exists, replace
// today's variance alert for that item; otherwise clear it.
const checkVarianceAndAlert = async (executor, branchId, itemId, date) => {
  try {
    // pg parses DATE columns to a local-midnight Date; normalize to YYYY-MM-DD
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;

    const inv = await executor.query(
      `SELECT di.record_date, di.opening_qty, di.received_qty, di.closing_qty, ii.name
       FROM daily_inventory di
       JOIN inventory_items ii ON ii.id = di.item_id
       WHERE di.branch_id = $1 AND di.item_id = $2 AND di.record_date = $3`,
      [branchId, itemId, dateStr]
    );
    if (inv.rows.length === 0) return; // closing count not entered yet

    const r = inv.rows[0];
    const deductionsResult = await executor.query(
      `SELECT COALESCE(SUM(-quantity), 0) as total
       FROM inventory_movements
       WHERE branch_id = $1 AND item_id = $2 AND movement_type = 'sale' AND created_at::date = $3`,
      [branchId, itemId, r.record_date]
    );
    const deductions = parseFloat(deductionsResult.rows[0].total);
    const expected = parseFloat(r.opening_qty) + parseFloat(r.received_qty) - deductions;
    const actual = parseFloat(r.closing_qty);
    const variance = actual - expected;

    // هل كان فيه تنبيه فرق مفتوح لهذا اليوم؟ (حتى ما نعيد إرسال واتساب)
    const existingVar = await executor.query(
      `SELECT id FROM alerts
       WHERE branch_id = $1 AND item_id = $2 AND alert_type = 'variance'
         AND is_resolved = FALSE AND created_at::date = CURRENT_DATE`,
      [branchId, itemId]
    );
    const hadVariance = existingVar.rows.length > 0;

    // Replace any earlier unresolved variance alert for this item today
    await executor.query(
      `DELETE FROM alerts
       WHERE branch_id = $1 AND item_id = $2 AND alert_type = 'variance'
         AND is_resolved = FALSE AND created_at::date = CURRENT_DATE`,
      [branchId, itemId]
    );

    if (Math.abs(variance) >= 0.001) {
      await executor.query(
        `INSERT INTO alerts (branch_id, item_id, alert_type, title, message)
         VALUES ($1, $2, 'variance', $3, $4)`,
        [branchId, itemId,
          `⚖️ فرق في ${r.name}`,
          `التاريخ: ${dateStr} | المتوقع: ${expected.toFixed(3)} | الفعلي: ${actual.toFixed(3)} | الفرق: ${variance.toFixed(3)}`]
      );
      if (!hadVariance) {
        const b = await executor.query('SELECT name FROM branches WHERE id = $1', [branchId]);
        await notifyBranch(branchId,
          `⚖️ *فرق جرد — ${b.rows[0]?.name || ''}*\n\n📦 ${r.name}\nالتاريخ: ${dateStr}\nالمتوقع: ${expected.toFixed(3)}\nالفعلي: ${actual.toFixed(3)}\nالفرق: ${variance.toFixed(3)}\n\nراجع العد الفعلي وسجّله بالنظام.`,
          `variance:${branchId}:${itemId}:${dateStr}`)
      }
    }
  } catch (err) {
    console.error('Variance alert error:', err);
  }
};

module.exports = { checkAndCreateAlerts, createInfoAlert, checkVarianceAndAlert };
