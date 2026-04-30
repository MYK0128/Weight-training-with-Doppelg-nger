import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthPanel } from "@/components/auth/auth-panel";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <div className="hero-card auth-card">
        <section className="auth-visual">
          <span className="pill">REAL x RPG PROGRESSION</span>
          <h1 className="headline" style={{ marginTop: 18 }}>
            Lift in real life.
            <br />
            Level up in game.
          </h1>
          <p className="subhead">
            筋トレ記録、身体データ、アバター成長をひとつの流れで見せる MVP です。
            現実の成長率と、ゲーム内キャラクターの成長率を同じダッシュボードで比較できます。
          </p>
          <div className="stats-strip">
            <div className="stat-box">
              <p className="stat-label">記録</p>
              <p className="stat-value">Workout Log</p>
            </div>
            <div className="stat-box">
              <p className="stat-label">成長</p>
              <p className="stat-value">Avatar Sync</p>
            </div>
            <div className="stat-box">
              <p className="stat-label">比較</p>
              <p className="stat-value">Growth Graph</p>
            </div>
            <div className="stat-box">
              <p className="stat-label">継続</p>
              <p className="stat-value">Streak & Badges</p>
            </div>
          </div>
        </section>
        <section className="auth-panel">
          <div className="brand" style={{ marginBottom: 18 }}>
            <div className="brand-mark">MQ</div>
            <div>
              <strong>Muscle Quest</strong>
              <div className="muted">デモアカウント: demo@muscle.quest / demo1234</div>
            </div>
          </div>
          <AuthPanel />
        </section>
      </div>
    </main>
  );
}
