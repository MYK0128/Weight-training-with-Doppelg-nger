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
          <XAxis dataKey="bodyPart" stroke="#96afa8" />
          <YAxis stroke="#96afa8" />
          <Tooltip
            contentStyle={{
              background: "#08151d",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16
            }}
          />
          <Bar dataKey="volume" fill="#7df2bb" radius={[12, 12, 0, 0]} name="総ボリューム" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
