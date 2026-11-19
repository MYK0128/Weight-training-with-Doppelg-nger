// 曜日ごとの種目を編集し、週間集計と筋肉量の試算を表示する。
"use client";

import { useState } from "react";
import { requestJSON } from "@/lib/client-request";
import { useSubmission } from "@/components/use-submission";
import Link from "next/link";
import { ExerciseMuscles, ExerciseOptions } from "@/components/exercise-picker";
import { exerciseById, muscleParts } from "@/lib/exercises";
import {
  analyzeMenu, exerciseRepetitions, planSchema, simulate, weekdays,
  type analyzeReadings, type Exercise, type WeeklyPlan
} from "@/lib/simulation";

const number = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });
const format = (value: number) => number.format(value);
const signed = (value: number) => (value > 0 ? "+" : "") + format(value);
const duration = (months: number) => months >= 12
  ? `${Math.floor(months / 12)}年${months % 12 ? `${months % 12}か月` : ""}`
  : `${months}か月`;
const eta = (months: number | null) => months == null ? "到達しない" :
  months === 0 ? "到達済み" : months > 60 ? "5年超" : `約${duration(Math.ceil(months - 1e-10) || 1)}`;
const range = (low: number, high: number, formatter = format) =>
  formatter(low) === formatter(high) ? formatter(low) : `${formatter(low)}〜${formatter(high)}`;

