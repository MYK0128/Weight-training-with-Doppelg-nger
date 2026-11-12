// Goと共用する種目一覧を、画面で検索しやすい形にする。
import catalog from "../backend/exercises.json";

export const muscleParts = {
  chest: "胸", back: "背中", shoulders: "肩", arms: "腕", legs: "脚", core: "体幹"
};

export type MusclePart = keyof typeof muscleParts;
export type CatalogExercise = {
  id: string;
  name: string;
  part: MusclePart;
  secondary: MusclePart[];
  aliases: string[];
};

export const exercises = catalog as CatalogExercise[];
export const exerciseById = new Map(exercises.map((item) => [item.id, item]));
// 過去に入力された英語名や別名でも、同じ種目を探せるようにする。
const exerciseByName = new Map(exercises.flatMap((item) =>
  [item.name, ...item.aliases].map((name) => [name.toLowerCase(), item] as const)
));

export function findExerciseByName(name: string) {
  return exerciseByName.get(name.trim().toLowerCase());
}
