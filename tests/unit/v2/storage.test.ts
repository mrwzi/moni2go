import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveSpendableCashCents } from "../../../src/v2/domain/accounts";
import { financialWorkspaceSchema } from "../../../src/v2/domain/schemas";
import type { FinancialWorkspace } from "../../../src/v2/domain/workspace";
import {
  EXPORT_FORMAT,
  LEGACY_NORTHCENTS_EXPORT_FORMAT,
  LEGACY_EXPORT_FORMAT,
  LEGACY_MONEVERO_EXPORT_FORMAT,
  exportWorkspace,
  importWorkspace,
  parseWorkspaceExport,
} from "../../../src/v2/storage/export-import";
import {
  openNorthCentsDatabase,
  requestToPromise,
} from "../../../src/v2/storage/indexeddb";
import {
  migrateV1Baseline,
  readV1BaselineForMigration,
} from "../../../src/v2/storage/migration-v1";
import {
  NorthCentsStorageError,
  toStorageError,
} from "../../../src/v2/storage/storage-errors";
import {
  ACTIVE_WORKSPACE_META_KEY,
  NORTHCENTS_DATABASE_NAME,
  NORTHCENTS_DATABASE_VERSION,
  META_STORE,
  V1_MIGRATION_META_KEY,
  WORKSPACES_STORE,
} from "../../../src/v2/storage/types";
import { WorkspaceRepository } from "../../../src/v2/storage/workspace-repository";
import { BASELINE_STORAGE_KEY } from "../../../src/storage/baseline-storage";

const now = "2026-09-24T12:00:00.000Z";

