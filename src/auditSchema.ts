// src/auditSchema.ts
import { z } from "zod";

/**
 * Structured Outputs–friendly schema:
 * - No .optional()
 * - "Missing" values represented as empty strings / empty arrays
 */

export const AmbiguityType = z.enum([
  "semantic",
  "contextual",
  "mapping",
  "structural",
  "normative",
]);

export const AmbiguityPriority = z.enum(["primary", "secondary"]);

export const IntendedUse = z.enum([
  "exploration",
  "explanation",
  "decision_support",
  "justification",
  "unknown",
]);

export const UseTier = z.enum([
  "exploratory",
  "explanatory",
  "operational",
  "high_stakes",
]);

export const Stakes = z.enum(["low", "medium", "high", "unknown"]);
export const Reversibility = z.enum(["low", "medium", "high", "unknown"]);
export const Detectability = z.enum(["easy", "moderate", "hard", "unknown"]);
export const TimePressure = z.enum(["low", "medium", "high", "unknown"]);

export const RelianceLevel = z.enum(["very_low", "low", "medium", "high"]);

export const RelianceCap = z.enum([
  "input_only",
  "supporting",
  "weight_bearing",
  "decisive",
]);

export const AuditSchema = z.object({
  representation: z.object({
    raw: z.string(),
    kind: z.string(), // "" if unknown
    short: z.string(), // "" if unknown
  }),

  intended_use: z.object({
    attempted_use: IntendedUse,
    earned_tier: UseTier,

    mismatch: z.boolean(),
    mismatch_reason: z.string(), // "" if none

    notes: z.string(), // "" if none
    alternatives: z.array(IntendedUse), // [] if none
  }),

  decision_context: z.object({
    stakes: Stakes,
    reversibility: Reversibility,
    detectability: Detectability,
    time_pressure: TimePressure,
    alternatives_available: z.array(z.string()), // [] if none
    notes: z.string(), // "" if none
  }),

  scope: z.object({
    within: z.array(z.string()), // [] if none (but we’ll enforce non-empty post-parse)
    outside: z.array(z.string()), // [] if none (but we’ll enforce non-empty post-parse)
    assumptions: z.array(z.string()), // [] if none
  }),

  ambiguities: z.array(
    z.object({
      type: AmbiguityType,
      priority: AmbiguityPriority,
      description: z.string(),
      why_it_matters: z.string(),
      signals: z.array(z.string()), // [] if none
      what_to_do_now: z.array(z.string()), // [] if none
    })
  ),

  confidence: z.object({
    reliance: RelianceLevel,
    reliance_cap: RelianceCap,
    rationale: z.string(),
    verification_steps: z.array(z.string()), // [] if none
    safeguards: z.array(z.string()), // [] if none
    what_would_raise: z.array(z.string()), // [] if none
    what_would_lower: z.array(z.string()), // [] if none
  }),

  failure_modes: z.array(
    z.object({
      mode: z.string(),
      impact: z.string(),
      detectability: z.enum(["easy", "moderate", "hard"]),
      mitigations: z.array(z.string()), // [] if none
      fallback: z.array(z.string()), // [] if none
    })
  ),

  judgment_handoff: z.object({
    unresolved: z.array(z.string()), // [] if none
    who_owns_it: z.string(), // "" if unknown
    next_questions: z.array(z.string()), // [] if none
  }),

  meta: z.object({
    generated_at_iso: z.string(),
    model: z.string(),
    warnings: z.array(z.string()),
    gates_applied: z.array(z.string()),
    schema_version: z.string(), // e.g. "3"
  }),
});

export type Audit = z.infer<typeof AuditSchema>;
