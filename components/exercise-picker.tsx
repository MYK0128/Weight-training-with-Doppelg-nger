// 共通の種目一覧と、選択した種目の主部位・補助部位を表示する。
import { exercises, muscleParts } from "@/lib/exercises";

export function ExerciseOptions({ legacyName }: { legacyName?: string }) {
  return <>
    <option value="">種目を選択</option>
    {legacyName && <option value="legacy">以前の種目：{legacyName}</option>}
    {Object.entries(muscleParts).map(([part, label]) => <optgroup label={label} key={part}>
      {exercises.filter((item) => item.part === part).map((item) =>
        <option key={item.id} value={item.id}>{item.name}</option>)}
    </optgroup>)}
  </>;
}

export function ExerciseMuscles({ exercise }: { exercise?: (typeof exercises)[number] }) {
  if (!exercise) return null;
  return <small className="muted exercise-muscles">
    主：{muscleParts[exercise.part]}
    {exercise.secondary.length > 0 && ` ／ 補助：${exercise.secondary.map((part) => muscleParts[part]).join("・")}`}
  </small>;
}
