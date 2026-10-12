"use client";

import { useRef, useState } from "react";
import { useAuthUser } from "../../lib/supabase/use-auth-user";
import {
  exportWorkspace,
  importWorkspace,
  openMoni2GoDatabase,
  WorkspaceRepository,
} from "../../v2/storage";

export function LocalWorkspaceTransfer() {
  const auth = useAuthUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ownerId = auth.status === "signed-in" ? auth.user.id : undefined;

  async function downloadBackup() {
    setPending(true);
    setMessage(null);
    try {
      const database = await openMoni2GoDatabase();
      try {
        const repository = new WorkspaceRepository(database);
        const workspace =
          (await repository.getActiveWorkspace(ownerId)) ??
          (await repository.getActiveWorkspace());
        if (!workspace) {
          setMessage("No local workspace was found on this address.");
          return;
        }
        const serialized = await exportWorkspace(workspace, {
          exportedAt: new Date().toISOString(),
          applicationVersion: "0.1.0",
        });
        const url = URL.createObjectURL(
          new Blob([serialized], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `moni2go-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setMessage("Backup downloaded. Keep this financial file private.");
      } finally {
        database.close();
      }
    } catch {
      setMessage("The local backup could not be created.");
    } finally {
      setPending(false);
    }
  }

  async function importBackup(file: File) {
    setPending(true);
    setMessage(null);
    try {
      const serialized = await file.text();
      const database = await openMoni2GoDatabase();
      try {
        const repository = new WorkspaceRepository(database);
        const workspace = await importWorkspace(repository, serialized);
        await repository.setActiveWorkspace(workspace.id, ownerId);
      } finally {
        database.close();
      }
      setMessage("Backup imported. Open Home or Accounts to view your data.");
    } catch {
      setMessage(
        "The backup could not be imported. It may be invalid or already exist on this address.",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      setPending(false);
    }
  }

  return (
    <div className="cloud-controls">
      <p>
        Download from the old address, then import the same file on the new
        address. The file contains your financial information and is not
        encrypted.
      </p>
      <div className="cloud-actions">
        <button
          className="button button-primary"
          disabled={pending}
          onClick={() => void downloadBackup()}
        >
          Download local backup
        </button>
        <button
          className="button button-secondary"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          Import local backup
        </button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="Choose local backup file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
          }}
        />
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
