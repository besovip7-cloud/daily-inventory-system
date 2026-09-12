// إرسال إشعارات واتساب عبر Ultramsg
// يتطلب متغيرات البيئة: ULTRAMSG_INSTANCE_ID و ULTRAMSG_TOKEN
// إذا ما مضبوطات، الإرسال يتخطى بصمت (الإشعارات تبقى داخل النظام)
const pool = require('../config/database')

const isConfigured = () => !!(process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN)

const sendWhatsApp = async (to, message) => {
  if (!isConfigured() || !to) return false
  const phone = String(to).replace(/[^\d]/g, '') // أرقام بس
  if (!phone) return false
  try {
    const res = await fetch(
      `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: process.env.ULTRAMSG_TOKEN, to: phone, body: message })
      }
    )
    if (!res.ok) console.error('WhatsApp API error:', res.status, (await res.text()).slice(0, 200))
    return res.ok
  } catch (err) {
    console.error('WhatsApp send error:', err.message)
    return false
  }
}

// خنق بسيط بالذاكرة: ما نعيد إرسال نفس التنبيه خلال 6 ساعات
const lastSent = new Map()
const THROTTLE_MS = 6 * 60 * 60 * 1000
const wasRecentlySent = (key) => {
  const t = lastSent.get(key)
  if (t && Date.now() - t < THROTTLE_MS) return true
  lastSent.set(key, Date.now())
  return false
}

// إشعار مسؤولي فرع برسالة
const notifyBranch = async (branchId, message, throttleKey = null) => {
  try {
    if (throttleKey && wasRecentlySent(throttleKey)) return
    const result = await pool.query(
      `SELECT name, phone FROM users
       WHERE branch_id = $1 AND is_active = TRUE AND phone IS NOT NULL AND phone <> ''
         AND role IN ('manager', 'staff')`,
      [branchId]
    )
    for (const u of result.rows) {
      await sendWhatsApp(u.phone, message)
    }
  } catch (err) {
    console.error('notifyBranch error:', err.message)
  }
}

module.exports = { sendWhatsApp, notifyBranch, isConfigured }
