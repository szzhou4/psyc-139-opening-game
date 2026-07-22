import { CAREER_SCIENCE_KNOWLEDGE_BASE } from "../data/knowledgeBase";

/**
 * All calls go through our own serverless function (see api/claude.js), which
 * holds the Anthropic key server-side. The key is never shipped to the browser,
 * so the model and token ceiling are set there rather than here.
 */
const API_ENDPOINT = "/api/claude";

// null = not yet probed. The UI uses this to warn the instructor if the server
// has no key configured, without ever learning anything about the key itself.
let apiConfigured = null;

export function isApiConfigured() {
  return apiConfigured;
}

export async function probeApi() {
  try {
    const res = await fetch(API_ENDPOINT, { method: "GET" });
    const data = await res.json();
    apiConfigured = Boolean(data.configured);
  } catch (err) {
    console.error("Could not reach the Claude proxy:", err);
    apiConfigured = false;
  }
  return apiConfigured;
}

/**
 * ---------------------------------------------------------------------------
 * Prompt caching
 * ---------------------------------------------------------------------------
 * The Anthropic API is stateless — there is no way to upload the knowledge base
 * once and refer back to it. Every request must carry the full prompt.
 *
 * What we can do is make the API cache it. Caching is a *prefix* match, so the
 * system prompt is split into two blocks:
 *
 *   1. STATIC_SYSTEM  — preamble + knowledge base. Byte-identical for every
 *                       student and every call type, so the whole class shares
 *                       a single cache entry. This is the block we mark.
 *   2. profile block  — the four onboarding answers. Differs per student, so it
 *                       must come *after* the cache breakpoint.
 *
 * Anything volatile placed before the breakpoint would invalidate the cache for
 * everyone, which is why the per-student profile is second and the scenario
 * rules live in the user message rather than the system prompt.
 *
 * Cache reads bill at 0.1x input; the one-hour write bills at 2x. With ~350
 * calls in a class session that trade is overwhelmingly worth it.
 */
const STATIC_SYSTEM = `You are the narrator of a career simulation game for undergraduate students at Claremont McKenna College taking a course called "The Science of Careers, Purpose, and Vocational Identity." Your job is to generate realistic, personalized career decision scenarios grounded in vocational psychology research.

You have deep knowledge of career science concepts and findings from vocational psychology and management studies, based on peer-reviewed journal articles that the students will read throughout the semester. That literature is summarized below. Use it to ground everything you write.

${CAREER_SCIENCE_KNOWLEDGE_BASE}`;

// A one-hour TTL keeps the entry alive across the whole class period, including
// setup time and stragglers. The 2x write premium is paid once for the room.
const CACHE_CONTROL = { type: "ephemeral", ttl: "1h" };

function buildSystem(profile) {
  return [
    { type: "text", text: STATIC_SYSTEM, cache_control: CACHE_CONTROL },
    {
      type: "text",
      // Framed explicitly as starting conditions. Stated as a plain "profile",
      // the model reads these as the person's *present* situation and keeps
      // writing fresh-graduate scenarios no matter what age it is given.
      text: `STARTING CONDITIONS — who this person was at age 22, when the
simulation begins. This is their backstory, NOT their current situation:

- What they studied in college: ${profile.major}
- An experience they had before graduating: ${profile.experience}
- What they most want from their career: ${profile.aspiration}
- What they most fear: ${profile.fear}

These shape the kind of working life the simulation gives them, and their
motivations stay relevant throughout. But after the first decision they are no
longer a student and never return to one. At later ages, their degree is
something they earned decades ago, not something they are finishing.`,
    },
  ];
}

