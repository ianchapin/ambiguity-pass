import { describe, it, expect } from "vitest";
import { renderFriendly, renderTechnical } from "../src/render.js";
import { fixtureAudit } from "./fixtures.js";

describe("render", () => {
  it("renders friendly output", () => {
    const out = renderFriendly(fixtureAudit);
    expect(out).toContain("Ambiguity Pass");
    expect(out).toContain("Intended use");
    expect(out).toContain("Judgment handoff");
  });

  it("renders technical output", () => {
    const out = renderTechnical(fixtureAudit);
    expect(out).toContain("Framework View");
    expect(out).toContain("Decision context");
    expect(out).toContain("reliance_cap");
  });
});
