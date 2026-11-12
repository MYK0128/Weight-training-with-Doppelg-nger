// 部位ごとのトレーニング量を棒グラフで表示する。
"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = {
  bodyPart: string;
  volume: number;
};

export function PartVolumeChart({ points }: { points: Point[] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points}>
          <XAxis dataKey="bodyPart" stroke="var(--muted)" />
          <YAxis stroke="var(--muted)" />
          <Tooltip
            contentStyle={{
              background: "var(--surface-deep)",
              border: "1px solid var(--line)",
              borderRadius: 16
            }}
          />
          <Bar dataKey="volume" fill="var(--accent)" radius={[12, 12, 0, 0]} name="総ボリューム" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
