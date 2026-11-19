import assert from "node:assert/strict";
import test from "node:test";
import { currentBody, avatarProportions, type BodyProfile } from "../lib/body-profile";

const profile: BodyProfile = { heightCm: 174, weightKg: 68, bodyFatRate: 22, latestMetric: null };

test("registration data is used until the first body measurement", () => {
  assert.deepEqual(currentBody(profile), { heightCm: 174, weightKg: 68, bodyFatRate: 22, date: null });
});

test("latest weight and body fat stay paired and an unmeasured rate stays unknown", () => {
  assert.deepEqual(currentBody({ ...profile, latestMetric: { weightKg: 70, bodyFatRate: null, date: "2026-11-20" } }), {
    heightCm: 174, weightKg: 70, bodyFatRate: null, date: "2026-11-20"
  });
});

test("avatar responds to height, weight and body fat; an incomplete profile has no personalized shape", () => {
  const base = currentBody(profile);
  const shape = avatarProportions(base)!;
  assert.ok(shape);
  assert.ok(avatarProportions({ ...base, heightCm: 190 })!.heightScale > shape.heightScale);
  assert.ok(avatarProportions({ ...base, weightKg: 80 })!.torsoHalf > shape.torsoHalf);
  assert.ok(avatarProportions({ ...base, bodyFatRate: 30 })!.waistHalf > shape.waistHalf);
  assert.ok(avatarProportions({ ...base, bodyFatRate: null }));
  assert.equal(avatarProportions({ ...base, heightCm: null }), null);
});
