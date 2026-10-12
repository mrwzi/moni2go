"use client";

import { useState } from "react";
import { formatCad } from "../../domain/money";
import type { AssetAccount, LiabilityAccount } from "../../v2/domain/accounts";
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
  debtAccountId?: string;
}>;

const TRANSACTION_TYPE_OPTIONS = [
  { value: "purchase", label: "Bought or paid for something" },
  { value: "refund", label: "Got money back (refund)" },
  { value: "transfer", label: "Moved money between my accounts" },
  { value: "credit-card-payment", label: "Paid a credit card or loan" },
  {
    value: "savings-contribution",
    label: "Added to savings or investments",
  },
] as const satisfies readonly {
  value: ExpenseTransactionType;
  label: string;
}[];

const TRANSACTION_TYPE_HELP: Readonly<Record<ExpenseTransactionType, string>> =
  {
    purchase:
      "Counts as spending. A bank or debit purchase lowers its balance; a credit-card purchase increases the amount owed.",
    refund:
      "Money returned to you. It adds back to a bank account or reduces the amount owed on a credit card.",
    transfer:
      "Moves money between your own accounts. It is not counted as spending.",
    "credit-card-payment":
      "Pays down the selected card or loan from a bank account. It is not counted as another purchase.",
    "savings-contribution":
      "Tracks money moved toward savings or investing, separately from everyday spending.",
  };

const SUBMIT_LABELS: Readonly<Record<ExpenseTransactionType, string>> = {
  purchase: "Save purchase",
  refund: "Save refund",
  transfer: "Save transfer",
  "credit-card-payment": "Save payment",
  "savings-contribution": "Save contribution",
};

export function QuickActivityDialog({
  kind,
  accounts,
  liabilityAccounts,
  onClose,
  onSave,
}: Readonly<{
  kind: QuickActivityKind;
  accounts: readonly AssetAccount[];
  liabilityAccounts: readonly LiabilityAccount[];
  onClose: () => void;
  onSave: (input: QuickActivityInput) => Promise<string | null>;
}>) {
  const [accountId, setAccountId] = useState(
    accounts.find((account) => account.spendability === "spendable")?.id ??
      accounts[0]?.id ??
      (kind === "spending"
        ? liabilityAccounts.find(
            (account) =>
              account.status === "active" &&
              (account.type === "credit-card" ||
                account.type === "line-of-credit"),
          )?.id
        : undefined) ??
      "",
  );
  const [amount, setAmount] = useState("");
  const [incomeLabel, setIncomeLabel] = useState<IncomeLabel>("Paycheque");
  const [spendingCategory, setSpendingCategory] =
    useState<BudgetCategoryKey>("groceries");
  const [transactionType, setTransactionType] =
    useState<ExpenseTransactionType>("purchase");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [debtAccountId, setDebtAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const activeDebtAccounts = liabilityAccounts.filter(
    (account) => account.status === "active" && account.currentBalanceCents > 0,
  );
  const creditAccounts = liabilityAccounts.filter(
    (account) =>
      account.status === "active" &&
      (account.type === "credit-card" || account.type === "line-of-credit"),
  );
  const allowCreditSource =
    kind === "spending" &&
    (transactionType === "purchase" || transactionType === "refund");

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
              ...(debtAccountId ? { debtAccountId } : {}),
            }).then(setError);
          }}
        >
          <label>
            {kind === "income"
              ? "Add money to"
              : transactionType === "credit-card-payment"
                ? "Pay from"
                : transactionType === "transfer"
                  ? "Move money from"
                  : transactionType === "savings-contribution"
                    ? "Money comes from"
                    : "Account or card"}
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
              {allowCreditSource &&
                creditAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · owed{" "}
                    {formatCad(account.currentBalanceCents)}
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
                What happened?
                <select
                  value={transactionType}
                  onChange={(event) => {
                    setTransactionType(
                      event.target.value as ExpenseTransactionType,
                    );
                    setAccountId(
                      accounts.find(
                        (account) => account.spendability === "spendable",
                      )?.id ??
                        accounts[0]?.id ??
                        (event.target.value === "purchase" ||
                        event.target.value === "refund"
                          ? creditAccounts[0]?.id
                          : undefined) ??
                        "",
                    );
                    setDebtAccountId("");
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
              <p className="cash-place-note activity-explanation">
                {TRANSACTION_TYPE_HELP[transactionType]}
              </p>
              {(transactionType === "purchase" ||
                transactionType === "refund") && (
                <label>
                  {transactionType === "refund"
                    ? "What was refunded?"
                    : "What was it for?"}
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
                <>
                  <label>
                    Credit card or debt paid
                    <select
                      value={debtAccountId}
                      onChange={(event) => {
                        setDebtAccountId(event.target.value);
                      }}
                    >
                      <option value="">Choose debt account</option>
                      {activeDebtAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} · owed{" "}
                          {formatCad(account.currentBalanceCents)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
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
            This updates the manual balance in moni2go. It does not move money
            at your bank.
          </p>
          <button className="button button-primary" type="submit">
            {kind === "income" ? "Add money" : SUBMIT_LABELS[transactionType]}
          </button>
        </form>
      </section>
    </div>
  );
}
