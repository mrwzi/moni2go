"use client";

import { useMemo, useState } from "react";
import { formatCad } from "../../domain/money";
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_KEYS,
  type BudgetCategoryKey,
} from "../../v2/domain/budget-categories";
import { addCalendarDays, parseCalendarDate } from "../../v2/domain/calendar";
import type { ExpenseDefinition } from "../../v2/domain/expenses";
import { asV2Cents, parseV2CadInput } from "../../v2/domain/money";
import { expandRecurrence, type Recurrence } from "../../v2/domain/recurrence";
import type {
  CalendarDate,
  ExpenseDefinitionId,
  ObligationClassification,
} from "../../v2/domain/types";
import { useFinancialWorkspace } from "../../v2/react/useFinancialWorkspace";

function today(): CalendarDate {
  const date = new Date();
  return parseCalendarDate(
    `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`,
  );
}

function nextDue(definition: ExpenseDefinition, start: CalendarDate) {
  return expandRecurrence({
    recurrence: definition.recurrence,
    bounds: definition.bounds,
    horizonStart: start,
    horizonEnd: addCalendarDays(start, 370),
  }).occurrences[0];
}

function frequencyLabel(recurrence: Recurrence): string {
  if (recurrence.kind === "monthly")
    return `Monthly · day ${recurrence.nominalDay.toString()}`;
  if (recurrence.kind === "weekly") return "Every week";
  if (recurrence.kind === "biweekly") return "Every 2 weeks";
  if (recurrence.kind === "one-time") return "One time";
  return recurrence.kind === "semimonthly" ? "Twice a month" : "Irregular";
}

