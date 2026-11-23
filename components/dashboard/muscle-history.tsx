import { analyzeReadings, type MuscleReading } from "@/lib/simulation";

const format = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format;
const signed = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2, signDisplay: "exceptZero" }).format;

export function MuscleHistory({ readings }: { readings: MuscleReading[] }) {
  const history = analyzeReadings(readings);
  return (
    <section id="muscle-history" className="panel-card">
      <h2 className="section-title">筋肉量の実測推移</h2>
        <div className="plan-goal">
          <span>最新の実測</span>
          <strong>{history.latest ? `${format(history.latest.kg)} kg` : "測定記録なし"}</strong>
          {history.latest && <span>{history.latest.date} · 最新測定までの90日間に {history.readings.length}日分</span>}
          {history.deltaKg != null && <span>{history.spanDays}日間の実測差：{signed(history.deltaKg)} kg</span>}
          <span>{history.paceKg == null ? "月あたりの傾向は、4週間以上にわたる3日分以上の記録から表示します。"
            : `実測の傾向：月あたり ${signed(history.paceKg)} kg（過去の測定値から計算）`}</span>
        </div>
        {history.readings.length > 0 && <details className="plan-options">
          <summary>実測の履歴を見る</summary>
          <table className="plan-table">
            <thead><tr><th scope="col">測定日</th><th scope="col">筋肉量（kg）</th></tr></thead>
            <tbody>{history.readings.slice().reverse().map(({ date, kg }) =>
              <tr key={date}><th scope="row">{date}</th><td>{format(kg)}</td></tr>)}</tbody>
          </table>
        </details>}
    </section>
  );
}
