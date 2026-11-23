// ログイン・新規登録画面を表示し、ログイン済みならアバターのホームへ案内する。
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthPanel } from "@/components/auth/auth-panel";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  return (
    <main className="auth-shell">
      <div className="hero-card auth-card">
        <section className="auth-visual">
          <span className="pill">TRAINING / BODY GOALS</span>
          <h1 className="headline" style={{ marginTop: "var(--space-2)" }}>自分の身体から、<br />最初の一歩を。</h1>
        </section>
        <section className="auth-panel">
          <div className="brand" style={{ marginBottom: "var(--space-2)" }}>
            <div className="brand-mark">MQ</div>
            <div>
              <strong>Muscle Quest</strong>
              {process.env.NODE_ENV === "development" &&
                <div className="muted auth-demo">デモアカウント: demo@muscle.quest / demo1234</div>}
            </div>
          </div>
          <AuthPanel />
        </section>
      </div>
    </main>
  );
}
