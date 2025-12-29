// openaiAudit.ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AuditSchema, type Audit } from "./auditSchema.js";
import { buildMessages, type PromptArgs } from "./prompt.js";

export type RunArgs = PromptArgs & {
  model?: string;
};

const RELIANCE_ORDER = ["very_low", "low", "medium", "high"] as const;
const CAP_ORDER = ["input_only", "supporting", "weight_bearing", "decisive"] as const;
const TIER_ORDER = ["exploratory", "explanatory", "operational", "high_stakes"] as const;

function minByOrder<T extends string>(a: T, b: T, order: readonly T[]): T {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia <= ib ? a : b;
}

function tierCap(tier: Audit["intended_use"]["earned_tier"]): Audit["confidence"]["reliance_cap"] {
  switch (tier) {
    case "exploratory":
      return "input_only";
    case "explanatory":
      return "supporting";
    case "operational":
      return "weight_bearing";
    case "high_stakes":
      return "weight_bearing";
  }
}

function requiredTierForAttemptedUse(
  attempted: Audit["intended_use"]["attempted_use"]
): Audit["intended_use"]["earned_tier"] {
  switch (attempted) {
    case "exploration":
      return "exploratory";
    case "explanation":
      return "explanatory";
    case "decision_support":
      return "operational";
    case "justification":
      return "high_stakes";
    case "unknown":
      return "exploratory";
  }
}

function contextCap(dc: Audit["decision_context"]): Audit["confidence"]["reliance_cap"] | null {
  const stakesHigh = dc.stakes === "high";
  const detHard = dc.detectability === "hard" || dc.detectability === "unknown";
  const revLow = dc.reversibility === "low" || dc.reversibility === "unknown";

  // Strongest gate: high stakes + (hard detectability AND low reversibility)
  if (stakesHigh && detHard && revLow) return "input_only";

  // General high stakes gate: either hard detectability OR low reversibility
  if (stakesHigh && (detHard || revLow)) return "supporting";

  // Medium stakes but both bad: still cap at supporting
  if (dc.stakes === "medium" && detHard && revLow) return "supporting";

  return null;
}

function contextRelianceMax(dc: Audit["decision_context"]): Audit["confidence"]["reliance"] | null {
  const stakesHigh = dc.stakes === "high";
  const detHard = dc.detectability === "hard" || dc.detectability === "unknown";
  const revLow = dc.reversibility === "low" || dc.reversibility === "unknown";

  if (stakesHigh && detHard && revLow) return "very_low";
  if (stakesHigh && (detHard || revLow)) return "low";

  return null;
}

function hasFallbackOrRollback(a: Audit): boolean {
  const fmFallback = a.failure_modes.some((f) => (f.fallback?.length ?? 0) > 0);
  const fmMit = a.failure_modes.some((f) => (f.mitigations?.length ?? 0) > 0);
  const saf = (a.confidence.safeguards?.length ?? 0) > 0;
  return fmFallback || fmMit || saf;
}

function enforceNonEmptyScope(a: Audit, gatesApplied: string[]) {
  const withinEmpty = !a.scope.within || a.scope.within.length === 0;
  const outsideEmpty = !a.scope.outside || a.scope.outside.length === 0;

  if (!withinEmpty && !outsideEmpty) return a;

  const cap = a.confidence.reliance_cap;

  const defaultWithin =
    cap === "input_only"
      ? ["Idea generation / hypothesis formation / discussion only"]
      : cap === "supporting"
        ? ["One input among others (cannot dominate the decision)"]
        : cap === "weight_bearing"
          ? ["Action support with explicit checks + monitoring"]
          : ["Decisive only with strong validation + rollback"];

  const defaultOutside =
    cap === "input_only"
      ? ["Final decisions, justification, or irreversible actions"]
      : cap === "supporting"
        ? ["Single-point-of-failure decision-making (treating this as proof)"]
        : cap === "weight_bearing"
          ? ["Irreversible, high-impact decisions without independent confirmation"]
          : ["(none)"];

  const updated = {
    ...a,
    scope: {
      ...a.scope,
      within: withinEmpty ? defaultWithin : a.scope.within,
      outside: outsideEmpty ? defaultOutside : a.scope.outside,
    },
  };

  gatesApplied.push("Filled empty scope.within/scope.outside with defaults (must be non-empty).");
  return updated;
}

