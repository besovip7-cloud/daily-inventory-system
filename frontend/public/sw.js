/* Service Worker — تطبيق يشتغل حتى بدون نت (البيانات دايم من السيرفر) */
const CACHE = 'inventory-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  // طلبات الـ API دايم من الشبكة (البيانات لحظية)
  if (url.pathname.includes('/api/')) return
  // الملفات الثابتة (js/css/صور): كاش أولاً مع تحديث بالخلفية
  if (e.request.method === 'GET' && (url.origin === self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetched = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return res
        }).catch(() => cached)
        return cached || fetched
      })
    )
  }
})
