import { avatarProportions, type currentBody } from "@/lib/body-profile";

import { getAvatarSilhouette, type calculateAvatarSnapshot } from "@/lib/avatar";

type Props = { body: ReturnType<typeof currentBody>; avatar: ReturnType<typeof calculateAvatarSnapshot> };

export function BodyAvatar({ body, avatar }: Props) {
  const shape = avatarProportions(body);
  const { heightScale, torsoHalf: baseTorso, waistHalf, limb } = shape ?? {
    heightScale: 1, torsoHalf: 35, waistHalf: 25, limb: 11
  };
  // 身体プロフィールの体格に、既存の部位別成長幅だけを加える。
  const trained = getAvatarSilhouette(avatar.visualTier, avatar);
  const base = getAvatarSilhouette(1);
  const torsoHalf = baseTorso + (trained.chest - base.chest) / 2;
  const midpoint = 150;
  return (
    <figure className="home-avatar-stage">
      <svg viewBox="0 0 300 310" role="img" aria-label={shape ? "身体データを反映したアバター" : "プロフィール未登録のアバター"}>
        <defs>
          <pattern id="body-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#7c7c7c" strokeOpacity=".15"/>
          </pattern>
          <linearGradient id="body-fill" x2=".85" y2="1">
            <stop stopColor="#d8d8d8"/><stop offset=".65" stopColor="#a3a3a3"/><stop offset="1" stopColor="#777777"/>
          </linearGradient>
        </defs>
        <rect x="12" y="12" width="276" height="286" rx="20" fill="url(#body-grid)"/>
        <circle cx="150" cy="148" r="103" stroke="#8b8b8b" strokeOpacity=".38" fill="none" strokeDasharray="3 6"/>
        <circle cx="150" cy="148" r="82" stroke="#8b8b8b" strokeOpacity=".25" fill="none"/>
        <ellipse cx="150" cy="275" rx="60" ry="11" fill="#808080" opacity=".18"/>
        <g transform={`translate(0 268) scale(1 ${heightScale}) translate(0 -268)`} opacity={shape ? 1 : .42}>
          <path d={`M${midpoint-torsoHalf+4} 100 L${midpoint-torsoHalf-10} 141 L${midpoint-torsoHalf-16} 179 M${midpoint+torsoHalf-4} 100 L${midpoint+torsoHalf+10} 141 L${midpoint+torsoHalf+16} 179`}
            fill="none" stroke="#909090" strokeWidth={limb * 1.72 + trained.arms - base.arms} strokeLinecap="round"/>
          <path d={`M${midpoint-waistHalf*.55} 167 L${midpoint-waistHalf*.45-2} 214 L${midpoint-waistHalf*.42-5} 258 M${midpoint+waistHalf*.55} 167 L${midpoint+waistHalf*.45+2} 214 L${midpoint+waistHalf*.42+5} 258`}
            fill="none" stroke="#7c7c7c" strokeWidth={limb * 2.18 + trained.legs - base.legs} strokeLinecap="round"/>
          <rect x="141" y="76" width="18" height="18" rx="6" fill="#969696"/>
          <path d={`M${midpoint-torsoHalf} 102 Q${midpoint-torsoHalf} 90 150 85 Q${midpoint+torsoHalf} 90 ${midpoint+torsoHalf} 102 L${midpoint+waistHalf} 158 Q${midpoint+waistHalf+2} 182 150 185 Q${midpoint-waistHalf-2} 182 ${midpoint-waistHalf} 158 Z`} fill="url(#body-fill)" stroke="#676767" strokeOpacity=".5"/>
          <path d={`M${midpoint-torsoHalf+8} 113 Q135 105 150 119 Q165 105 ${midpoint+torsoHalf-8} 113 M150 119 V147`} fill="none" stroke="#606060" strokeOpacity=".48" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="150" cy="63" r="22" fill="url(#body-fill)" stroke="#676767" strokeOpacity=".45"/>
          <path d="M143 63h.1m14 0h.1M146 71q4 3 8 0" stroke="#535353" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
        </g>
        <path d="M31 51V31h20m198 0h20v20M31 259v20h20m198 0h20v-20" stroke="#747474" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
      <figcaption>身体データとトレーニング記録によるイメージ</figcaption>
    </figure>
  );
}
