import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeReadings, loadPlan } from "@/lib/simulation";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { PlanEditor } from "@/components/plan/plan-editor";

export default async function PlanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [stored, readings] = await Promise.all([
    prisma.weeklyPlan.findUnique({ where: { userId: user.id } }),
    prisma.bodyMetric.findMany({
      where: { userId: user.id, muscleMassKg: { gt: 0 } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { date: true, muscleMassKg: true }
    })
  ]);
  const history = analyzeReadings(readings.flatMap(({ date, muscleMassKg }) =>
    muscleMassKg == null ? [] : [{ date: date.toISOString().slice(0, 10), kg: muscleMassKg }]));
  const initial = loadPlan(stored?.settings, history.latest?.kg ?? null);

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
