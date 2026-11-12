import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Muscle Quest",
  description: "週間トレーニングの部位別セット数、筋肉量の実測推移と増加シナリオを確認"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
