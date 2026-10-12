"use client";

import { useRef, useState } from "react";
import styles from "./LocalWorkspaceTransfer.module.css";
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
  const [messageKind, setMessageKind] = useState<"success" | "error">(
    "success",
  );
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
          setMessageKind("error");
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
        setMessageKind("success");
        setMessage(
          "Backup downloaded. Keep the file private until you import it.",
        );
      } finally {
        database.close();
      }
    } catch {
      setMessageKind("error");
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
      setMessageKind("success");
      setMessage("Backup imported. Open Home or Accounts to view your data.");
    } catch {
      setMessageKind("error");
      setMessage(
        "The backup could not be imported. It may be invalid or already exist on this address.",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      setPending(false);
    }
  }

  return (
    <div className={styles.transfer}>
      <p className={styles.intro}>
        Moving from the old address? Transfer the workspace in two quick steps.
      </p>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            1
          </span>
          <div className={styles.stepContent}>
            <strong>Download from the old site</strong>
            <span>Save a copy of the workspace currently in this browser.</span>
            <button
              className={["button", "button-secondary", styles.action]
                .filter(Boolean)
                .join(" ")}
              type="button"
              disabled={pending}
              onClick={() => void downloadBackup()}
            >
              {pending ? "Please wait…" : "Download backup"}
            </button>
          </div>
        </li>
        <li className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            2
          </span>
          <div className={styles.stepContent}>
            <strong>Import on the new site</strong>
            <span>Select that same backup file to restore your workspace.</span>
            <button
              className={["button", "button-primary", styles.action]
                .filter(Boolean)
                .join(" ")}
              type="button"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? "Please wait…" : "Choose backup file"}
            </button>
            <input
              ref={inputRef}
              hidden
              type="file"
              accept="application/json,.json"
              aria-label="Choose local backup file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importBackup(file);
              }}
            />
          </div>
        </li>
      </ol>
      <p className={styles.privacyNote}>
        <span aria-hidden="true">●</span> The file contains financial data and
        is not encrypted. Keep it private.
      </p>
      {message && (
        <div
          className={[
            styles.status,
            messageKind === "error" ? styles.error : styles.success,
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
        >
          <span aria-hidden="true">{messageKind === "error" ? "!" : "✓"}</span>
          <p>{message}</p>
        </div>
      )}
    </div>
  );
}
