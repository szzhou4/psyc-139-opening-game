import Avatar from "./Avatar";

/**
 * The road segment shown beside each decision card.
 *
 * The road runs from the bottom of the frame (where the student has already
 * been) up toward the top-right, where it dissolves into fog — the decisions
 * not yet made. The travelled stretch fills in crimson as decisions accumulate.
 */

const VB_W = 400;
const VB_H = 440;

// One shared outline for the road surface and the travelled overlay.
const ROAD_D =
  "M30 440 L170 440 Q240 300 300 168 L286 160 Q150 290 30 440 Z";

// Centre line of the road, as a quadratic bezier — milestones ride along it.
const C0 = { x: 100, y: 440 };
const C1 = { x: 175, y: 330 };
const C2 = { x: 293, y: 164 };

function pointOnCentre(t) {
  const u = 1 - t;
  return {
    x: u * u * C0.x + 2 * u * t * C1.x + t * t * C2.x,
    y: u * u * C0.y + 2 * u * t * C1.y + t * t * C2.y,
  };
}

export default function CareerRoad({ mood, completed, total }) {
  // How far up the road the student has already walked.
  const progress = total > 0 ? completed / total : 0;
  const travelledTop = 440 - progress * 250;

  const milestones = Array.from({ length: completed }, (_, i) => {
    const t = ((i + 1) / (completed + 1)) * progress;
    const p = pointOnCentre(t);
    return { ...p, r: 3.6 - t * 2 };
  });

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: "100%", display: "block" }}>
        <defs>
          <linearGradient id="roadFade" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#4A4A52" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#3A3A42" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#C8C4BC" stopOpacity="0.1" />
          </linearGradient>
          {/* Anchored in user space so the crimson fades out exactly where the
              student has walked to — no hard edge across the road. */}
          <linearGradient
            id="travelledGrad"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="440"
            x2="0"
            y2={travelledTop - 30}
          >
            <stop offset="0%" stopColor="#981A31" stopOpacity="0.7" />
            <stop offset="55%" stopColor="#981A31" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#981A31" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="fogBall" cx="0.5" cy="0.5">
            <stop offset="0%" stopColor="#C8C4BC" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#C8C4BC" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="horizonGlow" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#00546B" stopOpacity="0" />
            <stop offset="100%" stopColor="#00546B" stopOpacity="0.26" />
          </linearGradient>
        </defs>

        {/* horizon glow behind the fog */}
        <ellipse cx="292" cy="152" rx="120" ry="84" fill="url(#horizonGlow)" />

        {/* the road surface, tapering with distance */}
        <path d={ROAD_D} fill="url(#roadFade)" />

        {/* the stretch already behind the student */}
        <path d={ROAD_D} fill="url(#travelledGrad)" />

        {/* centre line, dashed, fading into the distance */}
        <path
          d={`M${C0.x} ${C0.y} Q${C1.x} ${C1.y}, ${C2.x} ${C2.y}`}
          stroke="#B89A5A"
          strokeOpacity="0.3"
          strokeWidth="2.5"
          strokeDasharray="13 19"
          fill="none"
        />

        {/* one marker per decision already made */}
        {milestones.map((m, i) => (
          <circle
            key={i}
            cx={m.x}
            cy={m.y}
            r={Math.max(m.r, 1.4)}
            fill="#F7F4EF"
            opacity={0.55 - (i / Math.max(completed, 1)) * 0.25}
          />
        ))}

        {/* fog: everything ahead that hasn't been decided yet */}
        <g style={{ animation: "fogDrift 7s ease-in-out infinite" }}>
          <ellipse cx="296" cy="168" rx="112" ry="58" fill="url(#fogBall)" />
          <ellipse cx="246" cy="206" rx="86" ry="40" fill="url(#fogBall)" opacity="0.75" />
          <ellipse cx="332" cy="136" rx="68" ry="36" fill="url(#fogBall)" opacity="0.6" />
        </g>

        <text
          x="300"
          y="106"
          textAnchor="middle"
          fill="#C8C4BC"
          fillOpacity="0.3"
          fontSize="11"
          fontFamily="Inter, sans-serif"
          letterSpacing="2"
        >
          {total - completed} TO GO
        </text>
      </svg>

      {/* the figure, standing on the near stretch of road */}
      <div
        style={{
          position: "absolute",
          left: `${(C0.x / VB_W) * 100}%`,
          bottom: "7%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}
      >
        <Avatar mood={mood} height={230} />
      </div>
    </div>
  );
}
