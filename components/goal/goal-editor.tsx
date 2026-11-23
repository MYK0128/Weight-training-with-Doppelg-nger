'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSubmission } from '@/components/use-submission';
import { requestJSON } from '@/lib/client-request';
import { exerciseById, muscleParts } from '@/lib/exercises';
import { bodyGoalSchema, compareBodyGoal, reasonBodyGoal, type BodyGoal, type CurrentBody } from '@/lib/body-goal';
import styles from './goal.module.css';

const format = (value: number | null, unit: string) => value == null ? '未登録' : `${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(value)} ${unit}`;
const signed = (value: number | null, unit: string) => value == null ? '比較できません' : `${value > 0 ? '+' : ''}${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(value)} ${unit}`;

export function GoalEditor({ current, initial }: { current: CurrentBody; initial: BodyGoal | null }) {
  const [weight, setWeight] = useState(initial?.targetWeightKg.toString() ?? '');
  const [fat, setFat] = useState(initial?.targetBodyFatRate.toString() ?? '');
  const [trainingDays, setTrainingDays] = useState<2 | 3>(initial?.trainingDays ?? 2);
  const [equipment, setEquipment] = useState<'gym' | 'dumbbells'>(initial?.equipment ?? 'gym');
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState('');
  const [attempted, setAttempted] = useState(false);
  const { pending, error, run } = useSubmission();
  const parsed = bodyGoalSchema.safeParse({
    targetWeightKg: weight.trim() === '' ? NaN : Number(weight),
    targetBodyFatRate: fat.trim() === '' ? NaN : Number(fat),
    trainingDays, equipment,
  });
  const goal = parsed.success ? parsed.data : null;
  const comparison = goal ? compareBodyGoal(current, goal) : null;
  const reasoning = goal ? reasonBodyGoal(current, goal) : null;
  const dirty = !saved || !goal || saved.targetWeightKg !== goal.targetWeightKg || saved.targetBodyFatRate !== goal.targetBodyFatRate || saved.trainingDays !== goal.trainingDays || saved.equipment !== goal.equipment;
  const weightInvalid = !Number.isFinite(Number(weight)) || weight.trim() === '' || Number(weight) < 20 || Number(weight) > 500;
  const fatInvalid = !Number.isFinite(Number(fat)) || fat.trim() === '' || Number(fat) < 1 || Number(fat) > 75;
  function edit() { setStatus(''); setAttempted(false); }

  async function save() {
    setAttempted(true);
    setStatus('');
    if (!parsed.success) return;
    await run(async () => {
      await requestJSON('/api/body-goal', parsed.data, 'PUT');
      setSaved(parsed.data);
      setStatus('目標を保存しました。次回もこの設定から始められます。');
    });
  }

  return <div className={styles.stack}>
      <form className="panel-card" onSubmit={event => { event.preventDefault(); void save(); }} noValidate aria-busy={pending} data-testid="goal-form">
        <p className="plan-kicker">01 / TARGET</p>
        <h2 className="section-title">目指す身体</h2>
        <p className="muted">{saved ? '保存した目標を見直せます。' : '目標はまだ保存されていません。数値と環境を入力してみましょう。'}</p>
        <fieldset disabled={pending} className={`submission-fields ${styles.fields}`}>
          <div className={styles.pair}>
            <label className="field" htmlFor="targetWeightKg"><span>目標体重（kg）</span>
              <input id="targetWeightKg" name="targetWeightKg" type="number" inputMode="decimal" min="20" max="500" step="any" required value={weight} aria-invalid={attempted && weightInvalid} aria-describedby="goal-weight-help" onChange={event => { edit(); setWeight(event.target.value); }} />
              <small id="goal-weight-help" className={attempted && weightInvalid ? 'error-text' : 'muted'}>20〜500 kgの数値を入力してください。</small>
            </label>
            <label className="field" htmlFor="targetBodyFatRate"><span>目標体脂肪率（%）</span>
              <input id="targetBodyFatRate" name="targetBodyFatRate" type="number" inputMode="decimal" min="1" max="75" step="any" required value={fat} aria-invalid={attempted && fatInvalid} aria-describedby="goal-fat-help" onChange={event => { edit(); setFat(event.target.value); }} />
              <small id="goal-fat-help" className={attempted && fatInvalid ? 'error-text' : 'muted'}>1〜75%の数値を入力してください。</small>
            </label>
          </div>
          <div className={styles.pair}>
            <label className="field" htmlFor="trainingDays"><span>週に取り組む日数</span><select id="trainingDays" name="trainingDays" value={trainingDays} onChange={event => { edit(); setTrainingDays(Number(event.target.value) as 2 | 3); }}><option value="2">週2日（月・木の例）</option><option value="3">週3日（月・水・金の例）</option></select></label>
            <label className="field" htmlFor="equipment"><span>使える環境</span><select id="equipment" name="equipment" value={equipment} onChange={event => { edit(); setEquipment(event.target.value as 'gym' | 'dumbbells'); }}><option value="gym">ジム</option><option value="dumbbells">ダンベル・自重</option></select></label>
          </div>
          <div className={styles.actions}><button type="submit" className="button" data-testid="goal-save">{pending ? '保存中…' : '目標を保存'}</button><span className="muted" data-testid="goal-save-state">{dirty ? '未保存の入力' : '保存済み'}</span></div>
        </fieldset>
        {attempted && !parsed.success && <p className="error-text" role="alert">目標体重と体脂肪率を入力範囲内の数値にしてください。</p>}
        {error && <p className="error-text" role="alert" data-testid="goal-save-error">{error}</p>}
        {status && <p className="success-text" role="status" data-testid="goal-save-success">{status}</p>}
      </form>

    <section className="panel-card" aria-labelledby="goal-difference-heading" data-testid="goal-comparison">
      <div className="row-between"><div><p className="plan-kicker">02 / DIFFERENCE</p><h2 className="section-title" id="goal-difference-heading">現在 → 目標の差</h2></div><span className={styles.previewTag}>{dirty ? '入力中のプレビュー' : '保存済みの目標'}</span></div>
        {(current.weightKg == null || current.bodyFatRate == null || current.heightCm == null) && <p className={styles.notice} data-testid="goal-missing-profile">比較に必要な身体情報が揃っていません。体脂肪率が不明なときは、別の測定日の値で補わず「未登録」として扱います。</p>}
        <Link className="plan-text-link" href="/#body-profile">身体情報を入力・確認する →</Link>
        {current.date && current.bodyFatRate == null && <p><Link className="plan-text-link" href="/dashboard#metric-date">体脂肪率を含む新しい測定を記録する →</Link></p>}
      {comparison ? <>
        <div className={styles.deltaGrid}>
          <div className="kpi">体重の差<strong data-testid="goal-weight-delta">{signed(comparison.weightDeltaKg, 'kg')}</strong></div>
          <div className="kpi">体脂肪率の差<strong data-testid="goal-fat-delta">{signed(comparison.fatDeltaPoints, 'ポイント')}</strong></div>
          <div className="kpi">目標BMI<strong data-testid="goal-target-bmi">{comparison.targetBmi == null ? '身長が未登録' : format(comparison.targetBmi, '')}</strong><small className="muted">体重と身長の指標（体脂肪率ではありません）</small></div>
        </div>
        {comparison.fatMassDeltaKg != null && comparison.fatFreeMassDeltaKg != null ? <div className={styles.composition} data-testid="goal-composition">
          <p><strong>体脂肪量（概算）</strong><br />{format(comparison.currentFatKg, 'kg')} → {format(comparison.targetFatKg, 'kg')} <span className="muted">（差 {signed(comparison.fatMassDeltaKg, 'kg')}）</span></p>
          <p><strong>除脂肪量（概算）</strong><br />{format(comparison.currentFatFreeKg, 'kg')} → {format(comparison.targetFatFreeKg, 'kg')} <span className="muted">（差 {signed(comparison.fatFreeMassDeltaKg, 'kg')}）</span></p>
        </div> : <p className="muted" data-testid="goal-composition-unknown">現在の体重と体脂肪率が揃うまで、体脂肪量・除脂肪量の変化は計算しません。</p>}
        <p className={styles.note}>体脂肪量＝体重×体脂肪率÷100、除脂肪量＝体重−体脂肪量。除脂肪量は水分・骨・臓器なども含み、筋肉量ではありません。これは入力値同士の算術比較で、実際の変化や到達時期の予測ではありません。</p>
      </> : <p className="muted" data-testid="goal-empty">目標体重と目標体脂肪率を入力すると、現在との差と運動例を確認できます。</p>}
    </section>

    <section className={`panel-card ${reasoning?.focus === 'caution' ? styles.caution : ''}`} aria-labelledby="goal-reasoning-heading" data-testid="goal-reasoning" data-focus={reasoning?.focus ?? 'empty'}>
      <p className="plan-kicker">03 / NEXT STEP</p><h2 className="section-title" id="goal-reasoning-heading">{reasoning?.label ?? '目標に合わせた、次の一歩'}</h2>
      {!reasoning ? <p className="muted">有効な目標を入力するとここに表示します。入力がない状態では、減量や筋力向上の方向を推測しません。</p> : <>
        <p className={styles.body} data-testid="goal-focus-description">{reasoning.description}</p>
        {reasoning.focus === 'general' && <Link href="/#body-profile" className="plan-text-link">身体情報を入力する →</Link>}
        {reasoning.activity && <p className={styles.notice} data-testid="goal-light-activity">{reasoning.activity}</p>}
        {reasoning.menu.length > 0 && <>
          <h3>週{trainingDays}日の全身メニュー例 · {equipment === 'gym' ? 'ジム' : 'ダンベル・自重'}</h3>
          <p className="muted">連日を避けた配置です。曜日は生活に合わせて移して構いません。休みの日を挟み、回数はフォームを保てる範囲に調整してください。</p>
          <div className={styles.days} data-testid="goal-menu">
            {reasoning.menu.map(day => <article className={styles.day} key={day.weekday} data-weekday={day.weekday}>
              <h4>{day.label}<span>全身 / {String.fromCharCode(65 + (reasoning.menu.indexOf(day) % 2))}</span></h4>
              <ul>{day.exercises.map(item => {
                const exercise = exerciseById.get(item.exerciseId)!;
                return <li key={item.exerciseId} data-exercise-id={item.exerciseId}><div className={styles.exerciseLine}><strong>{exercise.name}</strong><small>{muscleParts[exercise.part]}</small></div><span className={styles.dose}>{item.sets}セット × {item.reps}</span><small className="muted">{item.note}</small></li>;
              })}</ul>
            </article>)}
          </div>
          <p className={styles.note}>この種目・セット数・回数はアプリの開始例で、個別の処方ではありません。軽い準備運動から始め、セット間は呼吸とフォームが整うまで休みましょう。痛みや体調不良があれば中止してください。</p>
          <Link href="/plan" className="button-secondary" data-testid="goal-plan-link">週間プランで自分のメニューを組む →</Link>
          <p className={styles.note}>この例が週間プランを自動で上書きすることはありません。</p>
        </>}
      </>}
    </section>
    <aside className={`panel-card ${styles.notes}`} aria-label="利用上の注意と参考資料">
      <h2 className="section-title">数値は目安。体調をいちばんに。</h2>
      <p>成人向けの参考情報です（BMIの参照資料は20歳以上を対象とします）。診断・治療や達成の保証ではありません。測定値は同じ機器・時間帯など、できるだけ同じ条件で比べてください。健康上の不安がある場合は、医師などの資格を持つ専門家に相談してください。</p>
      <p>体重差±0.5 kg・体脂肪率差±1ポイント以内を「差が小さい」と表示します。これはアプリ上の整理であり、健康の判定基準ではありません。体脂肪率15%も健康上の境界ではなく、減少方向・比較元不明のときに提案を控えるためのアプリ独自のガードです。</p>
      <ul><li><a href="https://kennet.mhlw.go.jp/information/information/exercise/s-00-005.html" target="_blank" rel="noreferrer">厚生労働省：筋力トレーニング（週2〜3日の一般的な目安） ↗</a></li><li><a href="https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html" target="_blank" rel="noreferrer">CDC：成人のBMI区分（BMIはスクリーニングの指標） ↗</a></li></ul>
    </aside>
  </div>;
}
