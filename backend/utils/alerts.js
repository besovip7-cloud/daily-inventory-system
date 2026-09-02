const pool = require('../config/database');

const checkAndCreateAlerts = async (branchId, itemId, currentQty, minQty, itemName) => {
  try {
    // Delete existing unresolved alerts for this item
    await pool.query(
      `DELETE FROM alerts WHERE branch_id = $1 AND item_id = $2 AND is_resolved = FALSE`,
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

module.exports = { checkAndCreateAlerts, createInfoAlert };
