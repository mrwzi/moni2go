"use client";

import Link from "next/link";
import { formatCad } from "../../domain/money";
import {
  deriveNetWorthCents,
  deriveRequiredDebtPayments,
  deriveSpendableCashCents,
  deriveTotalOwnedCents,
  deriveTotalLiabilitiesCents,
} from "../../v2/domain/accounts";
import { BUDGET_CATEGORIES } from "../../v2/domain/budget-categories";
import {
  addCalendarDays,
  differenceInCalendarDays,
  parseCalendarDate,
} from "../../v2/domain/calendar";
import { expandRecurrence } from "../../v2/domain/recurrence";
import type { CalendarDate } from "../../v2/domain/types";
import { useFinancialWorkspace } from "../../v2/react/useFinancialWorkspace";
import { SignedInGate } from "../auth/SignedInGate";
import { LoadingState } from "../shared/LoadingState";

function localToday(): CalendarDate {
  const value = new Date();
  return parseCalendarDate(
    `${value.getFullYear().toString().padStart(4, "0")}-${(value.getMonth() + 1).toString().padStart(2, "0")}-${value.getDate().toString().padStart(2, "0")}`,
  );
}

function dueLabel(date: CalendarDate, today: CalendarDate): string {
  const days = differenceInCalendarDays(today, date);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days.toString()} days`;
}

export function HomeDashboard() {
  return (
    <section className="section shell app-page home-page">
      <SignedInGate variant="home">
        <HomeDashboardContent />
      </SignedInGate>
    </section>
  );
}

function HomeDashboardContent() {
  const { workspace, loading, error } = useFinancialWorkspace();
  if (loading) return <LoadingState label="Loading your financial picture…" />;
  if (error)
    return (
      <section>
        <p role="alert">{error}</p>
        <Link className="button button-primary" href="/accounts">
          Review local accounts
        </Link>
      </section>
    );
  if (
    !workspace ||
    workspace.assetAccounts.length +
      workspace.liabilityAccounts.length +
      workspace.expenseDefinitions.length ===
      0
  )
    return (
      <div className="home-empty-layout">
        <section className="app-home-hero app-card">
          <div className="landing-intro">
            <p className="eyebrow">Your money, with direction.</p>
            <h1>Add your money.</h1>
            <p className="hero-copy">
              Enter what you have and what you owe. You stay in control.
            </p>
            <div className="home-actions">
              <Link className="button button-primary" href="/accounts">
                Add an account
              </Link>
              <Link className="button button-secondary" href="/explore">
                Try a demo
              </Link>
            </div>
            <p className="privacy-inline">
              Manual entry only · No bank connection required
            </p>
          </div>
        </section>
        <section className="app-card home-explainer">
          <h2>Three simple steps</h2>
          <ol className="simple-steps">
            <li>
              <strong>Add money</strong>
              <span>Cash, bank accounts, savings, or investments.</span>
            </li>
            <li>
              <strong>Add debts</strong>
              <span>Credit cards, loans, or a mortgage.</span>
            </li>
            <li>
              <strong>Make a plan</strong>
              <span>Split available money into useful categories.</span>
            </li>
          </ol>
        </section>
      </div>
    );
  const assets = workspace.assetAccounts;
  const liabilities = workspace.liabilityAccounts;
  const spendableCashCents = deriveSpendableCashCents(assets);
  const savedPlan = workspace.allocationRules.filter(
    (rule) =>
      rule.enabled &&
      rule.category !== undefined &&
      rule.strategy.kind === "fixed-amount" &&
      rule.strategy.amountCents > 0,
  );
  const savedPlanTotal = savedPlan.reduce(
    (total, rule) =>
      total +
      (rule.strategy.kind === "fixed-amount" ? rule.strategy.amountCents : 0),
    0,
  );
  const today = localToday();
  const horizonEnd = addCalendarDays(today, 30);
  const upcomingCommitments = workspace.expenseDefinitions
    .flatMap((definition) => {
      const occurrences = expandRecurrence({
        recurrence: definition.recurrence,
        bounds: definition.bounds,
        horizonStart: today,
        horizonEnd,
      }).occurrences;
      const nextDate = occurrences[0];
      return nextDate
        ? [{ definition, nextDate, occurrenceCount: occurrences.length }]
        : [];
    })
    .sort((left, right) => {
      const rank = { required: 0, flexible: 1, optional: 2 } as const;
      return (
        rank[left.definition.obligation] - rank[right.definition.obligation] ||
        left.nextDate.localeCompare(right.nextDate)
      );
    });
  const upcomingCommitmentTotal = upcomingCommitments.reduce(
    (total, item) => total + item.definition.amountCents * item.occurrenceCount,
    0,
  );
  const requiredUpcomingCommitmentTotal = upcomingCommitments.reduce(
    (total, item) =>
      item.definition.obligation === "required"
        ? total + item.definition.amountCents * item.occurrenceCount
        : total,
    0,
  );
  const requiredDebtPaymentTotal =
    deriveRequiredDebtPayments(liabilities).totalCents;
  const requiredPriorityTotal =
    requiredUpcomingCommitmentTotal + requiredDebtPaymentTotal;
  return (
    <div>
      <div className="app-page-heading">
        <p className="eyebrow">Home</p>
        <h1>Your financial picture</h1>
        <p>Based on the balances you entered manually.</p>
      </div>
      <section className="account-totals">
        <div>
          <span>Available now</span>
          <strong>{formatCad(spendableCashCents)}</strong>
        </div>
        <div>
          <span>Owed</span>
          <strong>{formatCad(deriveTotalLiabilitiesCents(liabilities))}</strong>
        </div>
      </section>
      <details className="home-financial-details">
        <summary>More totals</summary>
        <div className="account-totals">
          <div>
            <span>Net worth</span>
            <strong>
              {formatCad(deriveNetWorthCents(assets, liabilities))}
            </strong>
          </div>
          <div>
            <span>Total assets</span>
            <strong>
              {formatCad(deriveTotalOwnedCents(assets, liabilities))}
            </strong>
          </div>
        </div>
      </details>
      {spendableCashCents > 0 && (
        <section
          className="app-card home-next-step"
          aria-label="Money guidance"
        >
          <div className="home-section-heading">
            <div>
              <p className="eyebrow">Next step</p>
              <h2 id="home-next-step-heading">
                {requiredPriorityTotal > 0
                  ? `Keep ${formatCad(requiredPriorityTotal)} ready`
                  : savedPlan.length > 0
                    ? `Monthly plan: ${formatCad(savedPlanTotal)}`
                    : "Start a simple plan"}
              </h2>
            </div>
            <Link href="/plan">Open plan</Link>
          </div>
          <p className="home-next-step-summary">
            {requiredPriorityTotal > 0
              ? "Cover required payments first. Then use your monthly plan for the rest."
              : savedPlan.length > 0
                ? "Review it when your income or regular costs change."
                : "Add your real bills and priorities. moni2go will show what remains without moving any money."}
          </p>
        </section>
      )}
      {upcomingCommitments.length > 0 && (
        <section
          className="app-card home-due-card"
          aria-labelledby="home-due-heading"
        >
          <div className="home-section-heading">
            <div>
              <p className="eyebrow">Next 30 days</p>
              <h2 id="home-due-heading">What needs attention</h2>
            </div>
            <Link href="/accounts">Manage</Link>
          </div>
          <div className="home-plan-total">
            <span>Expected commitments</span>
            <strong>{formatCad(upcomingCommitmentTotal)}</strong>
          </div>
          <ul className="home-due-list">
            {upcomingCommitments.slice(0, 5).map(({ definition, nextDate }) => (
              <li key={definition.id}>
                <span>
                  <strong>{definition.name}</strong>
                  <small>
                    {BUDGET_CATEGORIES[definition.category]} ·{" "}
                    {dueLabel(nextDate, today)}
                  </small>
                </span>
                <span>
                  <strong>{formatCad(definition.amountCents)}</strong>
                  <small
                    className={`priority priority-${definition.obligation}`}
                  >
                    {definition.obligation === "required"
                      ? "Pay first"
                      : definition.obligation}
                  </small>
                </span>
              </li>
            ))}
          </ul>
          <p className="reminder-note">
            These are in-app reminders. moni2go does not send email or phone
            notifications yet.
          </p>
        </section>
      )}
    </div>
  );
}
