import { getAvatarSilhouette } from "@/lib/avatar";

type AvatarCardProps = {
  avatar: {
    level: number;
    experience: number;
    power: number;
    chestStat: number;
    armStat: number;
    legStat: number;
    enduranceStat: number;
    bodyShapeScore: number;
    visualTier: number;
  } | null;
};

function AvatarFigure({ avatar }: { avatar: NonNullable<AvatarCardProps["avatar"]> }) {
  const silhouette = getAvatarSilhouette(avatar.visualTier, avatar);

  return (
    <svg className="avatar-svg" viewBox="0 0 220 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="avatar silhouette">
      <circle cx="110" cy="42" r="28" fill="var(--accent)" />
      <path
        d={`M${110 - silhouette.shoulders / 2} 98
            Q110 84 ${110 + silhouette.shoulders / 2} 98
            L${110 + silhouette.chest / 2} 170
            Q110 188 ${110 - silhouette.chest / 2} 170 Z`}
        fill="var(--accent)"
      />
      <path
        d={`M${110 - silhouette.waist / 2} 170
            Q110 198 ${110 + silhouette.waist / 2} 170
            L${110 + 24} 250
            Q110 262 ${110 - 24} 250 Z`}
        fill="var(--accent-strong)"
      />
      <rect x={42} y={108} width={silhouette.arms} height={120} rx={silhouette.arms / 2} fill="var(--accent)" />
      <rect x={220 - 42 - silhouette.arms} y={108} width={silhouette.arms} height={120} rx={silhouette.arms / 2} fill="var(--accent)" />
      <rect x={84} y={246} width={silhouette.legs} height={104} rx={silhouette.legs / 2} fill="var(--accent)" />
      <rect x={220 - 84 - silhouette.legs} y={246} width={silhouette.legs} height={104} rx={silhouette.legs / 2} fill="var(--accent)" />
    </svg>
  );
}

export function AvatarCard({ avatar }: AvatarCardProps) {
  const activeAvatar = avatar ?? {
    level: 1,
    experience: 0,
    power: 10,
    chestStat: 10,
    armStat: 10,
    legStat: 10,
    enduranceStat: 10,
    bodyShapeScore: 10,
    visualTier: 1
  };

  const silhouette = getAvatarSilhouette(activeAvatar.visualTier);

  return (
    <section className="panel-card">
      <div className="row-between">
        <div>
          <p className="pill">Avatar Growth</p>
          <h2 className="section-title" style={{ marginTop: 14 }}>
            バーチャルアバター
          </h2>
        </div>
        <div className="muted">Visual Tier {activeAvatar.visualTier}</div>
      </div>
      <div className="avatar-shell">
        <div className="avatar-stage">
          <AvatarFigure avatar={activeAvatar} />
        </div>
        <div className="avatar-meta">
          <div>
            <h3 style={{ margin: 0, fontSize: "1.8rem" }}>{silhouette.label}</h3>
            <p className="subhead" style={{ marginTop: 8 }}>
              現実のトレーニング量と身体データから、アバターの見た目と能力値を更新します。
            </p>
          </div>
          <div className="mini-kpis">
            <div className="kpi">
              Level
              <strong>{activeAvatar.level}</strong>
            </div>
            <div className="kpi">
              EXP
              <strong>{activeAvatar.experience}</strong>
            </div>
            <div className="kpi">
              Power
              <strong>{activeAvatar.power}</strong>
            </div>
            <div className="kpi">
              Shape
              <strong>{activeAvatar.bodyShapeScore}</strong>
            </div>
          </div>
          <div className="mini-kpis">
            <div className="kpi">
              Chest
              <strong>{activeAvatar.chestStat}</strong>
            </div>
            <div className="kpi">
              Arms
              <strong>{activeAvatar.armStat}</strong>
            </div>
            <div className="kpi">
              Legs
              <strong>{activeAvatar.legStat}</strong>
            </div>
            <div className="kpi">
              Endurance
              <strong>{activeAvatar.enduranceStat}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
