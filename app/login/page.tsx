// ログイン・新規登録画面を表示し、ログイン済みなら週間プランへ案内する。
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthPanel } from "@/components/auth/auth-panel";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/plan");
  }

  return (
    <main className="auth-shell">
      <div className="hero-card auth-card">
        <section className="auth-visual">
          <span className="pill">TRAINING / MUSCLE GROWTH</span>
          <h1 className="headline" style={{ marginTop: 18 }}>
            筋トレを組む。
            <br />
            筋肉の変化を追う。
          </h1>
          <p className="subhead">
            週間メニューを登録して、部位別のセット数と筋肉量の記録を確認できます。
            これからの筋肉量の変化は、自分で入力したペースで試算できます。
          </p>
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
