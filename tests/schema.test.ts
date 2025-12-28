import { describe, it, expect } from "vitest";
import { AuditSchema } from "../src/auditSchema.js";
import { fixtureAudit } from "./fixtures.js";

describe("AuditSchema", () => {
  it("validates a fixture audit", () => {
    const parsed = AuditSchema.parse(fixtureAudit);
    expect(parsed.meta.schema_version).toBe("2");
  });
});
