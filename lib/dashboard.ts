// Fetch records and prepare dashboard summaries and chart series.
import { apiGet } from "./api";
import type { BodyMetric, WorkoutLog } from "./record-types";
import { calculateAvatarSnapshot, getAvatarSilhouette } from "./avatar";
import { calculateStreak, calculateStrengthGrowth, growthRate } from "./growth";

function deriveBadges(workoutCount: number, streak: number, level: number) {
  const badges = [];

  if (workoutCount >= 1) badges.push("First Rep");
  if (workoutCount >= 10) badges.push("Consistency Builder");
  if (streak >= 3) badges.push("3-Day Streak");
  if (level >= 5) badges.push("Level 5 Lifter");

  return badges;
}

export async function getDashboardRecords() {
  const data = await apiGet<{
    workouts: Array<Omit<WorkoutLog, "date"> & { date: string }>;
    bodyMetrics: Array<Omit<BodyMetric, "date"> & { date: string }>;
  }>("/api/dashboard");
  if (!data) return null;
  const workouts = data.workouts.map((row) => ({ ...row, date: new Date(row.date) }));
  const bodyMetrics = data.bodyMetrics.map((row) => ({ ...row, date: new Date(row.date) }));

  return { workouts, bodyMetrics };
}

export async function getDashboardData() {
  const records = await getDashboardRecords();
  if (!records) return null;
  const { workouts, bodyMetrics } = records;
  const latestMetric = bodyMetrics[bodyMetrics.length - 1];
  const firstMetric = bodyMetrics[0];
  // Derive current and historical views with the same rules, including existing profiles.
  const avatar = calculateAvatarSnapshot(workouts, bodyMetrics);
  const measuredMuscles = bodyMetrics.filter((metric) => metric.muscleMassKg != null);

  const totalVolume = workouts.reduce((sum, workout) => sum + workout.weightKg * workout.reps * workout.sets, 0);
  const streak = calculateStreak(workouts.map((workout) => workout.date));
  const badges = deriveBadges(workouts.length, streak, avatar?.level ?? 1);

  const timelineDates = [...new Set([...workouts.map((workout) => workout.date.toISOString().slice(0, 10)), ...bodyMetrics.map((metric) => metric.date.toISOString().slice(0, 10))])].sort();

  const chartPoints = timelineDates.map((date) => {
    const currentWorkouts = workouts.filter((workout) => workout.date.toISOString().slice(0, 10) <= date);
    const currentMetrics = bodyMetrics.filter((metric) => metric.date.toISOString().slice(0, 10) <= date);
    const snapshot = calculateAvatarSnapshot(currentWorkouts, currentMetrics);
    const latestMetricAtDate = currentMetrics[currentMetrics.length - 1];

    return {
      date,
      realWeight: growthRate(firstMetric?.weightKg, latestMetricAtDate?.weightKg),
      muscleMass: growthRate(measuredMuscles[0]?.muscleMassKg,
        currentMetrics.filter((metric) => metric.muscleMassKg != null).at(-1)?.muscleMassKg),
      avatarPower: growthRate(10, snapshot.power),
      bodyShape: growthRate(10, snapshot.bodyShapeScore)
    };
  });

  const volumeByPartMap = new Map<string, number>();
  for (const workout of workouts) {
    const current = volumeByPartMap.get(workout.bodyPart) ?? 0;
    volumeByPartMap.set(workout.bodyPart, current + workout.weightKg * workout.reps * workout.sets);
  }

  const volumeByPart = [...volumeByPartMap.entries()].map(([bodyPart, volume]) => ({
    bodyPart,
    volume: Number(volume.toFixed(1))
  }));

  return {
    workouts,
    bodyMetrics,
    avatar,
    latestMetric,
    totalVolume: Number(totalVolume.toFixed(1)),
    streak,
    badges,
    silhouette: getAvatarSilhouette(avatar?.visualTier ?? 1),
    summary: {
      realWeightGrowthRate: growthRate(firstMetric?.weightKg, latestMetric?.weightKg),
      muscleGrowthRate: growthRate(measuredMuscles[0]?.muscleMassKg, measuredMuscles.at(-1)?.muscleMassKg),
      workoutStrengthGrowthRate: calculateStrengthGrowth(workouts),
      avatarPowerGrowthRate: growthRate(10, avatar?.power),
      avatarVisualGrowthRate: growthRate(10, avatar?.bodyShapeScore)
    },
    chartPoints,
    volumeByPart
  };
}
