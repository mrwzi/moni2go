"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCad } from "../../domain/money";
import {
  deriveNetWorthCents,
  deriveSpendableCashCents,
  deriveTotalOwnedCents,
  deriveTotalLiabilitiesCents,
} from "../../v2/domain/accounts";
import { BUDGET_CATEGORIES } from "../../v2/domain/budget-categories";
import {
  addCalendarDays,
  compareCalendarDates,
  differenceInCalendarDays,
  calendarDateParts,
  parseCalendarDate,
} from "../../v2/domain/calendar";
import {
  analyzeFinancialWorkspace,
  type ForecastHorizonDays,
} from "../../v2/domain/financial-insights";
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

function readableDate(date: CalendarDate): string {
  const { year, month, day } = calendarDateParts(date);
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function dueLabel(today: CalendarDate, date: CalendarDate): string {
  const days = differenceInCalendarDays(today, date);
  if (days < 0) return "Overdue";
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
  const [forecastDays, setForecastDays] = useState<ForecastHorizonDays>(30);
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
  const today = localToday();
  const insights = analyzeFinancialWorkspace(workspace, today);
  const { spending, recommendation } = insights;
  const forecast = insights.forecasts[forecastDays];
  const hasSpendingPlan = spending.spendingPlanCents > 0;
  const comparisonTotal = Math.max(
    spending.spendingPlanCents,
    spending.spentThisMonthCents,
  );
  const spentShare =
    comparisonTotal > 0
      ? Math.min(100, (spending.spentThisMonthCents / comparisonTotal) * 100)
      : 0;
  const obligationEnd = addCalendarDays(today, 30);
  const visibleObligations = insights.obligations.filter(
    (item) =>
      item.status === "overdue" ||
      (item.status === "upcoming" &&
        item.date !== null &&
        compareCalendarDates(item.date, obligationEnd) <= 0),
  );
  const forecastsAreIdentical = [60, 90].every((days) => {
    const item = insights.forecasts[days as 60 | 90];
    const first = insights.forecasts[30];
    return (
      item.endCashCents === first.endCashCents &&
      item.scheduledIncomeCents === first.scheduledIncomeCents &&
      item.scheduledOutflowCents === first.scheduledOutflowCents &&
      item.estimatedOutflowCents === first.estimatedOutflowCents
    );
  });
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
        <div>
          <span>Net worth</span>
          <strong>{formatCad(deriveNetWorthCents(assets, liabilities))}</strong>
        </div>
        <div>
          <span>Assets</span>
          <strong>
            {formatCad(deriveTotalOwnedCents(assets, liabilities))}
          </strong>
        </div>
      </section>
      <section className="app-card home-next-step" aria-label="Money guidance">
        <p className="eyebrow">Next useful step</p>
        <h2 id="home-next-step-heading">{recommendation.title}</h2>
        {recommendation.amountCents !== null && (
          <strong
            className={`home-next-step-amount${recommendation.priority <= 2 ? " money-negative" : ""}`}
          >
            {formatCad(recommendation.amountCents)}
          </strong>
        )}
        <p className="home-next-step-summary">{recommendation.explanation}</p>
        <Link
          className="button button-primary home-next-step-action"
          href={recommendation.actionHref}
        >
          {recommendation.actionLabel}
        </Link>
      </section>

      <section
        className="app-card home-outlook-card"
        aria-labelledby="home-outlook-heading"
      >
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Looking ahead</p>
            <h2 id="home-outlook-heading">Financial outlook</h2>
          </div>
          <div className="outlook-tabs" aria-label="Forecast period">
            {([30, 60, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={forecastDays === days}
                onClick={() => {
                  setForecastDays(days);
                }}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>
        <div className="outlook-summary" aria-live="polite">
          <div className="outlook-primary">
            <span>Projected available</span>
            <strong
              className={forecast.endCashCents < 0 ? "money-negative" : ""}
            >
              {formatCad(forecast.endCashCents)}
            </strong>
          </div>
          <div className="outlook-secondary">
            <div>
              <span>Income</span>
              <strong>{formatCad(forecast.scheduledIncomeCents)}</strong>
            </div>
            <div>
              <span>Payments</span>
              <strong>{formatCad(forecast.scheduledOutflowCents)}</strong>
            </div>
            <div>
              <span>Spending</span>
              <strong>
                {forecast.estimatedOutflowCents === null
                  ? "Unknown"
                  : formatCad(forecast.estimatedOutflowCents)}
              </strong>
            </div>
          </div>
        </div>
        {forecast.shortageDate && (
          <p className="outlook-warning" role="status">
            Cash may fall below $0 by {readableDate(forecast.shortageDate)}.
          </p>
        )}
        {forecast.estimatedOutflowCents === null ? (
          <p className="outlook-data-warning" role="status">
            Spending estimate unavailable — not enough history.
          </p>
        ) : forecast.unknowns.length > 0 ? (
          <p className="outlook-data-warning" role="status">
            Some future amounts are missing.
          </p>
        ) : null}
        <details className="outlook-details">
          <summary>More details</summary>
          {forecastsAreIdentical && (
            <p>
              The periods match because no additional dated activity is saved
              after 30 days.
            </p>
          )}
          <p>
            Starts with spendable balances, then applies dated income, payments,
            and reliable spending history in date order. Expected income is not
            guaranteed.
          </p>
          {forecast.unknowns.length > 0 && (
            <ul>
              {forecast.unknowns.slice(0, 3).map((unknown) => (
                <li key={unknown}>{unknown}</li>
              ))}
            </ul>
          )}
          <p>Estimates are informational. moni2go never moves money.</p>
        </details>
      </section>
      <section
        className="app-card home-spending-card"
        aria-labelledby="home-spending-heading"
      >
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">This month</p>
            <h2 id="home-spending-heading">Spending at a glance</h2>
          </div>
          <Link href="/accounts">View activity</Link>
        </div>
        {spending.topCategories.length > 0 ? (
          <div className="home-spending-layout">
            <div
              className={`home-spending-donut${hasSpendingPlan ? "" : " home-spending-donut-unplanned"}`}
            >
              <svg
                viewBox="0 0 120 120"
                role="img"
                aria-label={
                  hasSpendingPlan
                    ? `${formatCad(spending.spentThisMonthCents)} recorded as spending this month and ${formatCad(Math.abs(spending.planDifferenceCents))} ${spending.planDifferenceCents < 0 ? "over" : "left in"} the monthly spending plan`
                    : `${formatCad(spending.spentThisMonthCents)} recorded as spending this month; no spending plan is saved`
                }
              >
                <circle
                  className="home-spending-track"
                  cx="60"
                  cy="60"
                  r="48"
                />
                <circle
                  className="home-spending-value"
                  cx="60"
                  cy="60"
                  r="48"
                  pathLength="100"
                  strokeDasharray={`${hasSpendingPlan ? spentShare.toFixed(2) : "0"} 100`}
                />
              </svg>
              <div>
                <strong>{formatCad(spending.spentThisMonthCents)}</strong>
                <span>spent</span>
              </div>
            </div>
            <div className="home-spending-breakdown">
              <div className="home-spending-remaining">
                <span>
                  {!hasSpendingPlan
                    ? "No budget"
                    : spending.planDifferenceCents < 0
                      ? "Over budget"
                      : "Budget left"}
                </span>
                <strong
                  className={
                    spending.planDifferenceCents < 0 ? "money-negative" : ""
                  }
                >
                  {hasSpendingPlan
                    ? formatCad(Math.abs(spending.planDifferenceCents))
                    : "—"}
                </strong>
              </div>
              <ul>
                {spending.topCategories.map((item) => (
                  <li key={item.category}>
                    <span>{BUDGET_CATEGORIES[item.category]}</span>
                    <strong>{formatCad(item.spentCents)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="empty-group-copy">
            No spending recorded — activity may be incomplete.
          </p>
        )}
      </section>
      {visibleObligations.length > 0 && (
        <section
          className="app-card home-due-card"
          aria-labelledby="home-due-heading"
        >
          <div className="home-section-heading">
            <div>
              <p className="eyebrow">Payment dates</p>
              <h2 id="home-due-heading">Payments</h2>
            </div>
            <Link
              href={
                visibleObligations[0]?.kind === "debt-payment"
                  ? `/accounts#account-${visibleObligations[0].sourceId}`
                  : "/accounts#bills-commitments"
              }
            >
              Manage
            </Link>
          </div>
          <ul className="home-due-list">
            {visibleObligations.slice(0, 4).map((obligation) => (
              <li key={obligation.key}>
                <span>
                  <strong>{obligation.name}</strong>
                  <small>
                    {obligation.date
                      ? `${obligation.required ? "Required" : "Optional"} · ${dueLabel(today, obligation.date)}`
                      : "Date unknown"}
                  </small>
                </span>
                <span>
                  <strong>
                    {obligation.remainingCents === null
                      ? "Amount unknown"
                      : formatCad(obligation.remainingCents)}
                  </strong>
                </span>
              </li>
            ))}
          </ul>
          <details className="outlook-details reminder-details">
            <summary>About reminders</summary>
            <p>
              These are in-app reminders. Email and phone notifications are not
              available yet.
            </p>
          </details>
        </section>
      )}
    </div>
  );
}
