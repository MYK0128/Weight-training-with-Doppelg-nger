"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type ChartPoint = {
  date: string;
  realWeight: number;
  muscleMass: number | null;
  avatarPower: number;
  bodyShape: number;
};

export function ComparisonChart({ points }: { points: ChartPoint[] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
          <XAxis dataKey="date" stroke="#96afa8" />
          <YAxis stroke="#96afa8" />
          <Tooltip
            contentStyle={{
              background: "#08151d",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16
            }}
          />
          <Line type="monotone" dataKey="realWeight" stroke="#7df2bb" strokeWidth={3} dot={{ r: 4 }} name="現実の体重" />
          <Line type="monotone" dataKey="muscleMass" stroke="#ffbc59" strokeWidth={3} dot={{ r: 4 }} name="筋肉量" />
          <Line type="monotone" dataKey="avatarPower" stroke="#58a6ff" strokeWidth={3} dot={{ r: 4 }} name="Avatar Power" />
          <Line type="monotone" dataKey="bodyShape" stroke="#ff7f7f" strokeWidth={3} dot={{ r: 4 }} name="Body Shape" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
