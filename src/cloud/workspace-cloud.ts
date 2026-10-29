import type { SupabaseClient } from "@supabase/supabase-js";
import { financialWorkspaceSchema } from "../v2/domain/schemas";
import type { FinancialWorkspace } from "../v2/domain/workspace";

export class CloudWorkspaceError extends Error {
  constructor(
    readonly code:
      "not-configured" | "invalid-workspace" | "request-failed" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "CloudWorkspaceError";
  }
}

export type CloudWorkspaceSnapshot = Readonly<{
  workspace: FinancialWorkspace;
  version: string;
}>;

function nextCloudTimestamp(expectedVersion: string | null): string {
  const now = Date.now();
  const expected = expectedVersion ? Date.parse(expectedVersion) : 0;
  return new Date(Math.max(now, expected + 1)).toISOString();
}

function cloudRequestError(
  error: Readonly<{ code?: string }> | null,
  fallbackMessage: string,
): CloudWorkspaceError {
  if (error?.code === "PGRST205")
    return new CloudWorkspaceError(
      "not-configured",
      "Cloud backup storage has not been set up for this project yet.",
    );
  if (error?.code === "23505")
    return new CloudWorkspaceError(
      "conflict",
      "Cloud sync paused because this workspace changed on another device. Your local changes are still saved.",
    );
  return new CloudWorkspaceError("request-failed", fallbackMessage);
}

export async function saveWorkspaceToCloud(
  client: SupabaseClient,
  userId: string,
  workspace: FinancialWorkspace,
  expectedVersion: string | null,
): Promise<string> {
  const valid = financialWorkspaceSchema.parse(workspace);
  const updatedAt = nextCloudTimestamp(expectedVersion);
  const values = {
    workspace_id: valid.id,
    owner_id: userId,
    schema_version: valid.schemaVersion,
    workspace: valid,
    updated_at: updatedAt,
  };
  const response =
    expectedVersion === null
      ? await client
          .from("financial_workspaces")
          .insert(values)
          .select("updated_at")
          .single()
      : await client
          .from("financial_workspaces")
          .update(values)
          .eq("workspace_id", valid.id)
          .eq("owner_id", userId)
          .eq("updated_at", expectedVersion)
          .select("updated_at")
          .maybeSingle();
  const { data, error } = response;
  if (error)
    throw cloudRequestError(error, "Cloud workspace could not be saved.");
  if (!data)
    throw new CloudWorkspaceError(
      "conflict",
      "Cloud sync paused because this workspace changed on another device. Your local changes are still saved.",
    );
  return data.updated_at as string;
}

export async function loadCanonicalCloudWorkspace(
  client: SupabaseClient,
  userId: string,
): Promise<CloudWorkspaceSnapshot | null> {
  const { data, error } = await client
    .from("financial_workspaces")
    .select("workspace, updated_at, created_at")
    .eq("owner_id", userId)
    // One account may contain legacy rows created by different devices. Always
    // follow the first workspace so every device converges on the same row;
    // updated_at would let competing rows take turns becoming "current".
    .order("created_at", { ascending: true })
    .order("workspace_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error)
    throw cloudRequestError(error, "Cloud workspace could not be loaded.");
  if (!data) return null;
  const result = financialWorkspaceSchema.safeParse(data.workspace);
  if (!result.success)
    throw new CloudWorkspaceError(
      "invalid-workspace",
      "The cloud backup uses an unsupported data format.",
    );
  return {
    workspace: result.data as unknown as FinancialWorkspace,
    version: data.updated_at as string,
  };
}

export async function deleteCloudWorkspaces(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from("financial_workspaces")
    .delete()
    .eq("owner_id", userId);
  if (error)
    throw cloudRequestError(error, "Cloud workspaces could not be deleted.");
}
