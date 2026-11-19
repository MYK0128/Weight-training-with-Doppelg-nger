export type BodyProfile = {
  heightCm: number | null;
  weightKg: number | null;
  bodyFatRate: number | null;
  latestMetric: { weightKg: number; bodyFatRate: number | null; date: string } | null;
};

export function currentBody(profile: BodyProfile) {
  const latest = profile.latestMetric;
  return {
    heightCm: profile.heightCm,
    weightKg: latest?.weightKg ?? profile.weightKg,
    // 体脂肪率だけ古い値で補って、異なる日の数値を組み合わせない。
    bodyFatRate: latest ? latest.bodyFatRate : profile.bodyFatRate,
    date: latest?.date ?? null
  };
}

export const bodyFields = [
  { name: "heightCm", label: "身長（cm）", min: 80, max: 250, required: true, example: "174" },
  { name: "weightKg", label: "体重（kg）", min: 20, max: 500, required: true, example: "68.5" },
  { name: "bodyFatRate", label: "体脂肪率（%・任意）", min: 1, max: 75, required: false, example: "22" }
] as const;

export function bodyPayload(form: FormData) {
  return Object.fromEntries(bodyFields.map(({ name }) => [name, form.get(name)]));
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// ゲーム内のシルエット用。身体寸法、筋肉量や健康状態の推定には使わない。
export function avatarProportions({ heightCm, weightKg, bodyFatRate }: ReturnType<typeof currentBody>) {
  if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) return null;
  const frame = clamp(Math.sqrt(weightKg / 68) * (174 / heightCm), 0.72, 1.47);
  const waistShift = bodyFatRate == null ? 0 : clamp((bodyFatRate - 22) * 0.46, -10, 17);
  return {
    heightScale: clamp(heightCm / 174, 0.82, 1.15),
    torsoHalf: 35 * frame,
    waistHalf: 25 * frame + waistShift,
    limb: 11 * Math.sqrt(frame)
  };
}
