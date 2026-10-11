import {
  BUDGET_CATEGORY_KEYS,
  type BudgetCategoryKey,
} from "./budget-categories";
import type { DatedExpenseEvent, ExpenseTransactionType } from "./expenses";
import { asV2Cents } from "./money";
import type { CalendarDate, V2Cents } from "./types";

export type CategorySpendingHistory = Readonly<{
  category: BudgetCategoryKey;
  spentThisMonthCents: V2Cents;
  historicalMonthlyAverageCents: V2Cents | null;
  completedMonthCount: number;
  completedMonthTotals: Readonly<Record<string, V2Cents>>;
}>;

const EXCLUDED_TYPES = new Set<ExpenseTransactionType>([
  "transfer",
  "credit-card-payment",
]);

function eventType(event: DatedExpenseEvent): ExpenseTransactionType {
  return event.transactionType ?? "purchase";
}

function signedAmount(event: DatedExpenseEvent): number {
  const type = eventType(event);
  if (EXCLUDED_TYPES.has(type)) return 0;
  const amount = Number(event.amountCents);
  return type === "refund" ? -amount : amount;
}

/**
 * Aggregates actual transactions into calendar-month totals before averaging.
 * Only completed months that contain qualifying history for the category count.
 */
export function calculateCategorySpendingHistory(
  events: readonly DatedExpenseEvent[],
  asOfDate: CalendarDate,
): Readonly<Record<BudgetCategoryKey, CategorySpendingHistory>> {
  const currentMonth = asOfDate.slice(0, 7);
  const monthTotals = new Map<BudgetCategoryKey, Map<string, number>>();
  const currentTotals = new Map<BudgetCategoryKey, number>();

  for (const event of events) {
    if (event.status !== "actual") continue;
    const amount = signedAmount(event);
    if (amount === 0) continue;
    const date = event.actualDate ?? event.dueDate;
    const month = date.slice(0, 7);
    if (month === currentMonth) {
      currentTotals.set(
        event.category,
        (currentTotals.get(event.category) ?? 0) + amount,
      );
      continue;
    }
    if (month > currentMonth) continue;
    const categoryMonths =
      monthTotals.get(event.category) ?? new Map<string, number>();
    categoryMonths.set(month, (categoryMonths.get(month) ?? 0) + amount);
    monthTotals.set(event.category, categoryMonths);
  }

  return Object.fromEntries(
    BUDGET_CATEGORY_KEYS.map((category) => {
      const completed = monthTotals.get(category) ?? new Map<string, number>();
      const normalized = [...completed.entries()].map(
        ([month, cents]) => [month, asV2Cents(Math.max(0, cents))] as const,
      );
      const total = normalized.reduce((sum, [, cents]) => sum + cents, 0);
      const count = normalized.length;
      return [
        category,
        {
          category,
          spentThisMonthCents: asV2Cents(
            Math.max(0, currentTotals.get(category) ?? 0),
          ),
          historicalMonthlyAverageCents:
            count === 0 ? null : asV2Cents(Math.round(total / count)),
          completedMonthCount: count,
          completedMonthTotals: Object.fromEntries(normalized),
        },
      ];
    }),
  ) as Record<BudgetCategoryKey, CategorySpendingHistory>;
}

const CATEGORY_KEYWORDS: readonly [BudgetCategoryKey, readonly string[]][] = [
  ["housing", ["rent", "mortgage"]],
  ["utilities", ["electric", "electricity", "water", "hydro", "natural gas"]],
  ["phone-internet", ["phone", "mobile", "internet", "telecom"]],
  ["insurance", ["insurance"]],
  ["groceries", ["grocery", "supermarket", "costco"]],
  ["restaurants", ["restaurant", "takeout", "coffee", "cafe", "delivery"]],
  [
    "transportation",
    ["fuel", "gas station", "transit", "parking", "uber", "lyft"],
  ],
  ["health-personal-care", ["pharmacy", "medical", "dental", "personal care"]],
  ["debt-payments", ["loan payment", "debt payment", "card payment"]],
  [
    "savings-goals",
    ["savings", "investment contribution", "tfsa", "rrsp", "fhsa"],
  ],
  ["clothing", ["clothing", "clothes", "shoes"]],
  [
    "subscriptions",
    ["streaming", "subscription", "software", "membership", "gym"],
  ],
  ["entertainment-recreation", ["movie", "cinema", "game", "recreation"]],
  ["shopping", ["shopping", "online order", "amazon", "purchase"]],
];

export function inferBudgetCategory(description: string): BudgetCategoryKey {
  const normalized = description.trim().toLowerCase();
  return (
    CATEGORY_KEYWORDS.find(([, keywords]) =>
      keywords.some((keyword) => normalized.includes(keyword)),
    )?.[0] ?? "other"
  );
}
