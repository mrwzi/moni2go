import { financialWorkspaceSchema } from "../domain/schemas";
import type { FinancialWorkspace } from "../domain/workspace";
import { z } from "zod";
import { NorthCentsStorageError } from "./storage-errors";
import { WorkspaceRepository } from "./workspace-repository";

export const EXPORT_FORMAT = "moni2go-local-export";
export const LEGACY_NORTHCENTS_EXPORT_FORMAT = "northcents-local-export";
export const LEGACY_MONEVERO_EXPORT_FORMAT = "monevero-local-export";
export const LEGACY_EXPORT_FORMAT = "finscope-local-export";
export const EXPORT_FORMAT_VERSION = 1;
export const EXPORT_PRIVACY_WARNING =
  "This file contains personal financial information.";

export type Moni2GoExport = Readonly<{
  format: typeof EXPORT_FORMAT;
  formatVersion: 1;
  dataSchemaVersion: 2;
  exportedAt: string;
  applicationVersion: string;
  workspaceSchemaVersion: 2;
  workspace: FinancialWorkspace;
  integrity: Readonly<{ algorithm: "SHA-256"; digest: string }>;
}>;

async function sha256(value: string): Promise<string> {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi === undefined)
    throw new NorthCentsStorageError(
      "invalid-import",
      "Local cryptographic validation is unavailable.",
    );
  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function exportWorkspace(
  workspace: FinancialWorkspace,
  options: Readonly<{ exportedAt: string; applicationVersion: string }>,
): Promise<string> {
  const parsed = financialWorkspaceSchema.parse(
    workspace,
  ) as unknown as FinancialWorkspace;
  const workspaceJson = JSON.stringify(parsed);
  const envelope: Moni2GoExport = {
    format: EXPORT_FORMAT,
    formatVersion: 1,
    dataSchemaVersion: 2,
    exportedAt: options.exportedAt,
    applicationVersion: options.applicationVersion,
    workspaceSchemaVersion: 2,
    workspace: parsed,
    integrity: { algorithm: "SHA-256", digest: await sha256(workspaceJson) },
  };
  return JSON.stringify(envelope, null, 2);
}

export async function parseWorkspaceExport(
  serialized: string,
): Promise<Moni2GoExport> {
  let raw: unknown;
  try {
    raw = JSON.parse(serialized) as unknown;
  } catch {
    throw new NorthCentsStorageError(
      "invalid-import",
      "The import is not valid JSON.",
    );
  }
  if (typeof raw !== "object" || raw === null)
    throw new NorthCentsStorageError(
      "invalid-import",
      "The import envelope is invalid.",
    );
  if (
    !("format" in raw) ||
    (raw.format !== EXPORT_FORMAT &&
      raw.format !== LEGACY_NORTHCENTS_EXPORT_FORMAT &&
      raw.format !== LEGACY_MONEVERO_EXPORT_FORMAT &&
      raw.format !== LEGACY_EXPORT_FORMAT)
  )
    throw new NorthCentsStorageError(
      "invalid-import",
      "The import format is invalid.",
    );
  if (!("formatVersion" in raw) || raw.formatVersion !== EXPORT_FORMAT_VERSION)
    throw new NorthCentsStorageError(
      "unsupported-export-version",
      "The export version is not supported.",
    );
  if (
    !("dataSchemaVersion" in raw) ||
    raw.dataSchemaVersion !== 2 ||
    !("workspaceSchemaVersion" in raw) ||
    raw.workspaceSchemaVersion !== 2
  )
    throw new NorthCentsStorageError(
      "unsupported-workspace-version",
      "The exported workspace version is not supported.",
    );
  if (
    !("exportedAt" in raw) ||
    typeof raw.exportedAt !== "string" ||
    !z.iso.datetime().safeParse(raw.exportedAt).success ||
    !("applicationVersion" in raw) ||
    typeof raw.applicationVersion !== "string" ||
    !("workspace" in raw) ||
    !("integrity" in raw) ||
    typeof raw.integrity !== "object" ||
    raw.integrity === null ||
    !("algorithm" in raw.integrity) ||
    raw.integrity.algorithm !== "SHA-256" ||
    !("digest" in raw.integrity) ||
    typeof raw.integrity.digest !== "string"
  )
    throw new NorthCentsStorageError(
      "invalid-import",
      "The import envelope is invalid.",
    );

  if (
    typeof raw.workspace === "object" &&
    raw.workspace !== null &&
    "schemaVersion" in raw.workspace &&
    raw.workspace.schemaVersion !== 2
  )
    throw new NorthCentsStorageError(
      "unsupported-workspace-version",
      "The exported workspace version is not supported.",
    );

  const parsed = financialWorkspaceSchema.safeParse(raw.workspace);
  if (!parsed.success)
    throw new NorthCentsStorageError(
      "invalid-import",
      "The imported workspace failed validation.",
    );
  const workspace = parsed.data as unknown as FinancialWorkspace;
  if ((await sha256(JSON.stringify(workspace))) !== raw.integrity.digest)
    throw new NorthCentsStorageError(
      "invalid-import",
      "The import integrity check failed.",
    );
  return {
    format: EXPORT_FORMAT,
    formatVersion: 1,
    dataSchemaVersion: 2,
    exportedAt: raw.exportedAt,
    applicationVersion: raw.applicationVersion,
    workspaceSchemaVersion: 2,
    workspace,
    integrity: { algorithm: "SHA-256", digest: raw.integrity.digest },
  };
}

export async function importWorkspace(
  repository: WorkspaceRepository,
  serialized: string,
): Promise<FinancialWorkspace> {
  const envelope = await parseWorkspaceExport(serialized);
  if (await repository.workspaceExists(envelope.workspace.id))
    throw new NorthCentsStorageError(
      "workspace-id-collision",
      "A workspace with this ID already exists.",
      { workspaceId: envelope.workspace.id },
    );
  await repository.createWorkspace(envelope.workspace);
  return envelope.workspace;
}
