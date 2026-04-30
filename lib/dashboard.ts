import { prisma } from "./prisma";
import { calculateAvatarSnapshot, getAvatarSilhouette } from "./avatar";

function growthRate(first: number | null | undefined, last: number | null | undefined) {
  if (first == null || last == null || first === 0) {
    return 0;
  }
  return Number((((last - first) / first) * 100).toFixed(1));
}

function calculateStreak(dates: Date[]) {
  if (dates.length === 0) return 0;

  const normalized = [...new Set(dates.map((date) => new Date(date).toDateString()))]
    .map((value) => new Date(value))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 1;
  for (let i = 0; i < normalized.length - 1; i += 1) {
    const diff = normalized[i].getTime() - normalized[i + 1].getTime();
    if (diff === 24 * 60 * 60 * 1000) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

function deriveBadges(workoutCount: number, streak: number, level: number) {
  const badges = [];

  if (workoutCount >= 1) badges.push("First Rep");
  if (workoutCount >= 10) badges.push("Consistency Builder");
  if (streak >= 3) badges.push("3-Day Streak");
  if (level >= 5) badges.push("Level 5 Lifter");

  return badges;
}

export async function getDashboardData(userId: string) {
  const [workouts, bodyMetrics, avatar] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { userId },
      orderBy: { date: "asc" }
    }),
    prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { date: "asc" }
    }),
    prisma.avatarProfile.findUnique({
      where: { userId }
    })
  ]);

  const latestMetric = bodyMetrics[bodyMetrics.length - 1];
  const firstMetric = bodyMetrics[0];
  const firstWorkout = workouts[0];
  const latestWorkout = workouts[workouts.length - 1];

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
      realWeight: latestMetricAtDate?.weightKg ?? null,
      muscleMass: latestMetricAtDate?.muscleMassKg ?? null,
      avatarPower: snapshot.power,
      bodyShape: snapshot.bodyShapeScore
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
      muscleGrowthRate: growthRate(firstMetric?.muscleMassKg, latestMetric?.muscleMassKg),
      workoutStrengthGrowthRate: growthRate(firstWorkout?.weightKg, latestWorkout?.weightKg),
      avatarPowerGrowthRate: growthRate(10, avatar?.power),
      avatarVisualGrowthRate: growthRate(10, avatar?.bodyShapeScore)
    },
    chartPoints,
    volumeByPart
  };
}
