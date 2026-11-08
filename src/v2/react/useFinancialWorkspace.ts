"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseCalendarDate } from "../domain/calendar";
import type { FinancialWorkspace } from "../domain/workspace";
import { openMoni2GoDatabase, WorkspaceRepository } from "../storage";
import { useAuthUser } from "../../lib/supabase/use-auth-user";
import { createClient } from "../../lib/supabase/client";
import {
  deleteCloudWorkspaces,
  loadCloudSyncControl,
  loadCanonicalCloudWorkspace,
  resumeCloudSyncForAccount,
  saveWorkspaceToCloud,
  type CloudWorkspaceSnapshot,
} from "../../cloud/workspace-cloud";

export type CloudWorkspaceConflict = Readonly<{
  local: FinancialWorkspace;
  cloud: FinancialWorkspace;
}>;

function today(): ReturnType<typeof parseCalendarDate> {
  const value = new Date();
  return parseCalendarDate(
    `${value.getFullYear().toString().padStart(4, "0")}-${(value.getMonth() + 1).toString().padStart(2, "0")}-${value.getDate().toString().padStart(2, "0")}`,
  );
}

function newWorkspace(): FinancialWorkspace {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    schemaVersion: 2,
    id: id as FinancialWorkspace["id"],
    name: "My financial picture",
    provenance: "user-entered",
    currency: "CAD",
    asOfDate: today(),
    timeZone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto",
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
  };
}

