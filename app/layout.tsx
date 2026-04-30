import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Muscle Quest",
  description: "現実の筋トレ成長とアバター成長をつなぐトレーニング可視化アプリ"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
