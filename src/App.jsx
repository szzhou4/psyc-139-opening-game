import { useCallback, useEffect, useReducer, useRef } from "react";
import { decisions as DECISIONS } from "./data/decisions";
import {
  generateScenario,
  generateNarrative,
  generateOutcomeCard,
  generateNodeNotes,
  hasApiKey,
} from "./api/claudeClient";
import WelcomeScreen from "./components/WelcomeScreen";
import OnboardingForm from "./components/OnboardingForm";
import DecisionScreen from "./components/DecisionScreen";
import CareerMap from "./components/CareerMap";

const initialState = {
  screen: "welcome", // "welcome" | "onboarding" | "decision" | "map"
  currentDecisionIndex: 0,
  profile: { major: "", experience: "", aspiration: "", fear: "" },
  scenarios: {}, // decisionId -> personalized scenario text
  decisions: [], // decisions the student has actually made
  narrative: "",
  outcomeCard: "",
  nodeNotes: [],
  isLoading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "BEGIN":
      return { ...state, screen: "onboarding" };

    case "SET_PROFILE":
      return {
        ...state,
        profile: action.profile,
        screen: "decision",
        currentDecisionIndex: 0,
      };

    case "SCENARIO_READY":
      return {
        ...state,
        scenarios: { ...state.scenarios, [action.id]: action.text },
      };

    case "RECORD_CHOICE": {
      const src = DECISIONS[state.currentDecisionIndex];
      const made = [
        ...state.decisions,
        {
          id: src.id,
          courseConceptTag: src.courseConceptTag,
          scenarioText: action.scenarioText,
          choiceALabel: src.choiceALabel,
          choiceBLabel: src.choiceBLabel,
          choiceMade: action.choiceMade,
          choiceLabel: action.choiceLabel,
          choiceKey: action.choiceKey,
        },
      ];
      const done = made.length >= DECISIONS.length;
      return {
        ...state,
        decisions: made,
        currentDecisionIndex: done
          ? state.currentDecisionIndex
          : state.currentDecisionIndex + 1,
        screen: done ? "map" : "decision",
        isLoading: done,
      };
    }

    case "FINALE_READY":
      return {
        ...state,
        narrative: action.narrative,
        outcomeCard: action.outcomeCard,
        nodeNotes: action.nodeNotes,
        isLoading: false,
      };

    case "ERROR":
      return { ...state, error: action.error };

    case "RESTART":
      return { ...initialState };

    default:
      return state;
  }
}

const FALLBACK_NARRATIVE = `You begin the way most people do — with more certainty about what you are avoiding than about what you are building. The first decade rewards you for showing up and for saying yes, and you learn the shape of your own competence largely by bumping into its edges.

By mid-career the tradeoffs stop being hypothetical. What you chose early begins to compound, and the paths you left behind become genuinely closed rather than merely deferred. You spend these years deciding, over and over, which kind of success you actually want to be measured by.

By the end you are known for something specific — narrower than you imagined at twenty-two, and more your own. What you kept was the part of the work you would have done anyway. What you let go was the version of this career that belonged to someone else's expectations.`;

const FALLBACK_OUTCOME =
  "At 65, you are known for the particular way you did work that others found ordinary. The tradeoff you lived with longest was the one between the life you were building and the life you were postponing. Looking back, the decision that shaped everything was the first one, made before you knew it counted.";

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const inFlight = useRef(new Set());
  const finaleFired = useRef(false);

  /**
   * Fetch a scenario if we don't already have it (or have one in flight).
   * Prefetching the *next* decision while the student reads the current one is
   * what keeps the simulation inside its 15–20 minute budget.
   */
  const ensureScenario = useCallback(
    async (index, profile) => {
      const decision = DECISIONS[index];
      if (!decision) return;
      if (state.scenarios[decision.id] || inFlight.current.has(decision.id)) return;

      if (!hasApiKey) {
        dispatch({
          type: "SCENARIO_READY",
          id: decision.id,
          text: decision.baseScenarioFrame,
        });
        return;
      }

      inFlight.current.add(decision.id);
      try {
        const text = await generateScenario(profile, decision);
        dispatch({ type: "SCENARIO_READY", id: decision.id, text });
      } catch (err) {
        console.error(`Scenario generation failed for ${decision.id}:`, err);
        dispatch({
          type: "SCENARIO_READY",
          id: decision.id,
          text: decision.baseScenarioFrame,
        });
      } finally {
        inFlight.current.delete(decision.id);
      }
    },
    [state.scenarios]
  );

  // Current decision + one ahead.
  useEffect(() => {
    if (state.screen !== "decision") return;
    ensureScenario(state.currentDecisionIndex, state.profile);
    ensureScenario(state.currentDecisionIndex + 1, state.profile);
  }, [state.screen, state.currentDecisionIndex, state.profile, ensureScenario]);

  // Narrative + outcome card + node notes, all in parallel.
  useEffect(() => {
    if (state.screen !== "map" || finaleFired.current) return;
    finaleFired.current = true;

    if (!hasApiKey) {
      dispatch({
        type: "FINALE_READY",
        narrative: FALLBACK_NARRATIVE,
        outcomeCard: FALLBACK_OUTCOME,
        nodeNotes: [],
      });
      return;
    }

    Promise.all([
      generateNarrative(state.profile, state.decisions).catch((e) => {
        console.error("Narrative generation failed:", e);
        return FALLBACK_NARRATIVE;
      }),
      generateOutcomeCard(state.profile, state.decisions).catch((e) => {
        console.error("Outcome card generation failed:", e);
        return FALLBACK_OUTCOME;
      }),
      generateNodeNotes(state.profile, state.decisions).catch((e) => {
        console.error("Node notes generation failed:", e);
        return [];
      }),
    ]).then(([narrative, outcomeCard, nodeNotes]) =>
      dispatch({ type: "FINALE_READY", narrative, outcomeCard, nodeNotes })
    );
  }, [state.screen, state.profile, state.decisions]);

  function restart() {
    inFlight.current = new Set();
    finaleFired.current = false;
    dispatch({ type: "RESTART" });
  }

  const decision = DECISIONS[state.currentDecisionIndex];

  return (
    <div className="app">
      {state.screen === "welcome" && (
        <WelcomeScreen onBegin={() => dispatch({ type: "BEGIN" })} />
      )}

      {state.screen === "onboarding" && (
        <OnboardingForm
          apiKeyMissing={!hasApiKey}
          onSubmit={(profile) => dispatch({ type: "SET_PROFILE", profile })}
        />
      )}

      {state.screen === "decision" && (
        <DecisionScreen
          key={decision.id}
          decision={decision}
          scenarioText={state.scenarios[decision.id]}
          index={state.currentDecisionIndex}
          total={DECISIONS.length}
          onChoose={(choice) => dispatch({ type: "RECORD_CHOICE", ...choice })}
        />
      )}

      {state.screen === "map" && (
        <CareerMap
          madeDecisions={state.decisions}
          narrative={state.narrative}
          outcomeCard={state.outcomeCard}
          nodeNotes={state.nodeNotes}
          loading={state.isLoading}
          onRestart={restart}
        />
      )}
    </div>
  );
}
