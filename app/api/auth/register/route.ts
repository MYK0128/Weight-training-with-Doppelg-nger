import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordHash, createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? "入力内容が不正です" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: result.data.email }
    });

    if (existingUser) {
      return NextResponse.json({ error: "このメールアドレスはすでに登録されています" }, { status: 409 });
    }

    const passwordHash = await createPasswordHash(result.data.password);
    const user = await prisma.user.create({
      data: {
        name: result.data.name,
        email: result.data.email,
        passwordHash
      }
    });

    await prisma.avatarProfile.create({
      data: {
        userId: user.id
      }
    });

    await createSession(user.id);
    return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch {
    return NextResponse.json({ error: "ユーザー登録に失敗しました" }, { status: 500 });
  }
}
