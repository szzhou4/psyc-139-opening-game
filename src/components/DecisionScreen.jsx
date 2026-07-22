import { useEffect, useState } from "react";
import CareerRoad from "./CareerRoad";
import LoadingState from "./LoadingState";

export default function DecisionScreen({
  decision,
  scenarioText,
  index,
  total,
  onChoose,
}) {
  const [selected, setSelected] = useState(null);
  const [leaving, setLeaving] = useState(false);

  // Reset interaction state whenever we arrive at a new decision.
  useEffect(() => {
    setSelected(null);
    setLeaving(false);
  }, [decision.id]);

  const loading = !scenarioText;

  let mood = "idle";
  if (loading) mood = "thinking";
  if (selected) mood = "walking";

  function choose(which) {
    if (selected) return;
    setSelected(which);
    // Let the button pulse and the avatar step off before advancing.
    setTimeout(() => setLeaving(true), 420);
    setTimeout(() => {
      onChoose({
        choiceMade: which,
        choiceLabel: which === "A" ? decision.choiceALabel : decision.choiceBLabel,
        choiceKey: which === "A" ? decision.choiceAKey : decision.choiceBKey,
        scenarioText: scenarioText || decision.baseScenarioFrame,
      });
    }, 720);
  }

  const pct = ((index + (selected ? 1 : 0)) / total) * 100;

  return (
    <div className={`screen ${leaving ? "screen-out" : ""}`}>
      <div className="progress-rail">
        {/* The course concept is deliberately not shown here — naming it while
            the student is still deciding primes the answer. It's revealed on
            the career map at the end, where it becomes the teaching point. */}
        <div className="progress-meta">
          <span>
            Decision {index + 1} of {total}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="decision-body">
        <div className="decision-left">
          <CareerRoad mood={mood} completed={index} total={total} />
        </div>

        <div className="decision-right">
          <div className="decision-card">
            {loading ? (
              <LoadingState />
            ) : (
              <p className="scenario-text">{scenarioText}</p>
            )}

            <div className="choices">
              <button
                className={[
                  "choice",
                  "choice-a",
                  selected === "A" ? "choice-selected" : "",
                  selected && selected !== "A" ? "choice-dimmed" : "",
                ].join(" ")}
                onClick={() => choose("A")}
                disabled={loading || Boolean(selected)}
              >
                <span className="choice-index">A</span>
                {decision.choiceALabel}
              </button>

              <button
                className={[
                  "choice",
                  "choice-b",
                  selected === "B" ? "choice-selected" : "",
                  selected && selected !== "B" ? "choice-dimmed" : "",
                ].join(" ")}
                onClick={() => choose("B")}
                disabled={loading || Boolean(selected)}
              >
                <span className="choice-index">B</span>
                {decision.choiceBLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
