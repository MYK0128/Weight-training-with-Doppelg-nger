// Define workout and body measurement types used by the UI.
export type WorkoutLog = {
  id: string;
  date: Date;
  exerciseName: string;
  bodyPart: string;
  weightKg: number;
  reps: number;
  sets: number;
  memo: string | null;
};

export type BodyMetric = {
  id: string;
  date: Date;
  weightKg: number;
  bodyFatRate: number | null;
  muscleMassKg: number | null;
  chestCm: number | null;
  armCm: number | null;
  legCm: number | null;
};
