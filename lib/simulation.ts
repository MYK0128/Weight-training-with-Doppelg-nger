// 週間プランを検証し、練習量の集計と筋肉量の試算を行う。
import { z } from "zod";
import { exerciseById, findExerciseByName, muscleParts } from "./exercises";

export const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
const part = z.enum(["chest", "back", "shoulders", "arms", "legs", "core"]);
const exercise = z.object({
  exerciseId: z.string().refine((id) => exerciseById.has(id), "一覧から種目を選んでください。").optional(),
  name: z.string().trim().min(1, "一覧から種目を選んでください。").max(120),
  part: part.nullable(),
  reps: z.number().int().min(1).max(1000).nullable().optional(),
  sets: z.number().int().min(1).max(100).nullable()
});
const months = z.number().int().min(1).max(60);
const mass = z.number().min(0.01).max(1000).nullable();
const pace = z.number().min(0).max(25).nullable();

export const planSchema = z.object({
  days: z.array(z.array(exercise).max(20)).length(7),
  currentMassKg: mass,
  paceKg: pace,
  referenceReps: z.number().int().min(1).max(14_000_000).nullable().optional(),
  upperPaceKg: pace,
  targetMassKg: mass,
  months
}).refine(({ paceKg, upperPaceKg }) => upperPaceKg == null ||
  (paceKg != null && upperPaceKg >= paceKg), {
  message: "増加ペースの上限は、基本ペース以上にしてください。"
});

export type WeeklyPlan = z.infer<typeof planSchema>;
export type Exercise = z.infer<typeof exercise>;

const legacySchema = z.object({
  days: z.array(z.object({ menu: z.string().trim().max(120) })).length(7),
  months
});

// 保存済みのプランを読み込み、旧名称も分かる範囲で種目一覧に結びつける。
export function loadPlan(settings: unknown, latestMassKg: number | null): WeeklyPlan {
  const saved = planSchema.safeParse(settings);
  const resolve = (item: Exercise) => {
    const selected = item.exerciseId ? exerciseById.get(item.exerciseId) : findExerciseByName(item.name);
    return selected ? { ...item, exerciseId: selected.id, name: selected.name, part: selected.part } : item;
  };
  if (saved.success) return { ...saved.data, days: saved.data.days.map((day) => day.map(resolve)) };
  const legacy = legacySchema.safeParse(settings);
  return {
    // 旧形式の体重は筋肉量として引き継がない。
    days: legacy.success ? legacy.data.days.map(({ menu }) =>
      menu ? [resolve({ name: menu, part: null, sets: null })] : []) : weekdays.map(() => []),
    currentMassKg: latestMassKg, paceKg: null, upperPaceKg: null, targetMassKg: null,
    months: legacy.success ? legacy.data.months : 3
  };
}

// 1セットの回数 × セット数。未入力や無効な値は0回と区別する。
export function exerciseRepetitions(item: Exercise) {
  return item.reps != null && item.sets != null && Number.isInteger(item.reps) && Number.isInteger(item.sets) &&
    item.reps >= 1 && item.reps <= 1000 && item.sets >= 1 && item.sets <= 100
    ? item.reps * item.sets : null;
}

// 週間の総回数は全種目を合算し、部位別では主部位にだけ加算する。
export function analyzeMenu(days: WeeklyPlan["days"]) {
  const items = days.flat();
  const parts = part.options.map((key) => ({
    label: muscleParts[key],
    sets: items.reduce((sum, item) => sum + (item.part === key ? item.sets ?? 0 : 0), 0),
    repetitions: items.reduce((sum, item) => sum + (item.part === key ? exerciseRepetitions(item) ?? 0 : 0), 0),
    days: days.filter((items) => items.some((item) => item.part === key && item.sets != null)).length
  }));
  return {
    trainingDays: days.filter((items) => items.length > 0).length,
    sets: parts.reduce((sum, item) => sum + item.sets, 0),
    incomplete: items.filter((item) => item.sets == null || item.part == null).length,
    repetitions: items.reduce((sum, item) => sum + (exerciseRepetitions(item) ?? 0), 0),
    incompleteRepetitions: items.filter((item) => exerciseRepetitions(item) == null).length,
    parts
  };
}

const dayMs = 86_400_000;
export type MuscleReading = { date: string; kg: number };

export function analyzeReadings(readings: MuscleReading[]) {
  const ordered = [...new Map(readings.filter(({ kg }) => Number.isFinite(kg) && kg > 0)
    .map((reading) => [reading.date, reading])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered.at(-1);
  if (!latest) return { latest: null, readings: [], spanDays: 0, deltaKg: null, paceKg: null };
  const recent = ordered.filter(({ date }) => Date.parse(latest.date) - Date.parse(date) <= 90 * dayMs);
  const first = recent[0];
  const spanDays = (Date.parse(latest.date) - Date.parse(first.date)) / dayMs;
  const slopes: number[] = [];
  if (recent.length >= 3 && spanDays >= 28) {
    // 7日以上離れた測定ペアの増減を月換算し、中央値で一時的な変動の影響を抑える。
    recent.forEach((start, i) => recent.slice(i + 1).forEach((end) => {
      const days = (Date.parse(end.date) - Date.parse(start.date)) / dayMs;
      if (days >= 7) slopes.push((end.kg - start.kg) * 30.4375 / days);
    }));
  }
  slopes.sort((a, b) => a - b);
  const middle = Math.floor(slopes.length / 2);
  const paceKg = slopes.length === 0 ? null :
    slopes.length % 2 === 1 ? slopes[middle] : (slopes[middle - 1] + slopes[middle]) / 2;
  return { latest, readings: recent, spanDays, deltaKg: spanDays ? latest.kg - first.kg : null, paceKg };
}

export function simulate(plan: WeeklyPlan) {
  const { currentMassKg, targetMassKg, referenceReps } = plan;
  const menu = analyzeMenu(plan.days);
  // 基準回数を設定した場合だけ、入力されたペースを達成割合（上限100%）で補正する。
  // 実際の筋肉の増加量を予測する式ではない。回数が未入力なら補正結果を出さない。
  const ratio = referenceReps == null ? 1 :
    menu.incompleteRepetitions > 0 || !Number.isInteger(referenceReps) || referenceReps < 1 || referenceReps > 14_000_000
      ? null : Math.min(1, menu.repetitions / referenceReps);
  const paceKg = plan.paceKg != null && ratio != null ? plan.paceKg * ratio : null;
  const upperPaceKg = plan.upperPaceKg != null && ratio != null ? plan.upperPaceKg * ratio : null;
  const upper = upperPaceKg ?? paceKg;
  const difference = currentMassKg != null && targetMassKg != null ? targetMassKg - currentMassKg : null;
  const goalAt = (rate: number | null) => difference == null ? null :
    difference <= 0 ? 0 : rate != null && rate > 0 ? difference / rate : null;

  function at(month: number) {
    if (currentMassKg == null || paceKg == null || upper == null ||
      (plan.upperPaceKg != null && plan.paceKg != null && plan.upperPaceKg < plan.paceKg)) return null;
    const lowGain = month * paceKg;
    const highGain = month * upper;
    return { lowGain, highGain, lowMass: currentMassKg + lowGain, highMass: currentMassKg + highGain };
  }

  return { at, ratio, paceKg, earliest: goalAt(upper), latest: goalAt(paceKg) };
}
