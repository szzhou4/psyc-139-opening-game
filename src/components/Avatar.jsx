/**
 * Avatar — the visual signature of the simulation.
 *
 * A single SVG figure with named groups (head, torso, arms, legs) so CSS
 * keyframes can target each part cleanly. Animation is driven entirely by
 * the `mood` prop.
 *
 *   idle        gentle vertical bob, ~2s loop
 *   thinking    head tilts, "..." loops above the head
 *   walking     4-beat walk cycle (limb swing + body bounce)
 *   celebrating arms up, brief hop, then settles
 *   aged        idle, but with a forward lean and a different prop
 */

// Every value has to separate from the #1C1C1E background, so the "charcoal"
// figure is built from slates that sit a few steps lighter than the page.
const SKIN = "#F2E7DA";
const SKIN_SHADE = "#DCCDBC";
const HAIR = "#332C28";
const HAIR_GREY = "#8E8A85";
const COAT = "#3B3F4A";
const COAT_LIGHT = "#4C515E";
const TROUSER = "#31353E";
const TROUSER_LIGHT = "#3C414B";
const SHOE = "#22252C";
const ACCENT = "#981A31";
const ACCENT_DARK = "#781425";
const ACCENT_AGED = "#B89A5A";
const LINE = "#1C1C1E";

// Animation assignments per mood. Each entry is a CSS `animation` shorthand.
const ANIM = {
  idle: {
    figure: "avatarBob 2.4s ease-in-out infinite",
    head: "avatarBob 2.4s ease-in-out infinite 80ms",
    armL: "none",
    armR: "none",
    legL: "none",
    legR: "none",
  },
  thinking: {
    figure: "avatarBob 3.2s ease-in-out infinite",
    head: "headTilt 3.2s ease-in-out infinite",
    armL: "none",
    armR: "none",
    legL: "none",
    legR: "none",
  },
  walking: {
    figure: "walkBounce 620ms ease-in-out infinite",
    head: "none",
    armL: "armSwingFront 620ms ease-in-out infinite",
    armR: "armSwingBack 620ms ease-in-out infinite",
    legL: "legSwingFront 620ms ease-in-out infinite",
    legR: "legSwingBack 620ms ease-in-out infinite",
  },
  celebrating: {
    figure: "celebrateHop 1200ms ease-out 1, avatarBob 2.4s ease-in-out 1200ms infinite",
    head: "none",
    armL: "armsUp 1200ms ease-out 1",
    armR: "armsUpMirror 1200ms ease-out 1",
    legL: "none",
    legR: "none",
  },
  aged: {
    figure: "avatarBob 3.6s ease-in-out infinite",
    head: "avatarBob 3.6s ease-in-out infinite 120ms",
    armL: "none",
    armR: "none",
    legL: "none",
    legR: "none",
  },
};

// SVG elements need an explicit transform box + origin for CSS rotation.
const pivot = (x, y) => ({
  transformBox: "view-box",
  transformOrigin: `${x}px ${y}px`,
});

