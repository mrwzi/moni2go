"use client";

import { useState } from "react";
import { formatCad } from "../../domain/money";
import type { AssetAccount } from "../../v2/domain/accounts";
import type { ExpenseTransactionType } from "../../v2/domain/expenses";
import {
  BUDGET_CATEGORIES,
  type BudgetCategoryKey,
} from "../../v2/domain/budget-categories";
import {
  INCOME_LABELS,
  SPENDING_CATEGORIES,
  type IncomeLabel,
} from "./account-options";

export type QuickActivityKind = "income" | "spending";
export type QuickActivityInput = Readonly<{
  kind: QuickActivityKind;
  accountId: string;
  amount: string;
  incomeLabel: IncomeLabel;
  spendingCategory: BudgetCategoryKey;
  transactionType: ExpenseTransactionType;
  destinationAccountId?: string;
}>;

const TRANSACTION_TYPE_OPTIONS = [
  { value: "purchase", label: "Purchase or bill" },
  { value: "refund", label: "Refund" },
  { value: "transfer", label: "Transfer between my accounts" },
  { value: "credit-card-payment", label: "Credit-card payment" },
  {
    value: "savings-contribution",
    label: "Savings or investment contribution",
  },
] as const satisfies readonly {
  value: ExpenseTransactionType;
  label: string;
}[];

export function QuickActivityDialog({
  kind,
  accounts,
  onClose,
  onSave,
}: Readonly<{
  kind: QuickActivityKind;
  accounts: readonly AssetAccount[];
  onClose: () => void;
  onSave: (input: QuickActivityInput) => Promise<string | null>;
}>) {
  const [accountId, setAccountId] = useState(
    accounts.find((account) => account.spendability === "spendable")?.id ??
      accounts[0]?.id ??
      "",
  );
  const [amount, setAmount] = useState("");
  const [incomeLabel, setIncomeLabel] = useState<IncomeLabel>("Paycheque");
  const [spendingCategory, setSpendingCategory] =
    useState<BudgetCategoryKey>("groceries");
  const [transactionType, setTransactionType] =
    useState<ExpenseTransactionType>("purchase");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="account-dialog quick-activity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-activity-heading"
      >
        <header>
          <div>
            <p className="eyebrow">Quick update</p>
            <h2 id="quick-activity-heading">
              {kind === "income" ? "Add money" : "Record spending"}
            </h2>
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
            void onSave({
              kind,
              accountId,
              amount,
              incomeLabel,
              spendingCategory,
              transactionType,
              ...(destinationAccountId ? { destinationAccountId } : {}),
            }).then(setError);
          }}
        >
          <label>
            Account
            <select
              value={accountId}
              onChange={(event) => {
                setAccountId(event.target.value);
              }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {formatCad(account.currentValueCents)}
                </option>
              ))}
            </select>
          </label>
          {kind === "income" ? (
            <label>
              Where did it come from?
              <select
                value={incomeLabel}
                onChange={(event) => {
                  setIncomeLabel(event.target.value as IncomeLabel);
                }}
              >
                {INCOME_LABELS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                Transaction type
                <select
                  value={transactionType}
                  onChange={(event) => {
                    setTransactionType(
                      event.target.value as ExpenseTransactionType,
                    );
                    setError(null);
                  }}
                >
                  {TRANSACTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {(transactionType === "purchase" ||
                transactionType === "refund") && (
                <label>
                  What was it for?
                  <select
                    value={spendingCategory}
                    onChange={(event) => {
                      setSpendingCategory(
                        event.target.value as BudgetCategoryKey,
                      );
                    }}
                  >
                    {SPENDING_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {BUDGET_CATEGORIES[category]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {transactionType === "transfer" && (
                <label>
                  Move it to
                  <select
                    value={destinationAccountId}
                    onChange={(event) => {
                      setDestinationAccountId(event.target.value);
                    }}
                  >
                    <option value="">Choose destination account</option>
                    {accounts
                      .filter((account) => account.id !== accountId)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ·{" "}
                          {formatCad(account.currentValueCents)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {transactionType === "credit-card-payment" && (
                <p className="cash-place-note">
                  Recorded as a debt payment, not a second purchase.
                </p>
              )}
              {transactionType === "savings-contribution" && (
                <p className="cash-place-note">
                  Tracked separately from everyday consumption spending.
                </p>
              )}
            </>
          )}
          <label>
            Amount
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
            This updates the manual balance in NorthCents. It does not move
            money at your bank.
          </p>
          <button className="button button-primary" type="submit">
            {kind === "income" ? "Add money" : "Save spending"}
          </button>
        </form>
      </section>
    </div>
  );
}
