import {
  storedBaselineV1Schema,
  type StoredBaselineV1,
} from "../../domain/schemas";
import { financialWorkspaceSchema } from "../domain/schemas";
import type { CalendarDate } from "../domain/types";
import type { FinancialWorkspace } from "../domain/workspace";
import { NorthCentsDatabase, requestToPromise } from "./indexeddb";
import { NorthCentsStorageError } from "./storage-errors";
import {
  ACTIVE_WORKSPACE_META_KEY,
  META_STORE,
  V1_MIGRATION_META_KEY,
  WORKSPACES_STORE,
  type ActiveWorkspaceMeta,
  type V1MigrationMeta,
} from "./types";
import {
  BASELINE_STORAGE_KEY,
  type StorageLike,
} from "../../storage/baseline-storage";

export type V1MigrationSourceResult =
  | Readonly<{ status: "valid"; value: StoredBaselineV1 }>
  | Readonly<{ status: "no-source" }>
  | Readonly<{ status: "invalid-source" }>
  | Readonly<{ status: "unsupported-source" }>;

export type V1MigrationResult =
  | Readonly<{ status: "migrated"; workspaceId: string }>
  | Readonly<{ status: "already-migrated"; workspaceId: string }>
  | Readonly<{ status: "no-source" }>
  | Readonly<{ status: "invalid-source" }>
  | Readonly<{ status: "unsupported-source" }>;

export type V1MigrationOptions = Readonly<{
  workspaceId: string;
  legacySnapshotId: string;
  workspaceName: string;
  asOfDate: CalendarDate;
  timeZone: string;
  now: string;
  setActive?: boolean;
}>;

/** Reads and validates without mutating malformed or unsupported V1 storage. */
export function readV1BaselineForMigration(
  storage: Pick<StorageLike, "getItem">,
): V1MigrationSourceResult {
  const serialized = storage.getItem(BASELINE_STORAGE_KEY);
  if (serialized === null) return { status: "no-source" };
  let raw: unknown;
  try {
    raw = JSON.parse(serialized) as unknown;
  } catch {
    return { status: "invalid-source" };
  }
  const parsed = storedBaselineV1Schema.safeParse(raw);
  if (parsed.success) return { status: "valid", value: parsed.data };
  if (
    typeof raw === "object" &&
    raw !== null &&
    "version" in raw &&
    raw.version !== 1
  )
    return { status: "unsupported-source" };
  return { status: "invalid-source" };
}

function createMigratedWorkspace(
  source: StoredBaselineV1,
  options: V1MigrationOptions,
): FinancialWorkspace {
  const workspace = {
    schemaVersion: 2,
    id: options.workspaceId,
    name: options.workspaceName,
    provenance: "legacy-v1",
    currency: "CAD",
    asOfDate: options.asOfDate,
    timeZone: options.timeZone,
    createdAt: options.now,
    updatedAt: options.now,
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
        reminders: { accountReviewCadence: "never" },
      },
    },
    legacyV1Snapshot: {
      id: options.legacySnapshotId,
      workspaceId: options.workspaceId,
      provenance: "legacy-v1",
      originalSavedAt: source.savedAt,
      migratedAt: options.now,
      completeness: "monthly-aggregate-only",
      baseline: source.baseline,
      createdAt: options.now,
      updatedAt: options.now,
    },
  };
  return financialWorkspaceSchema.parse(
    workspace,
  ) as unknown as FinancialWorkspace;
}

export async function migrateV1Baseline(
  connection: NorthCentsDatabase,
  storage: Pick<StorageLike, "getItem">,
  options: V1MigrationOptions,
): Promise<V1MigrationResult> {
  const source = readV1BaselineForMigration(storage);
  if (source.status !== "valid") return source;
  const workspace = createMigratedWorkspace(source.value, options);

  return connection.write(
    [WORKSPACES_STORE, META_STORE],
    async (transaction) => {
      const metaStore = transaction.objectStore(META_STORE);
      const previous = (await requestToPromise(
        metaStore.get(V1_MIGRATION_META_KEY),
      )) as V1MigrationMeta | undefined;
      if (previous?.state === "completed")
        return {
          status: "already-migrated",
          workspaceId: previous.workspaceId,
        } as const;

      const workspaceStore = transaction.objectStore(WORKSPACES_STORE);
      if (
        (await requestToPromise(workspaceStore.get(options.workspaceId))) !==
        undefined
      )
        throw new NorthCentsStorageError(
          "workspace-id-collision",
          "The migration workspace ID already exists.",
          { workspaceId: options.workspaceId },
        );
      await requestToPromise(workspaceStore.add(workspace));

      if (options.setActive !== false) {
        const active: ActiveWorkspaceMeta = {
          key: ACTIVE_WORKSPACE_META_KEY,
          workspaceId: options.workspaceId,
        };
        await requestToPromise(metaStore.put(active));
      }
      const metadata: V1MigrationMeta = {
        key: V1_MIGRATION_META_KEY,
        state: "completed",
        sourceVersion: 1,
        workspaceId: options.workspaceId,
        migratedAt: options.now,
      };
      await requestToPromise(metaStore.put(metadata));
      return { status: "migrated", workspaceId: options.workspaceId } as const;
    },
  );
}
