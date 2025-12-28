import fs from "node:fs/promises";

export async function readMaybeFileOrStdin(opts: {
  argText?: string;
  file?: string;
}): Promise<string> {
  if (opts.file) {
    return await fs.readFile(opts.file, "utf8");
  }

  if (opts.argText && opts.argText.trim()) {
    return opts.argText;
  }

  // If nothing provided, read stdin
  const stdin = await readStdin();
  if (!stdin.trim()) {
    throw new Error(
      "No input provided. Pass text as an argument, --file, or pipe via stdin."
    );
  }
  return stdin;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
    // If no one pipes, end may never fire; but commander usage will generally provide args.
  });
}
