"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function BodyMetricForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="panel-card">
      <h2 className="section-title">身体情報記録</h2>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage("");
          setError("");
          const form = event.currentTarget;
          const formData = new FormData(form);

          startTransition(async () => {
            const response = await fetch("/api/body-metrics", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                date: formData.get("date"),
                weightKg: formData.get("weightKg"),
                bodyFatRate: formData.get("bodyFatRate"),
                muscleMassKg: formData.get("muscleMassKg"),
                chestCm: formData.get("chestCm"),
                armCm: formData.get("armCm"),
                legCm: formData.get("legCm")
              })
            });

            const data = await response.json();
            if (!response.ok) {
              setError(data.error ?? "保存に失敗しました");
              return;
            }

            form.reset();
            setMessage("身体情報を保存しました。アバター体型パラメータを更新しました。");
            router.refresh();
          });
        }}
      >
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="metric-date">日付</label>
            <input id="metric-date" name="date" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="weightKg">体重(kg)</label>
            <input id="weightKg" name="weightKg" type="number" step="0.1" min="1" required />
          </div>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="bodyFatRate">体脂肪率(任意)</label>
            <input id="bodyFatRate" name="bodyFatRate" type="number" step="0.1" min="0" max="100" />
          </div>
          <div className="field">
            <label htmlFor="muscleMassKg">筋肉量(任意)</label>
            <input id="muscleMassKg" name="muscleMassKg" type="number" step="0.1" min="0" />
          </div>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="chestCm">胸囲(cm)</label>
            <input id="chestCm" name="chestCm" type="number" step="0.1" min="0" />
          </div>
          <div className="field">
            <label htmlFor="armCm">腕囲(cm)</label>
            <input id="armCm" name="armCm" type="number" step="0.1" min="0" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="legCm">脚囲(cm)</label>
          <input id="legCm" name="legCm" type="number" step="0.1" min="0" />
        </div>
        <button className="button" disabled={pending} type="submit">
          {pending ? "保存中..." : "身体情報を保存"}
        </button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}
    </section>
  );
}
