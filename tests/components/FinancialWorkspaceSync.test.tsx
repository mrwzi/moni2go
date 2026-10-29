// @vitest-environment jsdom

import { IDBFactory } from "fake-indexeddb";
import type { User } from "@supabase/supabase-js";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteCloudWorkspaces,
  loadCanonicalCloudWorkspace,
  saveWorkspaceToCloud,
} from "../../src/cloud/workspace-cloud";
import { useAuthUser } from "../../src/lib/supabase/use-auth-user";
import { financialWorkspaceSchema } from "../../src/v2/domain/schemas";
import { useFinancialWorkspace } from "../../src/v2/react/useFinancialWorkspace";
import { openMoni2GoDatabase, WorkspaceRepository } from "../../src/v2/storage";
import type { FinancialWorkspace } from "../../src/v2/domain/workspace";

vi.mock("../../src/lib/supabase/use-auth-user", () => ({
  useAuthUser: vi.fn(),
}));
vi.mock("../../src/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({})),
}));
vi.mock("../../src/cloud/workspace-cloud", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/cloud/workspace-cloud")>();
  return {
    ...original,
    loadCanonicalCloudWorkspace: vi.fn(),
    saveWorkspaceToCloud: vi.fn(),
    deleteCloudWorkspaces: vi.fn(),
  };
});

const user = {
  id: "user-a",
  email: "person@example.com",
} as User;
const now = "2026-10-23T12:00:00.000Z";