function workspace(id = "workspace-1"): FinancialWorkspace {
  return financialWorkspaceSchema.parse({
    schemaVersion: 2,
    id,
    name: `Workspace ${id}`,
    provenance: "user-entered",
    currency: "CAD",
    asOfDate: "2026-09-24",
    timeZone: "America/Toronto",
    createdAt: now,
    updatedAt: now,
    accountGroups: [
      {
        id: `${id}-bank`,
        workspaceId: id,
        createdAt: now,
        updatedAt: now,
        provenance: "user-entered",
        name: "Local bank",
        type: "bank",
        status: "active",
      },
    ],
    assetAccounts: [
      {
        id: `${id}-chequing`,
        workspaceId: id,
        createdAt: now,
        updatedAt: now,
        provenance: "user-entered",
        groupId: `${id}-bank`,
        name: "Chequing",
        type: "chequing",
        currentValueCents: -12_345,
        valueAsOfDate: "2026-09-24",
        spendability: "spendable",
        includeInNetWorth: true,
        status: "active",
        institutionLabel: "Local institution",
        note: "Manually added",
      },
      {
        id: `${id}-savings`,
        workspaceId: id,
        createdAt: now,
        updatedAt: now,
        provenance: "user-entered",
        groupId: `${id}-bank`,
        name: "Savings",
        type: "savings",
        currentValueCents: 85_025,
        valueAsOfDate: "2026-09-24",
        spendability: "restricted",
        includeInNetWorth: true,
        status: "active",
      },
    ],
    liabilityAccounts: [],
    allocationRules: [],
    incomeSources: [],
    incomeEvents: [],
    historicalIncome: [],
    expenseDefinitions: [],
    expenseEvents: [],
    debts: [
      {
        id: `${id}-debt`,
        workspaceId: id,
        createdAt: now,
        updatedAt: now,
        provenance: "user-entered",
        name: "Card",
        type: "credit-card",
        currentBalanceCents: 20_999,
        balanceAsOfDate: "2026-09-24",
        interestModel: {
          kind: "apr-estimate",
          modelVersion: 1,
          aprBasisPoints: 2099,
          dayCount: "actual-365",
          interestPosting: "monthly",
          rounding: "half-away-from-zero-at-posting",
        },
        minimumPaymentCents: 1_000,
        plannedPaymentCents: 1_500,
        dueDay: 15,
      },
    ],
    goals: [],
    sinkingFunds: [],
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

it("persists explicit balance-correction history through IndexedDB", async () => {
  const source = workspace("workspace-correction");
  const correctionAccount = source.assetAccounts.at(0);
  if (!correctionAccount) throw new Error("Test account is missing.");
  const withCorrection: FinancialWorkspace = {
    ...source,
    balanceCorrections: [
      {
        id: "correction-1" as never,
        workspaceId: source.id,
        accountId: correctionAccount.id,
        correctionDate: "2026-09-24" as never,
        previousBalanceCents: 10_000 as never,
        correctedBalanceCents: 9_000 as never,
        provenance: "user-entered",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
  const factory = new IDBFactory();
  const connection = await openNorthCentsDatabase({ indexedDB: factory });
  const repository = new WorkspaceRepository(connection);

  await repository.createWorkspace(withCorrection);
  const restored = await repository.getWorkspace(withCorrection.id);

  expect(restored.balanceCorrections).toEqual(
    withCorrection.balanceCorrections,
  );
  connection.close();
});

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(BASELINE_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    raw: values,
  };
}

async function expectStorageCode(
  operation: Promise<unknown>,
  code: NorthCentsStorageError["code"],
) {
  await expect(operation).rejects.toMatchObject({ code });
}

describe("IndexedDB database and workspace repository", () => {
  let factory: IDBFactory;

  beforeEach(() => {
    factory = new IDBFactory();
  });

  it("opens the exact database/version with only workspaces and meta", async () => {
    const connection = await openNorthCentsDatabase({ indexedDB: factory });
    expect(connection.database.name).toBe(NORTHCENTS_DATABASE_NAME);
    expect(connection.database.version).toBe(NORTHCENTS_DATABASE_VERSION);
    expect(Array.from(connection.database.objectStoreNames)).toEqual([
      META_STORE,
      WORKSPACES_STORE,
    ]);
    const transaction = connection.database.transaction(
      [META_STORE, WORKSPACES_STORE],
      "readonly",
    );
    expect(transaction.objectStore(META_STORE).indexNames.length).toBe(0);
    expect(transaction.objectStore(WORKSPACES_STORE).indexNames.length).toBe(0);
    connection.close();
    const reopened = await openNorthCentsDatabase({ indexedDB: factory });
    expect(reopened.database.version).toBe(1);
    reopened.close();
  });

  it("creates, reads, updates, lists, and deletes multiple workspaces", async () => {
    const connection = await openNorthCentsDatabase({ indexedDB: factory });
    const repository = new WorkspaceRepository(connection);
    const first = workspace();
    const second = workspace("workspace-2");
    await repository.createWorkspace(first);
    await repository.createWorkspace(second);
    expect(await repository.workspaceExists(first.id)).toBe(true);
    expect(await repository.listWorkspaces()).toHaveLength(2);
    expect(await repository.listWorkspaceMetadata()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, name: first.name }),
        expect.objectContaining({ id: second.id, name: second.name }),
      ]),
    );
    await repository.saveWorkspace({ ...first, name: "Updated" });
    expect((await repository.getWorkspace(first.id)).name).toBe("Updated");
    await repository.deleteWorkspace(first.id);
    expect(await repository.workspaceExists(first.id)).toBe(false);
    expect(await repository.getWorkspace(second.id)).toEqual(second);
    connection.close();
  });

  it("persists cloud revision and deletion markers per signed-in owner", async () => {
    const connection = await openNorthCentsDatabase({ indexedDB: factory });
    const repository = new WorkspaceRepository(connection);
    await repository.setCloudSyncMeta({
      ownerId: "user-a",
      workspaceId: "workspace-1",
      cloudVersion: "2026-10-23T10:00:00.000Z",
      syncedWorkspaceUpdatedAt: now,
    });
    await repository.setCloudSyncMeta({
      ownerId: "user-a",
      workspaceId: "workspace-2",
      cloudVersion: "2026-10-23T10:01:00.000Z",
      syncedWorkspaceUpdatedAt: now,
    });
    expect(
      await repository.getCloudSyncMeta("user-a", "workspace-1"),
    ).toMatchObject({
      ownerId: "user-a",
      cloudVersion: "2026-10-23T10:00:00.000Z",
    });
    expect(
      await repository.getCloudSyncMeta("user-b", "workspace-1"),
    ).toBeNull();

    await repository.markCloudDeleted("user-a", "2026-10-23T11:00:00.000Z");
    expect(await repository.getCloudDeletionMeta("user-a")).toMatchObject({
      ownerId: "user-a",
    });
    await repository.clearCloudDeleted("user-a");
    await repository.clearCloudSyncMetaForOwner("user-a");
    expect(await repository.getCloudDeletionMeta("user-a")).toBeNull();
    expect(
      await repository.getCloudSyncMeta("user-a", "workspace-1"),
    ).toBeNull();
    expect(
      await repository.getCloudSyncMeta("user-a", "workspace-2"),
    ).toBeNull();
    connection.close();
  });

  it("round-trips complete asset-account data without a consolidated field", async () => {
    const connection = await openNorthCentsDatabase({ indexedDB: factory });
    const repository = new WorkspaceRepository(connection);
    const original = workspace();
    const before = deriveSpendableCashCents(original.assetAccounts);
    await repository.createWorkspace(original);
    const restored = await repository.getWorkspace(original.id);
    expect(restored).toEqual(original);
    expect(restored.assetAccounts[0]).toMatchObject({
      currentValueCents: -12_345,
      spendability: "spendable",
      type: "chequing",
      institutionLabel: "Local institution",
      note: "Manually added",
    });
    expect(deriveSpendableCashCents(restored.assetAccounts)).toBe(before);
    const raw = await connection.read<unknown>(
      WORKSPACES_STORE,
      (transaction) =>
        requestToPromise(
          transaction
            .objectStore(WORKSPACES_STORE)
            .get(original.id) as IDBRequest<unknown>,
        ),
    );
    expect(raw).not.toHaveProperty("availableCashCents");
    expect(raw).not.toHaveProperty("totalCashCents");
    connection.close();
  });

  it("rejects invalid writes, credentials, debt cash types, and limits", async () => {
    const connection = await openNorthCentsDatabase({ indexedDB: factory });
    const repository = new WorkspaceRepository(connection);
    const original = workspace();
    await expectStorageCode(
      repository.createWorkspace({
        ...original,
        assetAccounts: [
          { ...original.assetAccounts[0], accountNumber: "private" },
        ],
      } as never),
      "corrupted-workspace",
    );
    await expectStorageCode(
      repository.createWorkspace({
        ...original,
        assetAccounts: [{ ...original.assetAccounts[0], type: "credit-card" }],
      } as never),
      "corrupted-workspace",
    );
    await expectStorageCode(
      repository.createWorkspace({
        ...original,
        assetAccounts: [
          {
            ...original.assetAccounts[0],
            currentValueCents: 10_000_000_001,
          },
        ],
      } as never),
      "corrupted-workspace",
    );
    await expectStorageCode(
      repository.createWorkspace({ ...original, schemaVersion: 3 } as never),
      "unsupported-workspace-version",
    );
    connection.close();
  });

  it("rejects corrupted reads without deleting or repairing them", async () => {
    const connection = await openNorthCentsDatabase({ indexedDB: factory });
    const repository = new WorkspaceRepository(connection);
    await connection.write(WORKSPACES_STORE, async (transaction) => {
      await requestToPromise(
        transaction.objectStore(WORKSPACES_STORE).put({
          id: "corrupt",
          schemaVersion: 2,
          assetAccounts: "not-an-array",
        }),
      );
    });
    await expectStorageCode(
      repository.getWorkspace("corrupt"),
      "corrupted-workspace",
    );
    expect(await repository.workspaceExists("corrupt")).toBe(true);
    connection.close();
  });

  it("aborts a failed write transaction without partial data", async () => {
    const connection = await openNorthCentsDatabase({ indexedDB: factory });
    await expectStorageCode(
      connection.write(WORKSPACES_STORE, async (transaction) => {
        await requestToPromise(
          transaction.objectStore(WORKSPACES_STORE).add(workspace()),
        );
        throw new Error("forced failure");
      }),
      "transaction-failed",
    );
    const repository = new WorkspaceRepository(connection);
    expect(await repository.workspaceExists("workspace-1")).toBe(false);
    connection.close();
  });
});

describe("active workspace and clearing", () => {
  it("isolates active workspace pointers by authenticated user", async () => {
    const connection = await openNorthCentsDatabase({
      indexedDB: new IDBFactory(),
    });
    const repository = new WorkspaceRepository(connection);
    const first = workspace();
    const second = workspace("workspace-2");
    await repository.createWorkspace(first);
    await repository.createWorkspace(second);
    await repository.setActiveWorkspace(first.id, "user-a");
    await repository.setActiveWorkspace(second.id, "user-b");
    expect(await repository.getActiveWorkspace("user-a")).toEqual(first);
    expect(await repository.getActiveWorkspace("user-b")).toEqual(second);
    expect(await repository.getActiveWorkspace("user-c")).toBeNull();
    await repository.deleteWorkspace(first.id);
    expect(await repository.getActiveWorkspaceId("user-a")).toBeNull();
    expect(await repository.getActiveWorkspace("user-b")).toEqual(second);
    connection.close();
  });

  it("persists, clears, and transactionally removes an active pointer", async () => {
    const factory = new IDBFactory();
    let connection = await openNorthCentsDatabase({ indexedDB: factory });
    let repository = new WorkspaceRepository(connection);
    const first = workspace();
    const second = workspace("workspace-2");
    await repository.createWorkspace(first);
    await repository.createWorkspace(second);
    await repository.setActiveWorkspace(first.id);
    connection.close();
    connection = await openNorthCentsDatabase({ indexedDB: factory });
    repository = new WorkspaceRepository(connection);
    expect(await repository.getActiveWorkspace()).toEqual(first);
    await repository.deleteWorkspace(first.id);
    expect(await repository.getActiveWorkspaceId()).toBeNull();
    expect(await repository.workspaceExists(second.id)).toBe(true);
    await repository.setActiveWorkspace(second.id);
    await repository.clearActiveWorkspace();
    expect(await repository.getActiveWorkspace()).toBeNull();
    connection.close();
  });

  it("reports stale and corrupted active workspaces as recoverable errors", async () => {
    const connection = await openNorthCentsDatabase({
      indexedDB: new IDBFactory(),
    });
    const repository = new WorkspaceRepository(connection);
    await connection.write(META_STORE, async (transaction) => {
      await requestToPromise(
        transaction.objectStore(META_STORE).put({
          key: ACTIVE_WORKSPACE_META_KEY,
          workspaceId: "missing",
        }),
      );
    });
    await expectStorageCode(
      repository.getActiveWorkspace(),
      "invalid-active-workspace",
    );
    await connection.write(
      [WORKSPACES_STORE, META_STORE],
      async (transaction) => {
        await requestToPromise(
          transaction.objectStore(WORKSPACES_STORE).put({
            id: "corrupt",
            schemaVersion: 2,
          }),
        );
        await requestToPromise(
          transaction.objectStore(META_STORE).put({
            key: ACTIVE_WORKSPACE_META_KEY,
            workspaceId: "corrupt",
          }),
        );
      },
    );
    await expectStorageCode(
      repository.getActiveWorkspace(),
      "invalid-active-workspace",
    );
    connection.close();
  });

  it("clears only V2 stores and leaves V1 localStorage untouched", async () => {
    const source = JSON.stringify({ version: 1, savedAt: now, baseline: {} });
    const storage = memoryStorage(source);
    const connection = await openNorthCentsDatabase({
      indexedDB: new IDBFactory(),
    });
    const repository = new WorkspaceRepository(connection);
    await repository.createWorkspace(workspace());
    await repository.setActiveWorkspace("workspace-1");
    await repository.clearAllV2Data();
    expect(await repository.listWorkspaces()).toEqual([]);
    expect(await repository.getActiveWorkspaceId()).toBeNull();
    expect(storage.getItem(BASELINE_STORAGE_KEY)).toBe(source);
    connection.close();
  });
});

describe("non-destructive V1 migration", () => {
  const storedV1 = JSON.stringify({
    version: 1,
    savedAt: "2026-09-20T10:00:00.000Z",
    baseline: {
      incomeCents: 300_000,
      housingCents: 100_000,
      otherExpensesCents: 50_000,
      debtPaymentsCents: 20_000,
      plannedSavingsCents: 30_000,
    },
  });
  const options = {
    workspaceId: "migrated-workspace",
    legacySnapshotId: "legacy-snapshot",
    workspaceName: "Migrated V1 baseline",
    asOfDate: "2026-09-24" as never,
    timeZone: "America/Toronto",
    now,
  } as const;

  it("migrates exactly once without touching the V1 source or inventing details", async () => {
    const storage = memoryStorage(storedV1);
    const connection = await openNorthCentsDatabase({
      indexedDB: new IDBFactory(),
    });
    const repository = new WorkspaceRepository(connection);
    expect(await migrateV1Baseline(connection, storage, options)).toEqual({
      status: "migrated",
      workspaceId: options.workspaceId,
    });
    expect(await migrateV1Baseline(connection, storage, options)).toEqual({
      status: "already-migrated",
      workspaceId: options.workspaceId,
    });
    expect(await repository.listWorkspaces()).toHaveLength(1);
    const migrated = await repository.getWorkspace(options.workspaceId);
    expect(migrated.accountGroups).toEqual([]);
    expect(migrated.assetAccounts).toEqual([]);
    expect(migrated.liabilityAccounts).toEqual([]);
    expect(migrated.incomeSources).toEqual([]);
    expect(migrated.incomeEvents).toEqual([]);
    expect(migrated.expenseDefinitions).toEqual([]);
    expect(migrated.expenseEvents).toEqual([]);
    expect(migrated.debts).toEqual([]);
    expect(migrated.goals).toEqual([]);
    expect(migrated.sinkingFunds).toEqual([]);
    expect(migrated.legacyV1Snapshot?.baseline).toEqual({
      incomeCents: 300_000,
      housingCents: 100_000,
      otherExpensesCents: 50_000,
      debtPaymentsCents: 20_000,
      plannedSavingsCents: 30_000,
    });
    expect(migrated.legacyV1Snapshot).not.toHaveProperty("asOfDate");
    expect(storage.getItem(BASELINE_STORAGE_KEY)).toBe(storedV1);
    expect(await repository.getActiveWorkspaceId()).toBe(options.workspaceId);
    const migrationMeta = await connection.read<unknown>(
      META_STORE,
      (transaction) =>
        requestToPromise(
          transaction
            .objectStore(META_STORE)
            .get(V1_MIGRATION_META_KEY) as IDBRequest<unknown>,
        ),
    );
    expect(migrationMeta).toEqual({
      key: V1_MIGRATION_META_KEY,
      state: "completed",
      sourceVersion: 1,
      workspaceId: options.workspaceId,
      migratedAt: now,
    });
    expect(JSON.stringify(migrationMeta)).not.toContain("300000");
    connection.close();
  });

  it("preserves malformed and unsupported sources and creates nothing", async () => {
    for (const source of ["not json", JSON.stringify({ version: 99 })]) {
      const storage = memoryStorage(source);
      const connection = await openNorthCentsDatabase({
        indexedDB: new IDBFactory(),
      });
      const result = await migrateV1Baseline(connection, storage, options);
      expect(["invalid-source", "unsupported-source"]).toContain(result.status);
      expect(storage.getItem(BASELINE_STORAGE_KEY)).toBe(source);
      expect(
        await new WorkspaceRepository(connection).listWorkspaces(),
      ).toEqual([]);
      connection.close();
    }
  });

  it("returns no-source and performs no write", async () => {
    const storage = memoryStorage();
    expect(readV1BaselineForMigration(storage)).toEqual({
      status: "no-source",
    });
    const connection = await openNorthCentsDatabase({
      indexedDB: new IDBFactory(),
    });
    expect(await migrateV1Baseline(connection, storage, options)).toEqual({
      status: "no-source",
    });
    expect(await new WorkspaceRepository(connection).listWorkspaces()).toEqual(
      [],
    );
    connection.close();
  });

  it("does not mark migration successful when the atomic write fails", async () => {
    const storage = memoryStorage(storedV1);
    const connection = await openNorthCentsDatabase({
      indexedDB: new IDBFactory(),
    });
    const repository = new WorkspaceRepository(connection);
    await repository.createWorkspace({
      ...workspace(),
      id: options.workspaceId as never,
      name: "Existing",
      accountGroups: [],
      assetAccounts: [],
      liabilityAccounts: [],
      debts: [],
    });
    await expectStorageCode(
      migrateV1Baseline(connection, storage, options),
      "workspace-id-collision",
    );
    const meta = await connection.read<unknown>(META_STORE, (transaction) =>
      requestToPromise(
        transaction
          .objectStore(META_STORE)
          .get(V1_MIGRATION_META_KEY) as IDBRequest<unknown>,
      ),
    );
    expect(meta).toBeUndefined();
    expect(storage.getItem(BASELINE_STORAGE_KEY)).toBe(storedV1);
    connection.close();
  });
});

describe("local export and import", () => {
  it("exports and validates an exact versioned workspace envelope", async () => {
    const base = workspace();
    const original = financialWorkspaceSchema.parse({
      ...base,
      expenseEvents: [
        {
          id: "expense-transaction-1",
          workspaceId: base.id,
          accountId: base.assetAccounts[0]?.id,
          relatedAccountId: base.assetAccounts[1]?.id,
          transactionType: "transfer",
          name: "Transfer between accounts",
          amountCents: 5_000,
          category: "other",
          nature: "variable",
          obligation: "flexible",
          dueDate: "2026-09-20",
          actualDate: "2026-09-20",
          status: "actual",
          provenance: "user-entered",
          createdAt: now,
          updatedAt: now,
        },
      ],
    }) as unknown as FinancialWorkspace;
    const serialized = await exportWorkspace(original, {
      exportedAt: now,
      applicationVersion: "0.1.0",
    });
    const envelope = await parseWorkspaceExport(serialized);
    expect(envelope.format).toBe(EXPORT_FORMAT);
    expect(envelope.workspace).toEqual(original);
    expect(envelope.workspace.assetAccounts[0]?.currentValueCents).toBe(
      -12_345,
    );
    expect(envelope.workspace.debts[0]?.interestModel).toMatchObject({
      aprBasisPoints: 2099,
    });
    expect(envelope.workspace.expenseEvents[0]).toMatchObject({
      transactionType: "transfer",
      accountId: "workspace-1-chequing",
      relatedAccountId: "workspace-1-savings",
    });
    expect(envelope).not.toHaveProperty("activeWorkspaceId");
    expect(envelope).not.toHaveProperty("migrationState");
    expect(serialized).not.toContain("availableCashCents");
  });

  it.each([
    LEGACY_NORTHCENTS_EXPORT_FORMAT,
    LEGACY_MONEVERO_EXPORT_FORMAT,
    LEGACY_EXPORT_FORMAT,
  ])(
    "accepts legacy %s exports without emitting the legacy brand",
    async (legacyFormat) => {
      const serialized = await exportWorkspace(workspace(), {
        exportedAt: now,
        applicationVersion: "0.1.0",
      });
      const legacyEnvelope = {
        ...(JSON.parse(serialized) as Record<string, unknown>),
        format: legacyFormat,
      };
      const parsed = await parseWorkspaceExport(JSON.stringify(legacyEnvelope));

      expect(parsed.format).toBe(EXPORT_FORMAT);
      expect(parsed.workspace.id).toBe("workspace-1");
    },
  );

  it("restores a valid pre-correction-history backup and initializes its history safely", async () => {
    const serialized = await exportWorkspace(workspace(), {
      exportedAt: now,
      applicationVersion: "0.1.0",
    });
    const envelope = JSON.parse(serialized) as {
      workspace: Record<string, unknown>;
      integrity: { digest: string };
    };
    delete envelope.workspace.balanceCorrections;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(envelope.workspace)),
    );
    envelope.integrity.digest = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    const parsed = await parseWorkspaceExport(JSON.stringify(envelope));

    expect(parsed.workspace.balanceCorrections).toEqual([]);
  });

  it("imports valid data and rejects collisions without overwrite", async () => {
    const original = workspace();
    const serialized = await exportWorkspace(original, {
      exportedAt: now,
      applicationVersion: "0.1.0",
    });
    const connection = await openNorthCentsDatabase({
      indexedDB: new IDBFactory(),
    });
    const repository = new WorkspaceRepository(connection);
    expect(await importWorkspace(repository, serialized)).toEqual(original);
    await expectStorageCode(
      importWorkspace(repository, serialized),
      "workspace-id-collision",
    );
    expect(await repository.listWorkspaces()).toEqual([original]);
    connection.close();
  });

  it("replaces an existing workspace only when explicitly requested and verifies correction history", async () => {
    const original = workspace();
    const correctionAccount = original.assetAccounts.at(0);
    if (!correctionAccount) throw new Error("Test account is missing.");
    const restored: FinancialWorkspace = {
      ...original,
      name: "Restored workspace",
      updatedAt: "2026-10-23T12:00:00.000Z",
      balanceCorrections: [
        {
          id: "restored-correction" as never,
          workspaceId: original.id,
          accountId: correctionAccount.id,
          correctionDate: "2026-10-23" as never,
          previousBalanceCents: 8_000 as never,
          correctedBalanceCents: 9_000 as never,
          provenance: "user-entered",
          createdAt: "2026-10-23T12:00:00.000Z",
          updatedAt: "2026-10-23T12:00:00.000Z",
        },
      ],
    };
    const serialized = await exportWorkspace(restored, {
      exportedAt: "2026-10-23T12:01:00.000Z",
      applicationVersion: "0.1.0",
    });
    const connection = await openNorthCentsDatabase({
      indexedDB: new IDBFactory(),
    });
    const repository = new WorkspaceRepository(connection);
    await repository.createWorkspace(original);

    await expectStorageCode(
      importWorkspace(repository, serialized),
      "workspace-id-collision",
    );
    expect((await repository.getWorkspace(original.id)).name).toBe(
      original.name,
    );
    await expect(
      importWorkspace(repository, serialized, { onCollision: "replace" }),
    ).resolves.toEqual(restored);
    expect(await repository.getWorkspace(original.id)).toEqual(restored);
    expect(
      (await repository.getWorkspace(original.id)).balanceCorrections,
    ).toHaveLength(1);
    connection.close();
  });

  it("rejects malformed JSON, envelopes, versions, integrity, and workspaces", async () => {
    await expectStorageCode(parseWorkspaceExport("{"), "invalid-import");
    await expectStorageCode(
      parseWorkspaceExport(
        JSON.stringify({ format: "other", formatVersion: 1 }),
      ),
      "invalid-import",
    );
    const serialized = await exportWorkspace(workspace(), {
      exportedAt: now,
      applicationVersion: "0.1.0",
    });
    const envelope = JSON.parse(serialized) as Record<string, unknown>;
    await expectStorageCode(
      parseWorkspaceExport(JSON.stringify({ ...envelope, formatVersion: 2 })),
      "unsupported-export-version",
    );
    await expectStorageCode(
      parseWorkspaceExport(
        JSON.stringify({
          ...envelope,
          workspace: { ...(envelope.workspace as object), schemaVersion: 3 },
        }),
      ),
      "unsupported-workspace-version",
    );
    await expectStorageCode(
      parseWorkspaceExport(
        JSON.stringify({
          ...envelope,
          workspace: {
            ...(envelope.workspace as object),
            assetAccounts: "bad",
          },
        }),
      ),
      "invalid-import",
    );
    await expectStorageCode(
      parseWorkspaceExport(
        JSON.stringify({
          ...envelope,
          integrity: { algorithm: "SHA-256", digest: "00" },
        }),
      ),
      "invalid-import",
    );
  });
});

