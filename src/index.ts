#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs/promises";
import path from "node:path";
import { readMaybeFileOrStdin } from "./io.js";
import { runAmbiguityPass } from "./openaiAudit.js";
import { renderFriendly, renderTechnical } from "./render.js";
import type { Audit } from "./auditSchema.js";

const program = new Command();

program
  .name("ambiguity-pass")
  .description("Run an Ambiguity Pass audit on a representation (local CLI tool).")
  .argument("[text...]", "representation text (or pipe via stdin)")
  .option("-f, --file <path>", "read representation from a file")
  .option("-c, --context <text>", "context: what decision/use is this for?")
  .option(
    "--use <exploration|explanation|decision_support|justification|unknown>",
    "attempted use (what someone wants to do with it)",
    "unknown"
  )
  .option("-s, --stakes <low|medium|high|unknown>", "stakes (default: medium)", "medium")
  .option("--reversibility <high|medium|low|unknown>", "reversibility (default: unknown)", "unknown")
  .option("--detectability <easy|moderate|hard|unknown>", "detectability (default: unknown)", "unknown")
  .option("--time-pressure <low|medium|high|unknown>", "time pressure (default: unknown)", "unknown")
  .option(
    "-a, --alt <text>",
    "alternative check/source available (repeatable)",
    (v, acc: string[]) => {
      acc.push(v);
      return acc;
    },
    [] as string[]
  )
  .option("-m, --model <name>", "OpenAI model (default: gpt-4o-mini)")
  .option("--technical", "print framework/technical view")
  .option("--json", "print raw JSON output")
  .option(
    "--self",
    "self-audit: run Ambiguity Pass on the output itself (critique for overreach)"
  )
  .option("-o, --out <path>", "write output to a text file (same content as stdout)")
  .option("--append", "append to --out instead of overwriting")
  .option("--quiet", "do not print to stdout (useful with --out)")
  .parse(process.argv);

type Opts = {
  file?: string;
  context?: string;
  use: string;

  stakes: string;
  reversibility: string;
  detectability: string;
  timePressure: string;
  alt: string[];

  model?: string;

  technical?: boolean;
  json?: boolean;
  self?: boolean;

  out?: string;
  append?: boolean;
  quiet?: boolean;
};

async function writeOutputFile(filePath: string, content: string, append: boolean) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const stamp = new Date().toISOString();
  const payload = append
    ? `\n\n===== ambiguity-pass @ ${stamp} =====\n${content}\n`
    : content + (content.endsWith("\n") ? "" : "\n");

  if (append) await fs.appendFile(filePath, payload, "utf8");
  else await fs.writeFile(filePath, payload, "utf8");
}

async function main() {
  const opts = program.opts<Opts>();
  const argText = (program.args ?? []).join(" ").trim();

  const representation = await readMaybeFileOrStdin({
    argText,
    file: opts.file,
  });

  const decisionContext = {
    stakes: (opts.stakes ?? "unknown") as any,
    reversibility: (opts.reversibility ?? "unknown") as any,
    detectability: (opts.detectability ?? "unknown") as any,
    time_pressure: (opts.timePressure ?? "unknown") as any,
    alternatives_available: Array.isArray(opts.alt) ? opts.alt : [],
    notes: "",
  };

  const audit = await runAmbiguityPass({
    representation,
    context: opts.context ?? "",
    attemptedUse: opts.use ?? "unknown",
    decisionContext,
    model: opts.model,
    selfAudit: false,
  });

  let finalAudit: Audit = audit;

  if (opts.self) {
    const selfContext =
      "Self-audit this Ambiguity Pass output. Identify overreach, hidden normative assumptions, unscoped claims, and where judgment is laundered as certainty. Recommend scope limits and reliance cap corrections.";
    finalAudit = await runAmbiguityPass({
      representation: JSON.stringify(audit, null, 2),
      context: selfContext,
      attemptedUse: "unknown",
      decisionContext,
      model: opts.model,
      selfAudit: true,
    });
  }

  const content = opts.json
    ? JSON.stringify(finalAudit, null, 2) + "\n"
    : (opts.technical ? renderTechnical(finalAudit) : renderFriendly(finalAudit)) + "\n";

  if (opts.out) await writeOutputFile(opts.out, content, Boolean(opts.append));
  if (!opts.quiet) process.stdout.write(content);
}

main().catch((err: any) => {
  const msg = typeof err?.message === "string" ? err.message : String(err);
  process.stderr.write(chalk.red(`Error: ${msg}\n`));
  process.exit(1);
});
