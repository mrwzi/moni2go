"use client";

import { useState } from "react";
import { formatCad } from "../../domain/money";
import type { AssetAccount } from "../../v2/domain/accounts";

export const BALANCE_UPDATE_REASONS = [
  { value: "set", label: "Set current balance" },
  { value: "deposit", label: "Deposit or contribution" },
  { value: "interest-dividend", label: "Interest or dividend" },
  { value: "gain", label: "Investment or crypto gain" },
  { value: "loss", label: "Investment or crypto loss" },
  { value: "fee-withdrawal", label: "Fee or withdrawal" },
] as const;

export type BalanceUpdateReason =
  (typeof BALANCE_UPDATE_REASONS)[number]["value"];

export type BalanceUpdateInput = Readonly<{
  accountId: string;
  reason: BalanceUpdateReason;
  amount: string;
}>;

export function AccountBalanceDialog({
  account,
  onClose,
  onSave,
}: Readonly<{
  account: AssetAccount;
  onClose: () => void;
  onSave: (input: BalanceUpdateInput) => Promise<string | null>;
}>) {
  const [reason, setReason] = useState<BalanceUpdateReason>("set");
  const [amount, setAmount] = useState(
    (account.currentValueCents / 100).toFixed(2),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="balance-update-heading"
      >
        <header>
          <div>
            <p className="eyebrow">{account.name}</p>
            <h2 id="balance-update-heading">Update balance</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <form
          className="account-form wizard-step"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            void onSave({ accountId: account.id, reason, amount }).then(
              (message) => {
                setPending(false);
                setError(message);
              },
            );
          }}
        >
          <p className="balance-current-value">
            Current balance{" "}
            <strong>{formatCad(account.currentValueCents)}</strong>
          </p>
          <label>
            What changed?
            <select
              value={reason}
              onChange={(event) => {
                const nextReason = event.target.value as BalanceUpdateReason;
                setReason(nextReason);
                setAmount(
                  nextReason === "set"
                    ? (account.currentValueCents / 100).toFixed(2)
                    : "",
                );
                setError(null);
              }}
            >
              {BALANCE_UPDATE_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {reason === "set" ? "New current balance" : "Amount"}
            <span className="money-input">
              <span>$</span>
              <input
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError(null);
                }}
                inputMode="decimal"
                placeholder="0.00"
                autoFocus
              />
            </span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="cash-place-note">
            Use Set current balance if several updates were missed. This only
            updates moni2go; it does not move money at your provider.
          </p>
          <button
            className="button button-primary"
            type="submit"
            disabled={pending}
            aria-busy={pending}
          >
            {pending && <span className="button-spinner" aria-hidden="true" />}
            <span>{pending ? "Updating…" : "Update balance"}</span>
          </button>
        </form>
      </section>
    </div>
  );
}
