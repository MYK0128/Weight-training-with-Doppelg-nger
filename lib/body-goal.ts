import { z } from 'zod';

export const bodyGoalSchema = z.object({
  targetWeightKg: z.number().finite().min(20, '目標体重は20〜500 kgで入力してください。').max(500, '目標体重は20〜500 kgで入力してください。'),
  targetBodyFatRate: z.number().finite().min(1, '目標体脂肪率は1〜75%で入力してください。').max(75, '目標体脂肪率は1〜75%で入力してください。'),
  trainingDays: z.union([z.literal(2), z.literal(3)]),
  equipment: z.enum(['gym', 'dumbbells']),
});
export type BodyGoal = z.infer<typeof bodyGoalSchema>;
export type CurrentBody = { heightCm: number | null; weightKg: number | null; bodyFatRate: number | null; date: string | null };
export type GoalFocus = 'fat-loss' | 'strength' | 'maintain' | 'general' | 'caution';
export type GoalExercise = { exerciseId: string; sets: number; reps: string; note: string };
export type GoalDay = { weekday: number; label: string; exercises: GoalExercise[] };
export type GoalReasoning = { focus: GoalFocus; label: string; description: string; activity: string | null; menu: GoalDay[] };

function fullBodyMenu(goal: BodyGoal): GoalDay[] {
  const weekdays = goal.trainingDays === 2 ? [0, 3] : [0, 2, 4];
  const labels = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];
  return weekdays.map((weekday, index) => {
    const alternate = index % 2 === 1;
    const exercises: GoalExercise[] = goal.equipment === 'gym' ? [
      { exerciseId: alternate ? 'squat' : 'leg-press', sets: 2, reps: '8〜12回', note: alternate ? 'まず自重でフォームを確認。痛みのない範囲で。' : '背中を支え、膝を伸ばし切らない範囲で。' },
      { exerciseId: 'bench-press', sets: 2, reps: '8〜12回', note: '安全バーや補助を使い、軽い負荷から。' },
      { exerciseId: alternate ? 'dumbbell-row' : 'lat-pulldown', sets: 2, reps: '8〜12回', note: alternate ? '左右それぞれ。同じ回数で行う。' : '反動を使わず、胸を軽く起こす。' },
      { exerciseId: 'crunch', sets: 2, reps: '10〜15回', note: '首を引かず、息を止めずに。' },
    ] : [
      { exerciseId: alternate ? 'lunge' : 'squat', sets: 2, reps: '8〜12回', note: alternate ? '左右それぞれ。自重から始め、安定したらダンベルを。' : '自重から始め、安定したら胸の前にダンベルを持つ。' },
      { exerciseId: alternate ? 'dumbbell-press' : 'push-up', sets: 2, reps: '8〜12回', note: alternate ? '床に仰向けで行うフロアプレス。軽いダンベルで。' : '難しければ壁や膝つきで、無理のない回数に調整。' },
      { exerciseId: 'dumbbell-row', sets: 2, reps: '8〜12回', note: '左右それぞれ。上体を安定させ、軽い負荷で。' },
      { exerciseId: 'crunch', sets: 2, reps: '10〜15回', note: '首を引かず、息を止めずに。' },
    ];
    return { weekday, label: labels[weekday], exercises };
  });
}

