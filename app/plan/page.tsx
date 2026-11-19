// 保存済みプランと筋肉量の実測値をGo APIから取得して表示する。
import { AppNav } from "@/components/app-nav";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api";
import { analyzeReadings, loadPlan, type MuscleReading } from "@/lib/simulation";

import { PlanEditor } from "@/components/plan/plan-editor";

export default async function PlanPage() {
  const data = await apiGet<{ settings: unknown; readings: MuscleReading[] }>("/api/weekly-plan");
  if (!data) redirect("/login");
  const history = analyzeReadings(data.readings);
  const initial = loadPlan(data.settings, history.latest?.kg ?? null);

  return (
    <main className="page-shell plan-page">
      <AppNav active="plan" />
      <section className="hero-card plan-hero">
        <span className="pill">WEEKLY PLAN / 01</span>
        <h1 className="headline">週間トレーニング</h1>
        <p className="subhead">曜日ごとに種目・回数・セット数を決めて、1週間のメニューを保存しましょう。</p>
      </section>
      <PlanEditor initial={initial} history={history} />
    </main>
  );
}
