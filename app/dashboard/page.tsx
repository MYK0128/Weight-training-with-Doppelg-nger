import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { AvatarCard } from "@/components/dashboard/avatar-card";
import { WorkoutForm } from "@/components/dashboard/workout-form";
import { BodyMetricForm } from "@/components/dashboard/body-metric-form";
import { ComparisonChart } from "@/components/dashboard/comparison-chart";
import { PartVolumeChart } from "@/components/dashboard/part-volume-chart";
import { LogoutButton } from "@/components/dashboard/logout-button";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const dashboard = await getDashboardData(user.id);

  return (
    <main className="page-shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">MQ</div>
          <div>
            <strong>Muscle Quest</strong>
            <div className="muted">{user.name} の成長ダッシュボード</div>
          </div>
        </div>
        <LogoutButton />
      </div>

      <section className="hero-card">
        <span className="pill">REAL GROWTH VS AVATAR GROWTH</span>
        <h1 className="headline" style={{ marginTop: 18 }}>
          現実の努力を、
          <br />
          キャラクター成長に変換する。
        </h1>
        <p className="subhead">
          筋トレ記録と身体データから、アバターの見た目・能力値・レベルを算出。
          現実の成長率とゲーム内成長率を並べて、継続のモチベーションを高めます。
        </p>
        <div className="stats-strip">
          <div className="stat-box">
            <p className="stat-label">連続記録日数</p>
            <p className="stat-value">{dashboard.streak}日</p>
          </div>
          <div className="stat-box">
            <p className="stat-label">累計トレーニング量</p>
            <p className="stat-value">{dashboard.totalVolume}</p>
          </div>
          <div className="stat-box">
            <p className="stat-label">Avatar Level</p>
            <p className="stat-value">{dashboard.avatar?.level ?? 1}</p>
          </div>
          <div className="stat-box">
            <p className="stat-label">最新体重</p>
            <p className="stat-value">{dashboard.latestMetric?.weightKg ?? "-"}kg</p>
          </div>
        </div>
      </section>

      <div className="grid grid-2" style={{ marginTop: 22 }}>
        <AvatarCard avatar={dashboard.avatar} />
        <section className="panel-card">
          <h2 className="section-title">成長比較サマリー</h2>
          <div className="mini-kpis">
            <div className="kpi">
              現実の体重成長率
              <strong>{dashboard.summary.realWeightGrowthRate}%</strong>
            </div>
            <div className="kpi">
              現実の筋肉量成長率
              <strong>{dashboard.summary.muscleGrowthRate}%</strong>
            </div>
            <div className="kpi">
              扱う重量の伸び率
              <strong>{dashboard.summary.workoutStrengthGrowthRate}%</strong>
            </div>
            <div className="kpi">
              Avatar Power 成長率
              <strong>{dashboard.summary.avatarPowerGrowthRate}%</strong>
            </div>
            <div className="kpi">
              Avatar Visual 成長率
              <strong>{dashboard.summary.avatarVisualGrowthRate}%</strong>
            </div>
            <div className="kpi">
              実績バッジ
              <strong>{dashboard.badges.length}</strong>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="badge-list">
              {dashboard.badges.length > 0 ? (
                dashboard.badges.map((badge) => (
                  <span className="badge-chip" key={badge}>
                    {badge}
                  </span>
                ))
              ) : (
                <span className="muted">まだバッジはありません。記録を増やしてアンロックしましょう。</span>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-2" style={{ marginTop: 22 }}>
        <WorkoutForm />
        <BodyMetricForm />
      </div>

      <div className="grid grid-2" style={{ marginTop: 22 }}>
        <section className="panel-card">
          <h2 className="section-title">現実 x アバター比較グラフ</h2>
          <ComparisonChart points={dashboard.chartPoints} />
        </section>
        <section className="panel-card">
          <h2 className="section-title">部位別トレーニング分析</h2>
          <PartVolumeChart points={dashboard.volumeByPart} />
        </section>
      </div>

      <div className="grid grid-2" style={{ marginTop: 22 }}>
        <section className="panel-card">
          <h2 className="section-title">最近の筋トレ記録</h2>
          <div className="log-list">
            {dashboard.workouts.slice(-5).reverse().map((workout) => (
              <div className="log-item" key={workout.id}>
                <div className="row-between">
                  <strong>{workout.exerciseName}</strong>
                  <span className="muted">{workout.date.toISOString().slice(0, 10)}</span>
                </div>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {workout.weightKg}kg x {workout.reps}回 x {workout.sets}セット / {workout.bodyPart}
                </p>
                {workout.memo ? <p style={{ marginBottom: 0 }}>{workout.memo}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="panel-card">
          <h2 className="section-title">最近の身体データ</h2>
          <div className="log-list">
            {dashboard.bodyMetrics.slice(-5).reverse().map((metric) => (
              <div className="log-item" key={metric.id}>
                <div className="row-between">
                  <strong>{metric.weightKg}kg</strong>
                  <span className="muted">{metric.date.toISOString().slice(0, 10)}</span>
                </div>
                <p className="muted" style={{ marginBottom: 0 }}>
                  体脂肪率: {metric.bodyFatRate ?? "-"} / 筋肉量: {metric.muscleMassKg ?? "-"}
                </p>
                <p style={{ marginBottom: 0 }}>
                  胸囲 {metric.chestCm ?? "-"}cm / 腕囲 {metric.armCm ?? "-"}cm / 脚囲 {metric.legCm ?? "-"}cm
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
