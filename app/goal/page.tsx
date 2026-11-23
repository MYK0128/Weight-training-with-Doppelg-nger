// 認証済みの身体情報と保存目標を、同じ画面で比較する。

import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';
import { GoalEditor } from '@/components/goal/goal-editor';
import { apiGet } from '@/lib/api';
import { currentBody, type BodyProfile } from '@/lib/body-profile';
import { type BodyGoal } from '@/lib/body-goal';

export default async function GoalPage() {
  let data: [BodyProfile | null, { goal: BodyGoal | null } | null] | null = null;
  try {
    data = await Promise.all([
      apiGet<BodyProfile>('/api/body-profile'),
      apiGet<{ goal: BodyGoal | null }>('/api/body-goal'),
    ]);
  } catch {
    // API障害を「未登録」として扱わず、編集・上書きを避ける。
  }
  if (data && (!data[0] || !data[1])) redirect('/login');

  return <main className="page-shell" data-testid="goal-page">
    <AppNav active="goal" />
    <section className="hero-card plan-hero">
      <span className="pill">BODY GOAL / 02</span>
      <h1 className="headline">なりたい姿を、<br />今日の一歩に。</h1>
    </section>
    {data && data[0] && data[1]
      ? <GoalEditor current={currentBody(data[0])} initial={data[1].goal} />
      : <section className="panel-card" role="alert" data-testid="goal-load-error">
        <h2 className="section-title">身体情報と目標を読み込めませんでした</h2>
        <p className="muted">未登録の状態とは異なります。保存内容を保護するため、編集を一時的に止めています。接続を確認して再読み込みしてください。</p>
        <a href="/goal" className="button-secondary">再読み込み</a>
      </section>}
  </main>;
}
