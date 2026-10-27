"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCad } from "../../domain/money";
import {
  deriveNetWorthCents,
  deriveInvestmentAssetsCents,
  deriveSpendableCashCents,
  deriveTotalOwnedCents,
  deriveTotalLiabilitiesCents,
} from "../../v2/domain/accounts";
import { BUDGET_CATEGORIES } from "../../v2/domain/budget-categories";
import type { BudgetCategoryKey } from "../../v2/domain/budget-categories";
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

const CATEGORY_COACHING: Readonly<
  Record<
    BudgetCategoryKey,
    Readonly<{ icon: string; title: string; tip: string }>
  >
> = {
  housing: {
    icon: "⌂",
    title: "Keep housing steady",
    tip: "Review housing costs before adding a new commitment.",
  },
  utilities: {
    icon: "ϟ",
    title: "Power-down challenge",
    tip: "Switch off unused lights and devices today.",
  },
  groceries: {
    icon: "◎",
    title: "Shop with a list",
    tip: "Take a short list on your next grocery trip.",
  },
  restaurants: {
    icon: "♨",
    title: "Cook-one-meal challenge",
    tip: "Cook one extra meal at home before the next takeout.",
  },
  transportation: {
    icon: "↗",
    title: "Combine one trip",
    tip: "Combine trips or choose a lower-cost option when practical.",
  },
  insurance: {
    icon: "◇",
    title: "Coverage check",
    tip: "Compare plans before renewal without reducing needed coverage.",
  },
  "phone-internet": {
    icon: "⌁",
    title: "Check your plan",
    tip: "See whether your current phone and internet plan still fits.",
  },
  "health-personal-care": {
    icon: "+",
    title: "Protect the essentials",
    tip: "Keep necessary care covered and review optional purchases first.",
  },
  education: {
    icon: "✦",
    title: "Plan the next fee",
    tip: "Add upcoming learning costs before they surprise your plan.",
  },
  subscriptions: {
    icon: "↻",
    title: "Subscription sweep",
    tip: "Pause one service you no longer use.",
  },
  "entertainment-recreation": {
    icon: "☆",
    title: "Find a low-cost win",
    tip: "Try a lower-cost activity before the next outing.",
  },
  clothing: {
    icon: "◌",
    title: "Try a 24-hour pause",
    tip: "Wait a day before a non-essential clothing purchase.",
  },
  shopping: {
    icon: "▣",
    title: "Shopping cooldown",
    tip: "Pause non-essential shopping until the plan resets.",
  },
  "debt-payments": {
    icon: "↓",
    title: "Protect the minimum",
    tip: "Keep required payments covered first.",
  },
  "savings-goals": {
    icon: "↑",
    title: "Grow at your pace",
    tip: "Keep the goal realistic for your available cash.",
  },
  other: {
    icon: "?",
    title: "Name that expense",
    tip: "Give this expense a clearer category when possible.",
  },
};

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
  const [missionIndex, setMissionIndex] = useState(0);
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
  const coachingWarnings = [...spending.categoryProgress]
    .filter((item) => item.status !== "within")
    .sort(
      (left, right) =>
        Math.abs(right.differenceCents) - Math.abs(left.differenceCents),
    )
    .slice(0, 3);
  const coachingWin = [...spending.categoryProgress]
    .filter(
      (item) =>
        item.status === "within" &&
        item.spentCents > 0 &&
        item.plannedCents > 0,
    )
    .sort(
      (left, right) =>
        right.spentCents / right.plannedCents -
        left.spentCents / left.plannedCents,
    )[0];
  const activeMission =
    coachingWarnings.length > 0
      ? coachingWarnings[missionIndex % coachingWarnings.length]
      : undefined;
  const forecast = insights.forecasts[forecastDays];
  const hasSpendingPlan = spending.spendingPlanCents > 0;
  const isOverBudget = hasSpendingPlan && spending.planDifferenceCents < 0;
  const budgetUsagePercent = hasSpendingPlan
    ? Math.round(
        (spending.spentThisMonthCents / spending.spendingPlanCents) * 100,
      )
    : null;
  const comparisonTotal = Math.max(
    spending.spendingPlanCents,
    spending.spentThisMonthCents,
  );
  const spentShare =
    comparisonTotal > 0
      ? Math.min(100, (spending.spentThisMonthCents / comparisonTotal) * 100)
      : 0;
  const obligationEnd = addCalendarDays(today, 30);
  const recommendationObligation =
    recommendation.priority === 1
      ? insights.obligations.find(
          (item) => item.required && item.status === "overdue",
        )
      : undefined;
  const visibleObligations = insights.obligations.filter(
    (item) =>
      item.key !== recommendationObligation?.key &&
      (item.status === "overdue" ||
        (item.status === "upcoming" &&
          item.date !== null &&
          compareCalendarDates(item.date, obligationEnd) <= 0)),
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
          <span>Spent this month</span>
          <strong>{formatCad(spending.spentThisMonthCents)}</strong>
        </div>
      </section>
      <details className="account-more-totals home-asset-details">
        <summary>Asset details</summary>
        <section className="account-totals" aria-label="Asset details">
          <div>
            <span>Investments &amp; crypto</span>
            <strong>{formatCad(deriveInvestmentAssetsCents(assets))}</strong>
          </div>
          <div>
            <span>Total owned</span>
            <strong>
              {formatCad(deriveTotalOwnedCents(assets, liabilities))}
            </strong>
          </div>
        </section>
      </details>
      <div className="home-dashboard-overview">
        <section
          className="app-card home-next-step"
          aria-label="Money guidance"
        >
          <p className="eyebrow">Next useful step</p>
          <h2 id="home-next-step-heading">{recommendation.title}</h2>
          {recommendation.amountCents !== null && (
            <strong
              className={`home-next-step-amount${recommendation.priority <= 2 ? " money-negative" : ""}`}
            >
              {formatCad(recommendation.amountCents)}
            </strong>
          )}
          <p className="home-next-step-summary">
            {recommendation.explanation}
            {recommendationObligation?.date
              ? ` Due ${readableDate(recommendationObligation.date)}.`
              : ""}
          </p>
          <Link
            className="button button-primary home-next-step-action"
            href={
              recommendationObligation
                ? recommendationObligation.kind === "debt-payment"
                  ? `/accounts#account-${recommendationObligation.sourceId}`
                  : "/accounts#bills-commitments"
                : recommendation.actionHref
            }
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
              <span>
                {forecast.estimatedOutflowCents === null
                  ? "Known projection"
                  : "Projected available"}
              </span>
              <strong
                className={forecast.endCashCents < 0 ? "money-negative" : ""}
              >
                {formatCad(forecast.endCashCents)}
              </strong>
            </div>
            <div className="outlook-secondary">
              <div>
                <span>Scheduled income</span>
                <strong>
                  {forecast.scheduledIncomeCents === 0
                    ? "None scheduled"
                    : formatCad(forecast.scheduledIncomeCents)}
                </strong>
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
            <div className="outlook-data-warning" role="status">
              <span>
                Everyday spending is unknown and is not subtracted above.
              </span>
              <Link href="/accounts">Add bills or activity</Link>
            </div>
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
              Starts with spendable balances, then applies dated income,
              payments, and reliable spending history in date order. Expected
              income is not guaranteed.
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
      </div>
      <section
        className="app-card home-spending-card"
        aria-labelledby="home-spending-heading"
      >
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">This month</p>
            <h2 id="home-spending-heading">Spending at a glance</h2>
          </div>
          <Link href="/accounts#transaction-history">View activity</Link>
        </div>
        {spending.topCategories.length > 0 ? (
          <div className="home-spending-layout">
            <div
              className={`home-spending-donut${hasSpendingPlan ? "" : " home-spending-donut-unplanned"}${isOverBudget ? " home-spending-donut-over" : ""}`}
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
              </div>
            </div>
            <div className="home-spending-breakdown">
              <div className="home-spending-budget-summary">
                <div>
                  <span>Overall monthly budget</span>
                  <strong className={isOverBudget ? "money-negative" : ""}>
                    {budgetUsagePercent === null
                      ? "Not set"
                      : `${budgetUsagePercent.toString()}% used`}
                  </strong>
                </div>
                {hasSpendingPlan && (
                  <p className={isOverBudget ? "money-negative" : ""}>
                    {formatCad(Math.abs(spending.planDifferenceCents))} overall
                    {isOverBudget ? " over" : " left"}
                  </p>
                )}
              </div>
              <ul>
                {spending.topCategories.map((item) => (
                  <li key={item.category}>
                    <span>{BUDGET_CATEGORIES[item.category]}</span>
                    <strong>{formatCad(item.spentCents)}</strong>
                  </li>
                ))}
              </ul>
              {(coachingWarnings.length > 0 || coachingWin) && (
                <div className="home-money-coach" aria-label="Money coach">
                  <div className="home-money-coach-heading">
                    <div>
                      <small>Today&apos;s money mission</small>
                      <strong>One small move at a time</strong>
                    </div>
                    {coachingWarnings.length > 1 && (
                      <span>
                        {(missionIndex % coachingWarnings.length) + 1} of{" "}
                        {coachingWarnings.length}
                      </span>
                    )}
                  </div>
                  {activeMission &&
                    (() => {
                      const coaching =
                        CATEGORY_COACHING[activeMission.category];
                      return (
                        <article className="home-mission-feature">
                          <span
                            className="home-mission-icon"
                            aria-hidden="true"
                          >
                            {coaching.icon}
                          </span>
                          <div className="home-mission-feature-copy">
                            <small>
                              {activeMission.status === "unplanned"
                                ? "Plan it"
                                : "Try this"}
                            </small>
                            <h3>{coaching.title}</h3>
                            <p>
                              <strong>
                                {activeMission.status === "over"
                                  ? `${formatCad(Math.abs(activeMission.differenceCents))} over in ${BUDGET_CATEGORIES[activeMission.category].toLowerCase()}.`
                                  : `${formatCad(activeMission.spentCents)} wasn't planned.`}
                              </strong>{" "}
                              {coaching.tip}
                            </p>
                          </div>
                          <div className="home-mission-actions">
                            <Link href="/plan">Open plan</Link>
                            {coachingWarnings.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMissionIndex(
                                    (current) =>
                                      (current + 1) % coachingWarnings.length,
                                  );
                                }}
                              >
                                Next mission →
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })()}
                  {coachingWin && (
                    <div className="home-mission-win">
                      <span aria-hidden="true">✓</span>
                      <p>
                        <strong>
                          {BUDGET_CATEGORIES[coachingWin.category]} is on track.
                        </strong>{" "}
                        {formatCad(coachingWin.differenceCents)} remains—nice
                        work.
                      </p>
                    </div>
                  )}
                  <p className="home-mission-note">
                    Based on recorded activity.
                  </p>
                </div>
              )}
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
                      ? `${obligation.required ? "Required" : "Optional"} · ${dueLabel(today, obligation.date)} · ${readableDate(obligation.date)}`
                      : "Date unknown"}
                  </small>
                </span>
                <span>
                  <strong>
                    {obligation.remainingCents === null
                      ? "Amount unknown"
                      : formatCad(obligation.remainingCents)}
                  </strong>
                  <small>
                    {obligation.kind === "debt-payment"
                      ? obligation.paidCents > 0
                        ? `${formatCad(obligation.paidCents)} paid toward minimum`
                        : "Minimum payment due"
                      : obligation.paidCents > 0
                        ? `${formatCad(obligation.paidCents)} paid toward bill`
                        : "Bill amount due"}
                  </small>
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
            <p>
              For cards, the reminder uses the minimum payment you entered—not
              the full balance. Statement balances are not stored separately.
            </p>
          </details>
        </section>
      )}
    </div>
  );
}
