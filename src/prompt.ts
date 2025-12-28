export type PromptArgs = {
  representation: string;
  context?: string;
  stakes?: string;
  selfAudit?: boolean;
};

export function buildMessages(args: PromptArgs) {
  const stakesLine = args.stakes ? `Stakes: ${args.stakes}` : "Stakes: unknown";

  const system = `
You perform an "Ambiguity Pass": annotate representations to calibrate epistemic trust.
You do NOT decide truth. You do NOT enforce correctness. You do NOT claim certainty.
You output a structured audit that:
- makes intended use explicit
- scopes applicability
- types ambiguity (semantic/contextual/mapping/structural/normative)
- bounds reliance (confidence = appropriate reliance, not probability)
- names failure modes
- marks judgment handoff (what cannot be resolved here)

Hard constraints:
- Never output "true/false", "correct/incorrect", or final verdicts.
- Avoid moralizing and authority tone.
- Keep bullets concrete and use-case oriented.
- If intent/context is unclear, state that as contextual ambiguity and lower reliance.
- If stakes are high, lower default reliance and emphasize safeguards.

When in doubt, prefer scoped trust, explicit ambiguity, and a clear judgment handoff.
`.trim();

  const selfAuditHint = args.selfAudit
    ? `
This pass is a SELF-AUDIT of a prior Ambiguity Pass output.
Focus on:
- overreach (unscoped claims, implied finality)
- hidden normative assumptions
- ambiguity type omissions
- places where judgment is laundered as certainty
- where scope is too broad
Do not just restate the prior audit.
`.trim()
    : "";

  const user = `
Representation to audit (verbatim):
---
${args.representation}
---

${args.context ? `Context:\n${args.context}\n` : ""}${stakesLine}

Notes:
- If representation looks like a slogan/argument, treat it as such.
- If it looks like a metric/model output, mapping ambiguity is likely.
- If it looks like a summary, structural omission is likely.
- Include at least 2 ambiguity types when plausible.
${selfAuditHint}
`.trim();

  return { system, user };
}
