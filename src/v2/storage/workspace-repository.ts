import { financialWorkspaceSchema } from "../domain/schemas";
import type { WorkspaceId } from "../domain/types";
import type { FinancialWorkspace } from "../domain/workspace";
import { NorthCentsDatabase, requestToPromise } from "./indexeddb";
import { NorthCentsStorageError } from "./storage-errors";
import {
  ACTIVE_WORKSPACE_META_KEY,
  activeWorkspaceMetaKey,
  cloudDeletionMetaKey,
  cloudSyncMetaKey,
  META_STORE,
  WORKSPACES_STORE,
  type ActiveWorkspaceMeta,
  type CloudDeletionMeta,
  type CloudSyncMeta,
  type WorkspaceMetadata,
} from "./types";

function validateWorkspace(raw: unknown): FinancialWorkspace {
  if (
    typeof raw === "object" &&
    raw !== null &&
    "schemaVersion" in raw &&
    raw.schemaVersion !== 2
  )
    throw new NorthCentsStorageError(
      "unsupported-workspace-version",
      "The stored workspace version is not supported.",
    );
  const result = financialWorkspaceSchema.safeParse(raw);
  if (!result.success)
    throw new NorthCentsStorageError(
      "corrupted-workspace",
      "The stored workspace failed validation.",
    );
  return result.data as unknown as FinancialWorkspace;
}

function validateForWrite(workspace: unknown): FinancialWorkspace {
  const parsed = validateWorkspace(workspace);
  return structuredClone(parsed);
}

export class WorkspaceRepository {
  constructor(readonly connection: NorthCentsDatabase) {}

  async createWorkspace(workspace: FinancialWorkspace): Promise<void> {
    const valid = validateForWrite(workspace);
    await this.connection.write(WORKSPACES_STORE, async (transaction) => {
      const store = transaction.objectStore(WORKSPACES_STORE);
      if ((await requestToPromise(store.get(valid.id))) !== undefined)
        throw new NorthCentsStorageError(
          "workspace-id-collision",
          "A workspace with this ID already exists.",
          { workspaceId: valid.id },
        );
      await requestToPromise(store.add(valid));
    });
  }

  async saveWorkspace(workspace: FinancialWorkspace): Promise<void> {
    const valid = validateForWrite(workspace);
    await this.connection.write(WORKSPACES_STORE, async (transaction) => {
      const store = transaction.objectStore(WORKSPACES_STORE);
      if ((await requestToPromise(store.get(valid.id))) === undefined)
        throw new NorthCentsStorageError(
          "workspace-not-found",
          "The workspace does not exist.",
          { workspaceId: valid.id },
        );
      await requestToPromise(store.put(valid));
    });
  }

  async getWorkspace(id: WorkspaceId | string): Promise<FinancialWorkspace> {
    const raw = await this.connection.read<unknown>(
      WORKSPACES_STORE,
      (transaction) =>
        requestToPromise(
          transaction
            .objectStore(WORKSPACES_STORE)
            .get(id) as IDBRequest<unknown>,
        ),
    );
    if (raw === undefined)
      throw new NorthCentsStorageError(
        "workspace-not-found",
        "The workspace does not exist.",
        { workspaceId: id },
      );
    return validateWorkspace(raw);
  }

  async workspaceExists(id: WorkspaceId | string): Promise<boolean> {
    return this.connection.read(WORKSPACES_STORE, async (transaction) =>
      Boolean(
        await requestToPromise(
          transaction.objectStore(WORKSPACES_STORE).count(id),
        ),
      ),
    );
  }

  async listWorkspaces(): Promise<readonly FinancialWorkspace[]> {
    const values = await this.connection.read(WORKSPACES_STORE, (transaction) =>
      requestToPromise(transaction.objectStore(WORKSPACES_STORE).getAll()),
    );
    return values.map(validateWorkspace);
  }

