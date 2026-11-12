// 週間集計、筋肉量の試算、旧プランの読み込みを検証する。
import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMenu, analyzeReadings, loadPlan, planSchema, simulate } from "../lib/simulation";

test("legacy menu names survive without treating body weight as muscle mass", () => {
  const plan = loadPlan({ days: [{ menu: "スクワット", minutes: 30, cost: 200 },
    ...Array.from({ length: 6 }, () => ({ menu: "" }))], currentKg: 70, months: 12 }, 49);
  assert.deepEqual(plan.days[0], [{ exerciseId: "squat", name: "スクワット", part: "legs", sets: null }]);
  assert.equal(plan.currentMassKg, 49);
  assert.equal(plan.months, 12);
  assert.equal(planSchema.safeParse(plan).success, true);
});

test("unknown custom menu items retain their saved name and main muscle", () => {
  const original = loadPlan(null, 50);
  original.days[0] = [{ name: "自作メニュー", part: "core", sets: 4 }];
  assert.deepEqual(loadPlan(original, 50).days[0], original.days[0]);
});

test("counts sets and distinct days by main muscle without estimating kilos from sets", () => {
  const plan = loadPlan(null, 50);
  plan.days[0] = [{ name: "スクワット", part: "legs", sets: 3, reps: 10 }, { name: "ランジ", part: "legs", sets: 2, reps: 12 }];
  plan.days[2] = [{ name: "スクワット", part: "legs", sets: 4 }, { name: "未分類", part: null, sets: 2 }];
  const analysis = analyzeMenu(plan.days);
  assert.deepEqual(analysis.parts.find(({ label }) => label === "脚"), { label: "脚", sets: 9, repetitions: 54, days: 2 });
  assert.equal(analysis.repetitions, 54);
  assert.equal(analysis.incompleteRepetitions, 2);
  assert.equal(analysis.incomplete, 1);
  assert.equal(simulate(plan).at(3), null);
});

test("shows observed trend only with enough distinct days, using last entry per day", () => {
  const recent = [{ date: "2026-09-01", kg: 50 }, { date: "2026-09-16", kg: 50.5 }];
  assert.equal(analyzeReadings(recent).paceKg, null);
  const analysis = analyzeReadings([...recent, { date: "2026-10-01", kg: 54 }, { date: "2026-10-01", kg: 51 }]);
  assert.equal(analysis.readings.length, 3);
  assert.equal(analysis.deltaKg, 1);
  assert.ok(Math.abs((analysis.paceKg ?? 0) - 30.4375 / 30) < 1e-10);
});

test("scenarios show a range and handle a zero-gain assumption", () => {
  const plan = { ...loadPlan(null, 50), paceKg: 0, upperPaceKg: 0.5, targetMassKg: 53 };
  const result = simulate(plan);
  assert.deepEqual(result.at(12), { lowGain: 0, highGain: 6, lowMass: 50, highMass: 56 });
  assert.equal(result.earliest, 6);
  assert.equal(result.latest, null);
  assert.equal(planSchema.safeParse({ ...plan, paceKg: 0.6 }).success, false);
});

test("reference volume scales both gains and goal dates, with no bonus above baseline", () => {
  const plan = { ...loadPlan(null, 50), paceKg: 0.5, upperPaceKg: 1, targetMassKg: 53, referenceReps: 120 };
  plan.days[0] = [{ name: "スクワット", part: "legs", sets: 6, reps: 10 }];
  const result = simulate(plan);
  assert.equal(result.ratio, 0.5);
  assert.deepEqual(result.at(4), { lowGain: 1, highGain: 2, lowMass: 51, highMass: 52 });
  assert.equal(result.earliest, 6);
  assert.equal(result.latest, 12);
  assert.equal(simulate({ ...plan, referenceReps: 30 }).ratio, 1);
  plan.days[0][0].reps = null;
  assert.equal(simulate(plan).at(4), null);
  assert.equal(simulate({ ...plan, referenceReps: null }).at(4)?.lowGain, 2);
});
