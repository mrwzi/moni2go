import {
  BUDGET_CATEGORIES,
  PLAN_ADJUSTMENT_ORDER,
  PLAN_CATEGORY_PRIORITIES,
  type BudgetCategoryKey,
  type BudgetGuidancePriority,
  type PlanCategoryKey,
} from "./budget-categories";
import { asV2Cents } from "./money";
import type { V2Cents } from "./types";

/**
 * Centralized guidance tolerances:
 * - 90% of plan is "near" so the UI can give a quiet heads-up.
 * - An overage is meaningful only above both $5 and 5% of plan.
 * - Current spending is "close to typical" within both $10 and 10% of history.
 * These are product guidance thresholds, not financial rules.
 */
export const BUDGET_GUIDANCE_THRESHOLDS = {
  nearPlanBasisPoints: 9_000,
  meaningfulOverageBasisPoints: 500,
  minimumMeaningfulOverageCents: 500,
  historicalAlignmentBasisPoints: 1_000,
  minimumHistoricalAlignmentCents: 1_000,
} as const;

export type BudgetGuidanceLevel = "under" | "near" | "over";
export type HistoricalBudgetContext =
  "unavailable" | "supports-plan" | "plan-may-be-low" | "unusual-this-month";

export type CategoryBudgetGuidance = Readonly<{
  category: PlanCategoryKey;
  priority: BudgetGuidancePriority;
  level: BudgetGuidanceLevel;
  overByCents: V2Cents;
  historicalContext: HistoricalBudgetContext;
  message: string | null;
}>;

function percentageOf(cents: number, basisPoints: number): number {
  return Math.round((cents * basisPoints) / 10_000);
}

function formatCad(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function meaningfulTolerance(planCents: V2Cents): number {
  return Math.max(
    BUDGET_GUIDANCE_THRESHOLDS.minimumMeaningfulOverageCents,
    percentageOf(
      planCents,
      BUDGET_GUIDANCE_THRESHOLDS.meaningfulOverageBasisPoints,
    ),
  );
}

function historicalContext(
  planCents: V2Cents,
  spentCents: V2Cents,
  historicalAverageCents: V2Cents | null,
): HistoricalBudgetContext {
  if (historicalAverageCents === null) return "unavailable";
  const planTolerance = meaningfulTolerance(planCents);
  const historyTolerance = Math.max(
    BUDGET_GUIDANCE_THRESHOLDS.minimumHistoricalAlignmentCents,
    percentageOf(
      historicalAverageCents,
      BUDGET_GUIDANCE_THRESHOLDS.historicalAlignmentBasisPoints,
    ),
  );
  if (
    historicalAverageCents > planCents + planTolerance &&
    Math.abs(spentCents - historicalAverageCents) <= historyTolerance
  )
    return "plan-may-be-low";
  if (spentCents > historicalAverageCents + historyTolerance)
    return "unusual-this-month";
  return "supports-plan";
}

function overMessage(
  category: PlanCategoryKey,
  priority: BudgetGuidancePriority,
  planCents: V2Cents,
  spentCents: V2Cents,
  overByCents: V2Cents,
  context: HistoricalBudgetContext,
): string {
  const label = BUDGET_CATEGORIES[category];
  const amounts = `You planned ${formatCad(planCents)} for ${label.toLowerCase()} and have spent ${formatCad(spentCents)}. You are ${formatCad(overByCents)} over plan.`;
  const typical =
    context === "plan-may-be-low"
      ? " This is close to your usual monthly spending, so the plan may be lower than realistic."
      : context === "unusual-this-month"
        ? " This is also above your usual monthly spending."
        : "";

  switch (priority) {
    case "essential":
      return `${label} is ${formatCad(overByCents)} above your current plan.${typical} If this reflects your normal required cost, update the plan and review flexible categories elsewhere.`;
    case "semi-flexible":
      if (category === "groceries")
        return `Groceries are ${formatCad(overByCents)} above your monthly plan.${typical} If food costs have increased, consider updating the grocery budget. When appropriate, review flexible categories before cutting essential food spending.`;
      return `${label} is ${formatCad(overByCents)} above your current plan.${typical} If this spending was necessary, update the plan; otherwise, review flexible spending for the rest of the month.`;
    case "required-debt":
      return `Required debt payments are ${formatCad(overByCents)} above the current plan.${typical} Do not skip a required payment; consider reducing flexible categories or updating the rest of the plan.`;
    case "financial-goal":
      return `Savings and goal contributions are ${formatCad(overByCents)} above the amount planned.${typical} Keep the goal if it remains affordable, or adjust it after protecting essential costs and required debt payments.`;
    case "discretionary":
      return `${amounts}${typical} Consider reducing upcoming discretionary spending or updating the plan if the original amount was unrealistic.`;
  }
}

export function createCategoryBudgetGuidance(
  input: Readonly<{
    category: PlanCategoryKey;
    planCents: V2Cents;
    spentThisMonthCents: V2Cents;
    historicalAverageCents: V2Cents | null;
  }>,
): CategoryBudgetGuidance {
  const { category, planCents, spentThisMonthCents } = input;
  const priority = PLAN_CATEGORY_PRIORITIES[category];
  const overBy = Math.max(0, spentThisMonthCents - planCents);
  const tolerance = meaningfulTolerance(planCents);
  const context = historicalContext(
    planCents,
    spentThisMonthCents,
    input.historicalAverageCents,
  );
  if (overBy > tolerance) {
    const overByCents = asV2Cents(overBy);
    return {
      category,
      priority,
      level: "over",
      overByCents,
      historicalContext: context,
      message: overMessage(
        category,
        priority,
        planCents,
        spentThisMonthCents,
        overByCents,
        context,
      ),
    };
  }

  const nearThreshold = percentageOf(
    planCents,
    BUDGET_GUIDANCE_THRESHOLDS.nearPlanBasisPoints,
  );
  const near =
    spentThisMonthCents > 0 &&
    (spentThisMonthCents >= nearThreshold || overBy > 0);
  return {
    category,
    priority,
    level: near ? "near" : "under",
    overByCents: asV2Cents(overBy),
    historicalContext: context,
    message: near
      ? overBy > 0
        ? `${BUDGET_CATEGORIES[category]} is ${formatCad(overBy)} above plan, within the current guidance tolerance.`
        : `${BUDGET_CATEGORIES[category]} is close to its ${formatCad(planCents)} monthly plan.`
      : null,
  };
}

/** Returns user-controlled categories in the documented review order. */
export function prioritizePlanAdjustments(
  allocations: readonly Readonly<{
    category: BudgetCategoryKey;
    amountCents: V2Cents;
  }>[],
): readonly PlanCategoryKey[] {
  const positive = new Set(
    allocations
      .filter((allocation) => allocation.amountCents > 0)
      .map((allocation) => allocation.category),
  );
  return PLAN_ADJUSTMENT_ORDER.filter((category) => {
    const priority = PLAN_CATEGORY_PRIORITIES[category];
    return (
      positive.has(category) &&
      (priority === "discretionary" || priority === "financial-goal")
    );
  });
}