describe("failure and privacy boundaries", () => {
  it("returns a typed unavailable error", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    vi.stubGlobal("indexedDB", undefined);
    await expectStorageCode(openNorthCentsDatabase(), "indexeddb-unavailable");
    vi.unstubAllGlobals();
    if (descriptor !== undefined)
      Object.defineProperty(globalThis, "indexedDB", descriptor);
  });

  it("returns typed database-open and quota errors", async () => {
    const brokenFactory = {
      open: () => {
        throw new Error("blocked");
      },
    } as unknown as IDBFactory;
    await expectStorageCode(
      openNorthCentsDatabase({ indexedDB: brokenFactory }),
      "database-open-failed",
    );
    expect(
      toStorageError(
        new DOMException("private value omitted", "QuotaExceededError"),
        "transaction-failed",
        "failed",
      ).code,
    ).toBe("quota-exceeded");
  });

  it("contains no network, cookie, URL, or logging behavior", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logSpy = vi.spyOn(console, "log");
    const connection = await openNorthCentsDatabase({
      indexedDB: new IDBFactory(),
    });
    const repository = new WorkspaceRepository(connection);
    await repository.createWorkspace(workspace());
    await repository.getWorkspace("workspace-1");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    logSpy.mockRestore();
    connection.close();
  });
});