export function reasonBodyGoal(current: CurrentBody, goal: BodyGoal): GoalReasoning {
  const comparison = compareBodyGoal(current, goal);
  const lowFatReduction = goal.targetBodyFatRate < 15 && (
    current.bodyFatRate == null || current.weightKg == null ||
    goal.targetBodyFatRate < current.bodyFatRate || goal.targetWeightKg < current.weightKg
  );
  const currentBmi = current.heightCm != null && current.heightCm > 0 && current.weightKg != null
    ? current.weightKg / ((current.heightCm / 100) ** 2) : null;
  const furtherLoss = (comparison.weightDeltaKg != null && comparison.weightDeltaKg < 0) || (comparison.fatDeltaPoints != null && comparison.fatDeltaPoints < 0);
  const lowCurrentReduction = currentBmi != null && currentBmi < 18.5 && furtherLoss;
  if ((comparison.targetBmi != null && comparison.targetBmi < 18.5) || lowFatReduction || lowCurrentReduction) {
    return { focus: 'caution', label: '目標をいったん確認しましょう',
      description: '目標BMIが18.5未満、現在のBMIが18.5未満でさらに減少を目指す設定、または体脂肪率15%未満への減少・比較元が不明な設定のため、運動メニューの提案を控えています。目標の適切さを医師などの資格を持つ専門家に相談してください。15%は健康上の境界ではなく、このアプリの保守的な提案ガードです。',
      activity: null, menu: [] };
  }
  if (current.heightCm == null || current.weightKg == null) {
    return { focus: 'general', label: 'まずは現在地を記録',
      description: '身体情報に身長と現在の体重を入力すると、全身のトレーニング例を確認できます。',
      activity: null, menu: [] };
  }
  if (current.bodyFatRate == null) {
    return { focus: 'general', label: '全身を動かす習慣から',
      description: '現在の体脂肪率が未測定なので、体脂肪率の差や減量・増量の方向は推測しません。日数と器具に合わせた一般的なメニュー例を表示します。',
      activity: null, menu: fullBodyMenu(goal) };
  }
  if (comparison.weightDeltaKg! < -0.5 || comparison.fatDeltaPoints! < -1) {
    return { focus: 'fat-loss', label: '全身の筋力を保ちながら、活動を重ねる',
      description: '体重または体脂肪率を下げる方向の設定です。基本は全身の筋力トレーニング。回数を急に増やすより、無理なく続けられるフォームと負荷を優先します。',
      activity: '余裕があれば、休みの日に会話できる程度の散歩など軽い活動を。疲れが強い日は休みましょう。', menu: fullBodyMenu(goal) };
  }
  if (comparison.weightDeltaKg! > 0.5 || comparison.fatDeltaPoints! > 1) {
    return { focus: 'strength', label: 'フォームを固め、少しずつ強く',
      description: '体重または体脂肪率を増やす方向の設定です。体重の増加を筋肉の増加とはみなしません。全身のフォームを安定させ、余裕が出たら回数や負荷を少しずつ見直しましょう。',
      activity: null, menu: fullBodyMenu(goal) };
  }
  return { focus: 'maintain', label: '今の習慣を整え、維持する',
    description: '目標との差が小さい設定です。全身を動かす習慣と安定したフォームを大切にし、測定の揺れに合わせた急な変更は避けましょう。',
    activity: null, menu: fullBodyMenu(goal) };
}


export function compareBodyGoal(current: CurrentBody, goal: BodyGoal) {
  const currentFatKg = current.weightKg != null && current.bodyFatRate != null
    ? current.weightKg * current.bodyFatRate / 100 : null;
  const currentFatFreeKg = currentFatKg != null && current.weightKg != null ? current.weightKg - currentFatKg : null;
  const targetFatKg = goal.targetWeightKg * goal.targetBodyFatRate / 100;
  const targetFatFreeKg = goal.targetWeightKg - targetFatKg;
  return {
    weightDeltaKg: current.weightKg == null ? null : goal.targetWeightKg - current.weightKg,
    fatDeltaPoints: current.bodyFatRate == null ? null : goal.targetBodyFatRate - current.bodyFatRate,
    currentFatKg, currentFatFreeKg, targetFatKg, targetFatFreeKg,
    fatMassDeltaKg: currentFatKg == null ? null : targetFatKg - currentFatKg,
    fatFreeMassDeltaKg: currentFatFreeKg == null ? null : targetFatFreeKg - currentFatFreeKg,
    targetBmi: current.heightCm != null && current.heightCm > 0 ? goal.targetWeightKg / ((current.heightCm / 100) ** 2) : null,
  };
}
