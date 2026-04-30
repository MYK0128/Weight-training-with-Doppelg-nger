import { PrismaClient, BodyPart } from "@prisma/client";
import { createPasswordHash } from "../lib/auth";
import { recomputeAvatarProfile } from "../lib/avatar";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@muscle.quest";
  const passwordHash = await createPasswordHash("demo1234");

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo Lifter",
      passwordHash
    }
  });

  const now = new Date();
  const daysAgo = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date;
  };

  await prisma.workoutLog.deleteMany({ where: { userId: user.id } });
  await prisma.bodyMetric.deleteMany({ where: { userId: user.id } });
  await prisma.badgeAward.deleteMany({ where: { userId: user.id } });

  await prisma.workoutLog.createMany({
    data: [
      {
        userId: user.id,
        date: daysAgo(10),
        exerciseName: "Bench Press",
        bodyPart: BodyPart.CHEST,
        weightKg: 55,
        reps: 8,
        sets: 4,
        memo: "フォーム安定"
      },
      {
        userId: user.id,
        date: daysAgo(8),
        exerciseName: "Barbell Squat",
        bodyPart: BodyPart.LEGS,
        weightKg: 70,
        reps: 5,
        sets: 5,
        memo: "最後のセットはかなりきつい"
      },
      {
        userId: user.id,
        date: daysAgo(6),
        exerciseName: "Lat Pulldown",
        bodyPart: BodyPart.BACK,
        weightKg: 45,
        reps: 10,
        sets: 4,
        memo: "広背筋を意識"
      },
      {
        userId: user.id,
        date: daysAgo(4),
        exerciseName: "Shoulder Press",
        bodyPart: BodyPart.SHOULDERS,
        weightKg: 32,
        reps: 8,
        sets: 4,
        memo: "肩に効いた"
      },
      {
        userId: user.id,
        date: daysAgo(2),
        exerciseName: "Dumbbell Curl",
        bodyPart: BodyPart.ARMS,
        weightKg: 14,
        reps: 12,
        sets: 3,
        memo: "追い込み成功"
      },
      {
        userId: user.id,
        date: daysAgo(0),
        exerciseName: "Bench Press",
        bodyPart: BodyPart.CHEST,
        weightKg: 60,
        reps: 8,
        sets: 4,
        memo: "先週より重量アップ"
      }
    ]
  });

  await prisma.bodyMetric.createMany({
    data: [
      {
        userId: user.id,
        date: daysAgo(10),
        weightKg: 68.4,
        bodyFatRate: 17.2,
        muscleMassKg: 53.2,
        chestCm: 96,
        armCm: 33.2,
        legCm: 54.1
      },
      {
        userId: user.id,
        date: daysAgo(5),
        weightKg: 68.9,
        bodyFatRate: 16.7,
        muscleMassKg: 53.8,
        chestCm: 97.2,
        armCm: 33.7,
        legCm: 54.6
      },
      {
        userId: user.id,
        date: daysAgo(0),
        weightKg: 69.5,
        bodyFatRate: 16.2,
        muscleMassKg: 54.6,
        chestCm: 98.1,
        armCm: 34.2,
        legCm: 55.1
      }
    ]
  });

  await recomputeAvatarProfile(prisma, user.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
