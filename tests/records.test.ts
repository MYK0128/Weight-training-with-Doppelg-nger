import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BodyPart, PrismaClient } from "@prisma/client";
import { saveBodyMetric, saveWorkout } from "../lib/records";

test("record and avatar writes commit together and roll back on avatar failure", async () => {
  const directory = mkdtempSync(join(tmpdir(), "muscle-quest-test-"));
  closeSync(openSync(join(directory, "test.db"), "w"));
  const url = `file:${join(directory, "test.db")}`;
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], {
      env: { ...process.env, DATABASE_URL: url }, stdio: "pipe"
    });
    const user = await db.user.create({ data: { name: "Test", email: "test@example.com", passwordHash: "unused" } });
    const workout = { userId: user.id, date: new Date("2026-10-09"), exerciseName: "Bench",
      bodyPart: BodyPart.CHEST, weightKg: 60, reps: 10, sets: 4 };
    await saveWorkout(db, workout);
    await saveBodyMetric(db, { userId: user.id, date: workout.date, weightKg: 70 });
    const avatar = await db.avatarProfile.findUniqueOrThrow({ where: { userId: user.id } });
    assert.ok(avatar.chestStat > 10);
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_avatar BEFORE UPDATE ON AvatarProfile BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    await assert.rejects(saveWorkout(db, workout));
    await assert.rejects(saveBodyMetric(db, { userId: user.id, date: workout.date, weightKg: 71 }));
    assert.equal(await db.workoutLog.count(), 1);
    assert.equal(await db.bodyMetric.count(), 1);
    assert.deepEqual(await db.avatarProfile.findUnique({ where: { userId: user.id } }), avatar);
  } finally {
    await db.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