export function PlanEditor({ initial, history }: {
  initial: WeeklyPlan; history: ReturnType<typeof analyzeReadings>;
}) {
  const [plan, setPlan] = useState(initial);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const { pending: saving, error: requestError, run } = useSubmission();
  // 入力中も集計と試算は更新し、保存ボタンを押したときだけAPIに送る。
  const parsed = planSchema.safeParse(plan);
  const menu = analyzeMenu(plan.days);
  const result = simulate(plan);
  const milestones = [...new Set([1, 3, 6, 12, 24, 36, 48, 60, plan.months])]
    .filter((month) => month <= plan.months).sort((a, b) => a - b);

  function change<K extends keyof WeeklyPlan>(key: K, value: WeeklyPlan[K]) {
    setStatus("");
    setError("");
    setPlan((previous) => ({ ...previous, [key]: value }));
  }

  function updateDay(index: number, items: Exercise[]) {
    change("days", plan.days.map((day, i) => i === index ? items : day));
  }

  async function save() {
    setError("");
    setStatus("");
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力を確認してください。");
      return;
    }
    await run(async () => {
      await requestJSON("/api/weekly-plan", parsed.data, "PUT");
      setStatus("週間プランを保存しました。");
    });
  }

  function numericField(label: string, key: "currentMassKg" | "targetMassKg" | "paceKg" | "upperPaceKg") {
    const isPace = key === "paceKg" || key === "upperPaceKg";
    return <label className="field"><span>{label}</span>
      <input type="number" min={isPace ? 0 : 0.01} max={isPace ? 25 : 1000} step="any" value={plan[key] ?? ""}
        onChange={(event) => change(key, Number.isNaN(event.target.valueAsNumber) ? null : event.target.valueAsNumber)} />
    </label>;
  }

  return (
    <form className="plan-grid" aria-busy={saving} onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset className="panel-card plan-fieldset" disabled={saving}>
        <p className="plan-kicker">01 / WEEKLY MENU</p>
        <h2 className="section-title">1週間のメニュー</h2>
        <p className="muted">種目を選び、1セットの回数とセット数を入力します。ウォームアップは含めません。</p>
        <div className="plan-days">
          {plan.days.map((items, index) => (
            <section className="plan-menu-day" key={weekdays[index]} aria-label={weekdays[index] + "曜日"}>
              <div className="row-between">
                <strong>{weekdays[index]}曜 <small className="muted">{items.length ? `${items.length}種目` : "休み"}</small></strong>
                <button type="button" className="button-secondary plan-small-button" disabled={items.length >= 20}
                  aria-label={weekdays[index] + "曜に種目を追加"}
                  onClick={() => updateDay(index, [...items, { name: "", part: null, reps: null, sets: null }])}>＋ 種目</button>
              </div>
              {items.map((item, i) => {
                const update = (patch: Partial<Exercise>) => updateDay(index, items.map((entry, j) => j === i ? { ...entry, ...patch } : entry));
                const prefix = weekdays[index] + `曜の種目${i + 1}`;
                const selected = item.exerciseId ? exerciseById.get(item.exerciseId) : undefined;
                const legacy = !selected && item.name ? item.name : undefined;
                const repetitions = exerciseRepetitions(item);
                return <div className="plan-exercise" key={i}>
                  <label className="field"><span>種目</span><select aria-label={prefix} required
                    value={selected?.id ?? (legacy ? "legacy" : "")}
                    onChange={(event) => {
                      const choice = exerciseById.get(event.target.value);
                      if (choice) update({ exerciseId: choice.id, name: choice.name, part: choice.part });
                      else if (event.target.value === "") update({ exerciseId: undefined, name: "", part: null });
                    }}>
                    <ExerciseOptions legacyName={legacy} />
                  </select></label>
                  <label className="field"><span>回数／セット</span><input aria-label={prefix + "の1セットの回数"} type="number" min="1" max="1000" required={!!selected} value={item.reps ?? ""}
                    onChange={(event) => update({ reps: Number.isNaN(event.target.valueAsNumber) ? null : event.target.valueAsNumber })} /></label>
                  <label className="field"><span>セット数</span><input aria-label={prefix + "のセット数"} type="number" min="1" max="100" required={!!selected} value={item.sets ?? ""}
                    onChange={(event) => update({ sets: Number.isNaN(event.target.valueAsNumber) ? null : event.target.valueAsNumber })} /></label>
                  <button type="button" className="button-secondary plan-small-button" aria-label={prefix + "を削除"}
                    onClick={() => updateDay(index, items.filter((_, j) => j !== i))}>×</button>
                  <ExerciseMuscles exercise={selected} />
                  {legacy && <small className="muted exercise-muscles">以前の記録{item.part ? ` ／ 主：${muscleParts[item.part]}` : " ／ 部位未設定"}</small>}
                  {repetitions != null && <small className="exercise-muscles">合計 {format(repetitions)} 回</small>}
                </div>;
              })}
            </section>
          ))}
        </div>
        <h3>部位別の週間セット</h3>
        <div className="plan-parts">{menu.parts.map((part) => <div className="kpi" key={part.label}>
          {part.label}<strong>{part.sets} セット</strong><small className="muted">週 {part.days} 日・{format(part.repetitions)} 回</small>
        </div>)}</div>
        <p className="muted">週{menu.trainingDays}日・部位別計{menu.sets}セット・週間総回数 {format(menu.repetitions)} 回。
          {menu.incomplete > 0 && ` 部位かセット数が未入力の${menu.incomplete}種目は部位別集計外です。`}
          {menu.incompleteRepetitions > 0 && ` 総回数は入力済みの種目のみ（未入力 ${menu.incompleteRepetitions}件）。`}
        </p>
        <button type="submit" className="button">{saving ? "保存中…" : "週間プランを保存"}</button>
        {status && <p className="success-text" role="status">{status}</p>}
        {(error || requestError) && <p className="error-text" role="alert">{error || requestError}</p>}
      </fieldset>

      <details className="panel-card plan-scenario" onInvalidCapture={(event) => { event.currentTarget.open = true; }}>
        <summary>筋肉量の記録・試算（任意）</summary>
        <fieldset className="submission-fields plan-fieldset" disabled={saving} aria-label="筋肉量の記録・試算">
        <h2 className="section-title">筋肉量の変化</h2>
        <div className="plan-goal">
          <span>最新の実測</span>
          <strong>{history.latest ? `${format(history.latest.kg)} kg` : "測定記録なし"}</strong>
          {history.latest && <span>{history.latest.date} · 最新測定までの90日間に {history.readings.length}日分</span>}
          {history.deltaKg != null && <span>{history.spanDays}日間の実測差：{signed(history.deltaKg)} kg</span>}
          <span>{history.paceKg == null ? "月あたりの傾向は、4週間以上にわたる3日分以上の記録から表示します。"
            : `実測の傾向：月あたり ${signed(history.paceKg)} kg（過去の測定値から計算）`}</span>
        </div>
        {history.readings.length > 0 && <details className="plan-options">
          <summary>実測の履歴を見る</summary>
          <table className="plan-table">
            <thead><tr><th scope="col">測定日</th><th scope="col">筋肉量（kg）</th></tr></thead>
            <tbody>{history.readings.slice().reverse().map(({ date, kg }) =>
              <tr key={date}><th scope="row">{date}</th><td>{format(kg)}</td></tr>)}</tbody>
          </table>
        </details>}
        <Link href="/dashboard" className="plan-text-link">身体情報を記録する</Link>
        <h3>増加シナリオ</h3>
        <div className="form-grid two">
          {numericField("現在の筋肉量（kg）", "currentMassKg")}
          {numericField("仮定する月あたりの増加（kg）", "paceKg")}
          <label className="field"><span>試算期間</span><select value={plan.months} onChange={(event) => change("months", Number(event.target.value))}>
            {Array.from({ length: 60 }, (_, i) => i + 1).map((month) => <option key={month} value={month}>{duration(month)}</option>)}
          </select></label>
        </div>
        {history.latest && plan.currentMassKg !== history.latest.kg &&
          <button type="button" className="button-secondary plan-latest" onClick={() => change("currentMassKg", history.latest?.kg ?? null)}>最新の実測値を使う</button>}
        <details className="plan-options">
          <summary>総回数での補正・増加幅・目標（任意）</summary>
          <div className="form-grid two">
            <label className="field"><span>基準の週間総回数（回）</span>
              <input type="number" min="1" max="14000000" value={plan.referenceReps ?? ""}
                onChange={(event) => change("referenceReps", Number.isNaN(event.target.valueAsNumber) ? null : event.target.valueAsNumber)} />
            </label>
            {numericField("月あたりの増加の上限（kg）", "upperPaceKg")}
            {numericField("目標筋肉量（kg）", "targetMassKg")}
          </div>
          {menu.repetitions > 0 && menu.incompleteRepetitions === 0 &&
            <button type="button" className="button-secondary plan-latest" onClick={() => change("referenceReps", menu.repetitions)}>
              現在のメニュー（週{format(menu.repetitions)}回）を基準にする
            </button>}
          <p className="muted plan-note">入力した増加ペースを、基準回数をこなした場合のペースとして扱います。予定の週間総回数が基準の半分なら、試算上の増加量も半分になります。基準以上は上乗せしません。</p>
          {plan.targetMassKg != null && plan.currentMassKg != null && result.paceKg != null && parsed.success &&
            <p>目標まで：{result.earliest === result.latest ? eta(result.latest) :
              `${eta(result.earliest)}〜${result.latest == null ? "下限ペースでは未到達" : eta(result.latest)}`}</p>}
        </details>
        {plan.referenceReps != null && (result.ratio == null
          ? <p className="error-text">補正には有効な基準回数と、全種目の回数・セット数が必要です。</p>
          : <p className="muted">基準 {format(plan.referenceReps)} 回／週に対し、試算へ反映する割合は {format(result.ratio * 100)}% です。</p>)}
        {plan.upperPaceKg != null && (plan.paceKg == null || plan.upperPaceKg < plan.paceKg) &&
          <p className="error-text">上限は基本ペース以上にしてください。</p>}
        <div className="plan-table-wrap">
          <table className="plan-table">
            <caption>期間別の筋肉量（仮定）</caption>
            <thead><tr><th scope="col">経過</th><th scope="col">増加量（kg）</th><th scope="col">筋肉量（kg）</th></tr></thead>
            <tbody>{milestones.map((month) => {
              const row = result.at(month);
              return <tr key={month}><th scope="row">{duration(month)}</th>
                <td>{row ? range(row.lowGain, row.highGain, signed) : "—"}</td>
                <td>{row ? range(row.lowMass, row.highMass) : "—"}</td></tr>;
            })}</tbody>
          </table>
        </div>
        <p className="muted plan-note">回数とセット数だけで実際の筋肉の増加量は予測できません。ここでは入力したペースと練習量が続くと仮定して試算します。測定値は同じ機器・条件で比べてください。</p>
        </fieldset>
      </details>
    </form>
  );
}
