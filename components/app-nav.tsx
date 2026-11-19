import Link from "next/link";
import { LogoutButton } from "@/components/dashboard/logout-button";

const pages = [
  { key: "home", href: "/", title: "ホーム" },
  { key: "plan", href: "/plan", title: "週間メニュー" },
  { key: "goal", href: "/goal", title: "目標ボディ" },
  { key: "dashboard", href: "/dashboard", title: "記録・分析" }
] as const;

export function AppNav({ active }: { active: (typeof pages)[number]["key"] }) {
  return (
    <header className="app-header">
      <Link className="brand app-brand" href="/" aria-label="Muscle Quest ホーム">
        <span className="brand-mark" aria-hidden="true">MQ</span>
        <strong>Muscle Quest</strong>
      </Link>
      <nav className="app-nav" aria-label="アプリ内メニュー">
        {pages.map(({ key, href, title }) => <Link key={key} href={href}
          aria-current={key === active ? "page" : undefined}>{title}</Link>)}
      </nav>
      <div className="app-logout"><LogoutButton /></div>
    </header>
  );
}
