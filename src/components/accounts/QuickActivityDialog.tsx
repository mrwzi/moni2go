"use client";

import { useRef, useState } from "react";
import { formatCad } from "../../domain/money";
import type { AccountGroup } from "../../v2/domain/account-groups";
import type { AssetAccount, LiabilityAccount } from "../../v2/domain/accounts";
import type {
  ExpenseTransactionType,
  PersonPaymentPurpose,
} from "../../v2/domain/expenses";
import type { CalendarDate, V2Cents } from "../../v2/domain/types";
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
  billDueDate?: CalendarDate;
  billName?: string;
  personPaymentPurpose?: PersonPaymentPurpose;
  saveIncomeSchedule?: boolean;
  incomeFrequency?: "weekly" | "biweekly" | "monthly";
  nextIncomeDate?: string;
}>;

const UNTRACKED_ACCOUNT_VALUE = "untracked-owned-account";
const EXPENSE_OPTIONS = [
  { value: "purchase", label: "Purchase" },
  { value: "bill-payment", label: "Pay a bill" },
  { value: "refund", label: "Refund" },
  { value: "person-payment", label: "Send money to someone" },
] as const;
const BILL_PATH_OPTIONS = [
  { value: "saved", label: "Choose a saved bill" },
  { value: "one-time", label: "Record a one-time bill" },
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
const formatBillDueDate = (date: CalendarDate): string => {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

export function QuickActivityDialog({
  kind,
  accounts,
  liabilityAccounts,
  accountGroups,
  payableBills,
  onClose,
  onSave,
}: Readonly<{
  kind: QuickActivityKind;
  accounts: readonly AssetAccount[];
  liabilityAccounts: readonly LiabilityAccount[];
  accountGroups: readonly AccountGroup[];
  payableBills: readonly Readonly<{
    definitionId: string;
    dueDate: CalendarDate;
    name: string;
    category: BudgetCategoryKey;
    remainingCents: V2Cents;
  }>[];
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
    "" | "purchase" | "bill-payment" | "refund" | "person-payment"
  >("");
  const [billPath, setBillPath] = useState<"" | "saved" | "one-time">("");
  const [billName, setBillName] = useState("");
  const [billOccurrence, setBillOccurrence] = useState("");
  const [personPaymentPurpose, setPersonPaymentPurpose] =
    useState<PersonPaymentPurpose>("gift");
  const [destinationValue, setDestinationValue] = useState("");
  const [note, setNote] = useState("");
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
  const moveTransactionType: ExpenseTransactionType = destinationDebt
    ? "credit-card-payment"
    : destinationAsset && INVESTMENT_TYPES.has(destinationAsset.type)
      ? "savings-contribution"
      : "transfer";
  const selectedBill = payableBills.find(
    (bill) => `${bill.definitionId}|${bill.dueDate}` === billOccurrence,
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
    if (kind === "expense" && !expenseType) {
      setError("Select an expense type.");
      pendingRef.current = false;
      setPending(false);
      return;
    }
    if (kind === "expense" && expenseType === "bill-payment" && !billPath) {
      setError("Choose a saved bill or a one-time bill.");
      pendingRef.current = false;
      setPending(false);
      return;
    }
    if (
      kind === "expense" &&
      expenseType === "bill-payment" &&
      billPath === "saved" &&
      !selectedBill
    ) {
      setError("Choose an unpaid saved bill.");
      pendingRef.current = false;
      setPending(false);
      return;
    }
    if (
      kind === "expense" &&
      expenseType === "bill-payment" &&
      billPath === "one-time" &&
      !billName.trim()
    ) {
      setError("Enter the bill name.");
      pendingRef.current = false;
      setPending(false);
      return;
    }
    const expenseTransactionType: ExpenseTransactionType =
      expenseType === "refund"
        ? "refund"
        : expenseType === "person-payment"
          ? "person-payment"
          : "purchase";
    const transactionType: ExpenseTransactionType =
      kind === "expense" ? expenseTransactionType : moveTransactionType;
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
      ...(kind === "expense" && expenseType === "bill-payment" && selectedBill
        ? {
            definitionId: selectedBill.definitionId,
            billDueDate: selectedBill.dueDate,
          }
        : {}),
      ...(kind === "expense" &&
      expenseType === "bill-payment" &&
      billPath === "one-time"
        ? { billName: billName.trim() }
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
                placeholder="Select expense type"
                options={EXPENSE_OPTIONS}
                onChange={(value) => {
                  setExpenseType(value);
                  setBillPath("");
                  setBillOccurrence("");
                  setBillName("");
                  setAmount("");
                  setSpendingCategory("groceries");
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
              {expenseType === "bill-payment" && (
                <MoneySelect
                  label="Bill type"
                  value={billPath}
                  placeholder="Choose how to record the bill"
                  options={BILL_PATH_OPTIONS}
                  onChange={(value) => {
                    setBillPath(value);
                    setBillOccurrence("");
                    setBillName("");
                    setAmount("");
                    setError(null);
                  }}
                />
              )}
              {expenseType === "bill-payment" && billPath === "saved" && (
                <MoneySelect
                  label="Saved bill"
                  value={billOccurrence}
                  placeholder="Select an unpaid bill"
                  options={payableBills.map((bill) => ({
                    value: `${bill.definitionId}|${bill.dueDate}`,
                    label: `${bill.name} · Due ${formatBillDueDate(bill.dueDate)} · ${formatCad(bill.remainingCents)} remaining`,
                  }))}
                  onChange={(value) => {
                    setBillOccurrence(value);
                    const bill = payableBills.find(
                      (item) =>
                        `${item.definitionId}|${item.dueDate}` === value,
                    );
                    if (bill) {
                      setSpendingCategory(bill.category);
                      setAmount((bill.remainingCents / 100).toFixed(2));
                    }
                    setError(null);
                  }}
                  hint="You can enter a smaller amount for a partial payment."
                />
              )}
              {expenseType === "bill-payment" &&
                billPath === "saved" &&
                payableBills.length === 0 && (
                  <p className="activity-explanation">
                    There are no unpaid saved bills. Choose a one-time bill or
                    add a bill under Bills &amp; commitments.
                  </p>
                )}
              {expenseType === "bill-payment" && billPath === "one-time" && (
                <label>
                  Bill name
                  <input
                    value={billName}
                    maxLength={120}
                    onChange={(event) => {
                      setBillName(event.target.value);
                      setError(null);
                    }}
                    placeholder="For example, electricity bill"
                  />
                </label>
              )}
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
              {expenseType &&
                !(expenseType === "bill-payment" && billPath === "saved") && (
                  <MoneySelect
                    label={
                      expenseType === "refund"
                        ? "What was refunded?"
                        : expenseType === "bill-payment"
                          ? "Bill category"
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
