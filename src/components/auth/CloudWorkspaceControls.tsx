"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";
import {
  CloudWorkspaceError,
  deleteCloudWorkspaces,
} from "../../cloud/workspace-cloud";
import { useAuthUser } from "../../lib/supabase/use-auth-user";
import { useFinancialWorkspace } from "../../v2/react/useFinancialWorkspace";

export function CloudWorkspaceControls() {
  const auth = useAuthUser();
  const { loading, error, syncMessage, reload } = useFinancialWorkspace();
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
      await deleteCloudWorkspaces(createClient(), user.id);
      setMessage(
        "Cloud financial workspaces deleted. Local data remains on this device.",
      );
    } catch (error) {
      setMessage(
        error instanceof CloudWorkspaceError
          ? error.message
          : "Cloud deletion failed. No local information was changed.",
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
        <strong>{loading ? "Synchronizing…" : "Automatic sync is on"}</strong>
        <span>
          {error ??
            message ??
            syncMessage ??
            "Changes are saved to this account automatically."}
        </span>
      </p>
      <div className="cloud-actions">
        <button
          className="button button-secondary"
          disabled={pending || loading}
          onClick={() => void reload()}
        >
          Check sync now
        </button>
        <button
          className="button button-danger"
          disabled={pending}
          onClick={() => {
            void removeCloudCopy();
          }}
        >
          Delete cloud data
        </button>
      </div>
      <small>
        Open moni2go on another device and sign in—the latest workspace loads
        automatically.
      </small>
    </div>
  );
}
