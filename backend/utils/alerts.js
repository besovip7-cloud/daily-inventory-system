const pool = require('../config/database');

const checkAndCreateAlerts = async (branchId, itemId, currentQty, minQty, itemName) => {
  try {
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
    } else if (currentQty <= minQty * 0.5) {
      await pool.query(
        `INSERT INTO alerts (branch_id, item_id, alert_type, title, message)
         VALUES ($1, $2, 'critical', $3, $4)`,
        [branchId, itemId, `🚨 ${itemName} ناقص جداً`, 
         `الكمية: ${currentQty} | الحد الأدنى: ${minQty}`]
      );
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
    }
  } catch (err) {
    console.error('Variance alert error:', err);
  }
};

module.exports = { checkAndCreateAlerts, createInfoAlert, checkVarianceAndAlert };