export function CommitmentsManager() {
  const { workspace, save, ensureWorkspace } = useFinancialWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<BudgetCategoryKey>("subscriptions");
  const [priority, setPriority] =
    useState<ObligationClassification>("required");
  const [frequency, setFrequency] = useState<
    "monthly" | "weekly" | "biweekly" | "one-time"
  >("monthly");
  const [dueDay, setDueDay] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const start = today();
  const activeWorkspace = workspace ?? ensureWorkspace();
  const commitments = useMemo(
    () =>
      [...activeWorkspace.expenseDefinitions].sort((a, b) =>
        (nextDue(a, start) ?? "9999").localeCompare(
          nextDue(b, start) ?? "9999",
        ),
      ),
    [activeWorkspace.expenseDefinitions, start],
  );

  async function addCommitment() {
    const parsed = parseV2CadInput(amount);
    const day = Number(dueDay);
    if (!name.trim() || !parsed.ok || parsed.cents <= 0) {
      setError("Enter a name and an amount greater than $0.");
      return;
    }
    if (
      frequency === "monthly" &&
      (!Number.isInteger(day) || day < 1 || day > 31)
    ) {
      setError("Enter a monthly due day from 1 to 31.");
      return;
    }
    let recurrence: Recurrence;
    try {
      recurrence =
        frequency === "monthly"
          ? { kind: "monthly", nominalDay: day }
          : frequency === "weekly"
            ? { kind: "weekly", intervalWeeks: 1, weekday: 1 }
            : frequency === "biweekly"
              ? { kind: "biweekly", anchorDate: parseCalendarDate(dueDate) }
              : { kind: "one-time", date: parseCalendarDate(dueDate) };
    } catch {
      setError("Choose the next payment date.");
      return;
    }
    setPending(true);
    const now = new Date().toISOString();
    const definition: ExpenseDefinition = {
      id: crypto.randomUUID() as ExpenseDefinitionId,
      workspaceId: activeWorkspace.id,
      name: name.trim(),
      amountCents: asV2Cents(parsed.cents),
      category,
      nature: "fixed",
      obligation: priority,
      recurrence,
      bounds: {
        startDate:
          frequency === "monthly" || frequency === "weekly"
            ? start
            : parseCalendarDate(dueDate),
      },
      provenance: "user-entered",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await save({
        ...activeWorkspace,
        updatedAt: now,
        expenseDefinitions: [...activeWorkspace.expenseDefinitions, definition],
      });
      setOpen(false);
      setName("");
      setAmount("");
      setDueDay("");
      setDueDate("");
      setError(null);
    } finally {
      setPending(false);
    }
  }

  async function removeCommitment(id: ExpenseDefinitionId) {
    const now = new Date().toISOString();
    await save({
      ...activeWorkspace,
      updatedAt: now,
      expenseDefinitions: activeWorkspace.expenseDefinitions.filter(
        (item) => item.id !== id,
      ),
    });
  }

  return (
    <section
      id="bills-commitments"
      className="app-card commitments-card"
      aria-labelledby="commitments-heading"
    >
      <div className="home-section-heading">
        <div>
          <p className="eyebrow">What must be paid</p>
          <h2 id="commitments-heading">Bills & commitments</h2>
          <p>
            Rent, utilities, memberships, insurance, and other repeating costs.
          </p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          + Add bill
        </button>
      </div>
      {commitments.length === 0 ? (
        <p className="empty-group-copy">
          Add recurring costs to see what is due first.
        </p>
      ) : (
        <ul className="commitment-list">
          {commitments.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {BUDGET_CATEGORIES[item.category]} ·{" "}
                  {frequencyLabel(item.recurrence)}
                </span>
              </div>
              <div>
                <strong>{formatCad(item.amountCents)}</strong>
                <span className={`priority priority-${item.obligation}`}>
                  {item.obligation}
                </span>
                <small>Next: {nextDue(item, start) ?? "No date"}</small>
                <button
                  type="button"
                  onClick={() => void removeCommitment(item.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="account-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commitment-dialog-heading"
          >
            <header>
              <div>
                <p className="eyebrow">New commitment</p>
                <h2 id="commitment-dialog-heading">Add a bill</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close"
                onClick={() => {
                  setOpen(false);
                }}
              >
                ×
              </button>
            </header>
            <form
              className="account-form wizard-step"
              onSubmit={(event) => {
                event.preventDefault();
                void addCommitment();
              }}
            >
              <label>
                Bill or membership name
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  placeholder="For example, car loan or gym"
                  autoFocus
                />
              </label>
              <label>
                Amount
                <span className="money-input">
                  <span>$</span>
                  <input
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                    }}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </span>
              </label>
              <label>
                Category
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as BudgetCategoryKey);
                  }}
                >
                  {BUDGET_CATEGORY_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {BUDGET_CATEGORIES[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={priority}
                  onChange={(event) => {
                    setPriority(event.target.value as ObligationClassification);
                  }}
                >
                  <option value="required">Required — pay first</option>
                  <option value="flexible">Flexible — timing can change</option>
                  <option value="optional">
                    Optional — can cancel or pause
                  </option>
                </select>
              </label>
              <label>
                How often?
                <select
                  value={frequency}
                  onChange={(event) => {
                    setFrequency(event.target.value as typeof frequency);
                  }}
                >
                  <option value="monthly">Every month</option>
                  <option value="weekly">Every week</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="one-time">One time</option>
                </select>
              </label>
              {frequency === "monthly" ? (
                <label>
                  Due day each month
                  <input
                    aria-label="Due day each month"
                    value={dueDay}
                    onChange={(event) => {
                      setDueDay(event.target.value);
                    }}
                    inputMode="numeric"
                    placeholder="1–31"
                  />
                </label>
              ) : frequency === "weekly" ? (
                <p className="cash-place-note">
                  Weekly commitments are planned every Monday.
                </p>
              ) : (
                <label>
                  {frequency === "biweekly" ? "Next payment date" : "Due date"}
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => {
                      setDueDate(event.target.value);
                    }}
                  />
                </label>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button button-primary"
                type="submit"
                disabled={pending}
              >
                {pending ? "Saving…" : "Save bill"}
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
