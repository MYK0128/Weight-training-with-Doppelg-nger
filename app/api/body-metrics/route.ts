import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bodyMetricSchema } from "@/lib/validators";
import { saveBodyMetric } from "@/lib/records";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const body = await request.json();
    const result = bodyMetricSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? "入力内容が不正です" }, { status: 400 });
    }

    const metric = await saveBodyMetric(prisma, {
      userId: user.id,
      date: new Date(result.data.date),
      weightKg: result.data.weightKg,
      bodyFatRate: result.data.bodyFatRate,
      muscleMassKg: result.data.muscleMassKg,
      chestCm: result.data.chestCm,
      armCm: result.data.armCm,
      legCm: result.data.legCm
    });

    return NextResponse.json({ ok: true, metric });
  } catch {
    return NextResponse.json({ error: "身体情報の保存に失敗しました" }, { status: 500 });
  }
}
