import chalk from "chalk";
import type { Audit } from "./auditSchema.js";

const H = (s: string) => chalk.bold(s);
const K = (s: string) => chalk.gray(s);

function wrapBullets(items: string[], indent = "  ") {
  if (!items.length) return `${indent}${K("(none)")}`;
  return items.map((x) => `${indent}- ${x}`).join("\n");
}

export function renderFriendly(a: Audit) {
  const lines: string[] = [];

  lines.push(H("Ambiguity Pass"));
  if (a.representation.short) lines.push(K(a.representation.short));
  lines.push("");

  lines.push(H("1) What this is"));
  lines.push(
    `  ${
      a.representation.kind ? `${a.representation.kind}: ` : ""
    }${trimOneLine(a.representation.raw)}`
  );
  lines.push("");

  lines.push(H("2) Intended use (right now)"));
  lines.push(
    `  ${a.intended_use.primary}${
      a.intended_use.notes ? ` — ${a.intended_use.notes}` : ""
    }`
  );
  lines.push("");

  lines.push(H("3) Where it’s safer vs risky"));
  lines.push(`  ${chalk.green("Safer for:")}`);
  lines.push(wrapBullets(a.scope.within));
  lines.push(`  ${chalk.yellow("Risky for:")}`);
  lines.push(wrapBullets(a.scope.outside));
  lines.push("");

  lines.push(H("4) What’s unclear"));
  for (const amb of a.ambiguities) {
    lines.push(`  ${chalk.cyan(amb.type)}: ${amb.description}`);
    lines.push(`  ${K("why it matters:")} ${amb.why_it_matters}`);
  }
  lines.push("");

  lines.push(H("5) How much weight to put on it"));
  lines.push(
    `  ${chalk.magenta("Suggested reliance:")} ${a.confidence.reliance}`
  );
  lines.push(`  ${a.confidence.rationale}`);
  if (a.confidence.safeguards.length) {
    lines.push(`  ${K("safeguards:")}`);
    lines.push(wrapBullets(a.confidence.safeguards));
  }
  lines.push("");

  lines.push(H("6) What could go wrong"));
  for (const f of a.failure_modes) {
    lines.push(`  - ${f.mode} ${K(`(detectability: ${f.detectability})`)}`);
    lines.push(`    ${K("impact:")} ${f.impact}`);
    if (f.mitigations.length)
      lines.push(`    ${K("mitigate:")} ${f.mitigations.join("; ")}`);
  }
  lines.push("");

  lines.push(H("Judgment handoff"));
  lines.push(K("Unresolved:"));
  lines.push(wrapBullets(a.judgment_handoff.unresolved));
  lines.push(K("Next questions:"));
  lines.push(wrapBullets(a.judgment_handoff.next_questions));
  lines.push("");

  lines.push(K("Not a verdict. This scopes reliance; judgment remains yours."));

  return lines.join("\n");
}

export function renderTechnical(a: Audit) {
  const lines: string[] = [];

  lines.push(H("Ambiguity Pass — Framework View"));
  lines.push("");

  lines.push(H("Representation:"));
  lines.push(a.representation.raw.trim());
  lines.push("");

  lines.push(H("Intended use:"));
  lines.push(`- primary: ${a.intended_use.primary}`);
  if (a.intended_use.notes) lines.push(`- notes: ${a.intended_use.notes}`);
  if (a.intended_use.alternatives?.length)
    lines.push(`- alternatives: ${a.intended_use.alternatives.join(", ")}`);
  lines.push("");

  lines.push(H("Scope:"));
  lines.push(`- within:\n${wrapBullets(a.scope.within)}`);
  lines.push(`- outside:\n${wrapBullets(a.scope.outside)}`);
  lines.push(`- assumptions:\n${wrapBullets(a.scope.assumptions)}`);
  lines.push("");

  lines.push(H("Ambiguity types:"));
  for (const amb of a.ambiguities) {
    lines.push(`- ${amb.type}`);
    lines.push(`  - description: ${amb.description}`);
    lines.push(`  - why_it_matters: ${amb.why_it_matters}`);
    if (amb.signals?.length)
      lines.push(`  - signals: ${amb.signals.join("; ")}`);
  }
  lines.push("");

  lines.push(H("Confidence / reliance level:"));
  lines.push(`- reliance: ${a.confidence.reliance}`);
  lines.push(`- rationale: ${a.confidence.rationale}`);
  lines.push(`- safeguards:\n${wrapBullets(a.confidence.safeguards)}`);
  lines.push(
    `- what_would_raise:\n${wrapBullets(a.confidence.what_would_raise)}`
  );
  lines.push(
    `- what_would_lower:\n${wrapBullets(a.confidence.what_would_lower)}`
  );
  lines.push("");

  lines.push(H("Known failure modes:"));
  for (const f of a.failure_modes) {
    lines.push(`- mode: ${f.mode}`);
    lines.push(`  - impact: ${f.impact}`);
    lines.push(`  - detectability: ${f.detectability}`);
    lines.push(`  - mitigations:\n${wrapBullets(f.mitigations, "    ")}`);
  }
  lines.push("");

  lines.push(H("Judgment handoff:"));
  lines.push(`- unresolved:\n${wrapBullets(a.judgment_handoff.unresolved)}`);
  if (a.judgment_handoff.who_owns_it)
    lines.push(`- who_owns_it: ${a.judgment_handoff.who_owns_it}`);
  lines.push(
    `- next_questions:\n${wrapBullets(a.judgment_handoff.next_questions)}`
  );
  lines.push("");

  return lines.join("\n");
}

function trimOneLine(s: string, max = 140) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > max ? one.slice(0, max - 1) + "…" : one;
}
