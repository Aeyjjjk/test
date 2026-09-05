import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function TrendChart({ data }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <p className="font-head font-bold text-ink mb-4">Selections over time</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#33383F" vertical={false} />
            <XAxis dataKey="date" stroke="#9AA0A6" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9AA0A6" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#2B2F35', border: '1px solid #33383F', borderRadius: 8, color: '#F2F1ED' }}
              labelStyle={{ color: '#9AA0A6' }}
            />
            <Line type="monotone" dataKey="count" stroke="#FF7A29" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
