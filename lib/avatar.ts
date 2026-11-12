// Derive avatar stats and proportions from workout and body records.
import type { BodyMetric, WorkoutLog } from "./record-types";

type StatMap = Record<"chest" | "arms" | "legs" | "endurance", number>;

function mapBodyPart(part: string): keyof StatMap {
  switch (part) {
    case "CHEST":
      return "chest";
    case "ARMS":
      return "arms";
    case "LEGS":
      return "legs";
    default:
      return "endurance";
  }
}

function growthTier(shapeScore: number) {
  if (shapeScore >= 60) return 5;
  if (shapeScore >= 45) return 4;
  if (shapeScore >= 30) return 3;
  if (shapeScore >= 18) return 2;
  return 1;
}

export function calculateAvatarSnapshot(workouts: WorkoutLog[], bodyMetrics: BodyMetric[]) {
  const stats: StatMap = {
    chest: 10,
    arms: 10,
    legs: 10,
    endurance: 10
  };

  let experience = 0;

  for (const workout of workouts) {
    const volume = workout.weightKg * workout.reps * workout.sets;
    const target = mapBodyPart(workout.bodyPart);
    stats[target] += volume / 180;
    experience += Math.round(volume / 20 + workout.sets * 5);
  }

  const firstMetric = bodyMetrics[0];
  const latestMetric = bodyMetrics[bodyMetrics.length - 1];

  const realGrowthWeight = firstMetric && latestMetric ? latestMetric.weightKg - firstMetric.weightKg : 0;
  const realGrowthMuscle =
    firstMetric?.muscleMassKg != null && latestMetric?.muscleMassKg != null
      ? latestMetric.muscleMassKg - firstMetric.muscleMassKg
      : 0;

  const bodyShapeScore =
    10 +
    (stats.chest + stats.arms + stats.legs - 30) / 3 +
    Math.max(0, realGrowthWeight * 2) +
    Math.max(0, realGrowthMuscle * 5) +
    (latestMetric?.chestCm ?? 0) * 0.03 +
    (latestMetric?.armCm ?? 0) * 0.04 +
    (latestMetric?.legCm ?? 0) * 0.025;

  const power = (stats.chest + stats.arms + stats.legs + stats.endurance) / 4 + experience / 150;
  const level = Math.max(1, Math.floor(Math.sqrt(experience / 20)) + 1);
  const visualTier = growthTier(bodyShapeScore);

  return {
    level,
    experience,
    power: Number(power.toFixed(1)),
    chestStat: Number(stats.chest.toFixed(1)),
    armStat: Number(stats.arms.toFixed(1)),
    legStat: Number(stats.legs.toFixed(1)),
    enduranceStat: Number(stats.endurance.toFixed(1)),
    bodyShapeScore: Number(bodyShapeScore.toFixed(1)),
    visualTier
  };
}

export function getAvatarSilhouette(visualTier: number, stats?: { chestStat: number; armStat: number; legStat: number }) {
  const tiers = [
    {
      label: "Starter",
      shoulders: 88,
      chest: 78,
      waist: 56,
      arms: 14,
      legs: 24
    },
    {
      label: "Bronze Bulk",
      shoulders: 96,
      chest: 84,
      waist: 54,
      arms: 17,
      legs: 27
    },
    {
      label: "Silver Power",
      shoulders: 104,
      chest: 91,
      waist: 52,
      arms: 19,
      legs: 30
    },
    {
      label: "Gold Beast",
      shoulders: 114,
      chest: 98,
      waist: 49,
      arms: 22,
      legs: 33
    },
    {
      label: "Mythic Titan",
      shoulders: 126,
      chest: 108,
      waist: 46,
      arms: 25,
      legs: 37
    }
  ];

  const base = tiers[0];
  const tier = tiers[Math.min(tiers.length - 1, Math.max(0, visualTier - 1))];
  if (!stats) return tier;
  // Independent, capped dimensions make the trained body part visible without SVG overflow.
  const gain = (stat: number, cap: number) => Math.min(cap, Math.max(0, stat - 10) * 0.4);
  return { ...base, label: tier.label,
    shoulders: base.shoulders + gain(stats.chestStat, 38),
    chest: base.chest + gain(stats.chestStat, 30),
    arms: base.arms + gain(stats.armStat, 11),
    legs: base.legs + gain(stats.legStat, 13)
  };
}
