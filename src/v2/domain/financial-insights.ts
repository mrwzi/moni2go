import type { LiabilityAccount } from "./accounts";
import {
  BUDGET_CATEGORIES,
  PLAN_CATEGORY_PRIORITIES,
  type BudgetCategoryKey,
  type PlanCategoryKey,
} from "./budget-categories";
import { createCategoryBudgetGuidance } from "./budget-guidance";
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDateParts,
  compareCalendarDates,
  daysInMonth,
} from "./calendar";
import type { DatedExpenseEvent, ExpenseDefinition } from "./expenses";
import { asV2Cents } from "./money";
import { expandRecurrence, type Recurrence } from "./recurrence";
import { calculateCategorySpendingHistory } from "./spending-history";
import type { CalendarDate, V2Cents } from "./types";
import type { FinancialWorkspace } from "./workspace";
import { deriveSpendableCashCents } from "./accounts";

export type ForecastHorizonDays = 30 | 60 | 90;
export type ForecastConfidence = "confirmed" | "estimated";
export type ForecastEventKind =
  "income" | "bill" | "debt-payment" | "everyday-spending";

export type ForecastEvent = Readonly<{
  key: string;
  date: CalendarDate;
  label: string;
  amountCents: V2Cents;
  direction: "inflow" | "outflow";
  kind: ForecastEventKind;
  confidence: ForecastConfidence;
  required: boolean;
}>;

export type CashFlowForecast = Readonly<{
  horizonDays: ForecastHorizonDays;
  startCashCents: V2Cents;
  endCashCents: V2Cents;
  lowestCashCents: V2Cents;
  shortageDate: CalendarDate | null;
  confirmedIncomeCents: V2Cents;
  confirmedOutflowCents: V2Cents;
  estimatedOutflowCents: V2Cents;
  events: readonly ForecastEvent[];
  unknowns: readonly string[];
}>;

export type ObligationStatus = "overdue" | "upcoming" | "paid" | "unknown";
export type Obligation = Readonly<{
  key: string;
  name: string;
  amountCents: V2Cents | null;
  date: CalendarDate | null;
  status: ObligationStatus;
  kind: "bill" | "debt-payment";
  required: boolean;
  sourceId: string;
}>;

export type SmartRecommendation = Readonly<{
  priority: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  explanation: string;
  actionLabel: string;
  actionHref: "/accounts" | "/plan";
}>;

export type SpendingIntelligence = Readonly<{
  spentThisMonthCents: V2Cents;
  spendingPlanCents: V2Cents;
  planDifferenceCents: V2Cents;
  topCategories: readonly Readonly<{
    category: BudgetCategoryKey;
    spentCents: V2Cents;
  }>[];
  meaningfulOverages: readonly Readonly<{
    category: PlanCategoryKey;
    amountCents: V2Cents;
    message: string;
  }>[];
  unusualCategories: readonly Readonly<{
    category: BudgetCategoryKey;
    spentCents: V2Cents;
    historicalAverageCents: V2Cents;
  }>[];
}>;

export type FinancialInsights = Readonly<{
  obligations: readonly Obligation[];
  spending: SpendingIntelligence;
  forecasts: Readonly<Record<ForecastHorizonDays, CashFlowForecast>>;
  recommendation: SmartRecommendation;
}>;

/** Product-analysis tolerances, centralized here so they can be tuned. */
export const FINANCIAL_INSIGHT_THRESHOLDS = {
  minimumReliableCompletedMonths: 2,
  unusualSpendingBasisPoints: 12_500,
  minimumUnusualDifferenceCents: 2_000,
} as const;

const DAY_COUNTS_PER_YEAR = 365;

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("en-CA").replace(/\s+/g, " ");
}

function recurrenceKey(recurrence: Recurrence): string {
  return JSON.stringify(recurrence);
}

