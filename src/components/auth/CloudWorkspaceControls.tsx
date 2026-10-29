"use client";

import { useState } from "react";
import { useAuthUser } from "../../lib/supabase/use-auth-user";
import { useFinancialWorkspace } from "../../v2/react/useFinancialWorkspace";
import { exportWorkspace } from "../../v2/storage/export-import";
import type { FinancialWorkspace } from "../../v2/domain/workspace";

async function downloadRecoveryBackup(
  workspace: FinancialWorkspace,
  label: "device" | "cloud",
): Promise<void> {
  const serialized = await exportWorkspace(workspace, {
    exportedAt: new Date().toISOString(),
    applicationVersion: "0.1.0",
  });
  const url = URL.createObjectURL(
    new Blob([serialized], { type: "application/json" }),
  );
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `moni2go-${label}-recovery-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CloudWorkspaceControls() {
  const auth = useAuthUser();
  const {
    loading,
    error,
    syncMessage,
    cloudSyncPaused,
    cloudSyncState,
    cloudConflict,
    reload,
    deleteCloudData,
    resumeCloudSync,
    resolveCloudConflict,
  } = useFinancialWorkspace();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (auth.status !== "signed-in")
    return (
      <p className="settings-note">
        Sign in to synchronize your private workspace across devices.
      </p>
    );

  const user = auth.user;

  async function removeCloudCopy() {
    if (
      !window.confirm(
        "Delete every cloud workspace for this account? Local data on this device will remain.",
      )
    )
      return;
    setPending(true);
    setMessage(null);
    try {
      await deleteCloudData();
      setMessage(
        "Cloud financial workspaces deleted. Local data remains on this device and will not be uploaded again unless you resume sync.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Cloud deletion failed. No local information was changed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function resumeCloudCopy() {
    setPending(true);
    setMessage(null);
    try {
      await resumeCloudSync();
      setMessage("Cloud sync resumed.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Cloud sync could not be resumed. Local data was not changed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function recoverConflict(choice: "local" | "cloud") {
    if (!cloudConflict) return;
    const replaced = choice === "local" ? "cloud" : "device";
    const replacedCopy =
      choice === "local" ? cloudConflict.cloud : cloudConflict.local;
    const selected = choice === "local" ? "this device" : "the cloud copy";
    if (
      !window.confirm(
        `Use ${selected}? The other copy will download as a private recovery backup first.`,
      )
    )
      return;
    setPending(true);
    setMessage(null);
    try {
      await downloadRecoveryBackup(replacedCopy, replaced);
      await resolveCloudConflict(choice);
      setMessage(
        `Conflict resolved using ${selected}. The replaced copy was downloaded as a backup.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nothing was replaced. Both copies are still available.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="cloud-controls">
      <p className="cloud-account">
        <span>Signed in</span>
        <strong>{user.email}</strong>
      </p>
      <p className="cloud-sync-status" role="status">
        <strong>
          {loading || cloudSyncState === "pending"
            ? "Checking sync…"
            : cloudSyncState === "conflict"
              ? "Sync needs attention"
              : cloudSyncPaused
                ? "Saved on this device only"
                : "Automatic sync is on"}
        </strong>
        <span>
          {error ??
            message ??
            syncMessage ??
            "Changes are saved to this account automatically."}
        </span>
      </p>
      <div className="cloud-actions">
        {cloudSyncState === "conflict" || cloudSyncState === "local-only" ? (
          <button
            className="button button-secondary"
            disabled={pending || loading}
            onClick={() => void reload()}
          >
            Retry sync
          </button>
        ) : null}
        {cloudSyncPaused ? (
          <button
            className="button button-primary"
            disabled={pending || loading}
            onClick={() => void resumeCloudCopy()}
          >
            Resume cloud sync
          </button>
        ) : (
          <button
            className="button button-danger"
            disabled={pending}
            onClick={() => {
              void removeCloudCopy();
            }}
          >
            Delete cloud data
          </button>
        )}
      </div>
      {cloudSyncState === "conflict" && cloudConflict ? (
        <div className="cloud-conflict-actions">
          <p>
            This device and the cloud contain different activity. Choose the
            correct copy. The other copy downloads first as a private backup.
          </p>
          <div className="cloud-actions">
            <button
              className="button button-secondary"
              disabled={pending}
              onClick={() => void recoverConflict("local")}
            >
              Use this device
            </button>
            <button
              className="button button-secondary"
              disabled={pending}
              onClick={() => void recoverConflict("cloud")}
            >
              Use cloud copy
            </button>
          </div>
          <small>
            Backups contain unencrypted financial information. Keep them
            private.
          </small>
        </div>
      ) : null}
      <small>
        Changes sync after every save, when you return online, when you reopen
        the app, and periodically while it is open.
      </small>
    </div>
  );
}
