export const BUDGET_CATEGORIES = {
  housing: "Housing",
  utilities: "Utilities",
  groceries: "Groceries",
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
  "savings-goals": "Savings / goals",
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

export type PlanCategoryKey = (typeof PLAN_CATEGORY_KEYS)[number];
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
  restaurants: "discretionary",
  transportation: "semi-flexible",
  "health-personal-care": "semi-flexible",
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
  "clothing",
  "savings-goals",
  "transportation",
  "health-personal-care",
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
