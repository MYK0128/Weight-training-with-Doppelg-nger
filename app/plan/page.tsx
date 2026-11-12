// 保存済みプランと筋肉量の実測値をGo APIから取得して表示する。
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api";
import { analyzeReadings, loadPlan, type MuscleReading } from "@/lib/simulation";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { PlanEditor } from "@/components/plan/plan-editor";

export default async function PlanPage() {
  const data = await apiGet<{ settings: unknown; readings: MuscleReading[] }>("/api/weekly-plan");
  if (!data) redirect("/login");
  const history = analyzeReadings(data.readings);
  const initial = loadPlan(data.settings, history.latest?.kg ?? null);

  return (
    <main className="page-shell plan-page">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">MQ</span><strong>Muscle Quest</strong></div>
        <nav className="plan-nav" aria-label="アプリ内メニュー">
          <Link className="button-secondary" href="/dashboard">記録・アバター</Link>
          <LogoutButton />
        </nav>
      </header>
      <section className="hero-card plan-hero">
        <span className="pill">WEEKLY PLAN / 01</span>
        <h1 className="headline">筋トレを組む。<br />筋肉の変化を追う。</h1>
        <p className="subhead">週間メニューのセット数を確認し、実測の筋肉量とこれからの増加シナリオを見比べましょう。</p>
      </section>
      <PlanEditor initial={initial} history={history} />
    </main>
  );
}
