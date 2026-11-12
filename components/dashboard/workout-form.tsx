// 種目・重量・回数を入力し、筋トレ記録として保存する。
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExerciseMuscles, ExerciseOptions } from "@/components/exercise-picker";
import { exerciseById } from "@/lib/exercises";

export function WorkoutForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="panel-card">
      <h2 className="section-title">筋トレ記録</h2>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage("");
          setError("");
          const form = event.currentTarget;
          const formData = new FormData(form);

          startTransition(async () => {
            const response = await fetch("/api/workouts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                date: formData.get("date"),
                exerciseId: formData.get("exerciseId"),
                weightKg: formData.get("weightKg"),
                reps: formData.get("reps"),
                sets: formData.get("sets"),
                memo: formData.get("memo")
              })
            });

            const data = await response.json();
            if (!response.ok) {
              setError(data.error ?? "保存に失敗しました");
              return;
            }

            form.reset();
            setExerciseId("");
            setMessage("筋トレ記録を保存しました。アバター成長を再計算しています。");
            router.refresh();
          });
        }}
      >
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="workout-date">日付</label>
            <input id="workout-date" name="date" type="date" required />
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
      </form>
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}
    </section>
  );
}