/**
 * Deterministic post-parse enforcement:
 * - tier mismatch detection
 * - hard reliance gating from decision context + tier
 * - disallow "decisive" without detectability + fallback + verification
 * - enforce non-empty scope
 * - heuristic warnings when ambiguity typing looks off
 */
function enforceGates(a: Audit): Audit {
  const gatesApplied: string[] = [];
  const warnings: string[] = [];

  // 1) Attempted vs earned mismatch
  const requiredTier = requiredTierForAttemptedUse(a.intended_use.attempted_use);
  const requiredTierHigher =
    TIER_ORDER.indexOf(requiredTier) > TIER_ORDER.indexOf(a.intended_use.earned_tier);

  let out: Audit = {
    ...a,
    intended_use: {
      ...a.intended_use,
      mismatch: requiredTierHigher,
      mismatch_reason: requiredTierHigher
        ? `Attempted use (${a.intended_use.attempted_use}) exceeds earned tier (${a.intended_use.earned_tier}).`
        : "",
    },
  };

  if (requiredTierHigher) {
    warnings.push("Attempted use exceeds earned tier: scope creep / overreach risk.");
  }

  // 2) Cap from tier + context (hard clamp)
  const capFromTier = tierCap(out.intended_use.earned_tier);
  const capFromContext = contextCap(out.decision_context);

  let cap = out.confidence.reliance_cap;
  cap = minByOrder(cap, capFromTier, CAP_ORDER);

  if (capFromContext) cap = minByOrder(cap, capFromContext, CAP_ORDER);

  if (cap !== out.confidence.reliance_cap) {
    gatesApplied.push(
      `Clamped reliance_cap from ${out.confidence.reliance_cap} → ${cap} (tier/context gate).`
    );
  }

  // 3) Clamp reliance level too (context-based ceiling)
  let reliance = out.confidence.reliance;
  const relMax = contextRelianceMax(out.decision_context);
  if (relMax) {
    reliance = minByOrder(reliance, relMax, RELIANCE_ORDER);
    if (reliance !== out.confidence.reliance) {
      gatesApplied.push(
        `Clamped reliance from ${out.confidence.reliance} → ${reliance} (decision-context gate).`
      );
    }
  }

  // 4) Anti-performativity: decisive requires detectability + fallback + verification
  const verificationCount = out.confidence.verification_steps?.length ?? 0;
  const canBeDecisive =
    (out.decision_context.detectability === "easy" ||
      out.decision_context.detectability === "moderate") &&
    (out.decision_context.reversibility === "high" ||
      out.decision_context.reversibility === "medium") &&
    verificationCount > 0 &&
    hasFallbackOrRollback(out);

  if (cap === "decisive" && !canBeDecisive) {
    gatesApplied.push(
      'Downgraded reliance_cap "decisive" → "weight_bearing" (missing detectability/reversibility/verification/fallback).'
    );
    cap = "weight_bearing";
    warnings.push('Decisive cap was blocked by anti-performativity rule.');
  }

  out = {
    ...out,
    confidence: {
      ...out.confidence,
      reliance,
      reliance_cap: cap,
    },
  };

  // 5) Enforce non-empty scope
  out = enforceNonEmptyScope(out, gatesApplied);

  // 6) Heuristic warnings for ambiguity typing (don’t mutate; just warn)
  const rep = (out.representation.raw ?? "").toLowerCase();
  const ambTypes = new Set((out.ambiguities ?? []).map((x) => x.type));

  const hasNormativeCue = /\b(should|prioritize|better|worse|acceptable|must)\b/.test(rep);
  if (hasNormativeCue && !ambTypes.has("normative")) {
    warnings.push("Heuristic: normative cue detected (should/prioritize/etc) but normative ambiguity not listed.");
  }

  const hasMetricCue = /\b(kpi|dau|mau|%|probability|score|rank)\b/.test(rep);
  if (hasMetricCue && !ambTypes.has("mapping")) {
    warnings.push("Heuristic: metric/proxy cue detected but mapping ambiguity not listed.");
  }

  const hasSummaryCue = /\b(tl;dr|tldr|summary|postmortem)\b/.test(rep);
  if (hasSummaryCue && !ambTypes.has("structural")) {
    warnings.push("Heuristic: summary cue detected but structural ambiguity not listed.");
  }

  // 7) Detectability consistency warning
  const dcDet = out.decision_context.detectability;
  if (dcDet === "hard") {
    const anyEasyFailure = out.failure_modes?.some((f) => f.detectability === "easy") ?? false;
    if (anyEasyFailure) {
      warnings.push(
        "Detectability inconsistency: decision_context.detectability is hard, but at least one failure mode is marked easy. Ensure that’s justified."
      );
    }
  }

  // Merge warnings + gates into meta
  const mergedWarnings = [
    ...(Array.isArray(out.meta.warnings) ? out.meta.warnings : []),
    ...warnings,
  ];
  const mergedGates = [
    ...(Array.isArray(out.meta.gates_applied) ? out.meta.gates_applied : []),
    ...gatesApplied,
  ];

  return AuditSchema.parse({
    ...out,
    meta: {
      ...out.meta,
      warnings: mergedWarnings,
      gates_applied: mergedGates,
    },
  });
}

