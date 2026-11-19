// 体重や筋肉量などの身体測定値を入力して保存する。
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { localDate } from "@/lib/local-date";
import { requestJSON } from "@/lib/client-request";
import { useSubmission } from "@/components/use-submission";

export function BodyMetricForm() {
  const router = useRouter();
  const [date, setDate] = useState("");
  useEffect(() => { setDate(localDate()); }, []);
  const [message, setMessage] = useState("");
  const { pending, error, run } = useSubmission();

  return (
    <section className="panel-card">
      <h2 className="section-title">身体情報記録</h2>
      <form
        className="form-grid"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          setMessage("");
          const form = event.currentTarget;
          const formData = new FormData(form);

          void run(async () => {
            await requestJSON("/api/body-metrics", {
                date: formData.get("date"),
                weightKg: formData.get("weightKg"),
                bodyFatRate: formData.get("bodyFatRate"),
                muscleMassKg: formData.get("muscleMassKg"),
                chestCm: formData.get("chestCm"),
                armCm: formData.get("armCm"),
                legCm: formData.get("legCm")
            });

            form.reset();
            setMessage("身体情報を保存しました。アバター体型パラメータを更新しました。");
            router.refresh();
          });
        }}
      >
        <fieldset className="submission-fields form-grid" disabled={pending} aria-label="身体情報の入力">
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="metric-date">日付</label>
            <input id="metric-date" name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="metric-weightKg">体重(kg)</label>
            <input id="metric-weightKg" name="weightKg" type="number" step="0.1" min="1" required />
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
        </fieldset>
      </form>
      {error ? <p role="alert" className="error-text">{error}</p> : null}
      {message ? <p role="status" className="success-text">{message}</p> : null}
    </section>
  );
}
