import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  CloudWorkspaceError,
  loadNewestCloudWorkspace,
  saveWorkspaceToCloud,
} from "../../../src/cloud/workspace-cloud";
import { financialWorkspaceSchema } from "../../../src/v2/domain/schemas";
import type { FinancialWorkspace } from "../../../src/v2/domain/workspace";

const now = "2026-10-23T12:00:00.000Z";
const workspace = financialWorkspaceSchema.parse({
  schemaVersion: 2,
  id: "workspace-1",
  name: "My workspace",
  provenance: "user-entered",
  currency: "CAD",
  asOfDate: "2026-10-23",
  timeZone: "America/Toronto",
  createdAt: now,
  updatedAt: now,
  accountGroups: [],
  assetAccounts: [],
  liabilityAccounts: [],
  allocationRules: [],
  incomeSources: [],
  incomeEvents: [],
  historicalIncome: [],
  expenseDefinitions: [],
  expenseEvents: [],
  debts: [],
  goals: [],
  sinkingFunds: [],
  balanceCorrections: [],
  context: {
    country: "CA",
    preferences: {
      firstDayOfWeek: "monday",
      upcomingWindowDays: 7,
      reminders: { accountReviewCadence: "biweekly" },
    },
  },
}) as unknown as FinancialWorkspace;

describe("cloud workspace compare-and-set", () => {
  it("updates only the exact owner, workspace, and expected cloud revision", async () => {
    const eq = vi.fn();
    const chain = {
      eq,
      select: vi.fn(() => ({
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data: { updated_at: "2026-10-23T12:01:00.000Z" },
            error: null,
          }),
        ),
      })),
    };
    eq.mockReturnValue(chain);
    const update = vi.fn(() => chain);
    const client = {
      from: vi.fn(() => ({ update })),
    } as unknown as SupabaseClient;

    await expect(
      saveWorkspaceToCloud(client, "user-1", workspace, now),
    ).resolves.toBe("2026-10-23T12:01:00.000Z");
    expect(eq).toHaveBeenCalledWith("workspace_id", workspace.id);
    expect(eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(eq).toHaveBeenCalledWith("updated_at", now);
  });

  it("reports a conflict instead of overwriting when the revision changed", async () => {
    const chain = {
      eq: vi.fn(),
      select: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    };
    chain.eq.mockReturnValue(chain);
    const client = {
      from: vi.fn(() => ({ update: vi.fn(() => chain) })),
    } as unknown as SupabaseClient;

    await expect(
      saveWorkspaceToCloud(client, "user-1", workspace, now),
    ).rejects.toMatchObject<Partial<CloudWorkspaceError>>({ code: "conflict" });
  });

  it("loads the cloud revision with the validated workspace", async () => {
    const maybeSingle = vi.fn(() =>
      Promise.resolve({
        data: { workspace, updated_at: "2026-10-23T12:01:00.000Z" },
        error: null,
      }),
    );
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    const client = {
      from: vi.fn(() => query),
    } as unknown as SupabaseClient;

    await expect(loadNewestCloudWorkspace(client, "user-1")).resolves.toEqual({
      workspace,
      version: "2026-10-23T12:01:00.000Z",
    });
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
  });
});
