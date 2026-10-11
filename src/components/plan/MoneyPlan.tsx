"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatCad } from "../../domain/money";
import {
  analyzeBudget,
  modelPurchase,
  suggestEmergencyStarter,
  suggestPaychequeSplit,
  type BudgetAllocation,
} from "../../v2/domain/budget";
import {
  BUDGET_CATEGORIES,
  type BudgetCategoryKey,
} from "../../v2/domain/budget-categories";
import {
  deriveRequiredDebtPayments,
  deriveSpendableCashCents,
} from "../../v2/domain/accounts";
import { parseV2CadInput } from "../../v2/domain/money";
import type { PlanningGroup } from "../../v2/domain/planning";
import { parseCalendarDate } from "../../v2/domain/calendar";
import { calculateCategorySpendingHistory } from "../../v2/domain/spending-history";
import type { AllocationRuleId, V2Cents } from "../../v2/domain/types";
import { useFinancialWorkspace } from "../../v2/react/useFinancialWorkspace";
import { SignedInGate } from "../auth/SignedInGate";
import { LoadingState } from "../shared/LoadingState";

const PLAN_CATEGORIES = [
  "housing",
  "utilities",
  "phone-internet",
  "insurance",
  "groceries",
  "restaurants",
  "transportation",
  "health-personal-care",
  "debt-payments",
  "savings-goals",
  "clothing",
  "shopping",
  "subscriptions",
  "entertainment-recreation",
] as const satisfies readonly BudgetCategoryKey[];

const QUESTION_CATEGORIES = PLAN_CATEGORIES.filter(
  (category) => category !== "debt-payments",
);

const GROUP_BY_CATEGORY: Record<
  (typeof PLAN_CATEGORIES)[number],
  PlanningGroup
> = {
  housing: "required-obligations",
  utilities: "required-obligations",
  "phone-internet": "required-obligations",
  insurance: "required-obligations",
  groceries: "essential-flexible",
  restaurants: "lifestyle-flexible",
  transportation: "essential-flexible",
  "health-personal-care": "essential-flexible",
  clothing: "lifestyle-flexible",
  shopping: "lifestyle-flexible",
  subscriptions: "lifestyle-flexible",
  "entertainment-recreation": "lifestyle-flexible",
  "debt-payments": "required-obligations",
  "savings-goals": "protection-reserves",
};

const CATEGORY_QUESTIONS: Record<
  (typeof PLAN_CATEGORIES)[number],
  Readonly<{ question: string; explanation: string; skip: string }>
> = {
  housing: {
    question: "How much do you pay for housing each month?",
    explanation: "Include rent or mortgage and required housing fees.",
    skip: "I do not pay housing costs",
  },
  utilities: {
    question: "How much do you pay for utilities each month?",
    explanation: "Include electricity, water, heating, and similar bills.",
    skip: "Utilities are included or not applicable",
  },
  "phone-internet": {
    question: "How much do phone and internet cost each month?",
    explanation:
      "Include mobile plans, home internet, and required service fees.",
    skip: "No phone or internet cost",
  },
  insurance: {
    question: "How much do you pay for insurance each month?",
    explanation: "Include vehicle, tenant, home, health, or life insurance.",
    skip: "No insurance amount",
  },
  groceries: {
    question: "How much do you spend on groceries each month?",
    explanation: "Use a normal monthly estimate for food bought for home.",
    skip: "I do not pay for groceries",
  },
  restaurants: {
    question: "How much do you want for eating out each month?",
    explanation: "Include restaurants, delivery, coffee, and takeout.",
    skip: "No eating-out amount",
  },
  transportation: {
    question: "How much is transportation each month?",
    explanation: "Include transit, fuel, parking, or regular vehicle costs.",
    skip: "I do not have transportation costs",
  },
  "health-personal-care": {
    question: "How much is health and personal care each month?",
    explanation:
      "Include prescriptions, dental care, toiletries, and similar costs.",
    skip: "No health or personal-care amount",
  },
  "debt-payments": {
    question: "How much would you like to put toward flexible debt?",
    explanation:
      "Required payments are already included. This is an optional extra amount.",
    skip: "No extra payment this time",
  },
  "savings-goals": {
    question: "How much do you want to save or invest each month?",
    explanation: "Include emergency savings, investments, and other goals.",
    skip: "Not right now",
  },
  clothing: {
    question: "How much do you plan for clothing each month?",
    explanation: "Use a monthly average, even if you buy clothes less often.",
    skip: "No clothing amount",
  },
  shopping: {
    question: "How much do you want for shopping each month?",
    explanation:
      "Include online orders, household items, gifts, and non-essential purchases.",
    skip: "No shopping amount",
  },
  subscriptions: {
    question: "How much do subscriptions and memberships cost each month?",
    explanation:
      "Include streaming, apps, software, clubs, and gym memberships.",
    skip: "No subscriptions or memberships",
  },
  "entertainment-recreation": {
    question: "How much do you want for entertainment each month?",
    explanation: "Include hobbies, outings, games, and recreation.",
    skip: "No entertainment amount",
  },
};