export default function Avatar({
  mood = "idle",
  height = 300,
  width,
  x,
  y,
  className = "",
}) {
  const a = ANIM[mood] ?? ANIM.idle;
  const isAged = mood === "aged";
  const accent = isAged ? ACCENT_AGED : ACCENT;

  return (
    <svg
      className={className}
      viewBox="0 0 120 210"
      height={height}
      width={width}
      x={x}
      y={y}
      role="img"
      aria-label="Your avatar"
      style={{ overflow: "visible", maxWidth: "100%" }}
    >
      <defs>
        {/* light falls from the upper left, so every form is lit on that side */}
        <linearGradient id="coatGrad" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stopColor={COAT_LIGHT} />
          <stop offset="72%" stopColor={COAT} />
          <stop offset="100%" stopColor="#31343D" />
        </linearGradient>
        <linearGradient id="headGrad" x1="0" y1="0" x2="1" y2="0.7">
          <stop offset="0%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_SHADE} />
        </linearGradient>
        <radialGradient id="shadowGrad">
          <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow — stays put while the figure bobs */}
      <ellipse cx="60" cy="192" rx="32" ry="7" fill="url(#shadowGrad)" />

      <g
        className="avatar-figure"
        style={{
          animation: a.figure,
          ...pivot(60, 192),
          transform: isAged ? "rotate(3deg)" : undefined,
        }}
      >
        {/* ---------------- legs ---------------- */}
        <g className="avatar-leg-back" style={{ animation: a.legR, ...pivot(60, 106) }}>
          <path
            d="M56 104 L49 176"
            stroke={TROUSER}
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
          />
          {/* shoe */}
          <path
            d="M49 180 L39 182"
            stroke={SHOE}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        <g className="avatar-leg-front" style={{ animation: a.legL, ...pivot(60, 106) }}>
          <path
            d="M64 104 L71 176"
            stroke={TROUSER_LIGHT}
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M71 180 L81 182"
            stroke={SHOE}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* ---------------- back arm ---------------- */}
        <g className="avatar-arm-back" style={{ animation: a.armR, ...pivot(44, 64) }}>
          <path
            d="M44 64 Q38 86 40 104"
            stroke={COAT}
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="40" cy="107" r="4.4" fill={SKIN_SHADE} />
        </g>

        {/* ---------------- torso ---------------- */}
        <g className="avatar-torso">
          {/* coat */}
          <path
            d="M44 62 Q60 52 76 62 L79 106 Q60 113 41 106 Z"
            fill="url(#coatGrad)"
          />
          {/* rim light down the lit edge — keeps the silhouette readable */}
          <path
            d="M44 62 Q60 52 76 62"
            stroke="#6A7080"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
          {/* open collar over a light shirt */}
          <path d="M53 58 L60 74 L67 58 L60 55 Z" fill="#E8E2D8" />
          <path
            d="M53 58 L60 74 L67 58"
            stroke={COAT}
            strokeWidth="1.4"
            fill="none"
            strokeLinejoin="round"
          />

          {/* accent: satchel strap across the chest */}
          <path
            d="M51 58 L73 100"
            stroke={accent}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          {isAged ? (
            // late career: the bag is gone; a folded pocket square in its place
            <rect x="64" y="70" width="9" height="6.5" rx="1.5" fill={accent} />
          ) : (
            <g>
              <rect x="70" y="94" width="21" height="18" rx="3.5" fill={accent} />
              <rect x="70" y="94" width="21" height="5" rx="2.5" fill={ACCENT_DARK} />
              <rect x="78" y="99" width="5" height="4" rx="1" fill={ACCENT_AGED} />
            </g>
          )}
        </g>

        {/* ---------------- front arm ---------------- */}
        <g className="avatar-arm-front" style={{ animation: a.armL, ...pivot(76, 64) }}>
          <path
            d="M76 64 Q82 86 80 104"
            stroke={COAT_LIGHT}
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="80" cy="107" r="4.4" fill={SKIN} />
        </g>

        {/* ---------------- head ---------------- */}
        <g className="avatar-head" style={{ animation: a.head, ...pivot(60, 56) }}>
          {/* neck */}
          <path d="M55 44 L65 44 L65 58 L55 58 Z" fill={SKIN_SHADE} />

          {/* Hair, built from simple shapes so the silhouette stays clean at
              every size: a rounded cap plus two side lengths that stop level
              with the jaw. Cropped close reads as a men's cut and chin-length
              reads as a women's bob — this deliberately sits between them, with
              rounded ends so it never flicks out to either side. */}
          <g fill={isAged ? "#4A423C" : HAIR}>
            <rect x="41.5" y="28" width="7" height="12" rx="3.5" />
            <rect x="71.5" y="28" width="7" height="12" rx="3.5" />
            <ellipse cx="60" cy="29" rx="18" ry="17" />
          </g>

          {/* face */}
          <ellipse cx="60" cy="32" rx="14.5" ry="16" fill="url(#headGrad)" />

          {/* fringe — one solid sweep, no inner seam */}
          <path
            d="M45.5 31 Q46 15 60 15 Q74 15 74.5 31 Q60 23.5 45.5 31 Z"
            fill={isAged ? "#4A423C" : HAIR}
          />

          {isAged && (
            // grey coming in at the temple: decades later
            <path d="M45 33 Q44.5 19 54 15.5 Q47.5 22 46.5 34 Z" fill={HAIR_GREY} />
          )}
          {/* eyes + a suggestion of a mouth */}
          <circle cx="54" cy="33" r="1.7" fill={LINE} />
          <circle cx="65" cy="33" r="1.7" fill={LINE} />
          <path
            d="M56 40 Q60 42.5 64 40"
            stroke={LINE}
            strokeOpacity="0.45"
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* ---------------- thinking dots ---------------- */}
        {mood === "thinking" && (
          <g className="avatar-thought">
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={50 + i * 10}
                cy="6"
                r="3.2"
                fill={ACCENT_AGED}
                style={{ animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </g>
        )}
      </g>
    </svg>
  );
}
