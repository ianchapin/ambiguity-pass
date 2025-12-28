# Ambiguity Pass

A local CLI tool for annotating **representations** (metrics, models, summaries, arguments, dashboards, AI outputs, etc.) to calibrate **how much reliance** they deserve in a specific decision context.

This tool implements the **Epistemic Trust Calibration** framework (by Ian Chapin).  
Learn more here: https://github.com/ianchapin/epistemic-trust-calibration

This tool does **not** decide truth or correctness. It produces a structured *audit* that makes scope, ambiguity, failure modes, and judgment handoffs explicit.

---

## Why this exists

Representations are necessary—and lossy. Most failures aren’t “the model was wrong” so much as:

- a proxy was treated like reality
- a summary was treated like a justification
- exploratory work became decision work without reassessment
- a metric became a target (and stopped pointing at the goal)
- fluent AI text absorbed more authority than it earned

**Ambiguity Pass** is a lightweight way to prevent silent overconfidence by scoping trust and marking where judgment begins.

---

## What it does

Given a representation and a decision context, Ambiguity Pass outputs an audit with:

- **Representation** (raw, kind, short label)
- **Intended use** (primary + tier)
- **Decision context** (stakes, reversibility, detectability, time pressure, alternatives)
- **Scope boundaries** (safe vs risky uses + assumptions)
- **Ambiguity types** (semantic/contextual/mapping/structural/normative) with why they matter
- **Confidence / reliance guidance** (reliance level + “cap” + safeguards + verification steps)
- **Failure modes** (failure → detectability → impact → mitigations/fallbacks)
- **Judgment handoff** (what remains unresolved and who owns it)

It’s designed to be:
- **fast** enough for day-to-day decisions
- **structured** enough to prevent “hand-wavy certainty”
- **explicit** about what must remain human judgment

---

## Installation

### Prereqs
- Node.js 18+ (Node 20 recommended)
- An OpenAI API key

### Install deps
```bash
npm install
```

### Configure your API key

Create a `.env` file in the repo root:

```env
OPENAI_API_KEY=sk-...
```

The CLI uses `dotenv/config`, so `.env` will be loaded automatically.

> PowerShell note: shell environment variables can override `.env`.  
> If you previously set `OPENAI_API_KEY` in your session, unset it with:
> `Remove-Item Env:OPENAI_API_KEY`

---

## Usage

### Run via tsx (dev)

PowerShell line continuation uses a backtick (`)`:

```powershell
npx tsx src/index.ts "We should prioritize safety over speed." `
  --context "Team deciding on launch criteria for a minor feature" `
  --stakes medium --reversibility high --detectability moderate --time-pressure low `
  --alt "Ask stakeholders to define 'safety' and 'speed' with examples"
```

### Pipe from stdin

```powershell
"DAU increased 12% WoW" | npx tsx src/index.ts `
  --context "Exec update; decide whether to accelerate rollout" `
  --stakes medium --reversibility medium --detectability moderate --time-pressure high
```

### Read from a file

```powershell
npx tsx src/index.ts --file .\examples\rep.txt `
  --context "Using this to justify cutting support headcount" `
  --stakes high --reversibility low --detectability hard --time-pressure medium
```

---

## Output formats

### Friendly (default)

```powershell
npx tsx src/index.ts "KPI: DAU increased 12% WoW." --context "..."
```

### Technical

```powershell
npx tsx src/index.ts "KPI: DAU increased 12% WoW." --context "..." --technical
```

### JSON

```powershell
npx tsx src/index.ts "KPI: DAU increased 12% WoW." --context "..." --json
```

---

## Writing output to a file

If your CLI supports `--out`, you can write directly:

```powershell
npx tsx src/index.ts "KPI: DAU increased 12% WoW." --context "..." --out .\outputs\audit.txt
```

Or you can redirect:

```powershell
npx tsx src/index.ts "KPI: DAU increased 12% WoW." --context "..." > .\outputs\audit.txt
```

---

## Smoke tests

Quick suite:

```powershell
npm run smoke:quick
```

Full suite:

```powershell
npm run smoke
```

Artifacts are written to:

```
outputs\smoke\YYYYMMDD-HHMMSS\
```

---

## Project structure

```
src/
  index.ts         # CLI entrypoint (Commander)
  io.ts            # read text from arg/file/stdin
  prompt.ts        # prompt construction
  openaiAudit.ts   # OpenAI Responses API call + schema parse
  auditSchema.ts   # Zod schema (Structured Outputs-safe)
  render.ts        # friendly/technical renderers

scripts/
  smoke-tests.ps1  # PowerShell smoke suite

outputs/
  smoke/           # generated artifacts (gitignored)
```

---

## Learn more

This tool is an implementation of the **Epistemic Trust Calibration** framework.  
For the framework docs and conceptual background, see:

https://github.com/ianchapin/epistemic-trust-calibration

---

## Gitignore outputs

Recommended `.gitignore` entry:

```
outputs/
```

---

## License

MIT License (see `LICENSE`).
