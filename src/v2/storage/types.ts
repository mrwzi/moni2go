import type { FinancialWorkspace } from "../domain/workspace";
import type { WorkspaceId } from "../domain/types";

/**
 * The physical database name is intentionally retained from the original
 * FinScope release. Renaming it would strand existing browser-local financial
 * workspaces in a different IndexedDB database.
 */
export const LEGACY_INDEXEDDB_NAME = "finscope";
export const NORTHCENTS_DATABASE_NAME = LEGACY_INDEXEDDB_NAME;
export const NORTHCENTS_DATABASE_VERSION = 1;
export const WORKSPACES_STORE = "workspaces";
export const META_STORE = "meta";

export const ACTIVE_WORKSPACE_META_KEY = "active-workspace";
export const activeWorkspaceMetaKey = (ownerId?: string) =>
  ownerId
    ? `${ACTIVE_WORKSPACE_META_KEY}:user:${ownerId}`
    : ACTIVE_WORKSPACE_META_KEY;
export const V1_MIGRATION_META_KEY = "migration:v1-baseline";
export const PERSISTENCE_SCHEMA_META_KEY = "persistence-schema";
export const cloudSyncMetaKey = (ownerId: string, workspaceId: string) =>
  `cloud-sync:${ownerId}:${workspaceId}`;
export const cloudDeletionMetaKey = (ownerId: string) =>
  `cloud-sync-deleted:${ownerId}`;

export type WorkspaceMetadata = Readonly<{
  id: WorkspaceId;
  name: string;
  provenance: FinancialWorkspace["provenance"];
  updatedAt: string;
}>;

export type ActiveWorkspaceMeta = Readonly<{
  key: string;
  workspaceId: string;
}>;

export type V1MigrationMeta = Readonly<{
  key: typeof V1_MIGRATION_META_KEY;
  state: "completed";
  sourceVersion: 1;
  workspaceId: string;
  migratedAt: string;
}>;

export type PersistenceSchemaMeta = Readonly<{
  key: typeof PERSISTENCE_SCHEMA_META_KEY;
  databaseVersion: 1;
  workspaceSchemaVersion: 2;
}>;

export type CloudSyncMeta = Readonly<{
  key: string;
  ownerId: string;
  workspaceId: string;
  cloudVersion: string;
  syncedWorkspaceUpdatedAt: string;
}>;

export type CloudDeletionMeta = Readonly<{
  key: string;
  ownerId: string;
  deletedAt: string;
}>;

export type MetaRecord =
  | ActiveWorkspaceMeta
  | V1MigrationMeta
  | PersistenceSchemaMeta
  | CloudSyncMeta
  | CloudDeletionMeta;
