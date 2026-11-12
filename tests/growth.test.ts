// 成長率、継続日数、アバターの変化の計算を検証する。
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkoutLog } from "../lib/record-types";
import { calculateStreak, calculateStrengthGrowth, growthRate } from "../lib/growth";
import { calculateAvatarSnapshot, getAvatarSilhouette } from "../lib/avatar";

const date = (day: string) => new Date(`${day}T00:00:00Z`);
test("streak expires, ignores future records, and uses Japan's current day", () => {
  const now = new Date("2026-10-08T15:01:00Z");
  assert.equal(calculateStreak([date("2026-10-05"), date("2026-10-06")], now), 0);
  assert.equal(calculateStreak([date("2026-10-07"), date("2026-10-08"), date("2026-10-08")], now), 2);
  assert.equal(calculateStreak([date("2026-10-09"), date("2026-10-10")], now), 1);
  assert.equal(calculateStreak([], now), 0);
});

test("strength compares repeated exercises across days only", () => {
  const record = (exerciseName: string, weightKg: number, day: string) => ({ exerciseName, weightKg, date: date(day) });
  assert.equal(calculateStrengthGrowth([record("Bench", 60, "2026-10-01"), record("Curl", 14, "2026-10-02")]), null);
  assert.equal(calculateStrengthGrowth([
    record("Bench", 60, "2026-10-01"), record(" bench ", 66, "2026-10-02"),
    record("Curl", 14, "2026-10-03")
  ]), 10);
  assert.equal(calculateStrengthGrowth([record("Bench", 60, "2026-10-01"), record("Bench", 70, "2026-10-01")]), null);
});

test("missing measurements stay missing and percentages share a common unit", () => {
  assert.equal(growthRate(undefined, 70), null);
  assert.equal(growthRate(0, 70), null);
  assert.equal(growthRate(60, 66), 10);
  assert.equal(growthRate(10, 11), 10);
});

test("canonical exercise names compare with historical English names", () => {
  assert.equal(calculateStrengthGrowth([
    { exerciseName: "Bench Press", date: date("2026-10-01"), weightKg: 50 },
    { exerciseName: "ベンチプレス", date: date("2026-10-02"), weightKg: 55 }
  ]), 10);
});

test("training alone changes the trained part and visual score", () => {
  const baseline = calculateAvatarSnapshot([], []);
  const initial = getAvatarSilhouette(baseline.visualTier, baseline);
  for (const [part, dimension] of [["CHEST", "chest"], ["ARMS", "arms"], ["LEGS", "legs"]] as const) {
    const workout = { id: "test", date: date("2026-10-01"),
      exerciseName: "test", bodyPart: part, weightKg: 60, reps: 10, sets: 4, memo: null } satisfies WorkoutLog;
    const grown = calculateAvatarSnapshot([workout], []);
    const figure = getAvatarSilhouette(grown.visualTier, grown);
    assert.ok(grown.bodyShapeScore > baseline.bodyShapeScore);
    assert.ok(figure[dimension] > initial[dimension]);
    for (const other of ["chest", "arms", "legs"] as const) {
      if (other !== dimension) assert.equal(figure[other], initial[other]);
    }
  }
});
