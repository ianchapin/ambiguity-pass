// prompt.ts

export type PromptArgs = {
  representation: string;
  context?: string;

  /**
   * CLI passes this as decisionContext (camelCase).
   * The model output schema uses decision_context (snake_case) — that's fine;
   * this file just formats the prompt input.
   */
  decisionContext?: {
    stakes?: string; // low|medium|high|unknown
    reversibility?: string; // high|medium|low|unknown
    detectability?: string; // easy|moderate|hard|unknown
    time_pressure?: string; // low|medium|high|unknown
    alternatives_available?: string[]; // other checks/sources
    notes?: string; // optional
  };

  selfAudit?: boolean;
};

export function buildMessages(args: PromptArgs) {
  const dc = args.decisionContext ?? {};
  const alt = Array.isArray(dc.alternatives_available)
    ? dc.alternatives_available
    : [];

  const system = `
You perform an "Ambiguity Pass": annotate representations to calibrate epistemic trust.
You do NOT decide truth. You do NOT enforce correctness. You do NOT claim certainty.

OUTPUT MUST MATCH THE PROVIDED JSON SCHEMA EXACTLY.

NON-NEGOTIABLES:
- Never output "true/false", "correct/incorrect", or final verdicts.
- Avoid moralizing and authority tone.
- Keep bullets concrete, checkable, and use-case oriented.

REQUIRED FIELDS (v2):
- intended_use.tier ∈ {exploratory, explanatory, operational, high_stakes}
- confidence.reliance_cap ∈ {input_only, supporting, weight_bearing, decisive}
- decision_context fields populated; if unknown, use "unknown" (do not invent).
- confidence.verification_steps: include 1–3 concrete checks whenever possible.
- failure_modes[].fallback: include 1–2 fallback/rollback actions where applicable.

ANTI-PERFORMATIVITY RULE:
If you cannot name BOTH:
(1) how failure would be detected, and
(2) what we do when detection happens (fallback / rollback / stop),
then confidence.reliance_cap MUST NOT be "decisive".

AMBIGUITY SELECTION RULE:
- Include 0–3 ambiguity items maximum.
- If tempted to list many, merge or select the dominant ones.
- It is acceptable to include 0 ambiguity types when the representation is tightly scoped and directly verifiable now.

“KNIFE RULES” (classification aids):
- Contextual vs Scope:
  * contextual ambiguity: situation changed (stake/incentives/users/environment) OR original context is unclear/forgotten
  * scope creep: job changed (explore -> decide, explain -> justify, monitor -> incentivize)
  Use contextual when reuse context is unclear; use scope fields to describe boundaries.
- Mapping vs Structural:
  * mapping ambiguity: "does this output/metric correspond to the underlying thing?"
  * structural ambiguity: "even if it did, the representation cannot express what matters / omits key factors"

CALIBRATION NOTE:
High stakes does NOT automatically imply low reliance.
If the representation is directly verifiable now, tightly scoped, and failures are quickly detectable + reversible,
then reliance may be high — but emphasize verification_steps and safeguards.
If intent/context is unclear OR claim is not verifiable here, treat contextual/mapping ambiguity as likely and reduce reliance.

STYLE:
- Prefer short, concrete bullets.
- Avoid jargon unless necessary.
- Do not imply this is a complete analysis.
`.trim();

  const selfAuditHint = args.selfAudit
    ? `
THIS PASS IS A SELF-AUDIT of a prior Ambiguity Pass output.
Focus on:
- overreach (unscoped claims, implied finality)
- hidden normative assumptions
- missing ambiguity types
- where judgment is laundered as certainty
- scope too broad / reliance_cap too high
- missing verification/fallback pathways
Do not just restate the prior audit; critique it.
`.trim()
    : "";

  const stakesLine =
    typeof dc.stakes === "string" && dc.stakes.trim()
      ? dc.stakes.trim()
      : "unknown";
  const reversibilityLine =
    typeof dc.reversibility === "string" && dc.reversibility.trim()
      ? dc.reversibility.trim()
      : "unknown";
  const detectabilityLine =
    typeof dc.detectability === "string" && dc.detectability.trim()
      ? dc.detectability.trim()
      : "unknown";
  const timePressureLine =
    typeof dc.time_pressure === "string" && dc.time_pressure.trim()
      ? dc.time_pressure.trim()
      : "unknown";

  const user = `
Representation to audit (verbatim):
---
${args.representation}
---

${args.context ? `Context:\n${args.context}\n` : ""}

Decision context:
- stakes: ${stakesLine}
- reversibility: ${reversibilityLine}
- detectability: ${detectabilityLine}
- time_pressure: ${timePressureLine}
- alternatives_available: ${alt.length ? alt.join(" | ") : "(none provided)"}
${dc.notes?.trim() ? `- notes: ${dc.notes.trim()}` : ""}

Notes:
- If the representation looks like a slogan/argument, treat it as such.
- If it looks like a metric/model output, mapping ambiguity is likely.
- If it looks like a summary, structural omission is likely.
- Include only ambiguity types that are truly present (0–3).
${selfAuditHint}
`.trim();

  return { system, user };
}
