"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function MoreActionsIcon() {
  return (
    <svg
      className="action-menu-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

export function ActionMenu({
  label,
  title,
  actionLabel,
  onAction,
  primaryActionLabel,
  onPrimaryAction,
  provider = false,
}: Readonly<{
  label: string;
  title: string;
  actionLabel: string;
  onAction: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  provider?: boolean;
}>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  return (
    <div className={`action-menu${provider ? " provider-action-menu" : ""}`}>
      <button
        className="action-menu-trigger"
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
      >
        <MoreActionsIcon />
      </button>
      {open &&
        createPortal(
          <div
            className="action-sheet-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <section
              className="action-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="action-sheet-title"
            >
              <div className="action-sheet-heading">
                <span className="action-sheet-icon" aria-hidden="true">
                  <MoreActionsIcon />
                </span>
                <div>
                  <p>Options</p>
                  <h2 id="action-sheet-title">{title}</h2>
                </div>
              </div>
              <p className="action-sheet-copy">
                {onPrimaryAction
                  ? "Update this account or remove it from moni2go."
                  : "Removing this does not contact your bank or provider."}
              </p>
              <div className="action-sheet-actions">
                {onPrimaryAction && primaryActionLabel && (
                  <button
                    className="button button-primary action-sheet-primary"
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onPrimaryAction();
                    }}
                  >
                    {primaryActionLabel}
                  </button>
                )}
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="button action-sheet-danger"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAction();
                  }}
                >
                  {actionLabel}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}
