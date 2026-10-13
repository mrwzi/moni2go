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
  PLAN_CATEGORY_KEYS,
  type BudgetCategoryKey,
} from "../../v2/domain/budget-categories";
import { createCategoryBudgetGuidance } from "../../v2/domain/budget-guidance";
import {
  deriveRequiredDebtPayments,
  deriveSpendableCashCents,
} from "../../v2/domain/accounts";
import { asV2Cents, parseV2CadInput } from "../../v2/domain/money";
import type { PlanningGroup } from "../../v2/domain/planning";
import { parseCalendarDate } from "../../v2/domain/calendar";
import { calculateCategorySpendingHistory } from "../../v2/domain/spending-history";
import type { AllocationRuleId, V2Cents } from "../../v2/domain/types";
import { useFinancialWorkspace } from "../../v2/react/useFinancialWorkspace";
import { SignedInGate } from "../auth/SignedInGate";
import { LoadingState } from "../shared/LoadingState";

const QUESTION_CATEGORIES = PLAN_CATEGORY_KEYS.filter(
  (category) => category !== "debt-payments",
);

const GROUP_BY_CATEGORY: Record<
  (typeof PLAN_CATEGORY_KEYS)[number],
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
  (typeof PLAN_CATEGORY_KEYS)[number],
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

