export default function StatCard({ label, value, sub, tone = 'default' }) {
  const toneClass = {
    default: 'text-ink',
    orange: 'text-orange-soft',
    pass: 'text-pass',
    pending: 'text-pending'
  }[tone];

  return (
    <div className="bg-surface border border-line rounded-lg px-5 py-4">
      <p className="text-muted text-sm">{label}</p>
      <p className={`font-head font-extrabold text-3xl mt-1 ${toneClass}`}>{value}</p>
      {sub && <p className="text-muted text-xs mt-1">{sub}</p>}
    </div>
  );
}
