// Calculate percentage change, streaks, and strength trends by exercise.
import { findExerciseByName } from "./exercises";

type StrengthRecord = { exerciseName: string; weightKg: number; date: Date };

export function growthRate(first: number | null | undefined, last: number | null | undefined) {
  if (first == null || last == null || first <= 0) return null;
  return Number((((last - first) / first) * 100).toFixed(1));
}

export function calculateStreak(dates: Date[], now = new Date()) {
  // Records are calendar dates stored at UTC midnight; today follows Japan time.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  const todayDay = Date.parse(today) / 86400000;
  const days = [...new Set(dates.map((date) => Date.parse(date.toISOString().slice(0, 10)) / 86400000))]
    .filter((day) => day <= todayDay).sort((a, b) => b - a);
  if (!days.length || todayDay - days[0] > 1) return 0;
  let streak = 1;
  while (streak < days.length && days[streak - 1] - days[streak] === 1) streak++;
  return streak;
}

export function calculateStrengthGrowth(workouts: StrengthRecord[]) {
  const groups = new Map<string, StrengthRecord[]>();
  for (const workout of workouts) {
    const selected = findExerciseByName(workout.exerciseName);
    const key = selected ? `catalog:${selected.id}` : `legacy:${workout.exerciseName.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), workout]);
  }
  const rates: number[] = [];
  for (const records of groups.values()) {
    records.sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstDay = records[0].date.toISOString().slice(0, 10);
    const lastDay = records[records.length - 1].date.toISOString().slice(0, 10);
    if (firstDay === lastDay) continue;
    const first = Math.max(...records.filter((r) => r.date.toISOString().slice(0, 10) === firstDay).map((r) => r.weightKg));
    const last = Math.max(...records.filter((r) => r.date.toISOString().slice(0, 10) === lastDay).map((r) => r.weightKg));
    const rate = growthRate(first, last);
    if (rate != null) rates.push(rate);
  }
  return rates.length ? Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1)) : null;
}