function categoryLabel(category: (typeof PLAN_CATEGORIES)[number]): string {
  return category === "savings-goals"
    ? "Savings, investing & goals"
    : BUDGET_CATEGORIES[category];
}

function parseAmount(value: string): V2Cents | null {
  const parsed = parseV2CadInput(value);
  return parsed.ok ? parsed.cents : null;
}

function monthlyCommitmentCents(
  amountCents: V2Cents,
  recurrence: { kind: string },
): number {
  if (recurrence.kind === "weekly") return Math.round((amountCents * 52) / 12);
  if (recurrence.kind === "biweekly")
    return Math.round((amountCents * 26) / 12);
  if (recurrence.kind === "semimonthly") return amountCents * 2;
  return recurrence.kind === "monthly" ? amountCents : 0;
}

function localToday() {
  const date = new Date();
  return parseCalendarDate(
    `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`,
  );
}

export function MoneyPlan() {
  return (
    <section className="section shell app-page plan-page">
      <SignedInGate>
        <MoneyPlanContent />
      </SignedInGate>
    </section>
  );
}

function MoneyPlanContent() {
  const { workspace, loading, error, save } = useFinancialWorkspace();
  const [basis, setBasis] = useState<"available" | "payment">("available");
  const [payment, setPayment] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [purchaseCategory, setPurchaseCategory] =
    useState<BudgetCategoryKey>("groceries");
  const [purchase, setPurchase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [planStep, setPlanStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const restoredPlan = useRef(false);
  const questionCategories = QUESTION_CATEGORIES;

  useEffect(() => {
    if (!workspace || restoredPlan.current) return;
    restoredPlan.current = true;
    const restored: Record<string, string> = {};
    for (const rule of workspace.allocationRules) {
      if (
        rule.enabled &&
        rule.category &&
        rule.strategy.kind === "fixed-amount"
      )
        if (rule.category !== "debt-payments")
          restored[rule.category] = (rule.strategy.amountCents / 100).toFixed(
            2,
          );
    }
    if (Object.keys(restored).length === 0) {
      const commitmentTotals: Record<string, number> = {};
      for (const commitment of workspace.expenseDefinitions) {
        commitmentTotals[commitment.category] =
          (commitmentTotals[commitment.category] ?? 0) +
          monthlyCommitmentCents(commitment.amountCents, commitment.recurrence);
      }
      for (const category of questionCategories) {
        const cents = commitmentTotals[category];
        if (cents !== undefined && cents > 0)
          restored[category] = (cents / 100).toFixed(2);
      }
    }
    setAmounts(restored);
    if (Object.keys(restored).length > 0)
      setPlanStep(questionCategories.length);
  }, [questionCategories.length, workspace]);

  const spendable = workspace
    ? deriveSpendableCashCents(workspace.assetAccounts)
    : null;
  const planningAmount =
    basis === "available" ? spendable : parseAmount(payment);
  const debtPayments = deriveRequiredDebtPayments(
    workspace?.liabilityAccounts ?? [],
  );
  const spendingHistory = useMemo(
    () =>
      calculateCategorySpendingHistory(
        workspace?.expenseEvents ?? [],
        localToday(),
      ),
    [workspace?.expenseEvents],
  );
  const savedBillTotals = useMemo(() => {
    const totals: Partial<Record<BudgetCategoryKey, number>> = {};
    for (const commitment of workspace?.expenseDefinitions ?? [])
      totals[commitment.category] =
        (totals[commitment.category] ?? 0) +
        monthlyCommitmentCents(commitment.amountCents, commitment.recurrence);
    return totals;
  }, [workspace?.expenseDefinitions]);
  const hasMissingDebtPayments = debtPayments.missingAccountIds.length > 0;
  const missingDebtNames = (workspace?.liabilityAccounts ?? [])
    .filter((account) => debtPayments.missingAccountIds.includes(account.id))
    .map((account) => account.name);
  const allocations = useMemo(
    () =>
      PLAN_CATEGORIES.flatMap((category): BudgetAllocation[] => {
        if (category === "debt-payments")
          return [
            {
              category,
              amountCents: debtPayments.totalCents,
            },
          ];
        const cents = parseAmount(amounts[category] ?? "0");
        return cents === null ? [] : [{ category, amountCents: cents }];
      }),
    [amounts, debtPayments.totalCents],
  );
  const invalidAllocation = PLAN_CATEGORIES.some(
    (category) =>
      category !== "debt-payments" &&
      parseAmount(amounts[category] ?? "0") === null,
  );
  const analysis =
    planningAmount !== null && planningAmount >= 0 && !invalidAllocation
      ? analyzeBudget(planningAmount, allocations, {
          hasDebt:
            debtPayments.totalCents > 0 ||
            debtPayments.missingAccountIds.length > 0,
        })
      : null;
  const purchaseCents = parseAmount(purchase);
  const impact =
    analysis && purchaseCents !== null && purchaseCents > 0
      ? modelPurchase(analysis, purchaseCategory, purchaseCents)
      : null;

  if (loading) return <LoadingState label="Loading your money plan…" />;
  if (error) return <p role="alert">{error}</p>;
  if (!workspace || spendable === null)
    return (
      <section className="plan-empty app-card">
        <span className="plan-empty-icon" aria-hidden="true">
          $
        </span>
        <div>
          <p className="eyebrow">Start here</p>
          <h1>Add your first account</h1>
          <p>Enter a balance so your plan starts with a real amount.</p>
        </div>
        <Link className="button button-primary" href="/accounts">
          Add account
        </Link>
      </section>
    );

  async function savePlan() {
    if (!analysis || !workspace || analysis.unallocatedCents < 0) return;
    const now = new Date().toISOString();
    const unrelatedRules = workspace.allocationRules.filter(
      (rule) => rule.category === undefined,
    );
    const allocationRules = [
      ...unrelatedRules,
      ...analysis.allocations
        .filter((allocation) => allocation.amountCents > 0)
        .map((allocation) => ({
          id: crypto.randomUUID() as AllocationRuleId,
          workspaceId: workspace.id,
          name: BUDGET_CATEGORIES[allocation.category],
          category: allocation.category,
          group:
            GROUP_BY_CATEGORY[
              allocation.category as keyof typeof GROUP_BY_CATEGORY
            ],
          provenance: "user-entered" as const,
          enabled: true,
          strategy: {
            kind: "fixed-amount" as const,
            amountCents: allocation.amountCents,
          },
          createdAt: now,
          updatedAt: now,
        })),
    ];
    await save({ ...workspace, allocationRules, updatedAt: now });
    setMessage(
      "Plan saved in this browser. Use Settings › Save backup to access it from another device.",
    );
  }

  function addEmergencyStarter() {
    if (planningAmount === null || planningAmount <= 0) return;
    const starter = suggestEmergencyStarter(planningAmount);
    setAmounts((current) => ({
      ...current,
      "savings-goals": (starter / 100).toFixed(2),
    }));
    setMessage("Added an editable 5% emergency-savings starting point.");
  }

  function applySuggestedPaychequeSplit() {
    if (basis !== "payment" || planningAmount === null || planningAmount <= 0)
      return;
    const suggestion = suggestPaychequeSplit(
      planningAmount,
      allocations,
      debtPayments.totalCents,
    );
    const nextAmounts: Record<string, string> = {};
    for (const category of questionCategories) nextAmounts[category] = "0.00";
    for (const allocation of suggestion) {
      if (allocation.category !== "debt-payments")
        nextAmounts[allocation.category] = (
          allocation.amountCents / 100
        ).toFixed(2);
    }
    setAmounts(nextAmounts);
    setMessage(
      debtPayments.totalCents > planningAmount
        ? "Required debt payments exceed this payment. Review the draft before using it."
        : "Drafted from the proportions in your monthly plan. Edit any amount before saving.",
    );
  }

  const currentCategory = questionCategories[planStep];

  function continuePlan() {
    if (!currentCategory) return;
    const value = amounts[currentCategory] ?? "";
    if (value.trim() === "") {
      setStepError("Enter an amount or choose the option that does not apply.");
      return;
    }
    if (parseAmount(value) === null) {
      setStepError("Enter a CAD amount with no more than two decimal places.");
      return;
    }
    setStepError(null);
    setPlanStep((current) => Math.min(current + 1, questionCategories.length));
  }

  function skipCurrentCategory() {
    if (!currentCategory) return;
    setAmounts((current) => ({ ...current, [currentCategory]: "0.00" }));
    setStepError(null);
    setPlanStep((current) => Math.min(current + 1, questionCategories.length));
  }

  return (
    <div className="plan-stack">
      <header className="app-page-heading">
        <p className="eyebrow">Plan</p>
        <h1>Plan your money.</h1>
        <p>Add your real costs first, then decide what happens to the rest.</p>
      </header>

      <section className="plan-basis app-card" aria-labelledby="plan-basis">
        <h2 id="plan-basis">What are you planning?</h2>
        <div className="segmented-control" aria-label="Planning basis">
          <button
            type="button"
            aria-pressed={basis === "available"}
            onClick={() => {
              setBasis("available");
            }}
          >
            Available now
          </button>
          <button
            type="button"
            aria-pressed={basis === "payment"}
            onClick={() => {
              setBasis("payment");
            }}
          >
            Next payment
          </button>
        </div>
        {basis === "available" ? (
          <div className="plan-available">
            <span>Spendable across your included accounts</span>
            <strong>{formatCad(spendable)}</strong>
          </div>
        ) : (
          <label className="plan-money-field">
            <span>
              Expected take-home payment
              <small>
                Enter the amount that reaches your account after tax.
              </small>
            </span>
            <span className="money-input-wrap plan-payment-input">
              <span>$</span>
              <input
                inputMode="decimal"
                aria-label="Expected take-home payment"
                value={payment}
                onChange={(event) => {
                  setPayment(event.target.value);
                }}
                placeholder="0.00"
              />
              <span>CAD</span>
            </span>
          </label>
        )}
        {basis === "payment" &&
          planningAmount !== null &&
          planningAmount > 0 && (
            <>
              {planStep >= questionCategories.length &&
              allocations.some(
                (allocation) =>
                  allocation.category !== "debt-payments" &&
                  allocation.amountCents > 0,
              ) ? (
                <div className="starter-suggestion payment-split-suggestion">
                  <div>
                    <strong>Split this payment using your plan</strong>
                    <span>
                      NorthCents uses your own category proportions and includes
                      required debt payments. You can change every amount.
                    </span>
                  </div>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={applySuggestedPaychequeSplit}
                  >
                    Create suggested split
                  </button>
                </div>
              ) : (
                <div className="starter-suggestion">
                  <div>
                    <strong>Start an emergency cushion</strong>
                    <span>
                      Add 5% of this payment as an editable starting point—not a
                      rule.
                    </span>
                  </div>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={addEmergencyStarter}
                  >
                    Add {formatCad(suggestEmergencyStarter(planningAmount))}
                  </button>
                </div>
              )}
              <p className="plan-transfer-note">
                This creates category envelopes only. NorthCents does not move
                money between your accounts.
              </p>
            </>
          )}
      </section>

      {currentCategory ? (
        <section className="app-card plan-question" aria-live="polite">
          <div className="plan-progress">
            <span>
              Step {planStep + 1} of {questionCategories.length}
            </span>
            <progress value={planStep + 1} max={questionCategories.length}>
              {planStep + 1} of {questionCategories.length}
            </progress>
          </div>
          <p className="eyebrow">{categoryLabel(currentCategory)}</p>
          <h2>{CATEGORY_QUESTIONS[currentCategory].question}</h2>
          <p className="plan-question-help">
            {CATEGORY_QUESTIONS[currentCategory].explanation}
          </p>
          <label className="plan-question-input">
            Monthly amount
            <span className="money-input">
              <span>$</span>
              <input
                inputMode="decimal"
                aria-label={`${BUDGET_CATEGORIES[currentCategory]} amount`}
                value={amounts[currentCategory] ?? ""}
                onChange={(event) => {
                  setAmounts({
                    ...amounts,
                    [currentCategory]: event.target.value,
                  });
                  setStepError(null);
                }}
                placeholder="0.00"
                autoFocus
              />
            </span>
          </label>
          {stepError && (
            <p className="form-error" role="alert">
              {stepError}
            </p>
          )}
          <div className="plan-question-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={skipCurrentCategory}
            >
              {CATEGORY_QUESTIONS[currentCategory].skip}
            </button>
            <div>
              {planStep > 0 && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setStepError(null);
                    setPlanStep((current) => Math.max(0, current - 1));
                  }}
                >
                  Back
                </button>
              )}
              <button
                className="button button-primary"
                type="button"
                onClick={continuePlan}
              >
                Continue
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section
            className="app-card plan-review"
            aria-labelledby="plan-review"
          >
            <header>
              <div>
                <p className="eyebrow">
                  {hasMissingDebtPayments ? "Action needed" : "Ready to review"}
                </p>
                <h2 id="plan-review">
                  {hasMissingDebtPayments
                    ? "Finish your debt setup"
                    : "Your monthly plan"}
                </h2>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setMessage(null);
                  setPlanStep(0);
                }}
              >
                Edit answers
              </button>
            </header>
            {hasMissingDebtPayments && (
              <aside className="plan-debt-notice" role="status">
                <div>
                  <strong>
                    Add the required monthly payment for{" "}
                    {missingDebtNames.join(", ")}.
                  </strong>
                  <span>
                    NorthCents cannot calculate your plan accurately from a debt
                    balance alone.
                  </span>
                </div>
                <Link
                  className="button button-primary"
                  href="/accounts"
                  onClick={() => {
                    const firstMissingId = debtPayments.missingAccountIds[0];
                    if (firstMissingId)
                      sessionStorage.setItem(
                        "northcents-edit-debt",
                        firstMissingId,
                      );
                  }}
                >
                  Update debt
                </Link>
              </aside>
            )}
            <ul>
              {PLAN_CATEGORIES.map((category) => {
                const allocation = analysis?.allocations.find(
                  (item) => item.category === category,
                );
                const displayedCents =
                  category === "debt-payments"
                    ? debtPayments.totalCents
                    : (parseAmount(amounts[category] ?? "0") ?? 0);
                const history = spendingHistory[category];
                const savedBills = savedBillTotals[category] ?? 0;
                return (
                  <li key={category}>
                    <div className="plan-category-details">
                      <span>{categoryLabel(category)}</span>
                      {savedBills > 0 && (
                        <small>Saved bills: {formatCad(savedBills)}</small>
                      )}
                      {history.spentThisMonthCents > 0 && (
                        <small>
                          Spent this month:{" "}
                          {formatCad(history.spentThisMonthCents)}
                        </small>
                      )}
                      <small>
                        {history.historicalMonthlyAverageCents === null
                          ? "No spending history yet"
                          : history.completedMonthCount === 1
                            ? `1 month of history: ${formatCad(history.historicalMonthlyAverageCents)}`
                            : `Typical monthly spending: ${formatCad(history.historicalMonthlyAverageCents)}`}
                      </small>
                    </div>
                    <strong>{formatCad(displayedCents)}</strong>
                    <small>
                      {allocation?.shareOfAvailableBasisPoints === null ||
                      allocation === undefined
                        ? "0.0%"
                        : `${(allocation.shareOfAvailableBasisPoints / 100).toFixed(1)}%`}
                    </small>
                  </li>
                );
              })}
            </ul>
          </section>

          {!hasMissingDebtPayments && (
            <>
              {analysis ? (
                <section
                  className="plan-summary"
                  aria-labelledby="plan-summary-heading"
                >
                  <h2 className="sr-only" id="plan-summary-heading">
                    Plan summary
                  </h2>
                  <div>
                    <span>Money selected</span>
                    <strong>{formatCad(analysis.availableCents)}</strong>
                  </div>
                  <div>
                    <span>Planned</span>
                    <strong>{formatCad(analysis.allocatedCents)}</strong>
                  </div>
                  <div data-negative={analysis.unallocatedCents < 0}>
                    <span>
                      {analysis.unallocatedCents < 0
                        ? "Over plan"
                        : "Still available"}
                    </span>
                    <strong>{formatCad(analysis.unallocatedCents)}</strong>
                  </div>
                </section>
              ) : (
                <p className="form-error" role="alert">
                  Enter the money you are planning before saving this plan.
                </p>
              )}

              {analysis && analysis.unallocatedCents < 0 && (
                <aside className="plan-over-warning" role="alert">
                  <strong>This plan needs a change before saving.</strong>
                  <span>
                    Reduce planned amounts by{" "}
                    {formatCad(Math.abs(analysis.unallocatedCents))}, or choose
                    Next payment and enter a larger amount.
                  </span>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      setPlanStep(0);
                      setMessage(null);
                    }}
                  >
                    Edit amounts
                  </button>
                </aside>
              )}

              {analysis && (
                <details className="app-card plan-checks">
                  <summary>Review plan checks</summary>
                  <ol>
                    {analysis.checks.map((check) => (
                      <li key={check.id} data-status={check.status}>
                        <strong>
                          {check.status === "pass"
                            ? "Checked"
                            : check.status === "attention"
                              ? "Review"
                              : "Context"}
                        </strong>
                        <span>{check.message}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              <details className="app-card what-if-card">
                <summary>Test a purchase</summary>
                <p className="plan-help">
                  See the effect without changing your accounts or saved plan.
                </p>
                <div className="what-if-fields">
                  <label>
                    Category
                    <select
                      value={purchaseCategory}
                      onChange={(event) => {
                        setPurchaseCategory(
                          event.target.value as BudgetCategoryKey,
                        );
                      }}
                    >
                      {PLAN_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabel(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Purchase amount
                    <span className="money-input">
                      <span>$</span>
                      <input
                        inputMode="decimal"
                        value={purchase}
                        onChange={(event) => {
                          setPurchase(event.target.value);
                        }}
                        placeholder="0.00"
                      />
                    </span>
                  </label>
                </div>
                {impact && (
                  <div className="purchase-result" role="status">
                    <p>
                      Money after purchase:{" "}
                      <strong>
                        {formatCad(impact.remainingAvailableCents)}
                      </strong>
                    </p>
                    {impact.categoryRemainingCents === null ? (
                      <p>No amount is planned for this category.</p>
                    ) : (
                      <p>
                        Category amount after purchase:{" "}
                        <strong>
                          {formatCad(impact.categoryRemainingCents)}
                        </strong>
                      </p>
                    )}
                    {(impact.exceedsAvailable ||
                      impact.exceedsCategoryPlan) && (
                      <p className="form-error">
                        This modeled purchase exceeds{" "}
                        {impact.exceedsAvailable
                          ? "the selected money"
                          : "this category amount"}
                        .
                      </p>
                    )}
                    <small>
                      This is a temporary model. It does not move or spend
                      money.
                    </small>
                  </div>
                )}
              </details>

              <details className="app-card benchmark-card">
                <summary>Canadian reference context</summary>
                <p>
                  Statistics Canada’s 2023 household survey reported food at
                  15.7% of consumption, recreation near 6.8%, and clothing near
                  3.6%. These are dated household averages—not targets for you.
                </p>
                <p>
                  FCAC says needs differ by person and suggests gradually
                  building an emergency fund toward 3–6 months of regular
                  expenses when possible. Its first-job guidance suggests
                  starting with 5–10% of each paycheque; NorthCents&apos;
                  optional starter uses the lower 5% figure.
                </p>
                <div className="benchmark-links">
                  <a
                    href="https://www150.statcan.gc.ca/n1/daily-quotidien/250521/dq250521a-eng.htm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Statistics Canada, 2023 spending survey
                  </a>
                  <a
                    href="https://www.canada.ca/en/financial-consumer-agency/services/make-budget.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    FCAC budgeting guidance
                  </a>
                  <a
                    href="https://www.canada.ca/en/financial-consumer-agency/services/savings-investments/setting-up-emergency-funds.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    FCAC emergency-fund guidance
                  </a>
                  <a
                    href="https://www.canada.ca/en/financial-consumer-agency/services/first-job.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    FCAC first-paycheque guidance
                  </a>
                </div>
              </details>

              <button
                className="button button-primary"
                type="button"
                disabled={!analysis || analysis.unallocatedCents < 0}
                onClick={() => void savePlan()}
              >
                Save plan
              </button>
              {message && (
                <p className="save-message" role="status">
                  {message}
                </p>
              )}
              <p className="plan-storage-note">
                Plans stay in this browser on this device. To use the same data
                on another phone or computer, open Settings and choose Save
                backup, then restore it after signing in there.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
