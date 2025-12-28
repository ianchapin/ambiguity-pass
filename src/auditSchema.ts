import { z } from "zod";

export const AmbiguityType = z.enum([
  "semantic",
  "contextual",
  "mapping",
  "structural",
  "normative",
]);

export const IntendedUse = z.enum([
  "exploration",
  "explanation",
  "decision_support",
  "justification",
]);

export const RelianceLevel = z.enum(["very_low", "low", "medium", "high"]);

export const AuditSchema = z.object({
  representation: z.object({
    raw: z.string(),
    kind: z.string().optional(),
    short: z.string().optional(),
  }),

  intended_use: z.object({
    primary: IntendedUse,
    notes: z.string().optional(),
    alternatives: z.array(IntendedUse).optional(),
  }),

  scope: z.object({
    within: z.array(z.string()),
    outside: z.array(z.string()),
    assumptions: z.array(z.string()),
  }),

  ambiguities: z.array(
    z.object({
      type: AmbiguityType,
      description: z.string(),
      why_it_matters: z.string(),
      signals: z.array(z.string()).optional(),
    })
  ),

  confidence: z.object({
    reliance: RelianceLevel,
    rationale: z.string(),
    safeguards: z.array(z.string()),
    what_would_raise: z.array(z.string()),
    what_would_lower: z.array(z.string()),
  }),

  failure_modes: z.array(
    z.object({
      mode: z.string(),
      impact: z.string(),
      detectability: z.enum(["easy", "moderate", "hard"]),
      mitigations: z.array(z.string()),
    })
  ),

  judgment_handoff: z.object({
    unresolved: z.array(z.string()),
    who_owns_it: z.string().optional(),
    next_questions: z.array(z.string()),
  }),

  meta: z
    .object({
      generated_at_iso: z.string(),
      model: z.string().optional(),
      warnings: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Audit = z.infer<typeof AuditSchema>;
