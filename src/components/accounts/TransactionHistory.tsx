"use client";

import { useMemo, useRef, useState } from "react";
import { formatCad } from "../../domain/money";
import {
  BUDGET_CATEGORIES,
  type BudgetCategoryKey,
} from "../../v2/domain/budget-categories";
import { parseCalendarDate } from "../../v2/domain/calendar";
import type {
  DatedExpenseEvent,
  ExpenseTransactionType,
} from "../../v2/domain/expenses";
import type { HistoricalIncomeRecord } from "../../v2/domain/income";
import { parseV2CadInput } from "../../v2/domain/money";
import {
  affectedTransactionAccountIds,
  applyExpenseBalanceEffect,
  applyIncomeBalanceEffect,
} from "../../v2/domain/transaction-balances";
import type { CalendarDate, FinancialEntityId } from "../../v2/domain/types";
import type { FinancialWorkspace } from "../../v2/domain/workspace";
import { SPENDING_CATEGORIES } from "./account-options";
import { MoneySelect } from "./MoneySelect";

const TYPE_LABELS: Record<ExpenseTransactionType, string> = {
  purchase: "Purchase",
  "person-payment": "Money sent",
  refund: "Refund received",
  transfer: "Transfer between accounts",
  "credit-card-payment": "Card or loan payment",
  "savings-contribution": "Savings or investment deposit",
};
type Activity =
  | Readonly<{ kind: "expense"; record: DatedExpenseEvent }>
  | Readonly<{ kind: "income"; record: HistoricalIncomeRecord }>;
type BalanceChoice = "balances" | "record-only";
const eventType = (event: DatedExpenseEvent): ExpenseTransactionType =>
  event.transactionType ?? "purchase";
const activityDate = (activity: Activity): string =>
  activity.kind === "income"
    ? activity.record.receivedDate
    : (activity.record.actualDate ?? activity.record.dueDate);
const localToday = (): CalendarDate => {
  const now = new Date();
  return parseCalendarDate(
    `${now.getFullYear().toString().padStart(4, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`,
  );
};

