export type Cents = number;
export type Ratio = number | null;

export type Baseline = Readonly<{
  incomeCents: Cents;
  housingCents: Cents;
  otherExpensesCents: Cents;
  debtPaymentsCents: Cents;
  plannedSavingsCents: Cents;
}>;

export type CalculatedPosition = Baseline &
  Readonly<{
    nonSavingsOutflowsCents: Cents;
    coreSurplusCents: Cents;
    remainingFlexibleCashCents: Cents;
    housingToIncomeRatio: Ratio;
    savingsRate: Ratio;
    expenseToIncomeRatio: Ratio;
    coreSurplusRate: Ratio;
    flexibleCashRate: Ratio;
  }>;

export type HousingScenario = Readonly<{
  type: "housing";
  mode: "absolute" | "delta";
  value: number;
}>;

export type IncomeScenario = Readonly<{
  type: "income";
  mode: "absolute" | "percent";
  value: number;
}>;

export type CostOfLivingScenario = Readonly<{
  type: "cost-of-living";
  mode: "percent";
  value: number;
}>;

export type SavingsScenario = Readonly<{
  type: "savings";
  mode: "absolute" | "delta";
  value: number;
}>;

export type Scenario =
  HousingScenario | IncomeScenario | CostOfLivingScenario | SavingsScenario;

export type MetricDifference = Readonly<{
  current: number | null;
  scenario: number | null;
  delta: number | null;
  annualDelta?: number;
}>;

export type PositionComparison = Readonly<{
  income: MetricDifference;
  housing: MetricDifference;
  otherExpenses: MetricDifference;
  debtPayments: MetricDifference;
  nonSavingsOutflows: MetricDifference;
  coreSurplus: MetricDifference;
  plannedSavings: MetricDifference;
  remainingFlexibleCash: MetricDifference;
  housingToIncomeRatio: MetricDifference;
  savingsRate: MetricDifference;
  expenseToIncomeRatio: MetricDifference;
  coreSurplusRelativeChange: Ratio;
}>;

export type ImpactDirection = "increase" | "decrease" | "unchanged";

export type ImpactExplanation = Readonly<{
  metric: "remaining-flexible-cash";
  scenarioType: Scenario["type"];
  direction: ImpactDirection;
  monthlyDifferenceCents: Cents;
  annualDifferenceCents: Cents;
  message: string;
  isEstimate: true;
  isRecommendation: false;
}>;

export const DEMO_PROFILE_IDS = [
  "student-family",
  "student-renter",
  "student-part-time",
  "recent-graduate",
] as const;

export type DemoProfileId = (typeof DEMO_PROFILE_IDS)[number];

export type DemoProfile = Readonly<{
  source: "synthetic-demo";
  id: DemoProfileId;
  name: string;
  description: string;
  baseline: Baseline;
  provenance: "Synthetic example created for moni2go; not a statistical average.";
}>;

export type UserBaseline = Readonly<{
  source: "user-entered";
  baseline: Baseline;
}>;

export type FinancialInputSource = DemoProfile | UserBaseline;
