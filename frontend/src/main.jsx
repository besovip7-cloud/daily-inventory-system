import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// تطبيق تفضيل الوضع الليلي قبل أول رسم حتى لا يومض الشاشة
const saved = localStorage.getItem('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
if (saved === 'dark' || (!saved && prefersDark)) {
  document.documentElement.classList.add('dark')
}

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
