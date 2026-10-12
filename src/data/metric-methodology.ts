export type MetricMethodologyId =
  | "income"
  | "housing"
  | "other-expenses"
  | "debt-payments"
  | "non-savings-outflows"
  | "planned-savings"
  | "core-surplus"
  | "remaining-flexible-cash"
  | "housing-to-income"
  | "savings-rate"
  | "expense-to-income"
  | "monthly-impact"
  | "annual-impact"
  | "percentage-point-change"
  | "relative-percentage-change";

export type MetricMethodology = Readonly<{
  id: MetricMethodologyId;
  name: string;
  definition: string;
  formula: string;
  unit: string;
  display: string;
  zeroIncome?: string;
  limitation: string;
}>;

export const METRIC_METHODOLOGY = {
  income: {
    id: "income",
    name: "Monthly take-home income",
    definition:
      "Income received in one month after deductions represented by the entered amount.",
    formula: "User-entered monthly take-home income",
    unit: "CAD per month",
    display: "Displayed to two decimal places.",
    limitation:
      "moni2go does not separately calculate taxes or payroll deductions.",
  },
  housing: {
    id: "housing",
    name: "Housing",
    definition:
      "The monthly rent, residence fee, or housing payment in the baseline.",
    formula: "User-entered monthly housing amount",
    unit: "CAD per month",
    display: "Displayed to two decimal places.",
    limitation: "A housing scenario changes only this amount.",
  },
  "other-expenses": {
    id: "other-expenses",
    name: "Other monthly expenses",
    definition:
      "Monthly non-housing consumption entered as one combined amount.",
    formula: "User-entered other monthly expenses",
    unit: "CAD per month",
    display: "Displayed to two decimal places.",
    limitation:
      "V1 treats the entire amount as eligible for a cost-of-living scenario.",
  },
  "debt-payments": {
    id: "debt-payments",
    name: "Debt payments",
    definition: "Required monthly debt payments entered in the baseline.",
    formula: "User-entered monthly debt payments",
    unit: "CAD per month",
    display: "Displayed to two decimal places.",
    limitation:
      "moni2go does not model amortization, interest changes, or loan terms.",
  },
  "non-savings-outflows": {
    id: "non-savings-outflows",
    name: "Non-savings outflows",
    definition: "Housing, other monthly expenses, and debt payments combined.",
    formula: "housing + other monthly expenses + debt payments",
    unit: "CAD per month",
    display: "Displayed to two decimal places.",
    limitation:
      "Planned savings are deliberately excluded because they are an allocation, not consumption spending.",
  },
  "planned-savings": {
    id: "planned-savings",
    name: "Planned savings",
    definition:
      "An intentional monthly allocation to savings, kept separate from expenses.",
    formula: "User-entered planned savings allocation",
    unit: "CAD per month",
    display: "Displayed to two decimal places.",
    limitation: "No investment return or account behavior is modeled.",
  },
  "core-surplus": {
    id: "core-surplus",
    name: "Core surplus",
    definition:
      "Income remaining after non-savings outflows and before planned savings.",
    formula: "income − housing − other monthly expenses − debt payments",
    unit: "CAD per month",
    display: "Displayed to two decimal places; negative values remain visible.",
    limitation:
      "Planned savings are intentionally excluded and applied afterward.",
  },
  "remaining-flexible-cash": {
    id: "remaining-flexible-cash",
    name: "Remaining flexible cash",
    definition: "Core surplus remaining after the planned savings allocation.",
    formula: "core surplus − planned savings",
    unit: "CAD per month",
    display: "Displayed to two decimal places; negative values remain visible.",
    limitation:
      "This is a modeled remainder, not an affordability assessment or recommendation.",
  },
  "housing-to-income": {
    id: "housing-to-income",
    name: "Housing / income",
    definition: "The share of monthly take-home income represented by housing.",
    formula: "housing ÷ income",
    unit: "Percentage",
    display:
      "Calculated from unrounded values and displayed to one decimal place.",
    zeroIncome: "Returns N/A when income is zero.",
    limitation:
      "This ratio is descriptive and is not compared with an affordability threshold.",
  },
  "savings-rate": {
    id: "savings-rate",
    name: "Planned savings / income",
    definition:
      "The share of monthly take-home income allocated to planned savings.",
    formula: "planned savings ÷ income",
    unit: "Percentage",
    display:
      "Calculated from unrounded values and displayed to one decimal place.",
    zeroIncome: "Returns N/A when income is zero.",
    limitation:
      "It describes the entered plan and does not assess whether the rate is appropriate.",
  },
  "expense-to-income": {
    id: "expense-to-income",
    name: "Outflows / income",
    definition:
      "The share of monthly take-home income used by non-savings outflows.",
    formula: "non-savings outflows ÷ income",
    unit: "Percentage",
    display:
      "Calculated from unrounded values and displayed to one decimal place.",
    zeroIncome: "Returns N/A when income is zero.",
    limitation:
      "Planned savings are excluded and no external benchmark is applied.",
  },
  "monthly-impact": {
    id: "monthly-impact",
    name: "Monthly impact",
    definition:
      "The scenario value minus the current value for a monthly metric.",
    formula: "scenario value − current value",
    unit: "CAD per month",
    display: "Displayed as a signed CAD amount to two decimal places.",
    limitation:
      "The Scenario Lab headline applies this difference to remaining flexible cash.",
  },
  "annual-impact": {
    id: "annual-impact",
    name: "Annual impact",
    definition: "A simple annualization of a monthly difference.",
    formula: "monthly impact × 12",
    unit: "CAD per year",
    display: "Displayed as a signed CAD amount to two decimal places.",
    limitation: "It does not compound or model month-by-month changes.",
  },
  "percentage-point-change": {
    id: "percentage-point-change",
    name: "Percentage-point change",
    definition: "The direct difference between two percentage ratios.",
    formula: "(scenario ratio − current ratio) × 100",
    unit: "Percentage points",
    display: "Displayed to one decimal place with the words percentage points.",
    zeroIncome:
      "Returns N/A when either ratio cannot be calculated because income is zero.",
    limitation:
      "A percentage-point difference is not a relative percentage change.",
  },
  "relative-percentage-change": {
    id: "relative-percentage-change",
    name: "Relative percentage change",
    definition: "The change relative to the magnitude of the current value.",
    formula: "(scenario value − current value) ÷ |current value|",
    unit: "Percentage",
    display:
      "Displayed to one decimal place and explicitly labeled relative change.",
    limitation: "Returns N/A when the current value is zero.",
  },
} as const satisfies Record<MetricMethodologyId, MetricMethodology>;

export const METRIC_METHODOLOGY_LIST: readonly MetricMethodology[] =
  Object.values(METRIC_METHODOLOGY);

export function methodologyHref(id: MetricMethodologyId): string {
  return `/methodology#${id}`;
}
