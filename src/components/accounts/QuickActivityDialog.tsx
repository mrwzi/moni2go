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

export type QuickActivityKind = "income" | "expense" | "move";
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
  principalAmount?: string;
}>;

const UNTRACKED_ACCOUNT_VALUE = "untracked-owned-account";
const EXPENSE_OPTIONS = [
  { value: "purchase", label: "Purchase or bill" },
  { value: "refund", label: "Refund" },
] as const;
const INVESTMENT_TYPES = new Set<AssetAccount["type"]>([
  "savings",
  "tfsa",
  "rrsp",
  "fhsa",
  "non-registered-investment",
  "crypto",
]);

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
  const creditAccounts = liabilityAccounts.filter(
    (account) =>
      account.status === "active" &&
      (account.type === "credit-card" || account.type === "line-of-credit"),
  );
  const activeDebts = liabilityAccounts.filter(
    (account) => account.status === "active" && account.currentBalanceCents > 0,
  );
  const firstAsset =
    accounts.find((account) => account.spendability === "spendable") ??
    accounts[0];
  const [accountId, setAccountId] = useState(
    firstAsset?.id ??
      (kind === "expense" ? creditAccounts[0]?.id : undefined) ??
      "",
  );
  const [amount, setAmount] = useState("");
  const [incomeLabel, setIncomeLabel] = useState<IncomeLabel>("Paycheque");
  const [spendingCategory, setSpendingCategory] =
    useState<BudgetCategoryKey>("groceries");
  const [expenseType, setExpenseType] = useState<"purchase" | "refund">(
    "purchase",
  );
  const [destinationValue, setDestinationValue] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const destinationAsset = accounts.find(
    (account) => account.id === destinationValue,
  );
  const destinationDebt = activeDebts.find(
    (account) => account.id === destinationValue,
  );
  const isUntracked = destinationValue === UNTRACKED_ACCOUNT_VALUE;
  const isInstallmentLoan =
    destinationDebt !== undefined &&
    destinationDebt.type !== "credit-card" &&
    destinationDebt.type !== "line-of-credit";
  const transactionType: ExpenseTransactionType =
    kind === "expense"
      ? expenseType
      : destinationDebt
        ? "credit-card-payment"
        : destinationAsset && INVESTMENT_TYPES.has(destinationAsset.type)
          ? "savings-contribution"
          : "transfer";

  const duplicateNames = new Set(
    [...accounts, ...liabilityAccounts]
      .map((account) => account.name.trim().toLocaleLowerCase())
      .filter(
        (name, index, names) =>
          names.indexOf(name) !== index || names.lastIndexOf(name) !== index,
      ),
  );
  const accountLabel = (account: AssetAccount | LiabilityAccount) => {
    const provider = account.groupId
      ? accountGroups.find((group) => group.id === account.groupId)?.name
      : undefined;
    return duplicateNames.has(account.name.trim().toLocaleLowerCase()) &&
      provider
      ? `${provider} · ${account.name}`
      : account.name;
  };
  const title =
    kind === "income"
      ? "Add income"
      : kind === "expense"
        ? "Record expense"
        : "Move money";

  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await onSave({
      kind,
      accountId,
      amount,
      incomeLabel,
      spendingCategory,
      transactionType,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(destinationAsset
        ? { destinationAccountId: destinationAsset.id }
        : {}),
      ...(isUntracked ? { transferToUntrackedAccount: true } : {}),
      ...(destinationDebt ? { debtAccountId: destinationDebt.id } : {}),
      ...(isInstallmentLoan && principalAmount.trim()
        ? { principalAmount }
        : {}),
    });
    setError(result);
    if (result) setPending(false);
  }

  return (
    <div
      className="modal-backdrop money-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
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
            <h2 id="quick-activity-heading">{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close"
            disabled={pending}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <form
          className="account-form wizard-step"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <MoneySelect
            label={
              kind === "income"
                ? "Add to"
                : kind === "move"
                  ? "From"
                  : "Account or card"
            }
            value={accountId}
            options={[
              ...accounts.map((account) => ({
                value: account.id,
                label: `${accountLabel(account)} · ${formatCad(account.currentValueCents)}`,
              })),
              ...(kind === "expense"
                ? creditAccounts.map((account) => ({
                    value: account.id,
                    label: `${accountLabel(account)} · owed ${formatCad(account.currentBalanceCents)}`,
                  }))
                : []),
            ]}
            onChange={(value) => {
              setAccountId(value);
              if (value === destinationValue) setDestinationValue("");
              setError(null);
            }}
          />

          {kind === "income" && (
            <MoneySelect
              label="Income type"
              value={incomeLabel}
              options={INCOME_LABELS.map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={setIncomeLabel}
            />
          )}

          {kind === "expense" && (
            <>
              <MoneySelect
                label="Expense type"
                value={expenseType}
                options={EXPENSE_OPTIONS}
                onChange={(value) => {
                  setExpenseType(value);
                  setError(null);
                }}
              />
              <MoneySelect
                label={
                  expenseType === "refund"
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
            </>
          )}

          {kind === "move" && (
            <>
              <MoneySelect
                label="To"
                value={destinationValue}
                options={[
                  { value: "", label: "Choose destination" },
                  ...accounts
                    .filter((account) => account.id !== accountId)
                    .map((account) => ({
                      value: account.id,
                      label: `${accountLabel(account)} · ${formatCad(account.currentValueCents)}`,
                    })),
                  ...activeDebts.map((account) => ({
                    value: account.id,
                    label: `${accountLabel(account)} · owed ${formatCad(account.currentBalanceCents)}`,
                  })),
                  {
                    value: UNTRACKED_ACCOUNT_VALUE,
                    label: "Another account I own (not tracked)",
                  },
                ]}
                onChange={(value) => {
                  setDestinationValue(value);
                  setPrincipalAmount("");
                  setError(null);
                }}
              />
              {destinationValue && (
                <p className="activity-explanation">
                  {destinationDebt
                    ? "Records a debt payment without counting it as new spending."
                    : isUntracked
                      ? "Only the source balance changes because the destination is not tracked."
                      : destinationAsset &&
                          INVESTMENT_TYPES.has(destinationAsset.type)
                        ? "Moves money into savings or investments without counting it as spending."
                        : "Updates both tracked account balances without creating income or spending."}
                </p>
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
              {isInstallmentLoan && (
                <details className="optional-note">
                  <summary>
                    Add principal and interest split <span>(optional)</span>
                  </summary>
                  <label>
                    Principal portion
                    <span className="money-input">
                      <span>$</span>
                      <input
                        aria-label="Principal portion"
                        value={principalAmount}
                        onChange={(event) => {
                          setPrincipalAmount(event.target.value);
                          setError(null);
                        }}
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    </span>
                    <small>
                      Only this amount reduces the loan balance. Leave blank
                      when the split is unknown.
                    </small>
                  </label>
                </details>
              )}
            </>
          )}

          {kind !== "move" && (
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
          )}

          {kind !== "income" && (
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
                    kind === "move"
                      ? "For example, business account"
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
          <button
            className="button button-primary"
            type="submit"
            disabled={pending}
          >
            {pending
              ? "Saving…"
              : kind === "income"
                ? "Add income"
                : kind === "expense"
                  ? expenseType === "refund"
                    ? "Save refund"
                    : "Save expense"
                  : "Move money"}
          </button>
        </form>
      </section>
    </div>
  );
}
