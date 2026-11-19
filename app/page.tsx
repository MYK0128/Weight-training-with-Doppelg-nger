// ログイン後のホーム。身体データと主要な操作をひと目で確認する。
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { BodyAvatar } from "@/components/home/body-avatar";
import { ProfileForm } from "@/components/home/profile-form";
import { apiGet } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { currentBody, type BodyProfile } from "@/lib/body-profile";

const format = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });

export default async function HomePage() {
  const [user, profile] = await Promise.all([getCurrentUser(), apiGet<BodyProfile>("/api/body-profile")]);
  if (!user || !profile) redirect("/login");
  const body = currentBody(profile);
  const measurements = [
    { label: "身長", value: body.heightCm, unit: "cm" },
    { label: "体重", value: body.weightKg, unit: "kg" },
    { label: "体脂肪率", value: body.bodyFatRate, unit: "%" }
  ];

  return (
    <main className="page-shell home-page">
      <AppNav active="home" />
      <section className="hero-card home-hero" aria-labelledby="home-title">
        <div className="home-intro">
          <p className="plan-kicker">MUSCLE QUEST / HOME</p>
          <h1 id="home-title">マイアバター</h1>
          <p className="subhead">{user.name} さんの身体データを反映したアバターです。記録を続けて、変化を見ていきましょう。</p>
          <dl className="home-measurements">
            {measurements.map(({ label, value, unit }) => <div key={label}>
              <dt>{label}</dt>
              <dd>{value == null ? <span className="home-unset">{label === "体脂肪率" ? "未測定" : "未登録"}</span>
                : <>{format.format(value)} <small>{unit}</small></>}</dd>
            </div>)}
          </dl>
          <p className="home-source muted">{body.date ? `最新の測定：${body.date}（体重・体脂肪率）`
            : body.weightKg != null ? "登録時の身体データを表示しています。" : "身体プロフィールはまだ登録されていません。"}
            {body.heightCm == null && " 身長を登録すると、アバターに体格が反映されます。"}
          </p>
          <div className="home-body-links">
            {body.heightCm == null && <a href="#body-profile" className="plan-text-link">身体プロフィールへ</a>}
            <Link href="/dashboard#metric-date" className="plan-text-link">新しい測定を記録する</Link>
          </div>
        </div>
        <BodyAvatar body={body} />
      </section>

      <div className="home-actions">
        <Link href="/plan" className="panel-card home-action">
          <span className="home-action-number" aria-hidden="true">01</span>
          <div><h2>週間メニューを組む</h2><p>曜日ごとに種目・回数・セット数を決める</p></div>
          <span className="home-arrow" aria-hidden="true">→</span>
        </Link>
        <Link href="/goal" className="panel-card home-action">
          <span className="home-action-number" aria-hidden="true">02</span>
          <div><h2>目標ボディを設定する</h2><p>目標と現在の差を比べ、取り組むメニュー例を見る</p></div>
          <span className="home-arrow" aria-hidden="true">→</span>
        </Link>
      </div>
      <ProfileForm profile={profile} />
    </main>
  );
}
