import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const PALETTE = ['#FF7A29', '#FFB877', '#E0A94E', '#4CAF7D', '#9AA0A6', '#E5484D'];

export default function DeptChart({ data }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <p className="font-head font-bold text-ink mb-4">Selections by department (last 14 days)</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#33383F" vertical={false} />
            <XAxis dataKey="department" stroke="#9AA0A6" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9AA0A6" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#2B2F35', border: '1px solid #33383F', borderRadius: 8, color: '#F2F1ED' }}
              labelStyle={{ color: '#9AA0A6' }}
              cursor={{ fill: '#33383F55' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
