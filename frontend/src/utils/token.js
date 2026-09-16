// إدارة التوكن: "تذكرني" → localStorage (يبقى بعد إغلاق المتصفح)
// بدون تذكر → sessionStorage (ينتهي بإغلاق التبويب)
export const getToken = () =>
  localStorage.getItem('token') || sessionStorage.getItem('token')

export const setToken = (token, remember = true) => {
  clearToken()
  if (remember) localStorage.setItem('token', token)
  else sessionStorage.setItem('token', token)
}

export const clearToken = () => {
  localStorage.removeItem('token')
  sessionStorage.removeItem('token')
}
