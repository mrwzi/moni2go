"use client";

import { useState } from "react";
import { formatCad } from "../../domain/money";
import type { AccountGroup } from "../../v2/domain/account-groups";
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
import { MoneySelect } from "./MoneySelect";

export type QuickActivityKind = "income" | "spending";
export type QuickActivityInput = Readonly<{
  kind: QuickActivityKind;
  accountId: string;
  amount: string;
  incomeLabel: IncomeLabel;
  spendingCategory: BudgetCategoryKey;
  transactionType: ExpenseTransactionType;
  note?: string;
  destinationAccountId?: string;
  transferToUntrackedAccount?: boolean;
  debtAccountId?: string;
}>;

const UNTRACKED_ACCOUNT_VALUE = "untracked-owned-account";

const TRANSACTION_TYPE_OPTIONS = [
  { value: "purchase", label: "Bought, paid, or sent money" },
  { value: "refund", label: "Got money back (refund)" },
  { value: "transfer", label: "Transferred between accounts I own" },
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
      "Use for purchases, bills, gifts, or money sent to someone. Counts as spending.",
    refund: "Adds money back or reduces the amount owed on a credit card.",
    transfer:
      "For accounts you own. Moves the balance without counting it as spending.",
    "credit-card-payment":
      "Pays down a card or loan. It is not counted as another purchase.",
    "savings-contribution":
      "Tracks savings or investing separately from everyday spending.",
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
  accountGroups,
  onClose,
  onSave,
}: Readonly<{
  kind: QuickActivityKind;
  accounts: readonly AssetAccount[];
  liabilityAccounts: readonly LiabilityAccount[];
  accountGroups: readonly AccountGroup[];
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
  const [transferToUntrackedAccount, setTransferToUntrackedAccount] =
    useState(false);
  const [debtAccountId, setDebtAccountId] = useState("");
  const [note, setNote] = useState("");
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
  const availableDestinations = accounts.filter(
    (account) => account.id !== accountId,
  );
  const duplicateNames = new Set(
    [...accounts, ...liabilityAccounts]
      .map((account) => account.name.trim().toLocaleLowerCase())
      .filter(
        (name, index, names) =>
          names.indexOf(name) !== index || names.lastIndexOf(name) !== index,
      ),
  );
  const accountLabel = (account: AssetAccount | LiabilityAccount) => {
    const repeated = duplicateNames.has(
      account.name.trim().toLocaleLowerCase(),
    );
    const provider = account.groupId
      ? accountGroups.find((group) => group.id === account.groupId)?.name
      : undefined;
    return repeated && provider
      ? `${provider} · ${account.name}`
      : account.name;
  };

  return (
    <div
      className="modal-backdrop money-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="account-dialog money-dialog quick-activity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-activity-heading"
      >
        <header>
          <div>
            <p className="eyebrow">Quick update</p>
            <h2 id="quick-activity-heading">
              {kind === "income" ? "Add money" : "Record activity"}
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
              ...(note.trim() ? { note: note.trim() } : {}),
              ...(destinationAccountId ? { destinationAccountId } : {}),
              ...(transferToUntrackedAccount
                ? { transferToUntrackedAccount: true }
                : {}),
              ...(debtAccountId ? { debtAccountId } : {}),
            }).then(setError);
          }}
        >
          <MoneySelect
            label={
              kind === "income"
                ? "Add money to"
                : transactionType === "credit-card-payment"
                  ? "Pay from"
                  : transactionType === "transfer"
                    ? "Move money from"
                    : transactionType === "savings-contribution"
                      ? "Money comes from"
                      : "Account or card"
            }
            value={accountId}
            options={[
              ...accounts.map((account) => ({
                value: account.id,
                label: `${accountLabel(account)} · ${formatCad(account.currentValueCents)}`,
              })),
              ...(allowCreditSource
                ? creditAccounts.map((account) => ({
                    value: account.id,
                    label: `${accountLabel(account)} · owed ${formatCad(account.currentBalanceCents)}`,
                  }))
                : []),
            ]}
            onChange={setAccountId}
          />
          {kind === "income" ? (
            <MoneySelect
              label="Where did it come from?"
              value={incomeLabel}
              options={INCOME_LABELS.map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={setIncomeLabel}
            />
          ) : (
            <>
              <MoneySelect
                label="What happened?"
                value={transactionType}
                options={TRANSACTION_TYPE_OPTIONS}
                onChange={(nextType) => {
                  setTransactionType(nextType);
                  setAccountId(
                    accounts.find(
                      (account) => account.spendability === "spendable",
                    )?.id ??
                      accounts[0]?.id ??
                      (nextType === "purchase" || nextType === "refund"
                        ? creditAccounts[0]?.id
                        : undefined) ??
                      "",
                  );
                  setDebtAccountId(
                    nextType === "credit-card-payment"
                      ? (activeDebtAccounts[0]?.id ?? "")
                      : "",
                  );
                  setDestinationAccountId("");
                  setTransferToUntrackedAccount(false);
                  setError(null);
                }}
              />
              <p className="activity-explanation">
                {TRANSACTION_TYPE_HELP[transactionType]}
              </p>
              {(transactionType === "purchase" ||
                transactionType === "refund") && (
                <MoneySelect
                  label={
                    transactionType === "refund"
                      ? "What was refunded?"
                      : "What was it for?"
                  }
                  value={spendingCategory}
                  options={SPENDING_CATEGORIES.map((category) => ({
                    value: category,
                    label: BUDGET_CATEGORIES[category],
                  }))}
                  onChange={setSpendingCategory}
                />
              )}
              {transactionType === "transfer" && (
                <MoneySelect
                  label="Where did it go?"
                  value={
                    transferToUntrackedAccount
                      ? UNTRACKED_ACCOUNT_VALUE
                      : destinationAccountId
                  }
                  options={[
                    { value: "", label: "Choose where the money went" },
                    ...availableDestinations.map((account) => ({
                      value: account.id,
                      label: `${accountLabel(account)} · ${formatCad(account.currentValueCents)}`,
                    })),
                    {
                      value: UNTRACKED_ACCOUNT_VALUE,
                      label: "Another account I own (not listed)",
                    },
                  ]}
                  onChange={(nextDestination) => {
                    const isUntracked =
                      nextDestination === UNTRACKED_ACCOUNT_VALUE;
                    setTransferToUntrackedAccount(isUntracked);
                    setDestinationAccountId(isUntracked ? "" : nextDestination);
                    setError(null);
                  }}
                  hint="Sent it to someone else? Use “Bought, paid, or sent money.”"
                />
              )}
              {transactionType === "credit-card-payment" && (
                <MoneySelect
                  label="Pay this account"
                  value={debtAccountId}
                  options={
                    activeDebtAccounts.length === 0
                      ? [
                          {
                            value: "",
                            label: "No debt with a balance",
                            disabled: true,
                          },
                        ]
                      : activeDebtAccounts.map((account) => ({
                          value: account.id,
                          label: `${accountLabel(account)} · owed ${formatCad(account.currentBalanceCents)}`,
                        }))
                  }
                  onChange={(nextDebtId) => {
                    setDebtAccountId(nextDebtId);
                    setError(null);
                  }}
                />
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
          {kind === "spending" && (
            <details className="optional-note">
              <summary>
                Add a note <span>(optional)</span>
              </summary>
              <label>
                Note
                <input
                  aria-label="Note (optional)"
                  value={note}
                  maxLength={160}
                  onChange={(event) => {
                    setNote(event.target.value);
                  }}
                  placeholder={
                    transactionType === "credit-card-payment"
                      ? "For example, October card payment"
                      : transactionType === "transfer"
                        ? "For example, business bank"
                        : "For example, Netflix or lunch"
                  }
                />
              </label>
            </details>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="cash-place-note activity-save-note">
            Updates moni2go only—not your bank.
          </p>
          <button className="button button-primary" type="submit">
            {kind === "income" ? "Add money" : SUBMIT_LABELS[transactionType]}
          </button>
        </form>
      </section>
    </div>
  );
}