function uniqueDefinitions(
  definitions: readonly ExpenseDefinition[],
): ExpenseDefinition[] {
  const seen = new Set<string>();
  return uniqueById(definitions).filter((definition) => {
    const key = [
      normalizeName(definition.name),
      definition.amountCents,
      definition.category,
      recurrenceKey(definition.recurrence),
      definition.bounds.startDate,
      definition.bounds.endDate ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isConsumptionCategory(category: BudgetCategoryKey): boolean {
  return category !== "debt-payments" && category !== "savings-goals";
}

function eventDate(event: DatedExpenseEvent): CalendarDate {
  return event.actualDate ?? event.dueDate;
}

function debtDateAfter(
  anchorDate: CalendarDate,
  account: LiabilityAccount,
  installmentOffset: number,
): CalendarDate {
  const frequency = account.paymentFrequency ?? "monthly";
  if (frequency === "weekly")
    return addCalendarDays(anchorDate, installmentOffset * 7);
  if (frequency === "biweekly")
    return addCalendarDays(anchorDate, installmentOffset * 14);
  return addCalendarMonths(anchorDate, installmentOffset);
}

function debtInstallmentCents(account: LiabilityAccount): V2Cents | null {
  if (
    account.paymentRequirement !== "required" ||
    account.currentBalanceCents <= 0
  )
    return null;
  const amount =
    account.requiredPaymentCents ?? account.requiredMonthlyPaymentCents;
  if (amount === undefined || amount <= 0) return null;
  return asV2Cents(Math.min(amount, account.currentBalanceCents));
}

function linkedEventKey(definitionId: string, date: CalendarDate): string {
  return `${definitionId}|${date}`;
}

export function classifyObligations(
  workspace: FinancialWorkspace,
  today: CalendarDate,
  horizonDays = 30,
): readonly Obligation[] {
  const horizonEnd = addCalendarDays(today, horizonDays);
  const events = uniqueById(workspace.expenseEvents);
  const linked = new Map(
    events
      .filter((event) => event.definitionId)
      .map((event) => [
        linkedEventKey(event.definitionId as string, event.dueDate),
        event,
      ]),
  );
  const result: Obligation[] = [];

  for (const event of events) {
    if (event.obligation !== "required") continue;
    if (event.status === "actual" || event.status === "cancelled") {
      result.push({
        key: `event:${event.id}`,
        name: event.name,
        amountCents: event.amountCents,
        date: eventDate(event),
        status: event.status === "actual" ? "paid" : "unknown",
        kind:
          event.transactionType === "credit-card-payment"
            ? "debt-payment"
            : "bill",
        required: true,
        sourceId: event.id,
      });
    } else if (compareCalendarDates(event.dueDate, today) < 0) {
      result.push({
        key: `event:${event.id}`,
        name: event.name,
        amountCents: event.amountCents,
        date: event.dueDate,
        status: "overdue",
        kind: "bill",
        required: true,
        sourceId: event.id,
      });
    } else if (compareCalendarDates(event.dueDate, horizonEnd) <= 0) {
      result.push({
        key: `event:${event.id}`,
        name: event.name,
        amountCents: event.amountCents,
        date: event.dueDate,
        status: "upcoming",
        kind: "bill",
        required: true,
        sourceId: event.id,
      });
    }
  }

  for (const definition of uniqueDefinitions(workspace.expenseDefinitions)) {
    const occurrences = expandRecurrence({
      recurrence: definition.recurrence,
      bounds: definition.bounds,
      horizonStart: today,
      horizonEnd,
    }).occurrences;
    if (
      occurrences.length === 0 &&
      definition.recurrence.kind === "irregular"
    ) {
      result.push({
        key: `definition:${definition.id}:unknown`,
        name: definition.name,
        amountCents: definition.amountCents,
        date: null,
        status: "unknown",
        kind: "bill",
        required: definition.obligation === "required",
        sourceId: definition.id,
      });
    }
    if (
      occurrences.length === 0 &&
      definition.recurrence.kind === "one-time" &&
      compareCalendarDates(definition.recurrence.date, today) < 0 &&
      !linked.has(linkedEventKey(definition.id, definition.recurrence.date))
    ) {
      result.push({
        key: `definition:${definition.id}:unknown`,
        name: definition.name,
        amountCents: definition.amountCents,
        date: definition.recurrence.date,
        status: "unknown",
        kind: "bill",
        required: definition.obligation === "required",
        sourceId: definition.id,
      });
    }
    for (const date of occurrences) {
      const matchingEvent = linked.get(linkedEventKey(definition.id, date));
      if (matchingEvent) continue;
      result.push({
        key: `definition:${definition.id}:${date}`,
        name: definition.name,
        amountCents: definition.amountCents,
        date,
        status: "upcoming",
        kind: "bill",
        required: definition.obligation === "required",
        sourceId: definition.id,
      });
    }
  }

  for (const account of workspace.liabilityAccounts.filter(
    (item) => item.status === "active" && item.currentBalanceCents > 0,
  )) {
    const amount = debtInstallmentCents(account);
    if (account.paymentRequirement !== "required") continue;
    if (!amount || !account.nextPaymentDate) {
      result.push({
        key: `debt:${account.id}:unknown`,
        name: account.name,
        amountCents: amount,
        date: account.nextPaymentDate ?? null,
        status: "unknown",
        kind: "debt-payment",
        required: true,
        sourceId: account.id,
      });
      continue;
    }
    const recordedPayments = events
      .filter(
        (event) =>
          event.status === "actual" &&
          event.transactionType === "credit-card-payment" &&
          event.relatedAccountId === account.id,
      )
      .sort((left, right) => eventDate(right).localeCompare(eventDate(left)));
    const latestPayment = recordedPayments[0];
    const scheduleAnchor = account.nextPaymentDate;
    let installmentOffset = 0;
    let nextPaymentDate = scheduleAnchor;
    if (
      latestPayment &&
      compareCalendarDates(eventDate(latestPayment), nextPaymentDate) >= 0
    ) {
      result.push({
        key: `debt:${account.id}:${nextPaymentDate}:paid`,
        name: account.name,
        amountCents: asV2Cents(Math.min(amount, latestPayment.amountCents)),
        date: eventDate(latestPayment),
        status: "paid",
        kind: "debt-payment",
        required: true,
        sourceId: account.id,
      });
      installmentOffset = 1;
      if (account.paymentFrequency === "semimonthly") {
        result.push({
          key: `debt:${account.id}:unknown-future-schedule`,
          name: account.name,
          amountCents: amount,
          date: null,
          status: "unknown",
          kind: "debt-payment",
          required: true,
          sourceId: account.id,
        });
        continue;
      }
      nextPaymentDate = debtDateAfter(
        scheduleAnchor,
        account,
        installmentOffset,
      );
    }
    if (compareCalendarDates(nextPaymentDate, today) < 0) {
      result.push({
        key: `debt:${account.id}:${nextPaymentDate}`,
        name: account.name,
        amountCents: amount,
        date: nextPaymentDate,
        status: "overdue",
        kind: "debt-payment",
        required: true,
        sourceId: account.id,
      });
      continue;
    }
    let date = nextPaymentDate;
    let remaining = account.currentBalanceCents;
    while (compareCalendarDates(date, horizonEnd) <= 0 && remaining > 0) {
      const installment = asV2Cents(Math.min(amount, remaining));
      result.push({
        key: `debt:${account.id}:${date}`,
        name: account.name,
        amountCents: installment,
        date,
        status: "upcoming",
        kind: "debt-payment",
        required: true,
        sourceId: account.id,
      });
      remaining = asV2Cents(remaining - installment);
      installmentOffset += 1;
      if (account.paymentFrequency === "semimonthly") {
        result.push({
          key: `debt:${account.id}:unknown-future-schedule`,
          name: account.name,
          amountCents: amount,
          date: null,
          status: "unknown",
          kind: "debt-payment",
          required: true,
          sourceId: account.id,
        });
        break;
      }
      date = debtDateAfter(scheduleAnchor, account, installmentOffset);
    }
  }

  const rank: Record<ObligationStatus, number> = {
    overdue: 0,
    upcoming: 1,
    unknown: 2,
    paid: 3,
  };
  return result.sort(
    (left, right) =>
      rank[left.status] - rank[right.status] ||
      (left.date ?? "9999").localeCompare(right.date ?? "9999"),
  );
}

function scheduledDefinitionMonthlyCents(
  definition: ExpenseDefinition,
): number {
  if (definition.recurrence.kind === "weekly")
    return Math.round((definition.amountCents * 52) / 12);
  if (definition.recurrence.kind === "biweekly")
    return Math.round((definition.amountCents * 26) / 12);
  if (definition.recurrence.kind === "semimonthly")
    return definition.amountCents * 2;
  if (definition.recurrence.kind === "monthly") return definition.amountCents;
  return 0;
}

export function analyzeSpending(
  workspace: FinancialWorkspace,
  today: CalendarDate,
): SpendingIntelligence {
  const history = calculateCategorySpendingHistory(
    uniqueById(workspace.expenseEvents),
    today,
  );
  const plan = new Map<BudgetCategoryKey, V2Cents>();
  for (const rule of uniqueById(workspace.allocationRules))
    if (rule.enabled && rule.category && rule.strategy.kind === "fixed-amount")
      plan.set(
        rule.category,
        asV2Cents((plan.get(rule.category) ?? 0) + rule.strategy.amountCents),
      );
  const spendingPlanCents = asV2Cents(
    [...plan.entries()]
      .filter(([category]) => isConsumptionCategory(category))
      .reduce((sum, [, amount]) => sum + amount, 0),
  );
  const rows = Object.values(history)
    .filter((row) => isConsumptionCategory(row.category))
    .map((row) => ({
      category: row.category,
      spentCents: row.spentThisMonthCents,
    }))
    .filter((row) => row.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents);
  const spentThisMonthCents = asV2Cents(
    rows.reduce((sum, row) => sum + row.spentCents, 0),
  );
  const meaningfulOverages = [...plan.entries()].flatMap(
    ([category, planCents]) => {
      if (!(category in PLAN_CATEGORY_PRIORITIES)) return [];
      const row = history[category];
      const guidance = createCategoryBudgetGuidance({
        category: category as PlanCategoryKey,
        planCents,
        spentThisMonthCents: row.spentThisMonthCents,
        historicalAverageCents: row.historicalMonthlyAverageCents,
      });
      return guidance.level === "over" && guidance.message
        ? [
            {
              category: category as PlanCategoryKey,
              amountCents: guidance.overByCents,
              message: guidance.message,
            },
          ]
        : [];
    },
  );
  const todayParts = calendarDateParts(today);
  const elapsedMonthShare =
    todayParts.day / daysInMonth(todayParts.year, todayParts.month);
  const unusualCategories = Object.values(history).flatMap((row) => {
    const average = row.historicalMonthlyAverageCents;
    if (
      !isConsumptionCategory(row.category) ||
      average === null ||
      row.completedMonthCount <
        FINANCIAL_INSIGHT_THRESHOLDS.minimumReliableCompletedMonths
    )
      return [];
    const expectedByNow = Math.round(average * elapsedMonthShare);
    const threshold = Math.max(
      expectedByNow +
        FINANCIAL_INSIGHT_THRESHOLDS.minimumUnusualDifferenceCents,
      Math.round(
        (expectedByNow *
          FINANCIAL_INSIGHT_THRESHOLDS.unusualSpendingBasisPoints) /
          10_000,
      ),
    );
    return row.spentThisMonthCents > threshold
      ? [
          {
            category: row.category,
            spentCents: row.spentThisMonthCents,
            historicalAverageCents: average,
          },
        ]
      : [];
  });
  return {
    spentThisMonthCents,
    spendingPlanCents,
    planDifferenceCents: asV2Cents(spendingPlanCents - spentThisMonthCents),
    topCategories: rows.slice(0, 3),
    meaningfulOverages: meaningfulOverages.sort(
      (a, b) => b.amountCents - a.amountCents,
    ),
    unusualCategories: unusualCategories.sort(
      (a, b) => b.spentCents - a.spentCents,
    ),
  };
}

function forecastForHorizon(
  workspace: FinancialWorkspace,
  today: CalendarDate,
  horizonDays: ForecastHorizonDays,
  obligations: readonly Obligation[],
): CashFlowForecast {
  const end = addCalendarDays(today, horizonDays);
  const events: ForecastEvent[] = [];
  const unknowns = new Set<string>();

  const incomeEvents = uniqueById(workspace.incomeEvents);
  const incomeOccurrenceKeys = new Set<string>();
  for (const event of incomeEvents) {
    if (
      event.status !== "expected" ||
      compareCalendarDates(event.expectedDate, today) < 0 ||
      compareCalendarDates(event.expectedDate, end) > 0
    )
      continue;
    events.push({
      key: `income-event:${event.id}`,
      date: event.expectedDate,
      label: event.name,
      amountCents: event.amountCents,
      direction: "inflow",
      kind: "income",
      confidence: "confirmed",
      required: false,
    });
    if (event.sourceId)
      incomeOccurrenceKeys.add(`${event.sourceId}|${event.expectedDate}`);
  }
  for (const source of uniqueById(workspace.incomeSources)) {
    if (!source.defaultAmountCents || source.defaultAmountCents <= 0) {
      unknowns.add(`${source.name} has no expected amount.`);
      continue;
    }
    const dates = expandRecurrence({
      recurrence: source.recurrence,
      bounds: source.bounds,
      horizonStart: today,
      horizonEnd: end,
    }).occurrences;
    if (source.recurrence.kind === "irregular") {
      unknowns.add(`${source.name} has no confirmed future date.`);
      continue;
    }
    for (const date of dates) {
      if (incomeOccurrenceKeys.has(`${source.id}|${date}`)) continue;
      events.push({
        key: `income-source:${source.id}:${date}`,
        date,
        label: source.name,
        amountCents: source.defaultAmountCents,
        direction: "inflow",
        kind: "income",
        confidence: "confirmed",
        required: false,
      });
    }
  }

  const debtSourceIds = new Set(
    obligations
      .filter((item) => item.kind === "debt-payment")
      .map((item) => item.sourceId),
  );
  const debtNames = new Set(
    workspace.liabilityAccounts
      .filter((account) => debtSourceIds.has(account.id))
      .map((account) => normalizeName(account.name)),
  );
  for (const obligation of obligations) {
    if (obligation.status === "unknown") {
      if (obligation.required)
        unknowns.add(`${obligation.name} needs a payment date or amount.`);
      continue;
    }
    if (
      (obligation.status !== "upcoming" && obligation.status !== "overdue") ||
      !obligation.date ||
      !obligation.amountCents ||
      compareCalendarDates(obligation.date, end) > 0
    )
      continue;
    if (
      obligation.kind === "bill" &&
      debtNames.has(normalizeName(obligation.name))
    )
      continue;
    events.push({
      key: `obligation:${obligation.key}`,
      date:
        compareCalendarDates(obligation.date, today) < 0
          ? today
          : obligation.date,
      label: obligation.name,
      amountCents: obligation.amountCents,
      direction: "outflow",
      kind: obligation.kind,
      confidence: "confirmed",
      required: obligation.required,
    });
  }

  const history = calculateCategorySpendingHistory(
    uniqueById(workspace.expenseEvents),
    today,
  );
  const definitions = uniqueDefinitions(workspace.expenseDefinitions);
  const monthlyScheduledByCategory = new Map<BudgetCategoryKey, number>();
  for (const definition of definitions)
    monthlyScheduledByCategory.set(
      definition.category,
      (monthlyScheduledByCategory.get(definition.category) ?? 0) +
        scheduledDefinitionMonthlyCents(definition),
    );
  const reliableMonthlyEveryday = Object.values(history).reduce((sum, row) => {
    if (
      !isConsumptionCategory(row.category) ||
      row.historicalMonthlyAverageCents === null ||
      row.completedMonthCount <
        FINANCIAL_INSIGHT_THRESHOLDS.minimumReliableCompletedMonths
    )
      return sum;
    return (
      sum +
      Math.max(
        0,
        row.historicalMonthlyAverageCents -
          (monthlyScheduledByCategory.get(row.category) ?? 0),
      )
    );
  }, 0);
  if (reliableMonthlyEveryday > 0) {
    const daily = Math.round(
      (reliableMonthlyEveryday * 12) / DAY_COUNTS_PER_YEAR,
    );
    for (let offset = 1; offset <= horizonDays; offset += 1)
      events.push({
        key: `everyday:${offset.toString()}`,
        date: addCalendarDays(today, offset),
        label: "Expected everyday spending",
        amountCents: asV2Cents(daily),
        direction: "outflow",
        kind: "everyday-spending",
        confidence: "estimated",
        required: false,
      });
  } else {
    unknowns.add(
      "More completed-month history is needed to estimate everyday spending.",
    );
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.direction === "outflow" ? -1 : 1),
  );
  let balance = deriveSpendableCashCents(workspace.assetAccounts);
  let lowest = balance;
  let shortageDate: CalendarDate | null = balance < 0 ? today : null;
  for (const event of events) {
    balance = asV2Cents(
      balance +
        (event.direction === "inflow"
          ? event.amountCents
          : 0 - event.amountCents),
    );
    if (balance < lowest) lowest = balance;
    if (shortageDate === null && balance < 0) shortageDate = event.date;
  }
  const sum = (predicate: (event: ForecastEvent) => boolean): V2Cents =>
    asV2Cents(
      events
        .filter(predicate)
        .reduce((total, event) => total + event.amountCents, 0),
    );
  return {
    horizonDays,
    startCashCents: deriveSpendableCashCents(workspace.assetAccounts),
    endCashCents: balance,
    lowestCashCents: lowest,
    shortageDate,
    confirmedIncomeCents: sum(
      (event) =>
        event.confidence === "confirmed" && event.direction === "inflow",
    ),
    confirmedOutflowCents: sum(
      (event) =>
        event.confidence === "confirmed" && event.direction === "outflow",
    ),
    estimatedOutflowCents: sum(
      (event) =>
        event.confidence === "estimated" && event.direction === "outflow",
    ),
    events,
    unknowns: [...unknowns],
  };
}

function cad(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function chooseRecommendation(
  workspace: FinancialWorkspace,
  today: CalendarDate,
  obligations: readonly Obligation[],
  spending: SpendingIntelligence,
  forecast: CashFlowForecast,
): SmartRecommendation {
  const overdue = obligations.filter(
    (item) => item.required && item.status === "overdue",
  );
  if (overdue.length > 0) {
    const firstOverdue = overdue[0];
    if (!firstOverdue) throw new Error("Expected an overdue obligation.");
    const total = overdue.reduce(
      (sum, item) => sum + (item.amountCents ?? 0),
      0,
    );
    return {
      priority: 1,
      title: "Check an overdue payment",
      explanation: `${overdue.length === 1 ? firstOverdue.name : `${overdue.length.toString()} required payments`} ${overdue.length === 1 ? "is" : "are"} past the saved due date${total > 0 ? ` (${cad(total)})` : ""}. Confirm whether it was paid or update its details.`,
      actionLabel: "Review payments",
      actionHref: "/accounts",
    };
  }
  if (forecast.shortageDate) {
    return {
      priority: 2,
      title: "Cash may run short",
      explanation: `Known payments and reliable spending estimates put available cash below $0 by ${forecast.shortageDate}. Review timing and amounts before then.`,
      actionLabel: "Review plan",
      actionHref: "/plan",
    };
  }
  const currentMonth = today.slice(0, 7);
  const recordedIncome = uniqueById(workspace.historicalIncome)
    .filter((record) => record.receivedDate.slice(0, 7) === currentMonth)
    .reduce((total, record) => total + record.amountCents, 0);
  if (recordedIncome > 0 && spending.spentThisMonthCents > recordedIncome) {
    return {
      priority: 3,
      title: "Recorded spending is above recorded income",
      explanation: `${cad(spending.spentThisMonthCents)} of spending and ${cad(recordedIncome)} of income are recorded this month. Check for missing income or review the plan.`,
      actionLabel: "Review monthly plan",
      actionHref: "/plan",
    };
  }
  if (spending.meaningfulOverages.length > 0) {
    const first = spending.meaningfulOverages[0];
    if (!first) throw new Error("Expected a budget overage.");
    return {
      priority: 3,
      title: `${BUDGET_CATEGORIES[first.category]} is ${cad(first.amountCents)} over plan`,
      explanation: first.message,
      actionLabel: "Review monthly plan",
      actionHref: "/plan",
    };
  }
  const unusual = spending.unusualCategories[0];
  if (unusual) {
    return {
      priority: 4,
      title: `${BUDGET_CATEGORIES[unusual.category]} is higher than usual`,
      explanation: `${cad(unusual.spentCents)} is recorded this month, compared with a ${cad(unusual.historicalAverageCents)} completed-month average.`,
      actionLabel: "View activity",
      actionHref: "/accounts",
    };
  }
  const unknownRequired = obligations.find(
    (item) => item.required && item.status === "unknown",
  );
  if (unknownRequired) {
    return {
      priority: 6,
      title: "Finish a payment setup",
      explanation: `${unknownRequired.name} needs a payment date or amount before moni2go can forecast it reliably.`,
      actionLabel: "Add details",
      actionHref: "/accounts",
    };
  }
  if (
    workspace.incomeSources.length === 0 &&
    workspace.incomeEvents.filter((event) => event.status === "expected")
      .length === 0
  ) {
    return {
      priority: 6,
      title: "Add expected income when you know it",
      explanation:
        "Your current balances are shown, but future cash cannot include income until an amount and date are saved.",
      actionLabel: "Review accounts",
      actionHref: "/accounts",
    };
  }
  return {
    priority: 5,
    title: "Your next 30 days look covered",
    explanation:
      "No higher-priority issue is visible from the dates, balances, and history currently saved.",
    actionLabel: "Review plan",
    actionHref: "/plan",
  };
}

export function analyzeFinancialWorkspace(
  workspace: FinancialWorkspace,
  today: CalendarDate,
): FinancialInsights {
  const obligations = classifyObligations(workspace, today, 90);
  const spending = analyzeSpending(workspace, today);
  const forecasts = {
    30: forecastForHorizon(workspace, today, 30, obligations),
    60: forecastForHorizon(workspace, today, 60, obligations),
    90: forecastForHorizon(workspace, today, 90, obligations),
  } as const;
  return {
    obligations,
    spending,
    forecasts,
    recommendation: chooseRecommendation(
      workspace,
      today,
      obligations,
      spending,
      forecasts[30],
    ),
  };
}
