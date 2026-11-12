import { z } from "zod";

export const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
export const muscleParts = {
  chest: "胸", back: "背中", shoulders: "肩", arms: "腕", legs: "脚", core: "体幹"
};
const part = z.enum(["chest", "back", "shoulders", "arms", "legs", "core"]);
const exercise = z.object({
  name: z.string().trim().min(1, "種目名を入力してください。").max(120),
  part: part.nullable(),
  sets: z.number().int().min(1).max(100).nullable()
});
const months = z.number().int().min(1).max(60);
const mass = z.number().min(0.01).max(1000).nullable();
const pace = z.number().min(0).max(25).nullable();

export const planSchema = z.object({
  days: z.array(z.array(exercise).max(20)).length(7),
  currentMassKg: mass,
  paceKg: pace,
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

export function loadPlan(settings: unknown, latestMassKg: number | null): WeeklyPlan {
  const saved = planSchema.safeParse(settings);
  if (saved.success) return saved.data;
  const legacy = legacySchema.safeParse(settings);
  return {
    // Only menu names carry over. Body weight and muscle mass are different measurements.
    days: legacy.success ? legacy.data.days.map(({ menu }) =>
      menu ? [{ name: menu, part: null, sets: null }] : []) : weekdays.map(() => []),
    currentMassKg: latestMassKg, paceKg: null, upperPaceKg: null, targetMassKg: null,
    months: legacy.success ? legacy.data.months : 3
  };
}

export function analyzeMenu(days: WeeklyPlan["days"]) {
  const parts = part.options.map((key) => ({
    label: muscleParts[key],
    sets: days.flat().reduce((sum, item) => sum + (item.part === key ? item.sets ?? 0 : 0), 0),
    days: days.filter((items) => items.some((item) => item.part === key && item.sets != null)).length
  }));
  return {
    trainingDays: days.filter((items) => items.length > 0).length,
    sets: parts.reduce((sum, item) => sum + item.sets, 0),
    incomplete: days.flat().filter((item) => item.sets == null || item.part == null).length,
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
    // Median of slopes between readings at least a week apart reduces the effect of isolated spikes.
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
  const { currentMassKg, targetMassKg, paceKg, upperPaceKg } = plan;
  const upper = upperPaceKg ?? paceKg;
  const difference = currentMassKg != null && targetMassKg != null ? targetMassKg - currentMassKg : null;
  const goalAt = (rate: number | null) => difference == null ? null :
    difference <= 0 ? 0 : rate != null && rate > 0 ? difference / rate : null;

  function at(month: number) {
    if (currentMassKg == null || paceKg == null || upper == null || upper < paceKg) return null;
    const lowGain = month * paceKg;
    const highGain = month * upper;
    return { lowGain, highGain, lowMass: currentMassKg + lowGain, highMass: currentMassKg + highGain };
  }

  return { at, earliest: goalAt(upper), latest: goalAt(paceKg) };
}
