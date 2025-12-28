// io.ts
import fs from "node:fs/promises";

export async function readMaybeFileOrStdin(opts: {
  argText?: string;
  file?: string;
}): Promise<string> {
  // If file is provided, prefer it.
  // Allow "--file -" to mean: read from stdin explicitly.
  if (opts.file && opts.file !== "-") {
    const data = await fs.readFile(opts.file, "utf8");
    return normalizeText(data);
  }

  // If user provided text args, use them.
  if (opts.argText && opts.argText.trim()) {
    return normalizeText(opts.argText);
  }

  // If stdin is not piped and no file/args, fail fast.
  if (process.stdin.isTTY) {
    throw new Error(
      "No input provided. Pass text as an argument, use --file <path>, or pipe via stdin."
    );
  }

  const stdin = await readStdin();
  if (!stdin.trim()) {
    throw new Error(
      "No input provided on stdin. Pass text as an argument, use --file <path>, or pipe via stdin."
    );
  }
  return normalizeText(stdin);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (chunk) => {
      data += chunk;
    });

    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);

    // Ensure flowing mode starts
    process.stdin.resume();
  });
}

function normalizeText(s: string): string {
  // Normalize Windows line endings; keep content otherwise unchanged
  return s.replace(/\r\n/g, "\n");
}
