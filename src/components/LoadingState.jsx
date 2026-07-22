/**
 * Skeleton shown on the decision card while Claude writes the scenario.
 * The "thinking" avatar animation is driven separately from DecisionScreen.
 */
export default function LoadingState() {
  const widths = ["100%", "94%", "97%", "62%"];

  return (
    <div className="skeleton" aria-live="polite" aria-busy="true">
      {widths.map((w, i) => (
        <div
          key={i}
          className="skeleton-line"
          style={{ width: w, animationDelay: `${i * 140}ms` }}
        />
      ))}
      <p className="skeleton-label">Simulating your career…</p>
    </div>
  );
}
