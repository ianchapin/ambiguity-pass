// openaiAudit.ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AuditSchema, type Audit } from "./auditSchema.js";
import { buildMessages, type PromptArgs } from "./prompt.js";

export type RunArgs = PromptArgs & {
  model?: string;
};

/**
 * Deterministic post-parse linting to catch common failure patterns.
 * (This is where you enforce “make it better” without relying on the model.)
 */
function lintWarnings(a: Audit): string[] {
  const w: string[] = [];

  // Keep ambiguity list tight (model tends to over-list).
  if (a.ambiguities.length > 3) {
    w.push(
      "Too many ambiguity items (>3). Pick dominant 1–3 or merge related ones."
    );
  }

  // Encourage actionability.
  if ((a.confidence.verification_steps?.length ?? 0) === 0) {
    w.push("No verification_steps provided. Add 1–3 concrete checks.");
  }

  // If no failure modes, this is almost always under-specified.
  if (a.failure_modes.length === 0) {
    w.push("No failure_modes listed. Add at least 1 plausible failure mode.");
  }

  const cap = a.confidence.reliance_cap;
  const dc = a.decision_context;

  // Anti-performativity rule: "decisive" needs detectability + fallback/rollback.
  if (cap === "decisive") {
    if (dc.detectability === "hard" || dc.detectability === "unknown") {
      w.push(
        'reliance_cap="decisive" but decision_context.detectability is hard/unknown.'
      );
    }

    const hasFallback =
      a.failure_modes.some((f) => (f.fallback?.length ?? 0) > 0) ||
      a.failure_modes.some((f) => (f.mitigations?.length ?? 0) > 0) ||
      (a.confidence.safeguards?.length ?? 0) > 0;

    if (!hasFallback) {
      w.push(
        'reliance_cap="decisive" but no fallback/rollback/stop plan is present.'
      );
    }

    if ((a.confidence.verification_steps?.length ?? 0) === 0) {
      w.push('reliance_cap="decisive" but verification_steps is empty.');
    }
  }

  // High stakes + hard/unknown detectability + high cap is suspicious unless safeguards are strong.
  if (
    dc.stakes === "high" &&
    (dc.detectability === "hard" || dc.detectability === "unknown") &&
    (cap === "weight_bearing" || cap === "decisive")
  ) {
    w.push(
      "High stakes + hard/unknown detectability while reliance_cap is weight-bearing/decisive. Consider downgrading cap or adding stronger monitoring + fallback."
    );
  }

  // If user says there are no alternatives and stakes are high, nudge for second source.
  if (dc.stakes === "high" && (dc.alternatives_available?.length ?? 0) === 0) {
    w.push(
      "High stakes with no alternatives_available provided. Consider adding an independent check/second source."
    );
  }

  return w;
}

export async function runAmbiguityPass(args: RunArgs): Promise<Audit> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY (set it in .env or your shell).");
  }

  const client = new OpenAI({ apiKey });

  // Keep your default; feel free to bump this to a stronger model for quality.
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
    throw new Error(
      "Ambiguity Pass failed: model did not return schema-valid output."
    );
  }

  // Fill meta deterministically (schema requires it).
  // Also overwrite schema_version to keep migrations explicit.
  const enriched: Audit = {
    ...parsed,
    // hard-fill required meta
    meta: {
      generated_at_iso: new Date().toISOString(),
      model,
      warnings: Array.isArray(parsed.meta?.warnings)
        ? parsed.meta.warnings
        : [],
      schema_version:
        typeof parsed.meta?.schema_version === "string"
          ? parsed.meta.schema_version
          : "2",
    },
  };

  // Validate (hard) then lint (soft).
  const validated = AuditSchema.parse(enriched);

  const warnings = lintWarnings(validated);

  // Merge model-provided warnings (if any) with deterministic lint warnings.
  const mergedWarnings = [
    ...(Array.isArray(validated.meta.warnings) ? validated.meta.warnings : []),
    ...warnings,
  ];

  return AuditSchema.parse({
    ...validated,
    meta: {
      ...validated.meta,
      warnings: mergedWarnings,
    },
  });
}
