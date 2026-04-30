import { z } from "zod";

const optionalNumberField = z.preprocess((value) => {
  if (value === "" || value == null) {
    return undefined;
  }
  return value;
}, z.coerce.number().min(0).optional());

export const registerSchema = z.object({
  name: z.string().min(2, "名前は2文字以上で入力してください"),
  email: z.string().email("正しいメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください")
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const workoutSchema = z.object({
  date: z.string().min(1),
  exerciseName: z.string().min(1),
  bodyPart: z.enum(["CHEST", "BACK", "SHOULDERS", "ARMS", "LEGS", "CORE", "FULL_BODY", "CARDIO"]),
  weightKg: z.coerce.number().min(0),
  reps: z.coerce.number().int().min(1),
  sets: z.coerce.number().int().min(1),
  memo: z.string().optional().default("")
});

export const bodyMetricSchema = z.object({
  date: z.string().min(1),
  weightKg: z.coerce.number().min(1),
  bodyFatRate: z.preprocess((value) => (value === "" || value == null ? undefined : value), z.coerce.number().min(0).max(100).optional()),
  muscleMassKg: optionalNumberField,
  chestCm: optionalNumberField,
  armCm: optionalNumberField,
  legCm: optionalNumberField
});
