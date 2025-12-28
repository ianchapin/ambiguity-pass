import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AuditSchema, type Audit } from "./auditSchema.js";
import { buildMessages, type PromptArgs } from "./prompt.js";

export type RunArgs = PromptArgs & {
  model?: string;
};

export async function runAmbiguityPass(args: RunArgs): Promise<Audit> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error("Missing OPENAI_API_KEY (set it in .env or your shell).");

  const client = new OpenAI({ apiKey });

  const model = args.model ?? "gpt-4o-mini"; // structured outputs supported in GPT-4o family :contentReference[oaicite:1]{index=1}

  const { system, user } = buildMessages(args);

  // Responses API + Structured Outputs via text.format using zodTextFormat :contentReference[oaicite:2]{index=2}
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

  const enriched = {
    ...parsed,
    meta: {
      ...(parsed.meta ?? {}),
      generated_at_iso: new Date().toISOString(),
      model,
    },
  };

  return AuditSchema.parse(enriched);
}
