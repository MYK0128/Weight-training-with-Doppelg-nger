// ログイン後のホーム。身体データと主要な操作をひと目で確認する。
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { BodyAvatar } from "@/components/home/body-avatar";
import { ProfileForm } from "@/components/home/profile-form";
import { apiGet } from "@/lib/api";
import { getDashboardRecords } from "@/lib/dashboard";
import { calculateAvatarSnapshot, getAvatarSilhouette } from "@/lib/avatar";
import { currentBody, type BodyProfile } from "@/lib/body-profile";

const format = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });

export default async function HomePage() {
  const [records, profile] = await Promise.all([getDashboardRecords(), apiGet<BodyProfile>("/api/body-profile")]);
  if (!records || !profile) redirect("/login");
  const body = currentBody(profile);
  const avatar = calculateAvatarSnapshot(records.workouts, records.bodyMetrics);
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
        <div>
          <BodyAvatar body={body} avatar={avatar} />
          <p className="avatar-rank">Lv. {avatar.level} · {getAvatarSilhouette(avatar.visualTier).label}</p>
        </div>
      </section>

      <details className="panel-card home-profile avatar-stats">
        <summary>アバターの能力値</summary>
        <dl className="home-measurements">
          {Object.entries({ EXP: avatar.experience, 筋力: avatar.power, 体型: avatar.bodyShapeScore, 胸: avatar.chestStat, 腕: avatar.armStat, 脚: avatar.legStat, 持久力: avatar.enduranceStat, 外見ランク: avatar.visualTier }).map(([label, value]) =>
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </details>
      <ProfileForm profile={profile} />
    </main>
  );
}
