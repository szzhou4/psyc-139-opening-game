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
      text: `The student's profile:
- Major/field: ${profile.major}
- Relevant past experience: ${profile.experience}
- What they most want from their career: ${profile.aspiration}
- What they most fear: ${profile.fear}`,
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
1. Write in second person, present tense ("You are 27. Your manager approaches you...")
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

// --- API Call 1: decision scenario personalization --------------------------

export async function generateScenario(profile, decision) {
  const userMessage = `Generate a career decision scenario for this decision point.

Decision concept: ${decision.courseConceptTag}
Base scenario frame: ${decision.baseScenarioFrame}
Choice A label: ${decision.choiceALabel}
Choice B label: ${decision.choiceBLabel}

${SCENARIO_RULES}

Make it feel specific and real for this student. Maximum 100 words.`;

  return callClaude(buildSystem(profile), userMessage);
}

// --- API Call 2: career narrative -------------------------------------------

export async function generateNarrative(profile, madeDecisions) {
  const summary = madeDecisions
    .map((d) => `- ${d.courseConceptTag}: Chose "${d.choiceMade}" (${d.choiceLabel})`)
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
    .map((d) => `- ${d.courseConceptTag}: ${d.choiceLabel}`)
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
    .map((d, i) => `${i + 1}. ${d.courseConceptTag} — chose: ${d.choiceLabel}`)
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