export function TransactionHistory({
  workspace,
  save,
}: Readonly<{
  workspace: FinancialWorkspace;
  save: (workspace: FinancialWorkspace) => Promise<void>;
}>) {
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<BudgetCategoryKey>("groceries");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [relatedAccountId, setRelatedAccountId] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const accountName = (id?: string) => {
    if (!id) return "Account not recorded";
    const account = [
      ...workspace.assetAccounts,
      ...workspace.liabilityAccounts,
    ].find((candidate) => candidate.id === id);
    if (!account) return "Removed account";
    const provider = account.groupId
      ? workspace.accountGroups.find((group) => group.id === account.groupId)
          ?.name
      : undefined;
    return provider ? `${provider} · ${account.name}` : account.name;
  };
  const activities = useMemo(() => {
    const combined: Activity[] = [
      ...workspace.expenseEvents
        .filter((event) => event.status === "actual")
        .map((record): Activity => ({ kind: "expense", record })),
      ...workspace.historicalIncome.map((record): Activity => ({
        kind: "income",
        record,
      })),
    ];
    return combined
      .filter(
        (activity) =>
          accountFilter === "all" ||
          affectedTransactionAccountIds(activity.record).includes(
            accountFilter as FinancialEntityId,
          ),
      )
      .sort((left, right) =>
        activityDate(right).localeCompare(activityDate(left)),
      );
  }, [workspace.expenseEvents, workspace.historicalIncome, accountFilter]);
  if (
    workspace.expenseEvents.every((event) => event.status !== "actual") &&
    workspace.historicalIncome.length === 0
  )
    return null;

  const hasLaterAccountChanges = (activity: Activity) =>
    affectedTransactionAccountIds(activity.record).some((id) => {
      const account = [
        ...workspace.assetAccounts,
        ...workspace.liabilityAccounts,
      ].find((candidate) => candidate.id === id);
      return Boolean(account && account.updatedAt > activity.record.updatedAt);
    });
  function startEdit(activity: Activity) {
    setEditing(activity);
    setAmount((activity.record.amountCents / 100).toFixed(2));
    setDate(activityDate(activity));
    setCategory(
      activity.kind === "expense" ? activity.record.category : "groceries",
    );
    setNote(activity.kind === "expense" ? (activity.record.note ?? "") : "");
    setAccountId(activity.record.accountId ?? "");
    setRelatedAccountId(
      activity.kind === "expense"
        ? (activity.record.relatedAccountId ?? "")
        : "",
    );
    setPrincipalAmount(
      activity.kind === "expense" && activity.record.principalAmountCents
        ? (activity.record.principalAmountCents / 100).toFixed(2)
        : "",
    );
    setError(null);
  }

  async function saveEdit(choice: BalanceChoice) {
    if (!editing || pendingRef.current) return;
    const parsed = parseV2CadInput(amount);
    let parsedDate;
    try {
      parsedDate = parseCalendarDate(date);
    } catch {
      setError("Enter a valid transaction date.");
      return;
    }
    if (!parsed.ok || parsed.cents <= 0 || !accountId) {
      setError("Choose an account and enter an amount greater than $0.");
      return;
    }
    const principal = principalAmount ? parseV2CadInput(principalAmount) : null;
    if (
      principal &&
      (!principal.ok || principal.cents <= 0 || principal.cents > parsed.cents)
    ) {
      setError(
        "Principal must be greater than $0 and no more than the payment.",
      );
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    const now = new Date().toISOString();
    try {
      if (editing.kind === "income") {
        const updated: HistoricalIncomeRecord = {
          ...editing.record,
          accountId: accountId as FinancialEntityId,
          amountCents: parsed.cents,
          receivedDate: parsedDate,
          updatedAt: now,
        };
        let next = workspace;
        if (choice === "balances") {
          next = applyIncomeBalanceEffect(
            next,
            editing.record,
            "reverse",
            localToday(),
            now,
          );
          next = applyIncomeBalanceEffect(
            next,
            updated,
            "apply",
            localToday(),
            now,
          );
        }
        await save({
          ...next,
          updatedAt: now,
          historicalIncome: next.historicalIncome.map((record) =>
            record.id === updated.id ? updated : record,
          ),
        });
      } else {
        const type = eventType(editing.record);
        const editingRecord = { ...editing.record };
        delete editingRecord.relatedAccountId;
        delete editingRecord.note;
        const updated: DatedExpenseEvent = {
          ...editingRecord,
          accountId: accountId as FinancialEntityId,
          ...(relatedAccountId
            ? { relatedAccountId: relatedAccountId as FinancialEntityId }
            : {}),
          amountCents: parsed.cents,
          category,
          actualDate: parsedDate,
          dueDate: parsedDate,
          ...(type === "credit-card-payment" && principal?.ok
            ? { principalAmountCents: principal.cents }
            : {}),
          name:
            type === "purchase" || type === "refund"
              ? `${type === "refund" ? "Refund · " : ""}${BUDGET_CATEGORIES[category]}`
              : editing.record.name,
          ...(note.trim() ? { note: note.trim() } : {}),
          updatedAt: now,
        };
        let next = workspace;
        if (choice === "balances") {
          next = applyExpenseBalanceEffect(
            next,
            editing.record,
            "reverse",
            localToday(),
            now,
          );
          next = applyExpenseBalanceEffect(
            next,
            updated,
            "apply",
            localToday(),
            now,
          );
        }
        await save({
          ...next,
          updatedAt: now,
          expenseEvents: next.expenseEvents.map((record) =>
            record.id === updated.id ? updated : record,
          ),
        });
      }
      setEditing(null);
    } catch {
      setError(
        "The transaction could not be updated. Your data was not changed.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function removeTransaction(choice: BalanceChoice) {
    if (!deleting || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    const now = new Date().toISOString();
    try {
      let next = workspace;
      if (choice === "balances")
        next =
          deleting.kind === "income"
            ? applyIncomeBalanceEffect(
                next,
                deleting.record,
                "reverse",
                localToday(),
                now,
              )
            : applyExpenseBalanceEffect(
                next,
                deleting.record,
                "reverse",
                localToday(),
                now,
              );
      await save({
        ...next,
        updatedAt: now,
        historicalIncome:
          deleting.kind === "income"
            ? next.historicalIncome.filter(
                (record) => record.id !== deleting.record.id,
              )
            : next.historicalIncome,
        expenseEvents:
          deleting.kind === "expense"
            ? next.expenseEvents.filter(
                (record) => record.id !== deleting.record.id,
              )
            : next.expenseEvents,
      });
      setDeleting(null);
    } catch {
      setError(
        "The transaction could not be deleted. Your data was not changed.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const sourceOptions = editing
    ? [
        ...workspace.assetAccounts
          .filter((account) => account.status === "active")
          .map((account) => ({
            value: account.id,
            label: accountName(account.id),
          })),
        ...(editing.kind === "expense" &&
        ["purchase", "refund"].includes(eventType(editing.record))
          ? workspace.liabilityAccounts
              .filter(
                (account) =>
                  account.status === "active" &&
                  (account.type === "credit-card" ||
                    account.type === "line-of-credit"),
              )
              .map((account) => ({
                value: account.id,
                label: accountName(account.id),
              }))
          : []),
      ]
    : [];
  const relatedOptions =
    editing?.kind === "expense"
      ? eventType(editing.record) === "credit-card-payment"
        ? workspace.liabilityAccounts
            .filter((account) => account.status === "active")
            .map((account) => ({
              value: account.id,
              label: accountName(account.id),
            }))
        : workspace.assetAccounts
            .filter(
              (account) =>
                account.status === "active" && account.id !== accountId,
            )
            .map((account) => ({
              value: account.id,
              label: accountName(account.id),
            }))
      : [];

  return (
    <section
      className="app-card transaction-history"
      aria-labelledby="transaction-history-heading"
    >
      <div className="home-section-heading transaction-history-heading">
        <div>
          <p className="eyebrow">Actual activity</p>
          <h2 id="transaction-history-heading">Recent transactions</h2>
        </div>
        <MoneySelect
          label="Filter by account"
          value={accountFilter}
          options={[
            { value: "all", label: "All accounts" },
            ...[...workspace.assetAccounts, ...workspace.liabilityAccounts].map(
              (account) => ({
                value: account.id,
                label: accountName(account.id),
              }),
            ),
          ]}
          onChange={setAccountFilter}
        />
      </div>
      <p className="transaction-history-note">
        Edit the record alone, or also correct the account balances when it is
        safe.
      </p>
      {activities.length === 0 ? (
        <p className="empty-state">No activity for this account.</p>
      ) : (
        <ul className="transaction-history-list">
          {activities.slice(0, showAll ? 50 : 2).map((activity) => {
            const isRefund =
              activity.kind === "expense" &&
              eventType(activity.record) === "refund";
            return (
              <li key={`${activity.kind}-${activity.record.id}`}>
                <div className="transaction-history-details">
                  <strong>{activity.record.name}</strong>
                  {activity.kind === "expense" && activity.record.note && (
                    <span>{activity.record.note}</span>
                  )}
                  <small>{accountName(activity.record.accountId)}</small>
                  <small>
                    {activityDate(activity)} ·{" "}
                    {activity.kind === "income"
                      ? "Income"
                      : TYPE_LABELS[eventType(activity.record)]}
                  </small>
                </div>
                <div className="transaction-history-summary">
                  <strong className="transaction-history-amount">
                    {isRefund ? "−" : ""}
                    {formatCad(activity.record.amountCents)}
                  </strong>
                  <div className="transaction-history-actions">
                    <button
                      type="button"
                      aria-label={`Edit ${activity.record.name} transaction`}
                      onClick={() => {
                        startEdit(activity);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger-link"
                      aria-label={`Delete ${activity.record.name} transaction`}
                      onClick={() => {
                        setDeleting(activity);
                        setError(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {activities.length > 2 && (
        <button
          className="button button-secondary transaction-history-toggle"
          type="button"
          aria-expanded={showAll}
          onClick={() => {
            setShowAll((current) => !current);
          }}
        >
          {showAll
            ? "Show recent only"
            : `Show all activity (${activities.length.toString()})`}
        </button>
      )}

      {editing && (
        <div
          className="modal-backdrop money-dialog-backdrop"
          role="presentation"
        >
          <section
            className="account-dialog money-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-transaction-heading"
          >
            <header>
              <div>
                <p className="eyebrow">Transaction history</p>
                <h2 id="edit-transaction-heading">Edit transaction</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close"
                onClick={() => {
                  setEditing(null);
                }}
              >
                ×
              </button>
            </header>
            <form
              className="account-form wizard-step"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <MoneySelect
                label="Account or card"
                value={accountId}
                options={sourceOptions}
                onChange={setAccountId}
              />
              {editing.kind === "expense" &&
                [
                  "transfer",
                  "savings-contribution",
                  "credit-card-payment",
                ].includes(eventType(editing.record)) && (
                  <MoneySelect
                    label={
                      eventType(editing.record) === "credit-card-payment"
                        ? "Debt paid"
                        : "Destination account"
                    }
                    value={relatedAccountId}
                    options={relatedOptions}
                    onChange={setRelatedAccountId}
                  />
                )}
              {editing.kind === "expense" &&
                ["purchase", "refund", "person-payment"].includes(
                  eventType(editing.record),
                ) && (
                  <MoneySelect
                    label="Category"
                    value={category}
                    options={SPENDING_CATEGORIES.map((key) => ({
                      value: key,
                      label: BUDGET_CATEGORIES[key],
                    }))}
                    onChange={setCategory}
                  />
                )}
              <label>
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                  }}
                />
              </label>
              <label>
                Amount
                <span className="money-input">
                  <span>$</span>
                  <input
                    value={amount}
                    inputMode="decimal"
                    onChange={(event) => {
                      setAmount(event.target.value);
                    }}
                  />
                </span>
              </label>
              {editing.kind === "expense" &&
                eventType(editing.record) === "credit-card-payment" &&
                editing.record.principalAmountCents !== undefined && (
                  <label>
                    Principal portion
                    <span className="money-input">
                      <span>$</span>
                      <input
                        value={principalAmount}
                        inputMode="decimal"
                        onChange={(event) => {
                          setPrincipalAmount(event.target.value);
                        }}
                      />
                    </span>
                  </label>
                )}
              {editing.kind === "expense" && (
                <label>
                  Note <small>(optional)</small>
                  <input
                    value={note}
                    maxLength={160}
                    onChange={(event) => {
                      setNote(event.target.value);
                    }}
                  />
                </label>
              )}
              {hasLaterAccountChanges(editing) && (
                <p className="form-warning">
                  This account changed after this transaction. Choose “record
                  only” if you manually corrected its balance.
                </p>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="transaction-balance-actions">
                <button
                  className="button button-primary"
                  type="button"
                  disabled={pending}
                  onClick={() => void saveEdit("balances")}
                >
                  Save and adjust balances
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={pending}
                  onClick={() => void saveEdit("record-only")}
                >
                  Save record only
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleting && (
        <div
          className="modal-backdrop money-dialog-backdrop"
          role="presentation"
        >
          <section
            className="account-dialog money-dialog transaction-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-transaction-heading"
          >
            <header>
              <div>
                <p className="eyebrow">Transaction history</p>
                <h2 id="delete-transaction-heading">Delete transaction?</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close"
                onClick={() => {
                  setDeleting(null);
                }}
              >
                ×
              </button>
            </header>
            <div className="account-form wizard-step">
              <p>
                <strong>{deleting.record.name}</strong> ·{" "}
                {formatCad(deleting.record.amountCents)}
              </p>
              <p className="cash-place-note">
                Restore the affected balances, or remove only the history record
                if a balance was corrected later.
              </p>
              {hasLaterAccountChanges(deleting) && (
                <p className="form-warning">
                  This account changed after the transaction. Review the current
                  balance before restoring it.
                </p>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button button-primary"
                type="button"
                disabled={pending}
                onClick={() => void removeTransaction("balances")}
              >
                Undo transaction and restore balances
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={pending}
                onClick={() => void removeTransaction("record-only")}
              >
                Delete record only
              </button>
              <button
                className="button button-ghost"
                type="button"
                disabled={pending}
                onClick={() => {
                  setDeleting(null);
                }}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
