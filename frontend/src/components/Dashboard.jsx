import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { visibleBranches, isBranchLocked } from '../utils/branchScope'

const fmtMoney = n => parseFloat(n || 0).toFixed(2)

// عدّاد متحرك يشتغل بالجافاسكربت مباشرة — ما يتأثر بأي إعدادات CSS
function AnimatedNumber({ value, format = v => Math.round(v).toString(), duration = 900 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const target = parseFloat(value) || 0
    let raf
    const start = performance.now()
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(display)}</>
}

function KpiCard({ icon, label, value, tone = 'blue', number }) {
  const tones = {
    blue: 'bg-ios-blue/10 text-ios-blue',
    green: 'bg-ios-green/15 text-[#1F7A33]',
    orange: 'bg-ios-orange/15 text-ios-orange',
    red: 'bg-ios-red/10 text-ios-red',
  }
  return (
    <div className="card-ios p-4 flex items-center gap-3">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-ios-text truncate">
          {number !== undefined
            ? <AnimatedNumber value={number} format={v => `${fmtMoney(v)} د.ع`} />
            : value}
        </div>
        <div className="text-xs text-ios-label">{label}</div>
      </div>
    </div>
  )
}

function SectionTitle({ icon, title, extra }) {
  return (
    <div className="section-title">
      <h3>{icon} {title}</h3>
      {extra}
    </div>
  )
}

