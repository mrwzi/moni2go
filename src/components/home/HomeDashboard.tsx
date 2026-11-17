"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCad } from "../../domain/money";
import {
  deriveNetWorthCents,
  deriveSpendableCashCents,
  deriveTotalLiabilitiesCents,
} from "../../v2/domain/accounts";
import { BUDGET_CATEGORIES } from "../../v2/domain/budget-categories";
import {
  calendarDateParts,
  daysInMonth,
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

const CATEGORY_MARKERS: Readonly<Record<string, string>> = {
  housing: "⌂",
  utilities: "ϟ",
  groceries: "🛒",
  restaurants: "🍽️",
  transportation: "↗",
  education: "📚",
  clothing: "👕",
  shopping: "🛍️",
  subscriptions: "↻",
  insurance: "◇",
  "phone-internet": "⌁",
  "health-personal-care": "+",
  "entertainment-recreation": "☆",
  other: "•",
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
  const [showAllCategories, setShowAllCategories] = useState(false);
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
  const activeMission = coachingWarnings[0];
  const plannedCategory = [...spending.categoryProgress]
    .filter((item) => item.plannedCents > 0)
    .sort(
      (left, right) =>
        right.spentCents / right.plannedCents -
        left.spentCents / left.plannedCents,
    )[0];
  const buddyCategory = activeMission ?? coachingWin ?? plannedCategory;
  const buddyCopy = buddyCategory
    ? buddyCategory.status === "over"
      ? {
          title:
            buddyCategory.category === "restaurants"
              ? "Your kitchen misses you 🍳"
              : buddyCategory.category === "clothing"
                ? "Your wardrobe says we're full 👕"
                : `${BUDGET_CATEGORIES[buddyCategory.category]} needs a breather`,
          text: `${formatCad(Math.abs(buddyCategory.differenceCents))} over plan. A small pause can get you back on track.`,
        }
      : buddyCategory.status === "unplanned"
        ? {
            title: "Give this category a little room",
            text: `${formatCad(buddyCategory.spentCents)} spent so far with no amount planned yet.`,
          }
        : {
            title: "Your plan is ready—nice and steady",
            text: `${BUDGET_CATEGORIES[buddyCategory.category]} has room left this month.`,
          }
    : null;
  const showUrgentRecommendation = recommendation.priority <= 2;
  const activeLimitCategories = [...spending.categoryProgress]
    .filter((item) => item.spentCents > 0 || item.plannedCents > 0)
    .sort((left, right) => {
      const leftRatio =
        left.plannedCents > 0 ? left.spentCents / left.plannedCents : 2;
      const rightRatio =
        right.plannedCents > 0 ? right.spentCents / right.plannedCents : 2;
      return rightRatio - leftRatio;
    });
  const visibleLimitCategories = showAllCategories
    ? activeLimitCategories
    : activeLimitCategories.slice(0, 5);
  const hiddenCategoryCount = Math.max(
    0,
    activeLimitCategories.length - visibleLimitCategories.length,
  );
  const savingsPlanCents = workspace.allocationRules
    .filter(
      (rule) =>
        rule.enabled &&
        rule.category === "savings-goals" &&
        rule.strategy.kind === "fixed-amount",
    )
    .reduce(
      (total, rule) =>
        total +
        (rule.strategy.kind === "fixed-amount" ? rule.strategy.amountCents : 0),
      0,
    );
  const todayParts = calendarDateParts(today);
  const monthDays = daysInMonth(todayParts.year, todayParts.month);
  const daysRemaining = Math.max(0, monthDays - todayParts.day);
  const monthLabel = new Intl.DateTimeFormat("en-CA", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(todayParts.year, todayParts.month - 1, 1)));
  const hasSpendingPlan = spending.spendingPlanCents > 0;
  const remainingBudgetCents = hasSpendingPlan
    ? Math.max(0, spending.planDifferenceCents)
    : null;
  const forecast = insights.forecasts[forecastDays];
  const recommendationObligation =
    recommendation.priority === 1
      ? insights.obligations.find(
          (item) => item.required && item.status === "overdue",
        )
      : undefined;
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
  const buddySentence = showUrgentRecommendation
    ? `${recommendation.title}${recommendation.amountCents !== null ? ` · ${formatCad(recommendation.amountCents)}` : ""}. ${recommendation.explanation}`
    : buddyCopy
      ? buddyCopy.title.includes("kitchen") ||
        buddyCopy.title.includes("wardrobe")
        ? buddyCopy.title
        : `${buddyCopy.title}. ${buddyCopy.text}`
      : "Your budget is ready. Let’s make every dollar count! 🌱";
  const buddyActionHref = recommendationObligation
    ? recommendationObligation.kind === "debt-payment"
      ? `/accounts#account-${recommendationObligation.sourceId}`
      : "/accounts#bills-commitments"
    : recommendation.actionHref;
  const categoryProgressLabel = (
    item: (typeof activeLimitCategories)[number],
  ) =>
    item.status === "unplanned"
      ? `${formatCad(item.spentCents)} recorded`
      : item.status === "over"
        ? `${formatCad(Math.abs(item.differenceCents))} over`
        : `${formatCad(Math.max(0, item.differenceCents))} left`;
  return (
    <div className="home-redesign">
      <header className="home-friendly-header">
        <p className="eyebrow">Home</p>
        <h1>Your money today 👋</h1>
        <p>
          {new Intl.DateTimeFormat("en-CA", {
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(new Date())}
        </p>
      </header>

      <section className="home-overview-card" aria-label="Available money">
        <span className="home-overview-label">Available now</span>
        <strong className="home-overview-amount">
          {formatCad(spendableCashCents)}
        </strong>
        <div className="home-overview-divider" />
        <div className="home-overview-secondary">
          <div>
            <span>Net worth</span>
            <strong>
              {formatCad(deriveNetWorthCents(assets, liabilities))}
            </strong>
          </div>
          <div>
            <span>Owed</span>
            <strong>
              {formatCad(deriveTotalLiabilitiesCents(liabilities))}
            </strong>
          </div>
        </div>
      </section>

      <nav className="home-quick-actions" aria-label="Money actions">
        <Link href="/accounts#add-income">
          <span aria-hidden="true">⊕</span>
          <strong>Add income</strong>
        </Link>
        <Link href="/accounts#record-expense">
          <span aria-hidden="true">⊖</span>
          <strong>Expense</strong>
        </Link>
        <Link href="/accounts#move-money">
          <span aria-hidden="true">⇄</span>
          <strong>Transfer</strong>
        </Link>
      </nav>

      <section className="home-buddy-card" aria-label="Money Buddy">
        <span className="home-buddy-icon" aria-hidden="true">
          ◉
        </span>
        <div>
          <p className="eyebrow">Money Buddy</p>
          <p>{buddySentence}</p>
          {showUrgentRecommendation && (
            <Link href={buddyActionHref}>{recommendation.actionLabel}</Link>
          )}
        </div>
      </section>

      <section
        className="home-limits-card"
        aria-labelledby="home-limits-heading"
      >
        <div className="home-limits-heading">
          <div>
            <h2 id="home-limits-heading">Your money limits 🔋</h2>
            <p>{monthLabel} budget · Recorded spending</p>
          </div>
          <span className="home-days-left">
            <strong>{daysRemaining}</strong>
            <small>days left</small>
          </span>
        </div>
        <div className="home-limits-summary">
          <div>
            <strong>
              {remainingBudgetCents === null
                ? "—"
                : formatCad(remainingBudgetCents)}
            </strong>
            <span>Spending budget remaining</span>
          </div>
          <div>
            <strong>{formatCad(spending.spentThisMonthCents)}</strong>
            <span>recorded spent</span>
          </div>
        </div>
        {activeLimitCategories.length > 0 ? (
          <div
            className="home-limit-list"
            aria-label="Category budget progress"
          >
            {visibleLimitCategories.map((item) => {
              const remainingPercent =
                item.plannedCents > 0
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        ((item.plannedCents - item.spentCents) /
                          item.plannedCents) *
                          100,
                      ),
                    )
                  : 0;
              return (
                <div className="home-limit-row" key={item.category}>
                  <div className="home-limit-row-label">
                    <span>
                      <span className="home-category-marker" aria-hidden="true">
                        {CATEGORY_MARKERS[item.category] ?? "•"}
                      </span>{" "}
                      {BUDGET_CATEGORIES[item.category]}
                    </span>
                    <strong
                      className={item.status === "over" ? "money-negative" : ""}
                    >
                      {categoryProgressLabel(item)}
                    </strong>
                  </div>
                  <div
                    className={`home-limit-track${item.status === "over" ? " is-over" : ""}`}
                    aria-hidden="true"
                  >
                    <span
                      className={item.status === "over" ? "is-over" : ""}
                      style={{ width: `${remainingPercent.toFixed(1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="home-limits-empty">
            Set a monthly plan to give every category a clear limit.
          </p>
        )}
        {hiddenCategoryCount > 0 && (
          <button
            className="home-show-more"
            type="button"
            onClick={() => {
              setShowAllCategories((value) => !value);
            }}
          >
            {showAllCategories
              ? "Show fewer categories"
              : `Show all categories (${String(activeLimitCategories.length)})`}
          </button>
        )}
        {savingsPlanCents > 0 && (
          <div className="home-savings-row">
            <span>🐷 Savings plan</span>
            <strong>{formatCad(savingsPlanCents)} planned</strong>
          </div>
        )}
        <Link className="home-plan-link" href="/plan">
          Manage monthly plan <span aria-hidden="true">›</span>
        </Link>
        <small className="home-limits-note">
          Bars show recorded budget remaining, not verified unspent cash.
        </small>
      </section>

      <section
        className="home-outlook-compact"
        aria-labelledby="home-outlook-heading"
      >
        <div className="home-outlook-compact-heading">
          <div>
            <p className="eyebrow">Looking ahead</p>
            <h2 id="home-outlook-heading">Financial outlook</h2>
          </div>
          <span>{forecastDays} days</span>
        </div>
        <div className="home-outlook-compact-value" aria-live="polite">
          <span>
            {forecast.estimatedOutflowCents === null
              ? "Available now"
              : "Projected available"}
          </span>
          <strong className={forecast.endCashCents < 0 ? "money-negative" : ""}>
            {formatCad(forecast.endCashCents)}
          </strong>
        </div>
        {forecast.shortageDate && (
          <p className="outlook-warning" role="status">
            Cash may fall below $0 by {readableDate(forecast.shortageDate)}.
          </p>
        )}
        {forecast.estimatedOutflowCents === null && (
          <p className="home-outlook-caveat" role="status">
            Everyday spending isn’t estimated yet.
          </p>
        )}
        <details className="home-outlook-details">
          <summary>Forecast details</summary>
          <div className="home-forecast-tabs" aria-label="Forecast period">
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
          <dl className="home-outlook-details-grid">
            <div>
              <dt>Scheduled income</dt>
              <dd>
                {forecast.scheduledIncomeCents === 0
                  ? "None scheduled"
                  : formatCad(forecast.scheduledIncomeCents)}
              </dd>
            </div>
            <div>
              <dt>Payments</dt>
              <dd>{formatCad(forecast.scheduledOutflowCents)}</dd>
            </div>
            <div>
              <dt>Spending</dt>
              <dd>
                {forecast.estimatedOutflowCents === null
                  ? "Unknown"
                  : formatCad(forecast.estimatedOutflowCents)}
              </dd>
            </div>
          </dl>
          {forecastsAreIdentical && (
            <p>The periods match because no later dated activity is saved.</p>
          )}
          {forecast.unknowns.length > 0 && <p>{forecast.unknowns[0]}</p>}
          <p>Estimates are informational. moni2go never moves money.</p>
        </details>
      </section>
    </div>
  );
}
