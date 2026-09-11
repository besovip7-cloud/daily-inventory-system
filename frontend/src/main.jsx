import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// تطبيق تفضيل الثيم قبل أول رسم حتى لا يومض الشاشة
// الثيمات: light (فاتح) | dark (داكن) | gold (داكن ذهبي)
const savedTheme = localStorage.getItem('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const theme = savedTheme || (prefersDark ? 'dark' : 'light')
if (theme !== 'light') document.documentElement.classList.add('dark')
if (theme === 'gold') document.documentElement.classList.add('theme-gold')

// تسجيل Service Worker — تثبيت الموقع كتطبيق ويعمل بدون نت
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
