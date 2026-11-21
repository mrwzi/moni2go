export const BUDGET_CATEGORIES = {
  housing: "Housing",
  utilities: "Utilities",
  groceries: "Groceries",
  drinks: "Drinks & coffee",
  restaurants: "Restaurants / eating out",
  transportation: "Transportation",
  insurance: "Insurance",
  "phone-internet": "Phone / internet",
  "health-personal-care": "Health / personal care",
  education: "Education",
  subscriptions: "Subscriptions",
  "entertainment-recreation": "Entertainment / recreation",
  clothing: "Clothing",
  shopping: "Shopping",
  "debt-payments": "Debt payments",
  "savings-goals": "Savings & goals",
  other: "Other",
} as const;
export type BudgetCategoryKey = keyof typeof BUDGET_CATEGORIES;
export const BUDGET_CATEGORY_KEYS = Object.keys(
  BUDGET_CATEGORIES,
) as readonly BudgetCategoryKey[];

export const PLAN_CATEGORY_KEYS = [
  "housing",
  "utilities",
  "phone-internet",
  "insurance",
  "groceries",
  "drinks",
  "restaurants",
  "transportation",
  "health-personal-care",
  "education",
  "debt-payments",
  "savings-goals",
  "clothing",
  "shopping",
  "subscriptions",
  "entertainment-recreation",
] as const satisfies readonly BudgetCategoryKey[];

export type PlanCategoryKey = (typeof PLAN_CATEGORY_KEYS)[number];

/**
 * Shared thresholds for the lightweight budget coaching UI.
 * These values describe how close recorded spending is to a planned limit;
 * they do not change any budget calculations or prevent purchases.
 */
export const BUDGET_PROGRESS_THRESHOLDS = {
  attention: 0.7,
  caution: 0.9,
  over: 1,
} as const;

export type BudgetProgressLevel =
  "unplanned" | "calm" | "attention" | "caution" | "over";

export function getBudgetProgressLevel(
  spentCents: number,
  plannedCents: number,
): BudgetProgressLevel {
  if (plannedCents <= 0) return spentCents > 0 ? "unplanned" : "calm";
  const ratio = spentCents / plannedCents;
  if (ratio >= BUDGET_PROGRESS_THRESHOLDS.over) return "over";
  if (ratio >= BUDGET_PROGRESS_THRESHOLDS.caution) return "caution";
  if (ratio >= BUDGET_PROGRESS_THRESHOLDS.attention) return "attention";
  return "calm";
}

export type BudgetGuidancePriority =
  | "essential"
  | "semi-flexible"
  | "required-debt"
  | "financial-goal"
  | "discretionary";

/** One source of truth for how Plan categories should be discussed—not enforced. */
export const PLAN_CATEGORY_PRIORITIES: Readonly<
  Record<PlanCategoryKey, BudgetGuidancePriority>
> = {
  housing: "essential",
  utilities: "essential",
  "phone-internet": "essential",
  insurance: "essential",
  groceries: "semi-flexible",
  drinks: "discretionary",
  restaurants: "discretionary",
  transportation: "semi-flexible",
  "health-personal-care": "semi-flexible",
  education: "semi-flexible",
  "debt-payments": "required-debt",
  "savings-goals": "financial-goal",
  clothing: "discretionary",
  shopping: "discretionary",
  subscriptions: "discretionary",
  "entertainment-recreation": "discretionary",
};

/** Categories to review first when a draft itself exceeds available money. */
export const PLAN_ADJUSTMENT_ORDER = [
  "subscriptions",
  "entertainment-recreation",
  "shopping",
  "restaurants",
  "drinks",
  "clothing",
  "savings-goals",
  "transportation",
  "health-personal-care",
  "education",
  "phone-internet",
  "groceries",
  "utilities",
  "insurance",
  "housing",
  "debt-payments",
] as const satisfies readonly PlanCategoryKey[];
export function isBudgetCategoryKey(value: string): value is BudgetCategoryKey {
  return value in BUDGET_CATEGORIES;
}