/**
 * Soft linting (suggestions) — not gates.
 */
function lintWarnings(a: Audit): string[] {
  const w: string[] = [];

  if (a.ambiguities.length > 3) {
    w.push("Too many ambiguity items (>3). Pick dominant 1–3 or merge related ones.");
  }

  if ((a.confidence.verification_steps?.length ?? 0) === 0) {
    w.push("No verification_steps provided. Add 1–3 concrete checks.");
  }

  if (a.failure_modes.length === 0) {
    w.push("No failure_modes listed. Add at least 1 plausible failure mode.");
  }

  if (a.confidence.reliance_cap === "decisive") {
    if (a.decision_context.detectability === "hard" || a.decision_context.detectability === "unknown") {
      w.push('reliance_cap="decisive" but decision_context.detectability is hard/unknown.');
    }
    if (!hasFallbackOrRollback(a)) {
      w.push('reliance_cap="decisive" but no fallback/rollback/stop plan is present.');
    }
  }

  return w;
}

export async function runAmbiguityPass(args: RunArgs): Promise<Audit> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY (set it in .env or your shell).");

  const client = new OpenAI({ apiKey });
  const model = args.model ?? "gpt-4o-mini";

  const { system, user } = buildMessages(args);

  const resp = await client.responses.parse({
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: {
      format: zodTextFormat(AuditSchema, "ambiguity_pass_audit"),
    },
  });

  const parsed = resp.output_parsed;
  if (!parsed) {
    throw new Error("Ambiguity Pass failed: model did not return schema-valid output.");
  }

  const enriched: Audit = {
    ...parsed,
    meta: {
      generated_at_iso: new Date().toISOString(),
      model,
      warnings: Array.isArray(parsed.meta?.warnings) ? parsed.meta.warnings : [],
      gates_applied: Array.isArray((parsed as any).meta?.gates_applied)
        ? (parsed as any).meta.gates_applied
        : [],
      schema_version: "3",
    },
  };

  const validated = AuditSchema.parse(enriched);

  // 1) deterministic gates
  const gated = enforceGates(validated);

  // 2) soft lint warnings
  const extraWarnings = lintWarnings(gated);

  return AuditSchema.parse({
    ...gated,
    meta: {
      ...gated.meta,
      warnings: [...(gated.meta.warnings ?? []), ...extraWarnings],
    },
  });
}
