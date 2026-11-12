import { Prisma, PrismaClient } from "@prisma/client";
import { recomputeAvatarProfile } from "./avatar";

export function saveWorkout(db: PrismaClient, data: Prisma.WorkoutLogUncheckedCreateInput) {
  // The record and its derived avatar must either both commit or both roll back.
  return db.$transaction(async (tx) => {
    const saved = await tx.workoutLog.create({ data });
    await recomputeAvatarProfile(tx, data.userId);
    return saved;
  });
}

export function saveBodyMetric(db: PrismaClient, data: Prisma.BodyMetricUncheckedCreateInput) {
  return db.$transaction(async (tx) => {
    const saved = await tx.bodyMetric.create({ data });
    await recomputeAvatarProfile(tx, data.userId);
    return saved;
  });
}
