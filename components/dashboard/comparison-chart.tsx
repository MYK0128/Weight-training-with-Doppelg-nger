"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

type ChartPoint = {
  date: string;
  realWeight: number | null;
  muscleMass: number | null;
  avatarPower: number | null;
  bodyShape: number | null;
};

export function ComparisonChart({ points }: { points: ChartPoint[] }) {
  if (!points.length) return <p className="muted">記録を追加すると成長率を表示します。</p>;
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="4 6" />
          <XAxis dataKey="date" stroke="var(--muted)" />
          <YAxis stroke="var(--muted)" tickFormatter={(value) => `${value}%`} />
          <Legend />
          <Tooltip
            formatter={(value) => `${value}%`}
            contentStyle={{
              background: "var(--surface-deep)",
              border: "1px solid var(--line)",
              borderRadius: 16
            }}
          />
          <Line type="monotone" dataKey="realWeight" stroke="var(--chart-weight)" strokeWidth={3} dot={{ r: 4 }} name="現実の体重" />
          <Line type="monotone" dataKey="muscleMass" stroke="var(--chart-muscle)" strokeWidth={3} dot={{ r: 4 }} name="筋肉量" />
          <Line type="monotone" dataKey="avatarPower" stroke="var(--chart-power)" strokeDasharray="8 4" strokeWidth={3} dot={{ r: 4 }} name="Avatar Power" />
          <Line type="monotone" dataKey="bodyShape" stroke="var(--chart-shape)" strokeDasharray="2 4" strokeWidth={3} dot={{ r: 4 }} name="Body Shape" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
