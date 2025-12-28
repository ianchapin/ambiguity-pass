// render.ts
import chalk from "chalk";
import type { Audit } from "./auditSchema.js";

const H = (s: string) => chalk.bold(s);
const K = (s: string) => chalk.gray(s);

function wrapBullets(items: string[], indent = "  ") {
  if (!items || items.length === 0) return `${indent}${K("(none)")}`;
  return items.map((x) => `${indent}- ${x}`).join("\n");
}

function maybeLine(label: string, value: string) {
  const v = value?.trim?.() ?? "";
  return v ? `  ${K(label)} ${v}` : "";
}

export function renderFriendly(a: Audit) {
  const lines: string[] = [];

  // Header
  lines.push(H("Ambiguity Pass"));
  if (a.representation.short?.trim())
    lines.push(K(a.representation.short.trim()));
  lines.push("");

  // 1) What this is
  lines.push(H("1) What this is"));
  const kind = a.representation.kind?.trim() ?? "";
  lines.push(
    `  ${kind ? `${kind}: ` : ""}${trimOneLine(a.representation.raw)}`
  );
  lines.push("");

  // 2) Intended use
  lines.push(H("2) Intended use (right now)"));
  lines.push(
    `  ${a.intended_use.primary} ${K(`(tier: ${a.intended_use.tier})`)}`
  );
  if (a.intended_use.notes?.trim())
    lines.push(`  ${K("notes:")} ${a.intended_use.notes.trim()}`);
  if (a.intended_use.alternatives?.length) {
    lines.push(
      `  ${K("also plausible:")} ${a.intended_use.alternatives.join(", ")}`
    );
  }
  lines.push("");

  // 3) Decision context
  lines.push(H("3) Decision context"));
  lines.push(`  ${K("stakes:")} ${a.decision_context.stakes}`);
  lines.push(`  ${K("reversibility:")} ${a.decision_context.reversibility}`);
  lines.push(`  ${K("detectability:")} ${a.decision_context.detectability}`);
  lines.push(`  ${K("time pressure:")} ${a.decision_context.time_pressure}`);

  const alts = a.decision_context.alternatives_available ?? [];
  lines.push(
    `  ${K("alternatives available:")} ${
      alts.length ? alts.join("; ") : "(none)"
    }`
  );

  if (a.decision_context.notes?.trim()) {
    lines.push(`  ${K("notes:")} ${a.decision_context.notes.trim()}`);
  }
  lines.push("");

  // 4) Scope
  lines.push(H("4) Where it’s safer vs risky"));
  lines.push(`  ${chalk.green("Safer for:")}`);
  lines.push(wrapBullets(a.scope.within));
  lines.push(`  ${chalk.yellow("Risky for:")}`);
  lines.push(wrapBullets(a.scope.outside));
  if (a.scope.assumptions?.length) {
    lines.push(`  ${K("Assumptions:")}`);
    lines.push(wrapBullets(a.scope.assumptions));
  }
  lines.push("");

  // 5) Ambiguities
  lines.push(H("5) What’s unclear"));
  if (!a.ambiguities || a.ambiguities.length === 0) {
    lines.push(`  ${K("(no major ambiguity flagged)")}`);
  } else {
    for (const amb of a.ambiguities) {
      lines.push(`  ${chalk.cyan(amb.type)}: ${amb.description}`);
      lines.push(`  ${K("why it matters:")} ${amb.why_it_matters}`);
      if (amb.signals?.length)
        lines.push(`  ${K("signals:")} ${amb.signals.join("; ")}`);
      if (amb.what_to_do_now?.length)
        lines.push(`  ${K("do now:")} ${amb.what_to_do_now.join("; ")}`);
    }
  }
  lines.push("");

  // 6) Confidence / reliance
  lines.push(H("6) How much weight to put on it"));
  lines.push(
    `  ${chalk.magenta("Suggested reliance:")} ${a.confidence.reliance}`
  );
  lines.push(
    `  ${chalk.magenta("Max reliance allowed:")} ${a.confidence.reliance_cap}`
  );
  if (a.confidence.rationale?.trim())
    lines.push(`  ${a.confidence.rationale.trim()}`);

  if (a.confidence.verification_steps?.length) {
    lines.push(`  ${K("verification steps:")}`);
    lines.push(wrapBullets(a.confidence.verification_steps));
  }

  if (a.confidence.safeguards?.length) {
    lines.push(`  ${K("safeguards:")}`);
    lines.push(wrapBullets(a.confidence.safeguards));
  }

  if (a.confidence.what_would_raise?.length) {
    lines.push(`  ${K("what would raise reliance:")}`);
    lines.push(wrapBullets(a.confidence.what_would_raise));
  }

  if (a.confidence.what_would_lower?.length) {
    lines.push(`  ${K("what would lower reliance:")}`);
    lines.push(wrapBullets(a.confidence.what_would_lower));
  }
  lines.push("");

  // 7) Failure modes
  lines.push(H("7) What could go wrong"));
  if (!a.failure_modes || a.failure_modes.length === 0) {
    lines.push(`  ${K("(none listed)")}`);
  } else {
    for (const f of a.failure_modes) {
      lines.push(`  - ${f.mode} ${K(`(detectability: ${f.detectability})`)}`);
      lines.push(`    ${K("impact:")} ${f.impact}`);
      if (f.mitigations?.length)
        lines.push(`    ${K("mitigate:")} ${f.mitigations.join("; ")}`);
      if (f.fallback?.length)
        lines.push(`    ${K("fallback:")} ${f.fallback.join("; ")}`);
    }
  }
  lines.push("");

  // Judgment handoff
  lines.push(H("Judgment handoff"));
  lines.push(K("Unresolved:"));
  lines.push(wrapBullets(a.judgment_handoff.unresolved));
  if (a.judgment_handoff.who_owns_it?.trim()) {
    lines.push(
      `  ${K("who owns it:")} ${a.judgment_handoff.who_owns_it.trim()}`
    );
  }
  lines.push(K("Next questions:"));
  lines.push(wrapBullets(a.judgment_handoff.next_questions));
  lines.push("");

  // Warnings
  if (a.meta.warnings?.length) {
    lines.push(chalk.yellow("Warnings:"));
    lines.push(wrapBullets(a.meta.warnings));
    lines.push("");
  }

  lines.push(K("Not a verdict. This scopes reliance; judgment remains yours."));
  return lines.join("\n");
}

