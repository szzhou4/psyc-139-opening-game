import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import NarrativePanel from "./NarrativePanel";
import OutcomeCard from "./OutcomeCard";

const W = 900;
const H = 700;
const DRAW_MS = 3000;

/**
 * Lay the decisions out along a winding diagonal, bottom-left to top-right.
 * The top of the range stops well short of y=0 to leave headroom for the
 * figure (which stands ~82 units tall above its anchor) and the age marker.
 */
function layoutNodes(count) {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    return {
      x: 74 + t * 700,
      y: 636 - t * 448 + Math.sin(t * Math.PI * 3.1) * 58,
    };
  });
}

/** Smooth Catmull-Rom spline through the points, emitted as cubic beziers. */
function splinePath(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function CareerMap({
  madeDecisions,
  narrative,
  outcomeCard,
  nodeNotes,
  loading,
  onRestart,
}) {
  const [hovered, setHovered] = useState(null);
  const [avatarMood, setAvatarMood] = useState("walking");

  /**
   * Tooltips live in HTML rather than <foreignObject>, which renders
   * inconsistently across GPU paths. That means mapping SVG user units to
   * container pixels ourselves — with preserveAspectRatio="xMidYMid meet"
   * the transform is a uniform scale plus centring offsets.
   */
  const canvasRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, dx: 0, dy: 0, width: 0 });

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const scale = Math.min(width / W, height / H);
      setFit({
        scale,
        dx: (width - W * scale) / 2,
        dy: (height - H * scale) / 2,
        width,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The tooltip is 250px wide and centred on the node, so keep its centre far
  // enough from either edge that it never runs off the canvas.
  const TOOLTIP_HALF = 133;
  const toPixels = (p) => {
    const raw = fit.dx + p.x * fit.scale;
    const max = Math.max(TOOLTIP_HALF, fit.width - TOOLTIP_HALF);
    return {
      left: Math.min(Math.max(raw, TOOLTIP_HALF), max),
      top: fit.dy + p.y * fit.scale,
    };
  };

  // The figure walks while the road draws, celebrates on arrival, then settles.
  useEffect(() => {
    const a = setTimeout(() => setAvatarMood("celebrating"), DRAW_MS);
    const b = setTimeout(() => setAvatarMood("aged"), DRAW_MS + 1300);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const nodes = layoutNodes(madeDecisions.length);
  // Extend one segment past the last decision so the figure walks to "present day".
  const last = nodes[nodes.length - 1];
  const endPoint = { x: Math.min(last.x + 60, W - 56), y: last.y - 40 };
  const pathPts = [...nodes, endPoint];
  const d = splinePath(pathPts);

  return (
    <div className="screen map-screen">
      <div className="map-canvas" ref={canvasRef}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="mapRoad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#981A31" />
              <stop offset="70%" stopColor="#B52440" />
              <stop offset="100%" stopColor="#B89A5A" />
            </linearGradient>
            <filter id="roadGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* faded stubs: the roads not taken at each decision */}
          {nodes.map((n, i) => (
            <path
              key={`branch-${i}`}
              className="branch-path"
              d={`M${n.x} ${n.y} q ${26 + (i % 3) * 8} ${
                i % 2 === 0 ? 46 : -50
              }, ${58 + (i % 4) * 10} ${i % 2 === 0 ? 62 : -66}`}
              strokeWidth="4"
              style={{
                opacity: 0,
                animation: `fadeIn 500ms ease-out ${
                  600 + (i / nodes.length) * DRAW_MS
                }ms forwards`,
              }}
            />
          ))}

          {/* the path actually travelled */}
          <path
            id="careerPath"
            className="road-path road-draw"
            d={d}
            pathLength="1"
            stroke="url(#mapRoad)"
            strokeWidth="7"
            strokeDasharray="1"
            strokeDashoffset="1"
            filter="url(#roadGlow)"
            style={{ animationDuration: `${DRAW_MS}ms` }}
          />

          {/* decision nodes */}
          {nodes.map((n, i) => {
            const dec = madeDecisions[i];
            const isOn = hovered === i;
            return (
              <g
                key={dec.id}
                className="map-node"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  opacity: 0,
                  animation: `fadeIn 400ms ease-out ${
                    400 + (i / nodes.length) * DRAW_MS
                  }ms forwards`,
                }}
              >
                {/* generous invisible hover target */}
                <circle cx={n.x} cy={n.y} r="22" fill="transparent" />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isOn ? 13 : 9}
                  fill={isOn ? "#B89A5A" : "#F7F4EF"}
                  stroke="#981A31"
                  strokeWidth="3"
                />
                <text
                  x={n.x}
                  y={n.y + 3.5}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="Inter, sans-serif"
                  fill="#1C1C1E"
                  pointerEvents="none"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* present-day marker */}
          <g
            style={{
              opacity: 0,
              animation: `fadeIn 500ms ease-out ${DRAW_MS}ms forwards`,
            }}
          >
            <circle
              cx={endPoint.x}
              cy={endPoint.y}
              r="6"
              fill="#B89A5A"
            />
            <text
              x={endPoint.x}
              y={endPoint.y + 26}
              textAnchor="middle"
              fontSize="11"
              letterSpacing="2"
              fontFamily="Inter, sans-serif"
              fill="#B89A5A"
            >
              AGE 65
            </text>
          </g>

          {/* the figure, walking the road as it draws */}
          <g>
            <animateMotion
              dur={`${DRAW_MS}ms`}
              fill="freeze"
              calcMode="linear"
              rotate="0"
            >
              <mpath href="#careerPath" />
            </animateMotion>
            <Avatar mood={avatarMood} width={46} height={80} x={-23} y={-82} />
          </g>

        </svg>

        {hovered !== null && (
          <div
            className="node-tooltip"
            style={{
              left: toPixels(nodes[hovered]).left,
              top: toPixels(nodes[hovered]).top - 20,
            }}
          >
            <div className="eyebrow concept-tag">
              {madeDecisions[hovered].courseConceptTag}
            </div>
            <p className="tooltip-choice">
              {madeDecisions[hovered].choiceLabel}
            </p>
            <p className="tooltip-note">
              {nodeNotes[hovered] || "One of the turns that made the rest possible."}
            </p>
          </div>
        )}

        <div className="map-hint">Hover any node to revisit that decision</div>
      </div>

      <div className="map-panel">
        <NarrativePanel narrative={narrative} loading={loading} />
        <OutcomeCard text={outcomeCard} loading={loading} />

        <button
          className="btn btn-ghost"
          onClick={onRestart}
          style={{ marginTop: 28 }}
        >
          Run it again
        </button>
      </div>
    </div>
  );
}
