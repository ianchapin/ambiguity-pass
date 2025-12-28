#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import { readMaybeFileOrStdin } from "./io.js";
import { runAmbiguityPass } from "./openaiAudit.js";
import { renderFriendly, renderTechnical } from "./render.js";
import type { Audit } from "./auditSchema.js";

const program = new Command();

program
  .name("ambiguity-pass")
  .description(
    "Run an Ambiguity Pass audit on a representation (local CLI demo)."
  )
  .argument("[text...]", "representation text (or pipe via stdin)")
  .option("-f, --file <path>", "read representation from a file")
  .option("-c, --context <text>", "context: what decision/use is this for?")
  .option(
    "-s, --stakes <low|medium|high>",
    "stakes (default: medium)",
    "medium"
  )
  .option("-m, --model <name>", "OpenAI model (default: gpt-4o-mini)")
  .option("--technical", "print framework/technical view")
  .option("--json", "print raw JSON output")
  .option("--self", "self-audit: run Ambiguity Pass on the output itself")
  .parse(process.argv);

type Opts = {
  file?: string;
  context?: string;
  stakes: string;
  model?: string;
  technical?: boolean;
  json?: boolean;
  self?: boolean;
};

async function main() {
  const opts = program.opts<Opts>();
  const argText = (program.args ?? []).join(" ").trim();

  const representation = await readMaybeFileOrStdin({
    argText,
    file: opts.file,
  });
  const context = opts.context;
  const stakes = opts.stakes ?? "medium";

  const audit = await runAmbiguityPass({
    representation,
    context,
    stakes,
    model: opts.model,
    selfAudit: false,
  });

  let finalAudit: Audit = audit;

  if (opts.self) {
    const selfContext =
      "Self-audit this Ambiguity Pass output. Identify overreach, hidden value calls, unscoped claims, and where judgment is laundered as certainty.";
    finalAudit = await runAmbiguityPass({
      representation: JSON.stringify(audit, null, 2),
      context: selfContext,
      stakes,
      model: opts.model,
      selfAudit: true,
    });
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify(finalAudit, null, 2) + "\n");
    return;
  }

  const out = opts.technical
    ? renderTechnical(finalAudit)
    : renderFriendly(finalAudit);
  process.stdout.write(out + "\n");
}

main().catch((err: any) => {
  const msg = typeof err?.message === "string" ? err.message : String(err);
  process.stderr.write(chalk.red(`Error: ${msg}\n`));
  process.exit(1);
});
