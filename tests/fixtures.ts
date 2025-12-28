import type { Audit } from "../src/auditSchema.js";

export const fixtureAudit: Audit = {
  representation: { raw: "X", kind: "metric", short: "X short" },
  intended_use: {
    primary: "decision_support",
    tier: "operational",
    notes: "",
    alternatives: [],
  },
  decision_context: {
    stakes: "medium",
    reversibility: "medium",
    detectability: "moderate",
    time_pressure: "medium",
    alternatives_available: ["second source"],
    notes: "",
  },
  scope: {
    within: ["planning"],
    outside: ["final justification"],
    assumptions: ["data is recent"],
  },
  ambiguities: [
    {
      type: "mapping",
      description: "Proxy may not track outcome.",
      why_it_matters: "Could optimize the wrong thing.",
      signals: ["metric moved but outcomes didn’t"],
      what_to_do_now: ["validate against outcome metric"],
    },
  ],
  confidence: {
    reliance: "medium",
    reliance_cap: "supporting",
    rationale: "Useful as one input, not decisive.",
    verification_steps: ["compare to retention cohort"],
    safeguards: ["monitor regressions"],
    what_would_raise: ["validated on holdout"],
    what_would_lower: ["regime change"],
  },
  failure_modes: [
    {
      mode: "Metric improves while user outcomes worsen",
      impact: "Bad decisions",
      detectability: "moderate",
      mitigations: ["track outcome metric"],
      fallback: ["pause rollout"],
    },
  ],
  judgment_handoff: {
    unresolved: ["acceptable tradeoffs"],
    who_owns_it: "PM",
    next_questions: ["what outcomes matter most?"],
  },
  meta: {
    generated_at_iso: new Date().toISOString(),
    model: "test",
    warnings: [],
    schema_version: "2",
  },
};