export function useFinancialWorkspace() {
  const auth = useAuthUser();
  const ownerId = auth.status === "signed-in" ? auth.user.id : undefined;
  const [workspace, setWorkspace] = useState<FinancialWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [cloudSyncPaused, setCloudSyncPaused] = useState(false);
  const [cloudSyncState, setCloudSyncState] = useState<
    "pending" | "synced" | "local-only" | "conflict"
  >("pending");
  const [cloudConflictSnapshot, setCloudConflictSnapshot] =
    useState<CloudWorkspaceSnapshot | null>(null);
  const syncInProgress = useRef(false);
  const syncStateRef = useRef(cloudSyncState);
  const cloudVersionRef = useRef<string | null>(null);
  const cloudWorkspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    syncStateRef.current = cloudSyncState;
  }, [cloudSyncState]);

  const load = useCallback(
    async (background = false) => {
      if (syncInProgress.current) return;
      if (auth.status === "loading" || auth.status === "signed-out") {
        setWorkspace(null);
        setLoading(auth.status === "loading");
        return;
      }
      syncInProgress.current = true;
      if (!background) {
        setLoading(true);
        setCloudConflictSnapshot(null);
        setCloudSyncState(ownerId ? "pending" : "local-only");
      }
      setError(null);
      try {
        const database = await openMoni2GoDatabase();
        try {
          const repository = new WorkspaceRepository(database);
          const local = await repository.getActiveWorkspace(ownerId);

          if (!ownerId) {
            setWorkspace(local);
            return;
          }

          const client = createClient();
          const deletion = await repository.getCloudDeletionMeta(ownerId);
          let cloud;
          try {
            const control = await loadCloudSyncControl(client);
            if (!control.enabled) {
              setWorkspace(null);
              setCloudSyncPaused(true);
              setCloudSyncState("local-only");
              setSyncMessage(
                "Cloud sync is paused for this account. Resume sync to upload a workspace again.",
              );
              return;
            }
            if (deletion) await repository.clearCloudDeleted(ownerId);
            setCloudSyncPaused(false);
            cloud = await loadCanonicalCloudWorkspace(client, ownerId);
          } catch {
            setWorkspace(null);
            setCloudSyncState("local-only");
            setSyncMessage(
              "Your local workspace is available. Cloud sync has not completed; save again or check sync when you are online.",
            );
            return;
          }
          if (cloud) {
            // Signed-in workspaces are cloud-first. IndexedDB may still contain
            // an older recovery copy, but it never decides what the user sees.
            cloudVersionRef.current = cloud.version;
            cloudWorkspaceIdRef.current = cloud.workspace.id;
            setWorkspace(cloud.workspace);
            setCloudConflictSnapshot(null);
            setCloudSyncPaused(false);
            setCloudSyncState("synced");
            setSyncMessage(
              "Your latest workspace was loaded from your account.",
            );
            return;
          }

          if (local) {
            await repository.setActiveWorkspace(local.id, ownerId);
            setWorkspace(null);
            setCloudSyncPaused(true);
            setCloudSyncState("local-only");
            setSyncMessage(
              "No cloud copy was found. Your workspace remains on this device until you resume cloud sync.",
            );
            return;
          }

          setWorkspace(null);
          setCloudSyncPaused(false);
          setCloudSyncState("synced");
          setSyncMessage("Cloud sync is ready. Add an account to get started.");
        } finally {
          database.close();
        }
      } catch {
        setError(
          "Your local workspace could not be opened. Your stored data was not changed.",
        );
      } finally {
        if (!background) setLoading(false);
        syncInProgress.current = false;
      }
    },
    [auth.status, ownerId],
  );

  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (!ownerId) return;

    const refreshInBackground = () => {
      if (syncStateRef.current === "conflict") return;
      void load(true);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshInBackground();
    };

    window.addEventListener("online", refreshInBackground);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const interval = window.setInterval(refreshInBackground, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("online", refreshInBackground);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [load, ownerId]);

  const save = useCallback(
    async (next: FinancialWorkspace) => {
      if (ownerId) {
        if (cloudSyncPaused) {
          setCloudSyncState("local-only");
          setSyncMessage(
            "Cloud sync is paused for this account. Resume sync before saving new financial data.",
          );
          throw new Error("Resume cloud sync before saving changes.");
        }
        const canonical = {
          ...next,
          id: (cloudWorkspaceIdRef.current ??
            next.id) as FinancialWorkspace["id"],
        };
        try {
          const version = await saveWorkspaceToCloud(
            createClient(),
            ownerId,
            canonical,
            cloudVersionRef.current,
          );
          cloudVersionRef.current = version;
          cloudWorkspaceIdRef.current = canonical.id;
          setWorkspace(canonical);
          setError(null);
          setCloudSyncPaused(false);
          setCloudConflictSnapshot(null);
          setCloudSyncState("synced");
          setSyncMessage("Saved and synced to your account.");
          return;
        } catch (cloudError) {
          const conflict =
            cloudError instanceof Error &&
            "code" in cloudError &&
            cloudError.code === "conflict";
          if (conflict) await load(true);
          setCloudSyncState(conflict ? "conflict" : "local-only");
          setSyncMessage(
            conflict
              ? "This workspace changed on another device. The latest cloud copy was loaded; review and save your change again."
              : "This change could not reach the database. Nothing was saved; reconnect and try again.",
          );
          throw cloudError;
        }
      }

      const database = await openMoni2GoDatabase();
      try {
        const repository = new WorkspaceRepository(database);
        const exists = await repository.workspaceExists(next.id);
        if (exists) await repository.saveWorkspace(next);
        else await repository.createWorkspace(next);
        await repository.setActiveWorkspace(next.id, ownerId);
        setWorkspace(next);
        setError(null);
      } finally {
        database.close();
      }
    },
    [cloudSyncPaused, ownerId],
  );

  const ensureWorkspace = useCallback(
    () => workspace ?? newWorkspace(),
    [workspace],
  );

  const deleteCloudData = useCallback(async () => {
    if (!ownerId) throw new Error("Sign in before deleting cloud data.");
    await deleteCloudWorkspaces(createClient());
    const database = await openMoni2GoDatabase();
    try {
      const repository = new WorkspaceRepository(database);
      await repository.clearCloudSyncMetaForOwner(ownerId);
      await repository.markCloudDeleted(ownerId, new Date().toISOString());
    } finally {
      database.close();
    }
    setCloudSyncPaused(true);
    setCloudSyncState("local-only");
    setSyncMessage(
      "Cloud data deleted. This device remains local-only until you resume sync.",
    );
  }, [ownerId]);

  const resumeCloudSync = useCallback(async () => {
    if (!ownerId) throw new Error("Sign in before resuming cloud sync.");
    let local: FinancialWorkspace | null;
    const database = await openMoni2GoDatabase();
    try {
      const repository = new WorkspaceRepository(database);
      local = await repository.getActiveWorkspace(ownerId);
    } finally {
      database.close();
    }

    setCloudSyncState("pending");
    let resumed: Awaited<ReturnType<typeof resumeCloudSyncForAccount>>;
    try {
      resumed = await resumeCloudSyncForAccount(createClient(), local);
      if (!resumed.enabled)
        throw new Error("Cloud sync could not be verified after resuming.");
    } catch (resumeError) {
      setCloudSyncPaused(true);
      setCloudSyncState("local-only");
      setSyncMessage(
        "Cloud sync was not resumed. Your recovery copy was not uploaded.",
      );
      throw resumeError;
    }

    const cleanupDatabase = await openMoni2GoDatabase();
    try {
      const repository = new WorkspaceRepository(cleanupDatabase);
      if (local) await repository.clearCloudSyncMeta(ownerId, local.id);
      await repository.clearCloudDeleted(ownerId);
    } finally {
      cleanupDatabase.close();
    }

    cloudVersionRef.current = resumed.version;
    cloudWorkspaceIdRef.current = local?.id ?? null;
    setWorkspace(local);
    setCloudSyncPaused(false);
    setCloudConflictSnapshot(null);
    setCloudSyncState("synced");
    setSyncMessage(
      local
        ? "Cloud sync resumed. Your workspace is saved to your account."
        : "Cloud sync resumed. Add an account to create your workspace.",
    );
  }, [ownerId]);

  const resolveCloudConflict = useCallback(
    async (choice: "local" | "cloud") => {
      if (!ownerId || !workspace || !cloudConflictSnapshot)
        throw new Error("Both workspace copies must be available first.");

      const database = await openMoni2GoDatabase();
      try {
        const repository = new WorkspaceRepository(database);
        if (choice === "cloud") {
          const selected = cloudConflictSnapshot.workspace;
          if (await repository.workspaceExists(selected.id))
            await repository.saveWorkspace(selected);
          else await repository.createWorkspace(selected);
          await repository.setActiveWorkspace(selected.id, ownerId);
          await repository.setCloudSyncMeta({
            ownerId,
            workspaceId: selected.id,
            cloudVersion: cloudConflictSnapshot.version,
            syncedWorkspaceUpdatedAt: selected.updatedAt,
          });
          setWorkspace(selected);
        } else {
          // Retain the cloud workspace ID so devices already connected to this
          // account continue following one canonical copy.
          const selected = {
            ...workspace,
            id: cloudConflictSnapshot.workspace.id,
            updatedAt: new Date().toISOString(),
          } as FinancialWorkspace;
          const version = await saveWorkspaceToCloud(
            createClient(),
            ownerId,
            selected,
            cloudConflictSnapshot.version,
          );
          if (await repository.workspaceExists(selected.id))
            await repository.saveWorkspace(selected);
          else await repository.createWorkspace(selected);
          await repository.setActiveWorkspace(selected.id, ownerId);
          await repository.setCloudSyncMeta({
            ownerId,
            workspaceId: selected.id,
            cloudVersion: version,
            syncedWorkspaceUpdatedAt: selected.updatedAt,
          });
          setWorkspace(selected);
        }
        setCloudConflictSnapshot(null);
        setCloudSyncPaused(false);
        setCloudSyncState("synced");
        setSyncMessage("Conflict resolved. This copy is now synchronized.");
      } finally {
        database.close();
      }
    },
    [cloudConflictSnapshot, ownerId, workspace],
  );

  return {
    workspace,
    loading,
    error,
    syncMessage,
    cloudSyncPaused,
    cloudSyncState,
    cloudConflict:
      workspace && cloudConflictSnapshot
        ? { local: workspace, cloud: cloudConflictSnapshot.workspace }
        : null,
    save,
    ensureWorkspace,
    reload: () => load(false),
    deleteCloudData,
    resumeCloudSync,
    resolveCloudConflict,
  };
}
