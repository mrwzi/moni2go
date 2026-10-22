"use client";

import { useMemo, useState } from "react";
import { formatCad } from "../../domain/money";
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_KEYS,
  type BudgetCategoryKey,
} from "../../v2/domain/budget-categories";
import { addCalendarDays, parseCalendarDate } from "../../v2/domain/calendar";
import type {
  ExpenseDefinition,
  ExpenseDefinitionStatus,
} from "../../v2/domain/expenses";
import { asV2Cents, parseV2CadInput } from "../../v2/domain/money";
import { expandRecurrence, type Recurrence } from "../../v2/domain/recurrence";
import type {
  CalendarDate,
  ExpenseDefinitionId,
  ObligationClassification,
} from "../../v2/domain/types";
import type { FinancialWorkspace } from "../../v2/domain/workspace";
import { MoneySelect } from "./MoneySelect";

type BillFrequency = "monthly" | "weekly" | "biweekly" | "one-time";

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Every month" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "one-time", label: "One time" },
] as const;
const PRIORITY_OPTIONS = [
  { value: "required", label: "Required — must be paid" },
  { value: "flexible", label: "Flexible — timing can change" },
  { value: "optional", label: "Optional — can pause or cancel" },
] as const;
const WEEKDAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
] as const;

function today(): CalendarDate {
  const date = new Date();
  return parseCalendarDate(
    `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`,
  );
}

function nextDue(definition: ExpenseDefinition, start: CalendarDate) {
  if (definition.status === "paused" || definition.status === "cancelled")
    return undefined;
  return expandRecurrence({
    recurrence: definition.recurrence,
    bounds: definition.bounds,
    horizonStart: start,
    horizonEnd: addCalendarDays(start, 370),
  }).occurrences[0];
}

function frequencyOf(recurrence: Recurrence): BillFrequency {
  if (recurrence.kind === "weekly") return "weekly";
  if (recurrence.kind === "biweekly") return "biweekly";
  if (recurrence.kind === "one-time") return "one-time";
  return "monthly";
}

function frequencyLabel(recurrence: Recurrence): string {
  if (recurrence.kind === "monthly")
    return `Monthly · day ${recurrence.nominalDay.toString()}`;
  if (recurrence.kind === "weekly")
    return (
      WEEKDAY_OPTIONS.find(
        (option) => Number(option.value) === recurrence.weekday,
      )?.label ?? "Every week"
    );
  if (recurrence.kind === "biweekly") return "Every 2 weeks";
  if (recurrence.kind === "one-time") return "One time";
  return recurrence.kind === "semimonthly" ? "Twice a month" : "Irregular";
}

function dateForForm(definition: ExpenseDefinition): string {
  if (definition.recurrence.kind === "biweekly")
    return definition.recurrence.anchorDate;
  if (definition.recurrence.kind === "one-time")
    return definition.recurrence.date;
  return "";
}

