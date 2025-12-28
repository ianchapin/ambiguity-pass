import { describe, it, expect } from "vitest";
import { buildMessages } from "../src/prompt.js";

describe("prompt", () => {
  it("includes decision context in user message", () => {
    const { user, system } = buildMessages({
      representation: "Hello",
      context: "Test",
      decisionContext: {
        stakes: "high",
        reversibility: "low",
        detectability: "hard",
        time_pressure: "high",
        alternatives_available: ["second source"],
      },
    });

    expect(system).toContain("ANTI-PERFORMATIVITY");
    expect(user).toContain("Decision context:");
    expect(user).toContain("stakes: high");
    expect(user).toContain("alternatives_available:");
  });
});
