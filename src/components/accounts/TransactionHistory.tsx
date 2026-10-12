"use client";

import { useMemo, useState } from "react";
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
import { parseV2CadInput } from "../../v2/domain/money";
import type { FinancialWorkspace } from "../../v2/domain/workspace";
import type { FinancialEntityId } from "../../v2/domain/types";
import { SPENDING_CATEGORIES } from "./account-options";

const TYPE_LABELS: Record<ExpenseTransactionType, string> = {
  purchase: "Purchase",
  refund: "Refund received",
  transfer: "Transfer between accounts",
  "credit-card-payment": "Card or loan payment",
  "savings-contribution": "Savings or investment deposit",
};

function eventType(event: DatedExpenseEvent): ExpenseTransactionType {
  return event.transactionType ?? "purchase";
}

type TransactionHistoryProps = Readonly<{
  workspace: FinancialWorkspace;
  save: (workspace: FinancialWorkspace) => Promise<void>;
}>;

export function TransactionHistory({
  workspace,
  save,
}: TransactionHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<BudgetCategoryKey>("groceries");
  const [transactionType, setTransactionType] =
    useState<ExpenseTransactionType>("purchase");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const transactions = useMemo(
    () =>
      [...workspace.expenseEvents]
        .filter((event) => event.status === "actual")
        .sort((left, right) =>
          (right.actualDate ?? right.dueDate).localeCompare(
            left.actualDate ?? left.dueDate,
          ),
        ),
    [workspace.expenseEvents],
  );
  if (transactions.length === 0) return null;
  const editing = transactions.find((event) => event.id === editingId);

  function startEdit(event: DatedExpenseEvent) {
    setEditingId(event.id);
    setAmount((event.amountCents / 100).toFixed(2));
    setDate(event.actualDate ?? event.dueDate);
    setCategory(event.category);
    setTransactionType(eventType(event));
    setAccountId(
      event.accountId ??
        workspace.assetAccounts[0]?.id ??
        workspace.liabilityAccounts[0]?.id ??
        "",
    );
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const parsed = parseV2CadInput(amount);
    let parsedDate;
    try {
      parsedDate = parseCalendarDate(date);
    } catch {
      setError("Enter a valid transaction date.");
      return;
    }
    if (!parsed.ok || parsed.cents <= 0 || !accountId) {
      setError("Enter an account, date, and amount greater than $0.");
      return;
    }
    const now = new Date().toISOString();
    await save({
      ...workspace,
      updatedAt: now,
      expenseEvents: workspace.expenseEvents.map((event) =>
        event.id === editing.id
          ? {
              ...event,
              accountId: accountId as FinancialEntityId,
              amountCents: parsed.cents,
              category,
              transactionType,
              actualDate: parsedDate,
              dueDate: parsedDate,
              name: BUDGET_CATEGORIES[category],
              updatedAt: now,
            }
          : event,
      ),
    });
    setEditingId(null);
  }

  async function removeTransaction(event: DatedExpenseEvent) {
    if (
      !window.confirm(
        `Delete this ${TYPE_LABELS[eventType(event)].toLowerCase()} record?`,
      )
    )
      return;
    await save({
      ...workspace,
      updatedAt: new Date().toISOString(),
      expenseEvents: workspace.expenseEvents.filter(
        (candidate) => candidate.id !== event.id,
      ),
    });
  }

  return (
    <section
      className="app-card transaction-history"
      aria-labelledby="transaction-history-heading"
    >
      <div className="home-section-heading">
        <div>
          <p className="eyebrow">Actual activity</p>
          <h2 id="transaction-history-heading">Recent transactions</h2>
        </div>
      </div>
      <p className="transaction-history-note">
        Editing or deleting history updates Plan insights. It does not silently
        rewrite a balance you may have updated later.
      </p>
      <ul className="transaction-history-list">
        {transactions.slice(0, 10).map((event) => (
          <li key={event.id}>
            <div className="transaction-history-actions">
              <strong>{event.name}</strong>
              <small>
                {event.actualDate ?? event.dueDate} ·{" "}
                {TYPE_LABELS[eventType(event)]}
              </small>
            </div>
            <div>
              <strong>
                {eventType(event) === "refund" ? "−" : ""}
                {formatCad(event.amountCents)}
              </strong>
              <span>
                <button
                  type="button"
                  onClick={() => {
                    startEdit(event);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="danger-link"
                  onClick={() => void removeTransaction(event)}
                >
                  Delete
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingId(null);
          }}
        >
          <section
            className="account-dialog"
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
                  setEditingId(null);
                }}
              >
                ×
              </button>
            </header>
            <form
              className="account-form wizard-step"
              onSubmit={(event) => {
                event.preventDefault();
                void saveEdit();
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
                  {workspace.assetAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                  {workspace.liabilityAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                What happened?
                <select
                  value={transactionType}
                  onChange={(event) => {
                    setTransactionType(
                      event.target.value as ExpenseTransactionType,
                    );
                  }}
                >
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as BudgetCategoryKey);
                  }}
                >
                  {SPENDING_CATEGORIES.map((key) => (
                    <option key={key} value={key}>
                      {BUDGET_CATEGORIES[key]}
                    </option>
                  ))}
                </select>
              </label>
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
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button button-primary" type="submit">
                Save transaction
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
