import { describe, expect, it } from "vitest";
import { hasBalanceCorrectionAfterActivity } from "../../../src/v2/domain/balance-corrections";
import type { BalanceCorrection } from "../../../src/v2/domain/balance-corrections";

const correction = (overrides: Partial<BalanceCorrection> = {}) =>
  ({
    id: "correction-1",
    workspaceId: "workspace-1",
    accountId: "cash",
    correctionDate: "2026-10-21",
    previousBalanceCents: 100_000,
    correctedBalanceCents: 90_000,
    provenance: "user-entered",
    createdAt: "2026-10-21T15:00:00.000Z",
    updatedAt: "2026-10-21T15:00:00.000Z",
    ...overrides,
  }) as BalanceCorrection;

describe("historical balance-correction protection", () => {
  it("does not mistake ordinary later account activity for a correction", () => {
    expect(
      hasBalanceCorrectionAfterActivity(
        [],
        ["cash" as never, "loan" as never],
        "2026-10-21" as never,
        "2026-10-21T12:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("blocks an activity followed by a genuine same-day correction", () => {
    expect(
      hasBalanceCorrectionAfterActivity(
        [correction()],
        ["cash" as never],
        "2026-10-21" as never,
        "2026-10-21T12:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("does not block activity recorded after an earlier correction", () => {
    expect(
      hasBalanceCorrectionAfterActivity(
        [correction()],
        ["cash" as never],
        "2026-10-21" as never,
        "2026-10-21T16:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("keeps legacy workspaces without correction records editable", () => {
    expect(
      hasBalanceCorrectionAfterActivity(
        undefined,
        ["cash" as never],
        "2025-01-01" as never,
        "2025-01-01T12:00:00.000Z",
      ),
    ).toBe(false);
  });
});