export function CommitmentsManager({
  workspace,
  save,
}: Readonly<{
  workspace: FinancialWorkspace;
  save: (next: FinancialWorkspace) => Promise<void>;
}>) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<ExpenseDefinitionId | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<BudgetCategoryKey>("subscriptions");
  const [priority, setPriority] =
    useState<ObligationClassification>("flexible");
  const [frequency, setFrequency] = useState<BillFrequency>("monthly");
  const [dueDay, setDueDay] = useState("");
  const [weekday, setWeekday] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [actionPendingId, setActionPendingId] =
    useState<ExpenseDefinitionId | null>(null);
  const [removed, setRemoved] = useState<ExpenseDefinition | null>(null);
  const start = today();
  const activeWorkspace = workspace;
  const commitments = useMemo(
    () =>
      [...activeWorkspace.expenseDefinitions].sort((a, b) =>
        (nextDue(a, start) ?? "9999").localeCompare(
          nextDue(b, start) ?? "9999",
        ),
      ),
    [activeWorkspace.expenseDefinitions, start],
  );

  function resetForm() {
    setEditingId(null);
    setName("");
    setAmount("");
    setCategory("subscriptions");
    setPriority("flexible");
    setFrequency("monthly");
    setDueDay("");
    setWeekday("1");
    setDueDate("");
    setError(null);
  }

  function closeDialog() {
    if (pending) return;
    setOpen(false);
    resetForm();
  }

  function editCommitment(definition: ExpenseDefinition) {
    setEditingId(definition.id);
    setName(definition.name);
    setAmount((definition.amountCents / 100).toFixed(2));
    setCategory(definition.category);
    setPriority(definition.obligation);
    setFrequency(frequencyOf(definition.recurrence));
    setDueDay(
      definition.recurrence.kind === "monthly"
        ? definition.recurrence.nominalDay.toString()
        : "",
    );
    setWeekday(
      definition.recurrence.kind === "weekly"
        ? definition.recurrence.weekday.toString()
        : "1",
    );
    setDueDate(dateForForm(definition));
    setError(null);
    setOpen(true);
  }

  function buildRecurrence(): {
    recurrence: Recurrence;
    startDate: CalendarDate;
  } {
    if (frequency === "monthly") {
      const day = Number(dueDay);
      if (!Number.isInteger(day) || day < 1 || day > 31)
        throw new Error("Enter a monthly due day from 1 to 31.");
      return {
        recurrence: { kind: "monthly", nominalDay: day },
        startDate: start,
      };
    }
    if (frequency === "weekly") {
      const selectedWeekday = Number(weekday);
      if (
        !Number.isInteger(selectedWeekday) ||
        selectedWeekday < 1 ||
        selectedWeekday > 7
      )
        throw new Error("Choose the weekly payment day.");
      return {
        recurrence: {
          kind: "weekly",
          intervalWeeks: 1,
          weekday: selectedWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        },
        startDate: start,
      };
    }
    let date: CalendarDate;
    try {
      date = parseCalendarDate(dueDate);
    } catch {
      throw new Error(
        frequency === "biweekly"
          ? "Choose the next payment date."
          : "Choose the payment date.",
      );
    }
    return {
      recurrence:
        frequency === "biweekly"
          ? { kind: "biweekly", anchorDate: date }
          : { kind: "one-time", date },
      startDate: date,
    };
  }

  async function saveCommitment() {
    if (pending) return;
    const parsed = parseV2CadInput(amount);
    if (!name.trim() || !parsed.ok || parsed.cents <= 0) {
      setError("Enter a name and an amount greater than $0.");
      return;
    }
    if (
      activeWorkspace.liabilityAccounts.some(
        (account) =>
          account.status === "active" &&
          account.name.trim().toLocaleLowerCase() ===
            name.trim().toLocaleLowerCase(),
      )
    ) {
      setError(
        "This debt is already tracked in Accounts. Add its payment details there instead.",
      );
      return;
    }
    let schedule: ReturnType<typeof buildRecurrence>;
    try {
      schedule = buildRecurrence();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Check the payment schedule.",
      );
      return;
    }
    setPending(true);
    setError(null);
    const now = new Date().toISOString();
    const existing = activeWorkspace.expenseDefinitions.find(
      (item) => item.id === editingId,
    );
    const definition: ExpenseDefinition = {
      id: existing?.id ?? (crypto.randomUUID() as ExpenseDefinitionId),
      workspaceId: activeWorkspace.id,
      name: name.trim(),
      amountCents: asV2Cents(parsed.cents),
      category,
      nature: "fixed",
      obligation: priority,
      status: existing?.status ?? "active",
      recurrence: schedule.recurrence,
      bounds: { startDate: schedule.startDate },
      provenance: existing?.provenance ?? "user-entered",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await save({
        ...activeWorkspace,
        updatedAt: now,
        expenseDefinitions: existing
          ? activeWorkspace.expenseDefinitions.map((item) =>
              item.id === existing.id ? definition : item,
            )
          : [...activeWorkspace.expenseDefinitions, definition],
      });
      setOpen(false);
      resetForm();
    } catch {
      setError(
        "This bill could not be saved. Your existing data was not changed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function setStatus(
    definition: ExpenseDefinition,
    status: ExpenseDefinitionStatus,
  ) {
    if (actionPendingId) return;
    setActionPendingId(definition.id);
    const now = new Date().toISOString();
    try {
      await save({
        ...activeWorkspace,
        updatedAt: now,
        expenseDefinitions: activeWorkspace.expenseDefinitions.map((item) =>
          item.id === definition.id
            ? { ...item, status, updatedAt: now }
            : item,
        ),
      });
      setError(null);
    } catch {
      setError("The bill status could not be changed.");
    } finally {
      setActionPendingId(null);
    }
  }

  async function removeCommitment(definition: ExpenseDefinition) {
    if (actionPendingId) return;
    setActionPendingId(definition.id);
    const now = new Date().toISOString();
    try {
      await save({
        ...activeWorkspace,
        updatedAt: now,
        expenseDefinitions: activeWorkspace.expenseDefinitions.filter(
          (item) => item.id !== definition.id,
        ),
      });
      setRemoved(definition);
      setError(null);
    } catch {
      setError("The bill could not be removed.");
    } finally {
      setActionPendingId(null);
    }
  }

  async function undoRemove() {
    if (!removed) return;
    const now = new Date().toISOString();
    try {
      await save({
        ...activeWorkspace,
        updatedAt: now,
        expenseDefinitions: [...activeWorkspace.expenseDefinitions, removed],
      });
      setRemoved(null);
    } catch {
      setError("The bill could not be restored.");
    }
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
          <p>Rent, utilities, memberships, and other scheduled costs.</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          + Add bill
        </button>
      </div>
      {error && !open && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {removed && (
        <div className="commitment-undo" role="status">
          <span>{removed.name} removed.</span>
          <button type="button" onClick={() => void undoRemove()}>
            Undo
          </button>
        </div>
      )}
      {commitments.length === 0 ? (
        <p className="empty-group-copy">Add bills to see what is due next.</p>
      ) : (
        <ul className="commitment-list">
          {commitments.map((item) => {
            const status = item.status ?? "active";
            return (
              <li key={item.id}>
                <div className="commitment-copy">
                  <strong>{item.name}</strong>
                  <span>
                    {BUDGET_CATEGORIES[item.category]} ·{" "}
                    {frequencyLabel(item.recurrence)}
                  </span>
                  {status !== "active" && (
                    <small className={`priority priority-${status}`}>
                      {status}
                    </small>
                  )}
                </div>
                <div className="commitment-value">
                  <strong>{formatCad(item.amountCents)}</strong>
                  <span className={`priority priority-${item.obligation}`}>
                    {item.obligation}
                  </span>
                  <small>
                    {status === "active"
                      ? `Next: ${nextDue(item, start) ?? "No date"}`
                      : "Not included in forecasts"}
                  </small>
                  <div className="commitment-actions">
                    <button
                      type="button"
                      disabled={actionPendingId === item.id}
                      onClick={() => {
                        editCommitment(item);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={actionPendingId === item.id}
                      onClick={() =>
                        void setStatus(
                          item,
                          status === "active" ? "paused" : "active",
                        )
                      }
                    >
                      {status === "active" ? "Pause" : "Resume"}
                    </button>
                    {status !== "cancelled" && (
                      <button
                        type="button"
                        disabled={actionPendingId === item.id}
                        onClick={() => void setStatus(item, "cancelled")}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      className="danger-link"
                      type="button"
                      disabled={actionPendingId === item.id}
                      onClick={() => void removeCommitment(item)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {open && (
        <div
          className="modal-backdrop money-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            className="account-dialog money-dialog commitment-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commitment-dialog-heading"
          >
            <header>
              <div>
                <p className="eyebrow">
                  {editingId ? "Bill details" : "New bill"}
                </p>
                <h2 id="commitment-dialog-heading">
                  {editingId ? "Edit bill" : "Add a bill"}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close"
                disabled={pending}
                onClick={closeDialog}
              >
                ×
              </button>
            </header>
            <form
              className="account-form wizard-step"
              onSubmit={(event) => {
                event.preventDefault();
                void saveCommitment();
              }}
            >
              <label>
                Bill name
                <input
                  value={name}
                  maxLength={120}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  placeholder="For example, rent or gym"
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
                      setError(null);
                    }}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </span>
              </label>
              <MoneySelect
                label="Category"
                value={category}
                options={BUDGET_CATEGORY_KEYS.map((key) => ({
                  value: key,
                  label: BUDGET_CATEGORIES[key],
                }))}
                onChange={(value) => {
                  setCategory(value);
                  setError(null);
                }}
              />
              <MoneySelect
                label="Payment priority"
                value={priority}
                options={PRIORITY_OPTIONS}
                onChange={(value) => {
                  setPriority(value);
                  setError(null);
                }}
                hint="Choose required only when the payment must be made."
              />
              <MoneySelect
                label="How often?"
                value={frequency}
                options={FREQUENCY_OPTIONS}
                onChange={(value) => {
                  setFrequency(value);
                  setError(null);
                }}
              />
              {frequency === "monthly" && (
                <label>
                  Due day each month
                  <input
                    aria-label="Due day each month"
                    value={dueDay}
                    onChange={(event) => {
                      setDueDay(event.target.value);
                      setError(null);
                    }}
                    inputMode="numeric"
                    placeholder="1–31"
                  />
                </label>
              )}
              {frequency === "weekly" && (
                <MoneySelect
                  label="Payment day"
                  value={weekday}
                  options={WEEKDAY_OPTIONS}
                  onChange={(value) => {
                    setWeekday(value);
                    setError(null);
                  }}
                />
              )}
              {(frequency === "biweekly" || frequency === "one-time") && (
                <label>
                  {frequency === "biweekly"
                    ? "Next payment date"
                    : "Payment date"}
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => {
                      setDueDate(event.target.value);
                      setError(null);
                    }}
                  />
                </label>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <p className="activity-save-note">
                Scheduling a bill does not change an account balance or record
                spending.
              </p>
              <div className="wizard-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={pending}
                  onClick={closeDialog}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={pending}
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