export default function Dashboard({ apiUrl, user }) {
  const [branches, setBranches] = useState([])
  const [stats, setStats] = useState({})
  const [comparison, setComparison] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const branchLocked = isBranchLocked(user)
  const token = localStorage.getItem('token')
  const H = { Authorization: `Bearer ${token}` }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'صباح الخير' : 'مساء الخير'
  const dateStr = now.toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
  const fmtDate = d => d.toISOString().split('T')[0]

  useEffect(() => {
    (async () => {
      try {
        const bRes = await fetch(`${apiUrl}/branches`, { headers: H })
        const bData = visibleBranches(user, await bRes.json() || [])
        setBranches(bData)

        // إحصائيات كل فرع
        const results = await Promise.all(bData.map(b =>
          fetch(`${apiUrl}/branches/${b.id}/dashboard`, { headers: H }).then(r => r.json())
        ))
        const statsMap = {}
        bData.forEach((b, i) => { statsMap[b.id] = results[i] })
        setStats(statsMap)

        if (user?.role === 'admin') {
          const cRes = await fetch(`${apiUrl}/reports/comparison?from=${fmtDate(weekAgo)}&to=${fmtDate(now)}`, { headers: H })
          setComparison(await cRes.json() || [])
        } else if (bData.length === 1) {
          const tRes = await fetch(`${apiUrl}/sales/trend/${bData[0].id}?days=7`, { headers: H })
          setTrend(await tRes.json() || [])
        }
      } catch {
        setError('فشل تحميل بيانات اللوحة')
      }
      setLoading(false)
    })()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-ios-fill rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-ios-fill rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-72 bg-ios-fill rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (error) return <div className="text-center p-10 text-ios-red font-semibold">{error}</div>

  const totalSales = branches.reduce((s, b) => s + (stats[b.id]?.todaySales || 0), 0)
  const totalProfit = branches.reduce((s, b) => s + (stats[b.id]?.todayProfit || 0), 0)
  const submitted = branches.filter(b => stats[b.id]?.inventoryDone).length
  const openAlerts = branches.reduce((s, b) => s + (stats[b.id]?.alerts?.length || 0), 0)
  const lowStock = branches.reduce((s, b) => s + (stats[b.id]?.lowStockItems || 0), 0)
  const myBranch = branches.length === 1 ? branches[0] : null
  const myStats = myBranch ? stats[myBranch.id] : null

  return (
    <div className="space-y-6">
      {/* الترحيب */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-ios-text tracking-tight">{greeting}، {user?.name} 👋</h2>
          <p className="text-ios-label mt-1">{dateStr}</p>
        </div>
        {user?.role === 'admin' && <span className="badge-ios bg-ios-blue/10 text-ios-blue px-3 py-1">👑 مدير النظام</span>}
      </div>

      {/* مؤشرات اليوم */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 anim-stagger">
        <KpiCard icon="💰" label={myBranch ? 'مبيعات فرعك اليوم' : 'مبيعات كل الفروع اليوم'} number={totalSales} tone="green" />
        <KpiCard icon="📈" label={myBranch ? 'ربح فرعك اليوم' : 'ربح كل الفروع اليوم'} number={totalProfit} tone={totalProfit >= 0 ? 'green' : 'red'} />
        <KpiCard icon="📦" label="الجرد المسلَّم اليوم" value={`${submitted}/${branches.length}`} tone={submitted === branches.length ? 'green' : 'orange'} />
        <KpiCard icon="🔔" label="تنبيهات مفتوحة" value={openAlerts} tone={openAlerts > 0 ? 'red' : 'blue'} />
        <KpiCard icon="⚠️" label="مواد منخفضة" value={lowStock} tone={lowStock > 0 ? 'orange' : 'blue'} />
      </div>

      {user?.role === 'admin' ? (
        <>
          {/* مقارنة الفروع — آخر 7 أيام */}
          <div className="card-ios p-5">
            <SectionTitle icon="📊" title="مبيعات الفروع — آخر 7 أيام" />
            {comparison.length > 0 ? (
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                    <XAxis dataKey="branch_name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={v => [`${fmtMoney(v)} د.ع`, 'الإيرادات']} />
                    <Bar dataKey="total_revenue" name="الإيرادات" fill="#007AFF" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-ios-label text-center py-8">لا توجد مبيعات بهذه الفترة</p>
            )}
          </div>

          {/* بطاقات الفروع */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 anim-stagger">
            {branches.map(b => {
              const s = stats[b.id] || {}
              return (
                <div key={b.id} className="card-ios p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-ios-text">{b.name}</h3>
                      <p className="text-ios-label text-xs">{b.location || ''}</p>
                    </div>
                    <span className={`badge-ios ${s.inventoryDone ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
                      {s.inventoryDone ? '✓ سلّم الجرد' : '✗ ما سلّم الجرد'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-ios-bg rounded-xl p-2">
                      <div className="font-bold text-ios-green">{fmtMoney(s.todaySales)}</div>
                      <div className="text-[10px] text-ios-label">مبيعات اليوم</div>
                    </div>
                    <div className="bg-ios-bg rounded-xl p-2">
                      <div className={`font-bold ${(s.todayProfit || 0) >= 0 ? 'text-ios-green' : 'text-ios-red'}`}>{fmtMoney(s.todayProfit)}</div>
                      <div className="text-[10px] text-ios-label">ربح اليوم</div>
                    </div>
                    <div className="bg-ios-bg rounded-xl p-2">
                      <div className={`font-bold ${s.lowStockItems > 0 ? 'text-ios-orange' : 'text-ios-text'}`}>{s.lowStockItems ?? '—'}</div>
                      <div className="text-[10px] text-ios-label">منخفضة</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : myBranch && myStats ? (
        <>
          {/* عرض فرع المدير/الموظف */}
          <div className="card-ios p-5">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <h3 className="font-bold text-lg text-ios-text">🏪 {myBranch.name}</h3>
                <p className="text-ios-label text-xs">{myBranch.location || ''}</p>
              </div>
              <span className={`badge-ios ${myStats.inventoryDone ? 'bg-ios-green/15 text-[#1F7A33]' : 'bg-ios-red/10 text-ios-red'}`}>
                {myStats.inventoryDone ? '✓ سلّمت جرد اليوم' : '✗ انتظر — سلّم جرد اليوم'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-ios-green/10 rounded-2xl p-4 text-center">
                <div className="text-lg md:text-2xl font-bold text-[#1F7A33]">{fmtMoney(myStats.todaySales)}</div>
                <div className="text-xs text-ios-label mt-1">مبيعات اليوم</div>
              </div>
              <div className={`rounded-2xl p-4 text-center ${(myStats.todayProfit || 0) >= 0 ? 'bg-ios-green/10' : 'bg-ios-red/10'}`}>
                <div className={`text-lg md:text-2xl font-bold ${(myStats.todayProfit || 0) >= 0 ? 'text-[#1F7A33]' : 'text-ios-red'}`}>{fmtMoney(myStats.todayProfit)}</div>
                <div className="text-xs text-ios-label mt-1">ربح اليوم</div>
              </div>
              <div className={`rounded-2xl p-4 text-center ${myStats.lowStockItems > 0 ? 'bg-ios-orange/10' : 'bg-ios-blue/10'}`}>
                <div className={`text-lg md:text-2xl font-bold ${myStats.lowStockItems > 0 ? 'text-ios-orange' : 'text-ios-blue'}`}>{myStats.lowStockItems}</div>
                <div className="text-xs text-ios-label mt-1">مواد منخفضة من {myStats.totalItems}</div>
              </div>
            </div>
          </div>

          {/* اتجاه المبيعات — آخر 7 أيام */}
          <div className="card-ios p-5">
            <SectionTitle icon="📈" title="مبيعاتك — آخر 7 أيام" />
            {trend.length > 0 ? (
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                    <XAxis dataKey="record_date" fontSize={11} tickFormatter={d => d.slice(5)} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={v => [`${fmtMoney(v)} د.ع`, 'الإيراد']} labelFormatter={d => `تاريخ ${d}`} />
                    <Bar dataKey="revenue" name="الإيراد" fill="#34C759" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-ios-label text-center py-8">لا توجد مبيعات مسجلة بعد</p>
            )}
          </div>

          {/* أحدث التنبيهات */}
          {myStats.alerts?.length > 0 && (
            <div className="card-ios overflow-hidden">
              <div className="px-5 py-4 border-b border-ios-sep section-title !mb-0"><h3>🔔 أحدث التنبيهات</h3></div>
              {myStats.alerts.map(a => (
                <div key={a.id} className="list-row">
                  <div className="min-w-0">
                    <div className="font-semibold text-ios-text text-sm">{a.title}</div>
                    {a.message && <div className="text-xs text-ios-label truncate">{a.message}</div>}
                  </div>
                  <span className={`badge-ios shrink-0 ${a.alert_type === 'critical' ? 'bg-ios-red text-white' : a.alert_type === 'variance' ? 'bg-ios-orange/15 text-ios-orange' : 'bg-ios-blue/10 text-ios-blue'}`}>
                    {a.alert_type === 'variance' ? 'فرق جرد' : a.alert_type === 'critical' ? 'حرج' : 'تنبيه'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-ios-label text-center py-10">لا توجد بيانات للعرض</p>
      )}
    </div>
  )
}