function makeWorkspace(id: string, updatedAt = now): FinancialWorkspace {
  return financialWorkspaceSchema.parse({
    schemaVersion: 2,
    id,
    name: id,
    provenance: "user-entered",
    currency: "CAD",
    asOfDate: "2026-10-23",
    timeZone: "America/Toronto",
    createdAt: now,
    updatedAt,
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
}

async function seed(
  workspace: FinancialWorkspace,
  ownerId?: string,
): Promise<void> {
  const database = await openMoni2GoDatabase();
  try {
    const repository = new WorkspaceRepository(database);
    await repository.createWorkspace(workspace);
    await repository.setActiveWorkspace(workspace.id, ownerId);
  } finally {
    database.close();
  }
}

describe("signed-in workspace synchronization", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: new IDBFactory(),
    });
    vi.mocked(useAuthUser).mockReturnValue({ status: "signed-in", user });
    vi.mocked(loadCanonicalCloudWorkspace).mockReset();
    vi.mocked(saveWorkspaceToCloud).mockReset();
    vi.mocked(deleteCloudWorkspaces).mockReset();
  });

  it("does not silently attach an anonymous workspace to a newly signed-in account", async () => {
    await seed(makeWorkspace("anonymous-workspace"));
    vi.mocked(loadCanonicalCloudWorkspace).mockResolvedValue(null);

    const { result } = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspace).toBeNull();
    expect(saveWorkspaceToCloud).not.toHaveBeenCalled();
  });

  it("does not recreate a missing cloud copy from an older local workspace", async () => {
    await seed(makeWorkspace("older-local-workspace"), user.id);
    vi.mocked(loadCanonicalCloudWorkspace).mockResolvedValue(null);

    const { result } = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspace?.id).toBe("older-local-workspace");
    expect(result.current.cloudSyncPaused).toBe(true);
    expect(result.current.syncMessage).toContain("No cloud copy was found");
    expect(saveWorkspaceToCloud).not.toHaveBeenCalled();
  });

  it("keeps local changes when both the cloud revision and local workspace changed", async () => {
    const local = makeWorkspace("owned-workspace", "2026-10-23T12:10:00.000Z");
    await seed(local, user.id);
    const database = await openMoni2GoDatabase();
    try {
      await new WorkspaceRepository(database).setCloudSyncMeta({
        ownerId: user.id,
        workspaceId: local.id,
        cloudVersion: "2026-10-23T12:00:00.000Z",
        syncedWorkspaceUpdatedAt: now,
      });
    } finally {
      database.close();
    }
    vi.mocked(loadCanonicalCloudWorkspace).mockResolvedValue({
      workspace: makeWorkspace("owned-workspace", "2026-10-23T12:05:00.000Z"),
      version: "2026-10-23T12:05:01.000Z",
    });

    const { result } = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspace?.updatedAt).toBe(local.updatedAt);
    expect(result.current.syncMessage).toContain("Sync conflict detected");
    expect(saveWorkspaceToCloud).not.toHaveBeenCalled();
  });

  it("resolves a conflict with the selected cloud copy", async () => {
    const local = makeWorkspace("shared-workspace", "2026-10-23T12:10:00.000Z");
    const cloud = makeWorkspace("shared-workspace", "2026-10-23T12:20:00.000Z");
    await seed(local, user.id);
    vi.mocked(loadCanonicalCloudWorkspace).mockResolvedValue({
      workspace: cloud,
      version: "2026-10-23T12:21:00.000Z",
    });

    const { result } = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(result.current.cloudSyncState).toBe("conflict");
    });
    expect(result.current.cloudConflict).toEqual({ local, cloud });

    await act(async () => {
      await result.current.resolveCloudConflict("cloud");
    });

    expect(result.current.workspace?.updatedAt).toBe(cloud.updatedAt);
    expect(result.current.cloudSyncState).toBe("synced");
    expect(saveWorkspaceToCloud).not.toHaveBeenCalled();
  });

  it("makes the device copy canonical without creating a second cloud workspace", async () => {
    const local = makeWorkspace("phone-workspace", "2026-10-23T12:10:00.000Z");
    const cloud = makeWorkspace("cloud-workspace", "2026-10-23T12:20:00.000Z");
    await seed(local, user.id);
    vi.mocked(loadCanonicalCloudWorkspace).mockResolvedValue({
      workspace: cloud,
      version: "2026-10-23T12:21:00.000Z",
    });
    vi.mocked(saveWorkspaceToCloud).mockResolvedValue(
      "2026-10-23T12:30:00.000Z",
    );

    const { result } = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(result.current.cloudSyncState).toBe("conflict");
    });
    await act(async () => {
      await result.current.resolveCloudConflict("local");
    });

    expect(saveWorkspaceToCloud).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      expect.objectContaining({ id: cloud.id, name: local.name }),
      "2026-10-23T12:21:00.000Z",
    );
    expect(result.current.workspace?.id).toBe(cloud.id);
    expect(result.current.cloudSyncState).toBe("synced");
  });

  it("does not recreate deleted cloud data until sync is explicitly resumed", async () => {
    const local = makeWorkspace("owned-workspace");
    await seed(local, user.id);
    vi.mocked(loadCanonicalCloudWorkspace).mockResolvedValue(null);
    vi.mocked(deleteCloudWorkspaces).mockResolvedValue();

    const { result, unmount } = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    await act(async () => {
      await result.current.deleteCloudData();
    });
    vi.mocked(saveWorkspaceToCloud).mockClear();
    await act(async () => {
      await result.current.save({ ...local, name: "Local edit" });
    });

    expect(saveWorkspaceToCloud).not.toHaveBeenCalled();
    expect(result.current.cloudSyncPaused).toBe(true);
    expect(result.current.syncMessage).toContain("Saved on this device");
    unmount();

    const reopened = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(reopened.result.current.loading).toBe(false);
    });
    expect(reopened.result.current.cloudSyncPaused).toBe(true);
    expect(saveWorkspaceToCloud).not.toHaveBeenCalled();
  });

  it("keeps offline edits locally and recognizes the same data after reconnection", async () => {
    const local = makeWorkspace("offline-workspace");
    await seed(local, user.id);
    vi.mocked(loadCanonicalCloudWorkspace).mockRejectedValue(
      new Error("offline"),
    );
    vi.mocked(saveWorkspaceToCloud).mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    const edited = {
      ...local,
      name: "Edited while offline",
      updatedAt: "2026-10-23T12:20:00.000Z",
    };
    await act(async () => {
      await result.current.save(edited);
    });
    const database = await openMoni2GoDatabase();
    try {
      expect(
        (await new WorkspaceRepository(database).getWorkspace(local.id)).name,
      ).toBe("Edited while offline");
    } finally {
      database.close();
    }

    vi.mocked(loadCanonicalCloudWorkspace).mockResolvedValue({
      workspace: edited,
      version: "2026-10-23T12:21:00.000Z",
    });
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.workspace?.name).toBe("Edited while offline");
    expect(result.current.syncMessage).toContain("synced");
  });

  it("retries cloud synchronization automatically when the device reconnects", async () => {
    const local = makeWorkspace("offline-workspace");
    await seed(local, user.id);
    vi.mocked(loadCanonicalCloudWorkspace).mockRejectedValueOnce(
      new Error("offline"),
    );

    const { result } = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.cloudSyncState).toBe("local-only");

    vi.mocked(loadCanonicalCloudWorkspace).mockResolvedValue({
      workspace: local,
      version: "2026-10-23T12:01:00.000Z",
    });
    window.dispatchEvent(new Event("online"));

    await waitFor(() => {
      expect(result.current.cloudSyncState).toBe("synced");
    });
    expect(loadCanonicalCloudWorkspace).toHaveBeenCalledTimes(2);
  });

  it("checks for newer cloud data when the app becomes visible again", async () => {
    const local = makeWorkspace("owned-workspace");
    await seed(local, user.id);
    vi.mocked(loadCanonicalCloudWorkspace).mockResolvedValue({
      workspace: local,
      version: "2026-10-23T12:01:00.000Z",
    });

    const { result } = renderHook(() => useFinancialWorkspace());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    vi.mocked(loadCanonicalCloudWorkspace).mockClear();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(loadCanonicalCloudWorkspace).toHaveBeenCalledTimes(1);
    });
  });
});