function categoryLabel(category: (typeof PLAN_CATEGORY_KEYS)[number]): string {
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
      <SignedInGate variant="plan">
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
    useState<(typeof PLAN_CATEGORY_KEYS)[number]>("groceries");
  const [purchase, setPurchase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [planStep, setPlanStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const restoredPlan = useRef(false);
  const savingPlan = useRef(false);
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
    if (Object.keys(restored).length > 0) {
      setPlanStep(questionCategories.length);
      setEditingPlan(false);
    } else setEditingPlan(true);
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
      PLAN_CATEGORY_KEYS.flatMap((category): BudgetAllocation[] => {
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
  const invalidAllocation = PLAN_CATEGORY_KEYS.some(
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
  const categoryGuidance = useMemo(
    () =>
      PLAN_CATEGORY_KEYS.map((category) => {
        const planCents =
          category === "debt-payments"
            ? debtPayments.totalCents
            : (parseAmount(amounts[category] ?? "0") ?? asV2Cents(0));
        const history = spendingHistory[category];
        return createCategoryBudgetGuidance({
          category,
          planCents,
          spentThisMonthCents: history.spentThisMonthCents,
          historicalAverageCents: history.historicalMonthlyAverageCents,
        });
      }).filter((guidance) => guidance.level !== "under"),
    [amounts, debtPayments.totalCents, spendingHistory],
  );
  const purchaseCents = parseAmount(purchase);
  const impact =
    analysis && purchaseCents !== null && purchaseCents > 0
      ? modelPurchase(analysis, purchaseCategory, purchaseCents)
      : null;

  useEffect(() => {
    if (editingPlan && planStep >= questionCategories.length) void savePlan();
  }, [editingPlan, planStep]);

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
    if (!workspace || invalidAllocation || savingPlan.current) return;
    savingPlan.current = true;
    const now = new Date().toISOString();
    const unrelatedRules = workspace.allocationRules.filter(
      (rule) => rule.category === undefined,
    );
    const allocationRules = [
      ...unrelatedRules,
      ...allocations
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
    try {
      await save({ ...workspace, allocationRules, updatedAt: now });
      setMessage("Monthly plan updated automatically.");
      setEditingPlan(false);
    } finally {
      savingPlan.current = false;
    }
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

      {editingPlan && (
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
                        moni2go uses your own category proportions and includes
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
                        Add 5% of this payment as an editable starting point—not
                        a rule.
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
                  This creates category envelopes only. moni2go does not move
                  money between your accounts.
                </p>
              </>
            )}
        </section>
      )}

      {editingPlan && currentCategory ? (
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
                  setEditingPlan(true);
                  setPlanStep(0);
                }}
              >
                Edit monthly plan
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
                    moni2go cannot calculate your plan accurately from a debt
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
                        "moni2go-edit-debt",
                        firstMissingId,
                      );
                  }}
                >
                  Update debt
                </Link>
              </aside>
            )}
            <ul>
              {PLAN_CATEGORY_KEYS.filter((category) => {
                const planned =
                  category === "debt-payments"
                    ? debtPayments.totalCents
                    : (parseAmount(amounts[category] ?? "0") ?? 0);
                const history = spendingHistory[category];
                return (
                  planned > 0 ||
                  history.spentThisMonthCents > 0 ||
                  history.historicalMonthlyAverageCents !== null ||
                  (savedBillTotals[category] ?? 0) > 0
                );
              }).map((category) => {
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
                      {history.historicalMonthlyAverageCents !== null && (
                        <small>
                          {history.completedMonthCount === 1
                            ? `Last month: ${formatCad(history.historicalMonthlyAverageCents)}`
                            : `Typical: ${formatCad(history.historicalMonthlyAverageCents)}`}
                        </small>
                      )}
                    </div>
                    <strong>{formatCad(displayedCents)}</strong>
                  </li>
                );
              })}
            </ul>
            {PLAN_CATEGORY_KEYS.some((category) => {
              const planned =
                category === "debt-payments"
                  ? debtPayments.totalCents
                  : (parseAmount(amounts[category] ?? "0") ?? 0);
              const history = spendingHistory[category];
              return (
                planned === 0 &&
                history.spentThisMonthCents === 0 &&
                history.historicalMonthlyAverageCents === null &&
                (savedBillTotals[category] ?? 0) === 0
              );
            }) && (
              <details className="plan-inactive-categories">
                <summary>Show unused categories</summary>
                <p>
                  Every category remains available for purchases, history, and
                  future planning.
                </p>
                <ul>
                  {PLAN_CATEGORY_KEYS.filter((category) => {
                    const planned =
                      category === "debt-payments"
                        ? debtPayments.totalCents
                        : (parseAmount(amounts[category] ?? "0") ?? 0);
                    const history = spendingHistory[category];
                    return (
                      planned === 0 &&
                      history.spentThisMonthCents === 0 &&
                      history.historicalMonthlyAverageCents === null &&
                      (savedBillTotals[category] ?? 0) === 0
                    );
                  }).map((category) => (
                    <li key={category}>
                      <span>{categoryLabel(category)}</span>
                      <strong>{formatCad(0)}</strong>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {categoryGuidance.length > 0 && (
            <section
              className="app-card budget-guidance"
              aria-labelledby="budget-guidance-heading"
            >
              <div>
                <p className="eyebrow">This month</p>
                <h2 id="budget-guidance-heading">Budget guidance</h2>
                <p>Only categories that need attention appear here.</p>
              </div>
              <ul>
                {categoryGuidance.map((guidance) => (
                  <li key={guidance.category} data-level={guidance.level}>
                    <strong>
                      {guidance.level === "over" ? "Review" : "Near plan"}
                    </strong>
                    <span>
                      {categoryLabel(guidance.category)}:{" "}
                      {formatCad(
                        spendingHistory[guidance.category].spentThisMonthCents,
                      )}{" "}
                      spent of{" "}
                      {formatCad(
                        guidance.category === "debt-payments"
                          ? debtPayments.totalCents
                          : (parseAmount(amounts[guidance.category] ?? "0") ??
                              0),
                      )}{" "}
                      planned.
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
                    <span>Available now</span>
                    <strong>{formatCad(analysis.availableCents)}</strong>
                  </div>
                  <div>
                    <span>Planned</span>
                    <strong>{formatCad(analysis.allocatedCents)}</strong>
                  </div>
                  <div>
                    <span>Spent this month</span>
                    <strong>
                      {formatCad(
                        PLAN_CATEGORY_KEYS.reduce(
                          (total, category) =>
                            total +
                            spendingHistory[category].spentThisMonthCents,
                          0,
                        ),
                      )}
                    </strong>
                  </div>
                </section>
              ) : (
                <p className="form-error" role="alert">
                  Enter the money you are planning before saving this plan.
                </p>
              )}

              <details className="app-card purchase-checker">
                <summary>Check a purchase</summary>
                <p className="plan-help">
                  See whether a purchase fits before spending. Nothing is saved.
                </p>
                <div className="purchase-checker-fields">
                  <label>
                    Category
                    <select
                      value={purchaseCategory}
                      onChange={(event) => {
                        setPurchaseCategory(
                          event.target
                            .value as (typeof PLAN_CATEGORY_KEYS)[number],
                        );
                      }}
                    >
                      {PLAN_CATEGORY_KEYS.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabel(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Amount
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
                  <div className="purchase-checker-result" role="status">
                    <span>
                      Money left: {formatCad(impact.remainingAvailableCents)}
                    </span>
                    <strong>
                      {impact.categoryRemainingCents === null
                        ? `No money is planned for ${categoryLabel(purchaseCategory)}.`
                        : `${categoryLabel(purchaseCategory)} left: ${formatCad(impact.categoryRemainingCents)}`}
                    </strong>
                    {(impact.exceedsAvailable ||
                      impact.exceedsCategoryPlan) && (
                      <small>
                        This purchase does not fit the current plan.
                      </small>
                    )}
                  </div>
                )}
              </details>

              {message && (
                <p className="save-message" role="status">
                  {message}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
