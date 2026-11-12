import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workoutSchema } from "@/lib/validators";
import { saveWorkout } from "@/lib/records";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const body = await request.json();
    const result = workoutSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? "入力内容が不正です" }, { status: 400 });
    }

    const workout = await saveWorkout(prisma, {
      userId: user.id,
      date: new Date(result.data.date),
      exerciseName: result.data.exerciseName,
      bodyPart: result.data.bodyPart,
      weightKg: result.data.weightKg,
      reps: result.data.reps,
      sets: result.data.sets,
      memo: result.data.memo
    });

    return NextResponse.json({ ok: true, workout });
  } catch {
    return NextResponse.json({ error: "筋トレ記録の保存に失敗しました" }, { status: 500 });
  }
}
