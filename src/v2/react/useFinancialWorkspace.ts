"use client";

import { useCallback, useEffect, useState } from "react";
import { parseCalendarDate } from "../domain/calendar";
import type { FinancialWorkspace } from "../domain/workspace";
import { openMoni2GoDatabase, WorkspaceRepository } from "../storage";
import { useAuthUser } from "../../lib/supabase/use-auth-user";
import { createClient } from "../../lib/supabase/client";
import {
  loadNewestCloudWorkspace,
  saveWorkspaceToCloud,
} from "../../cloud/workspace-cloud";

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

  const load = useCallback(async () => {
    if (auth.status === "loading" || auth.status === "signed-out") {
      setWorkspace(null);
      setLoading(auth.status === "loading");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const database = await openMoni2GoDatabase();
      try {
        const repository = new WorkspaceRepository(database);
        let local = await repository.getActiveWorkspace(ownerId);
        if (!local && ownerId) local = await repository.getActiveWorkspace();

        if (!ownerId) {
          setWorkspace(local);
          return;
        }

        const client = createClient();
        let cloud: FinancialWorkspace | null;
        try {
          cloud = await loadNewestCloudWorkspace(client);
        } catch {
          setWorkspace(local);
          setSyncMessage(
            "Your local workspace is available. Cloud sync will retry automatically.",
          );
          return;
        }
        if (!local && cloud) {
          if (await repository.workspaceExists(cloud.id))
            await repository.saveWorkspace(cloud);
          else await repository.createWorkspace(cloud);
          await repository.setActiveWorkspace(cloud.id, ownerId);
          setWorkspace(cloud);
          setSyncMessage("Your latest workspace was loaded from your account.");
          return;
        }

        if (local && !cloud) {
          await repository.setActiveWorkspace(local.id, ownerId);
          await saveWorkspaceToCloud(client, ownerId, local);
          setWorkspace(local);
          setSyncMessage("Your workspace is synced to your account.");
          return;
        }

        if (local && cloud) {
          if (Date.parse(cloud.updatedAt) > Date.parse(local.updatedAt)) {
            if (await repository.workspaceExists(cloud.id))
              await repository.saveWorkspace(cloud);
            else await repository.createWorkspace(cloud);
            await repository.setActiveWorkspace(cloud.id, ownerId);
            setWorkspace(cloud);
            setSyncMessage(
              "Your latest workspace was loaded from your account.",
            );
          } else {
            await repository.setActiveWorkspace(local.id, ownerId);
            if (
              local.id !== cloud.id ||
              Date.parse(local.updatedAt) > Date.parse(cloud.updatedAt)
            )
              await saveWorkspaceToCloud(client, ownerId, local);
            setWorkspace(local);
            setSyncMessage("Your workspace is synced to your account.");
          }
          return;
        }

        setWorkspace(null);
      } finally {
        database.close();
      }
    } catch {
      setError(
        "Your local workspace could not be opened. Your stored data was not changed.",
      );
    } finally {
      setLoading(false);
    }
  }, [auth.status, ownerId]);

  useEffect(() => void load(), [load]);

  const save = useCallback(
    async (next: FinancialWorkspace) => {
      const database = await openMoni2GoDatabase();
      try {
        const repository = new WorkspaceRepository(database);
        const exists = await repository.workspaceExists(next.id);
        if (exists) await repository.saveWorkspace(next);
        else await repository.createWorkspace(next);
        await repository.setActiveWorkspace(next.id, ownerId);
        setWorkspace(next);
        setError(null);
        if (ownerId) {
          try {
            await saveWorkspaceToCloud(createClient(), ownerId, next);
            setSyncMessage("Saved and synced to your account.");
          } catch {
            setSyncMessage(
              "Saved on this device. Cloud sync will retry automatically.",
            );
          }
        }
      } finally {
        database.close();
      }
    },
    [ownerId],
  );

  const ensureWorkspace = useCallback(
    () => workspace ?? newWorkspace(),
    [workspace],
  );

  return {
    workspace,
    loading,
    error,
    syncMessage,
    save,
    ensureWorkspace,
    reload: load,
  };
}
