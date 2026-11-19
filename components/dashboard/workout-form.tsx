// 種目・重量・回数を入力し、筋トレ記録として保存する。
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { localDate } from "@/lib/local-date";
import { requestJSON } from "@/lib/client-request";
import { useSubmission } from "@/components/use-submission";
import { ExerciseMuscles, ExerciseOptions } from "@/components/exercise-picker";
import { exerciseById } from "@/lib/exercises";

export function WorkoutForm() {
  const router = useRouter();
  const [date, setDate] = useState("");
  useEffect(() => { setDate(localDate()); }, []);
  const [message, setMessage] = useState("");
  const { pending, error, run } = useSubmission();
  const [exerciseId, setExerciseId] = useState("");


  return (
    <section className="panel-card">
      <h2 className="section-title">筋トレ記録</h2>
      <form
        className="form-grid"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          setMessage("");
          const form = event.currentTarget;
          const formData = new FormData(form);

          void run(async () => {
            await requestJSON("/api/workouts", {
                date: formData.get("date"),
                exerciseId: formData.get("exerciseId"),
                weightKg: formData.get("weightKg"),
                reps: formData.get("reps"),
                sets: formData.get("sets"),
                memo: formData.get("memo")
            });

            form.reset();
            setExerciseId("");
            setMessage("筋トレ記録を保存しました。アバター成長を再計算しています。");
            router.refresh();
          });
        }}
      >
        <fieldset className="submission-fields form-grid" disabled={pending} aria-label="筋トレ記録の入力">
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="workout-date">日付</label>
            <input id="workout-date" name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="workout-exercise">種目</label>
            <select id="workout-exercise" name="exerciseId" value={exerciseId} onChange={(event) => setExerciseId(event.target.value)} required>
              <ExerciseOptions />
            </select>
            <ExerciseMuscles exercise={exerciseById.get(exerciseId)} />
          </div>
        </div>

        <div className="form-grid two">
          <div className="field">
            <label htmlFor="weightKg">重量(kg)</label>
            <input id="weightKg" name="weightKg" type="number" step="0.1" min="0" required />
          </div>
        </div>

        <div className="form-grid two">
          <div className="field">
            <label htmlFor="reps">1セットの回数</label>
            <input id="reps" name="reps" type="number" min="1" required />
          </div>
          <div className="field">
            <label htmlFor="sets">セット数</label>
            <input id="sets" name="sets" type="number" min="1" required />
          </div>
        </div>

        <div className="field">
          <label htmlFor="memo">メモ</label>
          <textarea id="memo" name="memo" placeholder="フォーム・体感・次回の目標など" />
        </div>

        <button className="button" disabled={pending} type="submit">
          {pending ? "保存中..." : "筋トレ記録を保存"}
        </button>
        </fieldset>
      </form>
      {error ? <p role="alert" className="error-text">{error}</p> : null}
      {message ? <p role="status" className="success-text">{message}</p> : null}
    </section>
  );
}
