"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../../lib/supabase/client";
import {
  deleteCloudWorkspaces,
  loadNewestCloudWorkspace,
  saveWorkspaceToCloud,
} from "../../cloud/workspace-cloud";
import { openMoni2GoDatabase, WorkspaceRepository } from "../../v2/storage";

export function CloudWorkspaceControls() {
  const [user, setUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        setUser(data.user);
      });
  }, []);

  if (!user)
    return (
      <p className="settings-note">
        Sign in to save or restore your private workspace across devices.
      </p>
    );

  async function upload() {
    if (!user) return;
    setPending(true);
    setMessage(null);
    try {
      const database = await openMoni2GoDatabase();
      try {
        const workspace = await new WorkspaceRepository(
          database,
        ).getActiveWorkspace();
        if (!workspace) {
          setMessage("Add an account before saving a cloud workspace.");
          return;
        }
        await saveWorkspaceToCloud(createClient(), user.id, workspace);
        setMessage("This device's workspace is saved to your account.");
      } finally {
        database.close();
      }
    } catch {
      setMessage("Cloud save failed. Your local information was not changed.");
    } finally {
      setPending(false);
    }
  }

  async function restore() {
    setPending(true);
    setMessage(null);
    try {
      const workspace = await loadNewestCloudWorkspace(createClient());
      if (!workspace) {
        setMessage("No cloud workspace was found for this account.");
        return;
      }
      const database = await openMoni2GoDatabase();
      try {
        const repository = new WorkspaceRepository(database);
        if (await repository.workspaceExists(workspace.id))
          await repository.saveWorkspace(workspace);
        else await repository.createWorkspace(workspace);
        await repository.setActiveWorkspace(workspace.id, user?.id);
      } finally {
        database.close();
      }
      setMessage("Cloud workspace restored. Reload Home to view it.");
    } catch {
      setMessage(
        "Cloud restore failed. Your local information was not changed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function removeCloudCopy() {
    if (
      !user ||
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
    } catch {
      setMessage("Cloud deletion failed. No local information was changed.");
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
      <div className="cloud-actions">
        <button
          className="button button-primary"
          disabled={pending}
          onClick={() => void upload()}
        >
          Save backup
        </button>
        <button
          className="button button-secondary"
          disabled={pending}
          onClick={() => void restore()}
        >
          Restore backup
        </button>
        <button
          className="button button-danger"
          disabled={pending}
          onClick={() => {
            void removeCloudCopy();
          }}
        >
          Delete backup
        </button>
      </div>
      <small>
        Cloud transfer happens only when you choose one of these actions.
      </small>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