  async listWorkspaceMetadata(): Promise<readonly WorkspaceMetadata[]> {
    return (await this.listWorkspaces()).map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      provenance: workspace.provenance,
      updatedAt: workspace.updatedAt,
    }));
  }

  async deleteWorkspace(id: WorkspaceId | string): Promise<void> {
    await this.connection.write(
      [WORKSPACES_STORE, META_STORE],
      async (transaction) => {
        const workspaceStore = transaction.objectStore(WORKSPACES_STORE);
        if ((await requestToPromise(workspaceStore.get(id))) === undefined)
          throw new NorthCentsStorageError(
            "workspace-not-found",
            "The workspace does not exist.",
            { workspaceId: id },
          );
        await requestToPromise(workspaceStore.delete(id));
        const metaStore = transaction.objectStore(META_STORE);
        const records = (await requestToPromise(
          metaStore.getAll(),
        )) as ActiveWorkspaceMeta[];
        for (const active of records)
          if (
            active.workspaceId === id &&
            active.key.startsWith(ACTIVE_WORKSPACE_META_KEY)
          )
            await requestToPromise(metaStore.delete(active.key));
      },
    );
  }

  async setActiveWorkspace(
    id: WorkspaceId | string,
    ownerId?: string,
  ): Promise<void> {
    await this.connection.write(
      [WORKSPACES_STORE, META_STORE],
      async (transaction) => {
        const rawWorkspace = await requestToPromise(
          transaction
            .objectStore(WORKSPACES_STORE)
            .get(id) as IDBRequest<unknown>,
        );
        if (rawWorkspace === undefined)
          throw new NorthCentsStorageError(
            "workspace-not-found",
            "The workspace does not exist.",
            { workspaceId: id },
          );
        validateWorkspace(rawWorkspace);
        const record: ActiveWorkspaceMeta = {
          key: activeWorkspaceMetaKey(ownerId),
          workspaceId: id,
        };
        await requestToPromise(transaction.objectStore(META_STORE).put(record));
      },
    );
  }

  async getActiveWorkspaceId(ownerId?: string): Promise<string | null> {
    const key = activeWorkspaceMetaKey(ownerId);
    const raw = (await this.connection.read(META_STORE, (transaction) =>
      requestToPromise(transaction.objectStore(META_STORE).get(key)),
    )) as unknown;
    if (raw === undefined) return null;
    if (
      typeof raw !== "object" ||
      raw === null ||
      !("workspaceId" in raw) ||
      typeof raw.workspaceId !== "string"
    )
      throw new NorthCentsStorageError(
        "invalid-active-workspace",
        "The active workspace pointer is invalid.",
      );
    return raw.workspaceId;
  }

  async getActiveWorkspace(
    ownerId?: string,
  ): Promise<FinancialWorkspace | null> {
    const id = await this.getActiveWorkspaceId(ownerId);
    if (id === null) return null;
    try {
      return await this.getWorkspace(id);
    } catch (error) {
      if (
        error instanceof NorthCentsStorageError &&
        [
          "workspace-not-found",
          "corrupted-workspace",
          "unsupported-workspace-version",
        ].includes(error.code)
      )
        throw new NorthCentsStorageError(
          "invalid-active-workspace",
          "The active workspace cannot be loaded.",
          { workspaceId: id, reason: error.code },
        );
      throw error;
    }
  }

  async clearActiveWorkspace(ownerId?: string): Promise<void> {
    await this.connection.write(META_STORE, async (transaction) => {
      await requestToPromise(
        transaction
          .objectStore(META_STORE)
          .delete(activeWorkspaceMetaKey(ownerId)),
      );
    });
  }

  async getCloudSyncMeta(
    ownerId: string,
    workspaceId: string,
  ): Promise<CloudSyncMeta | null> {
    const raw = (await this.connection.read(META_STORE, (transaction) =>
      requestToPromise(
        transaction
          .objectStore(META_STORE)
          .get(cloudSyncMetaKey(ownerId, workspaceId)),
      ),
    )) as CloudSyncMeta | undefined;
    return raw ?? null;
  }

  async setCloudSyncMeta(meta: Omit<CloudSyncMeta, "key">): Promise<void> {
    const record: CloudSyncMeta = {
      ...meta,
      key: cloudSyncMetaKey(meta.ownerId, meta.workspaceId),
    };
    await this.connection.write(META_STORE, async (transaction) => {
      await requestToPromise(transaction.objectStore(META_STORE).put(record));
    });
  }

  async clearCloudSyncMeta(
    ownerId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.connection.write(META_STORE, async (transaction) => {
      await requestToPromise(
        transaction
          .objectStore(META_STORE)
          .delete(cloudSyncMetaKey(ownerId, workspaceId)),
      );
    });
  }

  async clearCloudSyncMetaForOwner(ownerId: string): Promise<void> {
    await this.connection.write(META_STORE, async (transaction) => {
      const store = transaction.objectStore(META_STORE);
      const records = (await requestToPromise(
        store.getAll(),
      )) as (Partial<CloudSyncMeta> & { key?: string })[];
      for (const record of records)
        if (
          record.ownerId === ownerId &&
          record.key?.startsWith(`cloud-sync:${ownerId}:`)
        )
          await requestToPromise(store.delete(record.key));
    });
  }

  async getCloudDeletionMeta(
    ownerId: string,
  ): Promise<CloudDeletionMeta | null> {
    const raw = (await this.connection.read(META_STORE, (transaction) =>
      requestToPromise(
        transaction.objectStore(META_STORE).get(cloudDeletionMetaKey(ownerId)),
      ),
    )) as CloudDeletionMeta | undefined;
    return raw ?? null;
  }

  async markCloudDeleted(ownerId: string, deletedAt: string): Promise<void> {
    const record: CloudDeletionMeta = {
      key: cloudDeletionMetaKey(ownerId),
      ownerId,
      deletedAt,
    };
    await this.connection.write(META_STORE, async (transaction) => {
      await requestToPromise(transaction.objectStore(META_STORE).put(record));
    });
  }

  async clearCloudDeleted(ownerId: string): Promise<void> {
    await this.connection.write(META_STORE, async (transaction) => {
      await requestToPromise(
        transaction
          .objectStore(META_STORE)
          .delete(cloudDeletionMetaKey(ownerId)),
      );
    });
  }

  async clearAllV2Data(): Promise<void> {
    await this.connection.write(
      [WORKSPACES_STORE, META_STORE],
      async (transaction) => {
        await requestToPromise(
          transaction.objectStore(WORKSPACES_STORE).clear(),
        );
        await requestToPromise(transaction.objectStore(META_STORE).clear());
      },
    );
  }
}
