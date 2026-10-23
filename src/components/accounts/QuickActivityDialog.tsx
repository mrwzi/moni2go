"use client";

import { useRef, useState } from "react";
import { formatCad } from "../../domain/money";
import type { AccountGroup } from "../../v2/domain/account-groups";
import type { AssetAccount, LiabilityAccount } from "../../v2/domain/accounts";
import type {
  ExpenseDefinition,
  ExpenseTransactionType,
  PersonPaymentPurpose,
} from "../../v2/domain/expenses";
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
  definitionId?: string;
  personPaymentPurpose?: PersonPaymentPurpose;
  saveIncomeSchedule?: boolean;
  incomeFrequency?: "weekly" | "biweekly" | "monthly";
  nextIncomeDate?: string;
}>;

const UNTRACKED_ACCOUNT_VALUE = "untracked-owned-account";
const EXPENSE_OPTIONS = [
  { value: "purchase", label: "Purchase or bill" },
  { value: "refund", label: "Refund" },
  { value: "person-payment", label: "Send money to someone" },
] as const;
const PERSON_PAYMENT_OPTIONS = [
  { value: "gift", label: "Gift" },
  { value: "pay-someone", label: "Pay someone" },
  { value: "other", label: "Other" },
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
  expenseDefinitions,
  onClose,
  onSave,
}: Readonly<{
  kind: QuickActivityKind;
  accounts: readonly AssetAccount[];
  liabilityAccounts: readonly LiabilityAccount[];
  accountGroups: readonly AccountGroup[];
  expenseDefinitions: readonly ExpenseDefinition[];
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
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [incomeLabel, setIncomeLabel] = useState<IncomeLabel>("Paycheque");
  const [saveIncomeSchedule, setSaveIncomeSchedule] = useState(false);
  const [incomeFrequency, setIncomeFrequency] = useState<
    "weekly" | "biweekly" | "monthly"
  >("biweekly");
  const [nextIncomeDate, setNextIncomeDate] = useState("");
  const [spendingCategory, setSpendingCategory] =
    useState<BudgetCategoryKey>("groceries");
  const [expenseType, setExpenseType] = useState<
    "purchase" | "refund" | "person-payment"
  >("purchase");
  const [personPaymentPurpose, setPersonPaymentPurpose] =
    useState<PersonPaymentPurpose>("gift");
  const [destinationValue, setDestinationValue] = useState("");
  const [note, setNote] = useState("");
  const [definitionId, setDefinitionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const destinationAsset = accounts.find(
    (account) => account.id === destinationValue,
  );
  const destinationDebt = activeDebts.find(
    (account) => account.id === destinationValue,
  );
  const isUntracked = destinationValue === UNTRACKED_ACCOUNT_VALUE;
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
    if (pendingRef.current) return;
    pendingRef.current = true;
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
      ...(kind === "expense" && expenseType === "purchase" && definitionId
        ? { definitionId }
        : {}),
      ...(kind === "expense" && expenseType === "person-payment"
        ? { personPaymentPurpose }
        : {}),
      ...(kind === "income" && saveIncomeSchedule
        ? { saveIncomeSchedule, incomeFrequency, nextIncomeDate }
        : {}),
    });
    setError(result);
    if (result) {
      pendingRef.current = false;
      setPending(false);
    }
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
            placeholder={
              kind === "move" ? "Select source account" : "Select an account"
            }
            options={[
              ...accounts.map((account) => ({
                value: account.id,
                label: `${accountLabel(account)} · ${formatCad(account.currentValueCents)}`,
              })),
              ...(kind === "expense" && expenseType !== "person-payment"
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
            <>
              <MoneySelect
                label="Income type"
                value={incomeLabel}
                options={INCOME_LABELS.map((option) => ({
                  value: option,
                  label: option,
                }))}
                onChange={setIncomeLabel}
                hint="Enter the amount that actually reached your account. moni2go does not calculate taxes."
              />
            </>
          )}

          {kind === "expense" && (
            <>
              <MoneySelect
                label="Expense type"
                value={expenseType}
                options={EXPENSE_OPTIONS}
                onChange={(value) => {
                  setExpenseType(value);
                  if (
                    value === "person-payment" &&
                    liabilityAccounts.some(
                      (account) => account.id === accountId,
                    )
                  )
                    setAccountId("");
                  setError(null);
                }}
              />
              {expenseType === "person-payment" && (
                <>
                  <MoneySelect
                    label="Purpose"
                    value={personPaymentPurpose}
                    options={PERSON_PAYMENT_OPTIONS}
                    onChange={setPersonPaymentPurpose}
                  />
                  <p className="activity-explanation">
                    Use this for money you do not expect back. moni2go does not
                    currently track personal loans as money owed to you.
                  </p>
                </>
              )}
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
              {expenseType === "purchase" &&
                expenseDefinitions.some(
                  (definition) =>
                    definition.status !== "paused" &&
                    definition.status !== "cancelled",
                ) && (
                  <MoneySelect
                    label="Saved bill (optional)"
                    value={definitionId}
                    options={[
                      { value: "", label: "Not a saved bill" },
                      ...expenseDefinitions
                        .filter(
                          (definition) =>
                            definition.status !== "paused" &&
                            definition.status !== "cancelled",
                        )
                        .map((definition) => ({
                          value: definition.id,
                          label: `${definition.name} · ${formatCad(definition.amountCents)}`,
                        })),
                    ]}
                    onChange={(value) => {
                      setDefinitionId(value);
                      const definition = expenseDefinitions.find(
                        (item) => item.id === value,
                      );
                      if (definition) {
                        setSpendingCategory(definition.category);
                        setAmount((definition.amountCents / 100).toFixed(2));
                      }
                      setError(null);
                    }}
                    hint="Linking the payment prevents the bill from being forecast twice."
                  />
                )}
            </>
          )}

          {kind === "move" && (
            <>
              <MoneySelect
                label="To"
                value={destinationValue}
                placeholder="Select destination account"
                options={[
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
              {destinationDebt && (
                <p className="activity-explanation" role="status">
                  This manually reduces both cash and the tracked debt by the
                  amount entered. Correct the debt balance later if your lender
                  reports a different amount.
                </p>
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

          {kind === "income" && (
            <details className="optional-note income-schedule-fields">
              <summary>
                Future paydays <span>(optional)</span>
              </summary>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={saveIncomeSchedule}
                  onChange={(event) => {
                    setSaveIncomeSchedule(event.target.checked);
                    setError(null);
                  }}
                />
                Save a recurring payday schedule
              </label>
              {saveIncomeSchedule && (
                <>
                  <MoneySelect
                    label="How often?"
                    value={incomeFrequency}
                    options={[
                      { value: "weekly", label: "Every week" },
                      { value: "biweekly", label: "Every 2 weeks" },
                      { value: "monthly", label: "Every month" },
                    ]}
                    onChange={setIncomeFrequency}
                  />
                  <label>
                    Next expected payday
                    <input
                      type="date"
                      value={nextIncomeDate}
                      onChange={(event) => {
                        setNextIncomeDate(event.target.value);
                        setError(null);
                      }}
                    />
                  </label>
                  <small>
                    Only future dates are forecast. This paycheque is recorded
                    once as income received.
                  </small>
                </>
              )}
            </details>
          )}

          {kind !== "income" && (
            <details className="optional-note">
              <summary>
                Add a note <span>(optional)</span>
              </summary>
              <label>
                {kind === "expense" && expenseType === "person-payment"
                  ? "Recipient or note"
                  : "Note"}
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
                      : expenseType === "person-payment"
                        ? "For example, Alex or birthday gift"
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
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      </section>
    </div>
  );
}