export function renderTechnical(a: Audit) {
  const lines: string[] = [];

  lines.push(H("Ambiguity Pass — Framework View"));
  lines.push("");

  // Representation
  lines.push(H("Representation:"));
  lines.push(a.representation.raw.trim());
  if (a.representation.kind?.trim())
    lines.push(maybeLine("kind:", a.representation.kind).trimEnd());
  if (a.representation.short?.trim())
    lines.push(maybeLine("short:", a.representation.short).trimEnd());
  lines.push("");

  // Intended use
  lines.push(H("Intended use:"));
  lines.push(`- primary: ${a.intended_use.primary}`);
  lines.push(`- tier: ${a.intended_use.tier}`);
  if (a.intended_use.notes?.trim())
    lines.push(`- notes: ${a.intended_use.notes.trim()}`);
  if (a.intended_use.alternatives?.length)
    lines.push(`- alternatives: ${a.intended_use.alternatives.join(", ")}`);
  lines.push("");

  // Decision context
  lines.push(H("Decision context:"));
  lines.push(`- stakes: ${a.decision_context.stakes}`);
  lines.push(`- reversibility: ${a.decision_context.reversibility}`);
  lines.push(`- detectability: ${a.decision_context.detectability}`);
  lines.push(`- time_pressure: ${a.decision_context.time_pressure}`);
  lines.push(
    `- alternatives_available:\n${wrapBullets(
      a.decision_context.alternatives_available ?? []
    )}`
  );
  lines.push(`- notes: ${a.decision_context.notes?.trim() || "(none)"}`);
  lines.push("");

  // Scope
  lines.push(H("Scope:"));
  lines.push(`- within:\n${wrapBullets(a.scope.within)}`);
  lines.push(`- outside:\n${wrapBullets(a.scope.outside)}`);
  lines.push(`- assumptions:\n${wrapBullets(a.scope.assumptions)}`);
  lines.push("");

  // Ambiguities
  lines.push(H("Ambiguity types:"));
  if (!a.ambiguities || a.ambiguities.length === 0) {
    lines.push(`- ${K("(none)")}`);
  } else {
    for (const amb of a.ambiguities) {
      lines.push(`- ${amb.type}`);
      lines.push(`  - description: ${amb.description}`);
      lines.push(`  - why_it_matters: ${amb.why_it_matters}`);
      lines.push(`  - signals:\n${wrapBullets(amb.signals ?? [], "    ")}`);
      lines.push(
        `  - what_to_do_now:\n${wrapBullets(amb.what_to_do_now ?? [], "    ")}`
      );
    }
  }
  lines.push("");

  // Confidence
  lines.push(H("Confidence / reliance:"));
  lines.push(`- reliance: ${a.confidence.reliance}`);
  lines.push(`- reliance_cap: ${a.confidence.reliance_cap}`);
  lines.push(`- rationale: ${a.confidence.rationale}`);
  lines.push(
    `- verification_steps:\n${wrapBullets(
      a.confidence.verification_steps ?? []
    )}`
  );
  lines.push(`- safeguards:\n${wrapBullets(a.confidence.safeguards ?? [])}`);
  lines.push(
    `- what_would_raise:\n${wrapBullets(a.confidence.what_would_raise ?? [])}`
  );
  lines.push(
    `- what_would_lower:\n${wrapBullets(a.confidence.what_would_lower ?? [])}`
  );
  lines.push("");

  // Failure modes
  lines.push(H("Known failure modes:"));
  if (!a.failure_modes || a.failure_modes.length === 0) {
    lines.push(`- ${K("(none)")}`);
  } else {
    for (const f of a.failure_modes) {
      lines.push(`- mode: ${f.mode}`);
      lines.push(`  - impact: ${f.impact}`);
      lines.push(`  - detectability: ${f.detectability}`);
      lines.push(
        `  - mitigations:\n${wrapBullets(f.mitigations ?? [], "    ")}`
      );
      lines.push(`  - fallback:\n${wrapBullets(f.fallback ?? [], "    ")}`);
    }
  }
  lines.push("");

  // Judgment handoff
  lines.push(H("Judgment handoff:"));
  lines.push(
    `- unresolved:\n${wrapBullets(a.judgment_handoff.unresolved ?? [])}`
  );
  lines.push(
    `- who_owns_it: ${a.judgment_handoff.who_owns_it?.trim() || "(unknown)"}`
  );
  lines.push(
    `- next_questions:\n${wrapBullets(a.judgment_handoff.next_questions ?? [])}`
  );
  lines.push("");

  // Meta
  lines.push(K(`meta.generated_at_iso: ${a.meta.generated_at_iso}`));
  lines.push(K(`meta.model: ${a.meta.model}`));
  if (a.meta.schema_version)
    lines.push(K(`meta.schema_version: ${a.meta.schema_version}`));
  if (a.meta.warnings?.length)
    lines.push(K(`meta.warnings: ${a.meta.warnings.join("; ")}`));

  return lines.join("\n");
}

function trimOneLine(s: string, max = 140) {
  const one = (s ?? "").replace(/\s+/g, " ").trim();
  return one.length > max ? one.slice(0, max - 1) + "…" : one;
}
