import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exerciseById } from '../lib/exercises';
import { bodyGoalSchema, compareBodyGoal, reasonBodyGoal } from '../lib/body-goal';

const current = { heightCm: 175, weightKg: 80, bodyFatRate: 25, date: '2026-11-19' };
const near = (actual: number | null, expected: number) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) < 1e-10, `${actual} should be near ${expected}`);
};

test('comparison uses signed kg and percentage points, with direct fat and fat-free mass math', () => {
  const result = compareBodyGoal(current, { ...goal, targetBodyFatRate: 20 });
  near(result.weightDeltaKg, -10);
  near(result.fatDeltaPoints, -5);
  near(result.currentFatKg, 20);
  near(result.targetFatKg, 14);
  near(result.fatMassDeltaKg, -6);
  near(result.currentFatFreeKg, 60);
  near(result.targetFatFreeKg, 56);
  near(result.fatFreeMassDeltaKg, -4);
  near(result.targetBmi, 70 / (1.75 * 1.75));
});

test('missing fat does not borrow another measurement or invent a composition change', () => {
  const result = compareBodyGoal({ ...current, bodyFatRate: null }, goal);
  assert.equal(result.fatDeltaPoints, null);
  assert.equal(result.currentFatKg, null);
  assert.equal(result.currentFatFreeKg, null);
  assert.equal(result.fatMassDeltaKg, null);
  assert.equal(result.fatFreeMassDeltaKg, null);
  near(result.weightDeltaKg, -10);
  const missing = compareBodyGoal({ heightCm: null, weightKg: null, bodyFatRate: null, date: null }, goal);
  assert.equal(missing.weightDeltaKg, null);
  assert.equal(missing.targetBmi, null);
});

const goal = { targetWeightKg: 70, targetBodyFatRate: 20, trainingDays: 2 as const, equipment: 'gym' as const };

test('low adult target BMI or low-fat reduction suppresses all exercise suggestions', () => {
  const cases = [
    { baseline: current, target: { ...goal, targetWeightKg: 50 } },
    { baseline: current, target: { ...goal, targetBodyFatRate: 14.9 } },
    { baseline: { ...current, bodyFatRate: null }, target: { ...goal, targetBodyFatRate: 14 } },
    { baseline: { ...current, bodyFatRate: 12 }, target: { ...goal, targetBodyFatRate: 14 } },
    { baseline: { ...current, heightCm: null }, target: { ...goal, targetBodyFatRate: 14 } },
    { baseline: { ...current, weightKg: null }, target: { ...goal, targetBodyFatRate: 14 } },
  ];
  for (const { baseline, target } of cases) {
    const result = reasonBodyGoal(baseline, target);
    assert.equal(result.focus, 'caution');
    assert.deepEqual(result.menu, []);
    assert.equal(result.activity, null);
    assert.match(result.description, /専門家/);
  }
  assert.notEqual(reasonBodyGoal(current, { ...goal, targetBodyFatRate: 15 }).focus, 'caution');
  assert.equal(reasonBodyGoal({ ...current, bodyFatRate: 12 }, { ...goal, targetWeightKg: 82, targetBodyFatRate: 14 }).focus, 'strength');
});

test('a low current adult BMI also suppresses further fat loss even when target BMI increases', () => {
  const result = reasonBodyGoal({ ...current, heightCm: 180, weightKg: 55, bodyFatRate: 23 }, { ...goal, targetWeightKg: 65, targetBodyFatRate: 20 });
  assert.equal(result.focus, 'caution');
  assert.deepEqual(result.menu, []);
  assert.equal(result.activity, null);
  assert.match(result.description, /現在のBMI/);
});

test('missing profile baseline or height asks for profile and avoids personalization', () => {
  for (const key of ['heightCm', 'weightKg'] as const) {
    const result = reasonBodyGoal({ ...current, [key]: null }, goal);
    assert.equal(result.focus, 'general');
    assert.deepEqual(result.menu, []);
    assert.equal(result.activity, null);
    assert.match(result.description, /身体情報/);
  }
});

