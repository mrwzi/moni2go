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
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Next useful step</p>
            <h2 id="home-next-step-heading">{recommendation.title}</h2>
          </div>
          <Link href={recommendation.actionHref}>
            {recommendation.actionLabel}
          </Link>
        </div>
        <p className="home-next-step-summary">{recommendation.explanation}</p>
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
          <div>
            <span>Projected available</span>
            <strong
              className={forecast.endCashCents < 0 ? "money-negative" : ""}
            >
              {formatCad(forecast.endCashCents)}
            </strong>
          </div>
          <div>
            <span>Scheduled income</span>
            <strong>{formatCad(forecast.confirmedIncomeCents)}</strong>
          </div>
          <div>
            <span>Known payments</span>
            <strong>{formatCad(forecast.confirmedOutflowCents)}</strong>
          </div>
          <div>
            <span>Estimated everyday spending</span>
            <strong>{formatCad(forecast.estimatedOutflowCents)}</strong>
          </div>
        </div>
        {forecast.shortageDate && (
          <p className="outlook-warning" role="status">
            Available cash may fall below $0 by {forecast.shortageDate}.
          </p>
        )}
        <details className="outlook-details">
          <summary>How this estimate works</summary>
          <p>
            Starts with spendable balances, then applies dated income, bills,
            required debt payments, and reliable completed-month spending
            history in date order.
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
            <div className="home-spending-donut">
              <svg
                viewBox="0 0 120 120"
                role="img"
                aria-label={`${formatCad(spending.spentThisMonthCents)} recorded as spending this month and ${formatCad(Math.abs(spending.planDifferenceCents))} ${spending.planDifferenceCents < 0 ? "over" : "left in"} the monthly spending plan`}
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
                  strokeDasharray={`${spentShare.toFixed(2)} 100`}
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
                  {spending.planDifferenceCents < 0
                    ? "Over spending plan"
                    : "Left in spending plan"}
                </span>
                <strong
                  className={
                    spending.planDifferenceCents < 0 ? "money-negative" : ""
                  }
                >
                  {formatCad(Math.abs(spending.planDifferenceCents))}
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
            No spending has been recorded in moni2go this month. This does not
            mean no money was spent.
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
              <h2 id="home-due-heading">Required and upcoming</h2>
            </div>
            <Link href="/accounts">Manage</Link>
          </div>
          <ul className="home-due-list">
            {visibleObligations.slice(0, 4).map((obligation) => (
              <li key={obligation.key}>
                <span>
                  <strong>{obligation.name}</strong>
                  <small>
                    {obligation.kind === "debt-payment"
                      ? "Debt payment"
                      : "Bill"}{" "}
                    · {obligation.date ?? "Date unknown"}
                  </small>
                </span>
                <span>
                  <strong>
                    {obligation.amountCents === null
                      ? "Amount unknown"
                      : formatCad(obligation.amountCents)}
                  </strong>
                  <small
                    className={`priority priority-${obligation.status === "overdue" ? "required" : "flexible"}`}
                  >
                    {obligation.status === "overdue"
                      ? "Overdue"
                      : obligation.required
                        ? "Required"
                        : "Upcoming"}
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
