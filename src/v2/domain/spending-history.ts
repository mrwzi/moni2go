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
  "savings-contribution",
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

function monthRange(first: string, last: string): string[] {
  const [firstYear = 0, firstMonth = 1] = first.split("-").map(Number);
  const [lastYear = 0, lastMonth = 1] = last.split("-").map(Number);
  const firstIndex = firstYear * 12 + firstMonth - 1;
  const lastIndex = lastYear * 12 + lastMonth - 1;
  return Array.from({ length: lastIndex - firstIndex + 1 }, (_, offset) => {
    const index = firstIndex + offset;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`;
  });
}

/**
 * Aggregates actual transactions into calendar-month totals before averaging.
 * Missing months between a category's first and last recorded completed month
 * count as zero. Months before the first record or after the last are not
 * assumed to be tracked, which avoids treating an unused app as zero spending.
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
      const observedMonths = [...completed.keys()].sort();
      const normalized =
        observedMonths.length === 0
          ? []
          : monthRange(
              observedMonths[0] ?? currentMonth,
              observedMonths.at(-1) ?? currentMonth,
            ).map(
              (month) =>
                [
                  month,
                  asV2Cents(Math.max(0, completed.get(month) ?? 0)),
                ] as const,
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
  ["education", ["tuition", "school", "textbook", "course", "education"]],
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