test('optional body fat does not block a general menu but never guesses a goal direction', () => {
  const result = reasonBodyGoal({ ...current, bodyFatRate: null }, goal);
  assert.equal(result.focus, 'general');
  assert.equal(result.activity, null);
  assert.equal(result.menu.length, 2);
  assert.match(result.description, /体脂肪率/);
});

test('goal differences distinguish fat-loss, strength and near-target maintenance without guarantees', () => {
  const loss = reasonBodyGoal(current, goal);
  assert.equal(loss.focus, 'fat-loss');
  assert.match(loss.activity!, /散歩/);
  const strength = reasonBodyGoal(current, { ...goal, targetWeightKg: 82, targetBodyFatRate: 25 });
  assert.equal(strength.focus, 'strength');
  assert.match(strength.description, /フォーム.*負荷/);
  assert.equal(strength.activity, null);
  assert.equal(strength.menu.length, 2);
  const maintain = reasonBodyGoal(current, { ...goal, targetWeightKg: 80.5, targetBodyFatRate: 24 });
  assert.equal(maintain.focus, 'maintain');
  assert.equal(maintain.menu.length, 2);
  assert.notEqual(loss.label, strength.label);
  assert.notEqual(strength.label, maintain.label);
});

test('menus use canonical IDs, full-body patterns, concrete sets/reps and nonconsecutive days for every option', () => {
  for (const equipment of ['gym', 'dumbbells'] as const) {
    for (const trainingDays of [2, 3] as const) {
      const settings = { ...goal, equipment, trainingDays };
      const first = reasonBodyGoal(current, settings);
      assert.deepEqual(first, reasonBodyGoal(current, settings));
      assert.equal(first.menu.length, trainingDays);
      assert.deepEqual(first.menu.map(day => day.weekday), trainingDays === 2 ? [0, 3] : [0, 2, 4]);
      for (const day of first.menu) {
        assert.match(day.label, /曜日/);
        const parts = new Set(day.exercises.map(item => exerciseById.get(item.exerciseId)?.part));
        for (const part of ['legs', 'chest', 'back', 'core'] as const) assert.ok(parts.has(part));
        for (const item of day.exercises) {
          assert.ok(exerciseById.has(item.exerciseId));
          assert.ok(item.sets >= 1 && item.sets <= 3);
          assert.match(item.reps, /^\d+〜\d+回$/);
          assert.ok(item.note.length > 0);
          if (equipment === 'dumbbells') {
            assert.equal(['bench-press', 'leg-press', 'lat-pulldown'].includes(item.exerciseId), false);
          }
        }
      }
    }
  }
  assert.notDeepEqual(reasonBodyGoal(current, goal).menu, reasonBodyGoal(current, { ...goal, equipment: 'dumbbells' }).menu);
});

test('goal validation accepts numeric API boundaries and rejects blank, nonfinite or unsupported values', () => {
  for (const targetWeightKg of [20, 70.5, 500]) {
    for (const targetBodyFatRate of [1, 20.5, 75]) {
      assert.equal(bodyGoalSchema.safeParse({ ...goal, targetWeightKg, targetBodyFatRate }).success, true);
    }
  }
  for (const patch of [
    { targetWeightKg: '' }, { targetWeightKg: null }, { targetWeightKg: '70' },
    { targetWeightKg: 19.9 }, { targetWeightKg: 500.1 }, { targetWeightKg: NaN },
    { targetWeightKg: Infinity }, { targetBodyFatRate: 0 }, { targetBodyFatRate: 75.1 },
    { targetBodyFatRate: NaN }, { targetBodyFatRate: Infinity },
    { trainingDays: 1 }, { trainingDays: 4 }, { equipment: 'none' },
  ]) assert.equal(bodyGoalSchema.safeParse({ ...goal, ...patch }).success, false, JSON.stringify(patch));
});
