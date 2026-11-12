"use client";

import { useState } from "react";
import Link from "next/link";
import {
  analyzeMenu, muscleParts, planSchema, simulate, weekdays,
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
  const [saving, setSaving] = useState(false);
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
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力を確認してください。");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/weekly-plan", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data)
      });
      if (!response.ok) throw new Error("save failed");
      setStatus("週間プランを保存しました。");
    } catch {
      setError("保存できませんでした。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  function numericField(label: string, key: "currentMassKg" | "targetMassKg" | "paceKg" | "upperPaceKg") {
    const isPace = key === "paceKg" || key === "upperPaceKg";
    return <label className="field"><span>{label}</span>
      <input type="number" min={isPace ? 0 : 0.01} max={isPace ? 25 : 1000} step="any" value={plan[key] ?? ""}
        onChange={(event) => change(key, Number.isNaN(event.target.valueAsNumber) ? null : event.target.valueAsNumber)} />
    </label>;
  }

  return (
    <form className="plan-grid" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset className="panel-card plan-fieldset" disabled={saving}>
        <p className="plan-kicker">01 / WEEKLY MENU</p>
        <h2 className="section-title">1週間のメニュー</h2>
        <p className="muted">鍛える日に種目を追加。セット数にはウォームアップを含めません。</p>
        <div className="plan-days">
          {plan.days.map((items, index) => (
            <section className="plan-menu-day" key={weekdays[index]} aria-label={weekdays[index] + "曜日"}>
              <div className="row-between">
                <strong>{weekdays[index]}曜 <small className="muted">{items.length ? `${items.length}種目` : "休み"}</small></strong>
                <button type="button" className="button-secondary plan-small-button" disabled={items.length >= 20}
                  aria-label={weekdays[index] + "曜に種目を追加"}
                  onClick={() => updateDay(index, [...items, { name: "", part: null, sets: null }])}>＋ 種目</button>
              </div>
              {items.map((item, i) => {
                const update = (patch: Partial<Exercise>) => updateDay(index, items.map((entry, j) => j === i ? { ...entry, ...patch } : entry));
                const prefix = weekdays[index] + `曜の種目${i + 1}`;
                return <div className="plan-exercise" key={i}>
                  <label className="field"><span>種目名</span><input aria-label={prefix + "の名前"} placeholder="例：スクワット" value={item.name} maxLength={120} required
                    onChange={(event) => update({ name: event.target.value })} /></label>
                  <label className="field"><span>主部位</span><select aria-label={prefix + "の主部位"} value={item.part ?? ""}
                    onChange={(event) => update({ part: (event.target.value || null) as Exercise["part"] })}>
                    <option value="">未設定</option>
                    {Object.entries(muscleParts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select></label>
                  <label className="field"><span>セット</span><input aria-label={prefix + "のセット数"} type="number" min="1" max="100" value={item.sets ?? ""}
                    onChange={(event) => update({ sets: Number.isNaN(event.target.valueAsNumber) ? null : event.target.valueAsNumber })} /></label>
                  <button type="button" className="button-secondary plan-small-button" aria-label={prefix + "を削除"}
                    onClick={() => updateDay(index, items.filter((_, j) => j !== i))}>×</button>
                </div>;
              })}
            </section>
          ))}
        </div>
        <h3>部位別の週間セット</h3>
        <div className="plan-parts">{menu.parts.map((part) => <div className="kpi" key={part.label}>
          {part.label}<strong>{part.sets} セット</strong><small className="muted">週 {part.days} 日</small>
        </div>)}</div>
        <p className="muted">週{menu.trainingDays}日・計{menu.sets}セット。主部位のみ集計。
          {menu.incomplete > 0 && ` 部位かセット数が未入力の${menu.incomplete}種目は集計外です。`}
        </p>
        <button type="submit" className="button">{saving ? "保存中…" : "週間プランを保存"}</button>
        {status && <p className="success-text" role="status">{status}</p>}
        {error && <p className="error-text" role="alert">{error}</p>}
      </fieldset>

      <fieldset className="panel-card plan-fieldset" disabled={saving}>
        <p className="plan-kicker">02 / MUSCLE MASS</p>
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
          <summary>増加幅・目標を設定（任意）</summary>
          <div className="form-grid two">
            {numericField("月あたりの増加の上限（kg）", "upperPaceKg")}
            {numericField("目標筋肉量（kg）", "targetMassKg")}
          </div>
          {plan.targetMassKg != null && plan.currentMassKg != null && plan.paceKg != null && parsed.success &&
            <p>目標まで：{result.earliest === result.latest ? eta(result.latest) :
              `${eta(result.earliest)}〜${result.latest == null ? "下限ペースでは未到達" : eta(result.latest)}`}</p>}
        </details>
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
        <p className="muted plan-note">セット数は練習量の目安です。kgの予測には使いません。シナリオは入力したペースが続くと仮定した計算で、長期ほど実測との差が広がり得ます。測定値は同じ機器・条件で比べてください。</p>
      </fieldset>
    </form>
  );
}
