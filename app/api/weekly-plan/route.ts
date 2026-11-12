import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planSchema } from "@/lib/simulation";

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  const parsed = planSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力を確認してください。" }, { status: 400 });
  }

  await prisma.weeklyPlan.upsert({
    where: { userId: user.id },
    create: { userId: user.id, settings: parsed.data },
    update: { settings: parsed.data }
  });
  return NextResponse.json({ ok: true });
}
