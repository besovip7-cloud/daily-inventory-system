export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-2 mb-6">
      <div>
        <h2 className="text-2xl font-bold text-ios-text tracking-tight">{title}</h2>
        {subtitle && <p className="text-ios-label mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
