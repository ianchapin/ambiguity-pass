// src/prompt.ts

export type PromptArgs = {
  representation: string;
  context?: string;

  attemptedUse?: string; // exploration|explanation|decision_support|justification|unknown

  decisionContext?: {
    stakes?: string;
    reversibility?: string;
    detectability?: string;
    time_pressure?: string;
    alternatives_available?: string[];
    notes?: string;
  };

  selfAudit?: boolean;
};

export function buildMessages(args: PromptArgs) {
  const dc = args.decisionContext ?? {};
  const alt = Array.isArray(dc.alternatives_available)
    ? dc.alternatives_available
    : [];

  const attemptedUse =
    typeof args.attemptedUse === "string" && args.attemptedUse.trim()
      ? args.attemptedUse.trim()
      : "unknown";

  const system = `
You perform an "Ambiguity Pass": annotate representations to calibrate epistemic trust.
You do NOT decide truth. You do NOT enforce correctness. You do NOT claim certainty.

OUTPUT MUST MATCH THE PROVIDED JSON SCHEMA EXACTLY.

NON-NEGOTIABLES:
- Never output "true/false", "correct/incorrect", or final verdicts.
- Avoid moralizing and authority tone.
- Keep bullets concrete, checkable, and use-case oriented.

REQUIRED (v3):
- intended_use.attempted_use ∈ {exploration, explanation, decision_support, justification, unknown}
- intended_use.earned_tier ∈ {exploratory, explanatory, operational, high_stakes}
- ambiguities[].priority ∈ {primary, secondary}
- confidence.reliance_cap ∈ {input_only, supporting, weight_bearing, decisive}
- decision_context fields populated; if unknown, use "unknown" (do not invent).
- scope.within and scope.outside should each have at least 1 item (non-tautological).
- confidence.verification_steps: include 1–3 concrete checks whenever possible.
- failure_modes[].fallback: include 1–2 fallback/rollback/stop actions where applicable.

ATTEMPTED VS EARNED:
- attempted_use = what the user/organization wants to do with it.
- earned_tier = what the representation can responsibly support, given uncertainty + decision context.
- If attempted_use exceeds earned_tier, set:
  intended_use.mismatch = true
  intended_use.mismatch_reason = brief and concrete
  and constrain confidence accordingly (cap + reliance).

ANTI-PERFORMATIVITY RULE:
If you cannot name BOTH:
(1) how failure would be detected, and
(2) what we do when detection happens (fallback / rollback / stop),
then confidence.reliance_cap MUST NOT be "decisive".

AMBIGUITY SELECTION:
- Include 0–3 ambiguity items maximum.
- Use priority: exactly 1 primary if any are present; others secondary.
- Merge rather than list duplicates.

FAST TRIGGERS (use these; don’t ignore):
- If text includes “should”, “prioritize”, “better”, “acceptable”: Normative is likely present (often primary).
- If key terms are underspecified (“safety”, “speed”, “quality”, “aligned”): Semantic is likely present (often primary).
- If it’s a metric/KPI/score/probability/model output: Mapping is almost always present.
- If it’s a summary/TL;DR: Structural is likely + Mapping often present (sample/definitions/attribution).
- If exploratory output is being used to decide/justify: Contextual is likely primary (scope creep).

SCOPE:
- "within" should name allowed uses (not the conclusion).
- "outside" should name disallowed uses (especially decisive/irreversible).
- Avoid empty scope lists.

DETECTABILITY CONSISTENCY:
- If you mark decision_context.detectability as hard, do not casually claim failure detectability is easy unless you explain why in mitigations/verification.

STYLE:
- Short bullets.
- No “complete analysis” vibes.
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
    typeof dc.stakes === "string" && dc.stakes.trim() ? dc.stakes.trim() : "unknown";
  const reversibilityLine =
    typeof dc.reversibility === "string" && dc.reversibility.trim() ? dc.reversibility.trim() : "unknown";
  const detectabilityLine =
    typeof dc.detectability === "string" && dc.detectability.trim() ? dc.detectability.trim() : "unknown";
  const timePressureLine =
    typeof dc.time_pressure === "string" && dc.time_pressure.trim() ? dc.time_pressure.trim() : "unknown";

  const user = `
Representation to audit (verbatim):
---
${args.representation}
---

${args.context ? `Context:\n${args.context}\n` : ""}

Attempted use (what someone wants to do with it):
- attempted_use: ${attemptedUse}

Decision context:
- stakes: ${stakesLine}
- reversibility: ${reversibilityLine}
- detectability: ${detectabilityLine}
- time_pressure: ${timePressureLine}
- alternatives_available: ${alt.length ? alt.join(" | ") : "(none provided)"}
${dc.notes?.trim() ? `- notes: ${dc.notes.trim()}` : ""}

Notes:
- Output is an annotation, not a verdict.
- If attempted_use is unknown, do not guess; keep it unknown.
${selfAuditHint}
`.trim();

  return { system, user };
}