export async function callClaude(system, userMessage) {
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${body}`);
  }

  const data = await response.json();
  logCacheUsage(data.usage);
  return data.content[0].text.trim();
}

/**
 * Confirms the cache is actually working. On a warm cache
 * `cache_read_input_tokens` should be ~3,900 and `input_tokens` should be small.
 * If reads stay at zero across calls, the cached prefix is being invalidated.
 */
function logCacheUsage(usage) {
  if (!usage) return;
  // console.log, not console.debug — Chrome files debug under "Verbose", which
  // is hidden at the default log level, so the instructor would never see this.
  console.log(
    `[cache] read=${usage.cache_read_input_tokens ?? 0} ` +
      `write=${usage.cache_creation_input_tokens ?? 0} ` +
      `uncached=${usage.input_tokens ?? 0}`
  );
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const SCENARIO_RULES = `Follow these rules:
1. Write in second person, present tense.
2. LENGTH IS A HARD CONSTRAINT: no more than 100 words, in 4–5 sentences.
   Students read eleven of these in a 15-minute class activity, and the text has
   to fit on screen above the choice buttons. Going over is a failure, not a
   richer answer. Spend the words on the situation and the tension, not on
   explaining what each option would give them — the choice buttons say that.
3. Make the decision feel genuinely difficult — both choices should be defensible
4. Ground the scenario in the specific course concept for this decision point
5. Reference ONE of the student's four profile details where it adds realism —
   not all four. Specificity beats completeness.
6. Do not moralize or signal which choice is "correct"
7. Return only the scenario text — no preamble, no labels, no commentary`;

const CONTINUITY_RULES = `CONTINUITY — this is one continuous life, not eleven separate vignettes:

- The stated age is authoritative. Use it. Never state or imply a different age,
  and never contradict the ages of earlier decisions.
- Their career so far is given below. This scenario is the NEXT CHAPTER of that
  story. Do not restart them, re-graduate them, or put them back at an earlier
  stage.
- Refer to at least one specific earlier choice by its consequence, not by
  restating it. If they went self-directed at 46, then at 50 they have clients,
  not a manager. If they took the promotion at 25, they carry that seniority.
- Let earlier choices constrain what is plausible now. Someone who left for a
  calling at 42 is not casually offered a corporate ladder at 46 — if the
  decision point requires it, explain how it reached them.
- Keep the through-line concrete: the same field, the same accumulating
  expertise, the same relationships aging alongside them. Invent details freely,
  but once invented they are fixed for the rest of the run.
- Do not summarize their history back to them. Let it show through the
  situation.`;

// --- API Call 1: decision scenario personalization --------------------------

/**
 * `history` is the decisions already made, in order. Passing it is what makes
 * the eleven scenarios read as one life rather than eleven unrelated vignettes.
 * It also carries the scenario text of the previous step so the model can
 * continue concrete details (employer, field, relationships) instead of
 * inventing a fresh set each time.
 */
export async function generateScenario(profile, decision, history = []) {
  const storySoFar = history.length
    ? history
        .map(
          (d) =>
            `- Age ${d.age}: chose "${d.choiceLabel}"` +
            (d.scenarioText ? `\n    situation: ${d.scenarioText}` : "")
        )
        .join("\n")
    : "(This is the very first decision — they are just starting out.)";

  const yearsOut = decision.age - 22;
  const stageNote =
    yearsOut === 0
      ? "They have just finished college. This is the only scenario where that is true."
      : `They finished college ${yearsOut} years ago. They are an established working adult, ` +
        `not a student and not a new graduate. Do NOT write about graduating, finishing a ` +
        `degree, or looking for a first job.`;

  const userMessage = `=== AGE: ${decision.age} ===

This person is ${decision.age} years old. ${stageNote}

Their career so far:

${storySoFar}

=== THE DECISION TO WRITE ===

Concept: ${decision.courseConceptTag}
Base dilemma: ${decision.baseScenarioFrame}
Choice A: ${decision.choiceALabel}
Choice B: ${decision.choiceBLabel}

The base dilemma is written generically. Your job is to stage that same
underlying choice inside this specific person's life at ${decision.age}. Keep
the choice intact; change everything else so it fits where they actually are.

${CONTINUITY_RULES}

${SCENARIO_RULES}

Before you write, check: is this a situation a ${decision.age}-year-old with the
history above would actually face? If it reads like it could open the story, it
is wrong. Maximum 100 words.`;

  return callClaude(buildSystem(profile), userMessage);
}

// --- API Call 2: career narrative -------------------------------------------

export async function generateNarrative(profile, madeDecisions) {
  const summary = madeDecisions
    .map((d) => `- Age ${d.age} — ${d.courseConceptTag}: chose "${d.choiceLabel}"`)
    .join("\n");

  const userMessage = `The student has completed their career simulation. Here is a summary of every decision they made:

${summary}

Write a 3-paragraph career narrative in second person, present tense.
- Paragraph 1: Early career (what kind of professional they became, roughly ages 22–35)
- Paragraph 2: Mid-career (the tensions that emerged, what they built or changed, roughly ages 35–50)
- Paragraph 3: Late career (what they're known for, what they kept and what they let go, roughly ages 50–65)

Ground the narrative in vocational psychology concepts where natural — don't force it, but let the theory inform the arc. Write as literary narrative, not a career counseling report. 250–300 words total. Return only the three paragraphs, separated by blank lines — no headings, no labels, no preamble.`;

  return callClaude(buildSystem(profile), userMessage);
}

// --- API Call 3: 65-year-old outcome card ------------------------------------

export async function generateOutcomeCard(profile, madeDecisions) {
  const summary = madeDecisions
    .map((d) => `- Age ${d.age} — ${d.courseConceptTag}: ${d.choiceLabel}`)
    .join("\n");

  const userMessage = `Based on these career decisions:

${summary}

Write a 65-year-old outcome vignette in exactly this format — three sentences, second person:

"At 65, you are known for [specific, concrete thing]. The tradeoff you lived with longest was [a real tension from their decisions]. Looking back, the decision that shaped everything was [reference one specific decision they made]."

Be specific and honest — not all outcomes should feel triumphant. Return only the three sentences in the format above.`;

  return callClaude(buildSystem(profile), userMessage);
}

// --- Node tooltips: one line on why each choice mattered ---------------------

export async function generateNodeNotes(profile, madeDecisions) {
  const summary = madeDecisions
    .map((d, i) => `${i + 1}. Age ${d.age} — ${d.courseConceptTag}: chose "${d.choiceLabel}"`)
    .join("\n");

  const userMessage = `Here are the ${madeDecisions.length} decisions the student made, in order:

${summary}

For each decision, write ONE sentence (max 20 words, second person) naming what that choice set in motion — grounded in the research, not in praise or blame.

Return exactly ${madeDecisions.length} lines, numbered "1." through "${madeDecisions.length}.", nothing else.`;

  const raw = await callClaude(buildSystem(profile), userMessage);
  return raw
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}
