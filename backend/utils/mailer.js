// إرسال إيميلات عبر SMTP (Gmail App Password أو أي خادم SMTP)
// يتطلب متغيرات البيئة: SMTP_HOST و SMTP_PORT و SMTP_USER و SMTP_PASS و SMTP_FROM
// إذا ما مضبوطات، الإرسال يتخطى بصمت ويُسجّل بالكونسول
const nodemailer = require('nodemailer')

const isConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

let transporter = null
const getTransporter = () => {
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: (process.env.SMTP_PORT || '465') === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  })
  return transporter
}

const sendMail = async (to, subject, text, html) => {
  if (!isConfigured() || !to) return false
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    })
    return true
  } catch (err) {
    console.error('Mail send error:', err.message)
    return false
  }
}

module.exports = { sendMail, isConfigured }
