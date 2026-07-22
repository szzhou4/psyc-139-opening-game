import { useState } from "react";
import Avatar from "./Avatar";

const FIELDS = [
  {
    key: "major",
    label: "Your major or area of study",
    placeholder: "e.g., Psychology, Economics, Dual: PPE",
  },
  {
    key: "experience",
    label: "One relevant experience you've had",
    placeholder: "e.g., Marketing internship at a startup",
  },
  {
    key: "aspiration",
    label: "One thing you most want from your career",
    placeholder: "e.g., To feel like my work matters",
  },
  {
    key: "fear",
    label: "One thing you most fear about your career",
    placeholder: "e.g., Ending up in the wrong field",
  },
];

export default function OnboardingForm({ onSubmit, apiKeyMissing }) {
  const [values, setValues] = useState({
    major: "",
    experience: "",
    aspiration: "",
    fear: "",
  });

  const complete = FIELDS.every((f) => values[f.key].trim().length > 0);

  function handleSubmit(e) {
    e.preventDefault();
    if (!complete) return;
    const trimmed = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v.trim()])
    );
    onSubmit(trimmed);
  }

  return (
    <div className="screen">
      <div className="onboarding">
        <div className="onboarding-avatar">
          <Avatar mood="idle" height={320} />
        </div>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <h1 className="headline" style={{ fontSize: "2.1rem" }}>
            Before we begin, tell us a little about yourself.
          </h1>
          <p className="subheadline" style={{ marginBottom: 32 }}>
            Your answers will shape everything that follows.
          </p>

          {apiKeyMissing && (
            <div className="notice">
              The server has no Anthropic API key configured. The simulation
              will still run, but scenarios will use their generic wording
              instead of being personalized to you.
            </div>
          )}

          {FIELDS.map((f, i) => (
            <div
              className="field"
              key={f.key}
              style={{ animationDelay: `${120 + i * 90}ms` }}
            >
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type="text"
                autoComplete="off"
                placeholder={f.placeholder}
                value={values[f.key]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}

          <button className="btn" type="submit" disabled={!complete} style={{ marginTop: 10 }}>
            Start Simulation
          </button>
        </form>
      </div>
    </div>
  );
}
