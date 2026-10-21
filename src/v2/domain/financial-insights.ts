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
import { expandRecurrence } from "./recurrence";
import { calculateCategorySpendingHistory } from "./spending-history";
import type { CalendarDate, V2Cents } from "./types";
import type { FinancialWorkspace } from "./workspace";
import { deriveSpendableCashCents } from "./accounts";

export type ForecastHorizonDays = 30 | 60 | 90;
export type ForecastConfidence = "scheduled" | "estimated";
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
  scheduledIncomeCents: V2Cents;
  scheduledOutflowCents: V2Cents;
  estimatedOutflowCents: V2Cents | null;
  events: readonly ForecastEvent[];
  unknowns: readonly string[];
}>;

export type ObligationStatus =
  "overdue" | "upcoming" | "paid" | "cancelled" | "unknown";
export type Obligation = Readonly<{
  key: string;
  name: string;
  amountCents: V2Cents | null;
  paidCents: V2Cents;
  remainingCents: V2Cents | null;
  date: CalendarDate | null;
  status: ObligationStatus;
  kind: "bill" | "debt-payment";
  required: boolean;
  sourceId: string;
}>;

export type SmartRecommendation = Readonly<{
  priority: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  amountCents: V2Cents | null;
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

function uniqueDefinitions(
  definitions: readonly ExpenseDefinition[],
): ExpenseDefinition[] {
  // IDs identify records. Two separate bills may legitimately share every
  // user-visible field, so content-based deduplication would lose real data.
  return uniqueById(definitions);
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
  if (account.paymentRequirement !== "required") return null;
  const amount =
    account.requiredPaymentCents ?? account.requiredMonthlyPaymentCents;
  if (amount === undefined || amount <= 0) return null;
  return asV2Cents(amount);
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
  const linked = new Map<string, DatedExpenseEvent[]>();
  for (const event of events) {
    if (!event.definitionId) continue;
    const key = linkedEventKey(event.definitionId, event.dueDate);
    linked.set(key, [...(linked.get(key) ?? []), event]);
  }
  const result: Obligation[] = [];

  const makeObligation = (input: {
    key: string;
    name: string;
    amountCents: V2Cents | null;
    date: CalendarDate | null;
    status: ObligationStatus;
    kind: "bill" | "debt-payment";
    required: boolean;
    sourceId: string;
    paidCents?: V2Cents;
  }): Obligation => {
    const paidCents = input.paidCents ?? asV2Cents(0);
    return {
      ...input,
      paidCents,
      remainingCents:
        input.amountCents === null
          ? null
          : asV2Cents(Math.max(0, input.amountCents - paidCents)),
    };
  };

  for (const event of events) {
    if (event.obligation !== "required") continue;
    if (event.definitionId) continue;
    if (event.status === "actual" || event.status === "cancelled") {
      result.push(
        makeObligation({
          key: `event:${event.id}`,
          name: event.name,
          amountCents: event.amountCents,
          date: eventDate(event),
          status: event.status === "actual" ? "paid" : "cancelled",
          kind:
            event.transactionType === "credit-card-payment"
              ? "debt-payment"
              : "bill",
          required: true,
          sourceId: event.id,
          paidCents:
            event.status === "actual" ? event.amountCents : asV2Cents(0),
        }),
      );
    } else if (compareCalendarDates(event.dueDate, today) < 0) {
      result.push(
        makeObligation({
          key: `event:${event.id}`,
          name: event.name,
          amountCents: event.amountCents,
          date: event.dueDate,
          status: "overdue",
          kind: "bill",
          required: true,
          sourceId: event.id,
        }),
      );
    } else if (compareCalendarDates(event.dueDate, horizonEnd) <= 0) {
      result.push(
        makeObligation({
          key: `event:${event.id}`,
          name: event.name,
          amountCents: event.amountCents,
          date: event.dueDate,
          status: "upcoming",
          kind: "bill",
          required: true,
          sourceId: event.id,
        }),
      );
    }
  }

  for (const definition of uniqueDefinitions(workspace.expenseDefinitions)) {
    if (definition.status === "paused" || definition.status === "cancelled")
      continue;
    const expanded = expandRecurrence({
      recurrence: definition.recurrence,
      bounds: definition.bounds,
      horizonStart: addCalendarDays(today, -62),
      horizonEnd,
    }).occurrences;
    const prior = expanded
      .filter((date) => compareCalendarDates(date, today) < 0)
      .at(-1);
    const occurrences = expanded.filter(
      (date) => compareCalendarDates(date, today) >= 0 || date === prior,
    );
    if (
      occurrences.length === 0 &&
      definition.recurrence.kind === "irregular"
    ) {
      result.push(
        makeObligation({
          key: `definition:${definition.id}:unknown`,
          name: definition.name,
          amountCents: definition.amountCents,
          date: null,
          status: "unknown",
          kind: "bill",
          required: definition.obligation === "required",
          sourceId: definition.id,
        }),
      );
    }
    if (
      occurrences.length === 0 &&
      definition.recurrence.kind === "one-time" &&
      compareCalendarDates(definition.recurrence.date, today) < 0 &&
      !linked.get(linkedEventKey(definition.id, definition.recurrence.date))
        ?.length
    ) {
      result.push(
        makeObligation({
          key: `definition:${definition.id}:unknown`,
          name: definition.name,
          amountCents: definition.amountCents,
          date: definition.recurrence.date,
          status: "overdue",
          kind: "bill",
          required: definition.obligation === "required",
          sourceId: definition.id,
        }),
      );
    }
    for (const date of occurrences) {
      const matchingEvents =
        linked.get(linkedEventKey(definition.id, date)) ?? [];
      const cancelled = matchingEvents.some(
        (event) => event.status === "cancelled",
      );
      const paidCents = asV2Cents(
        matchingEvents
          .filter((event) => event.status === "actual")
          .reduce((sum, event) => sum + event.amountCents, 0),
      );
      const fullyPaid = paidCents >= definition.amountCents;
      result.push(
        makeObligation({
          key: `definition:${definition.id}:${date}`,
          name: definition.name,
          amountCents: definition.amountCents,
          date,
          status: cancelled
            ? "cancelled"
            : fullyPaid
              ? "paid"
              : compareCalendarDates(date, today) < 0
                ? "overdue"
                : "upcoming",
          kind: "bill",
          required: definition.obligation === "required",
          sourceId: definition.id,
          paidCents: asV2Cents(Math.min(paidCents, definition.amountCents)),
        }),
      );
    }
  }

  for (const account of workspace.liabilityAccounts.filter(
    (item) => item.status === "active",
  )) {
    const amount = debtInstallmentCents(account);
    if (account.paymentRequirement !== "required") continue;
    if (!amount || !account.nextPaymentDate) {
      result.push(
        makeObligation({
          key: `debt:${account.id}:unknown`,
          name: account.name,
          amountCents: amount,
          date: account.nextPaymentDate ?? null,
          status: "unknown",
          kind: "debt-payment",
          required: true,
          sourceId: account.id,
        }),
      );
      continue;
    }
    const recordedPayments = events
      .filter(
        (event) =>
          event.status === "actual" &&
          event.transactionType === "credit-card-payment" &&
          event.relatedAccountId === account.id,
      )
      .sort((left, right) => eventDate(left).localeCompare(eventDate(right)));
    const scheduleAnchor = account.nextPaymentDate;
    const priorBoundary =
      account.paymentFrequency === "weekly"
        ? addCalendarDays(scheduleAnchor, -7)
        : account.paymentFrequency === "biweekly"
          ? addCalendarDays(scheduleAnchor, -14)
          : account.paymentFrequency === "semimonthly"
            ? addCalendarDays(scheduleAnchor, -16)
            : addCalendarMonths(scheduleAnchor, -1);
    // The full cash payment satisfies the installment. Only the known
    // principal portion reduces an installment-loan balance.
    let paymentPool = recordedPayments
      .filter(
        (event) => compareCalendarDates(eventDate(event), priorBoundary) > 0,
      )
      .reduce((sum, event) => sum + event.amountCents, 0);
    const restoredPrincipal = recordedPayments
      .filter(
        (event) => compareCalendarDates(eventDate(event), priorBoundary) > 0,
      )
      .reduce(
        (sum, event) =>
          sum +
          (account.type === "credit-card" || account.type === "line-of-credit"
            ? event.amountCents
            : (event.principalAmountCents ?? 0)),
        0,
      );
    let debtRemaining = Math.max(
      0,
      account.currentBalanceCents + restoredPrincipal,
    );
    let installmentOffset = 0;
    let nextPaymentDate = scheduleAnchor;
    while (
      compareCalendarDates(nextPaymentDate, horizonEnd) <= 0 &&
      debtRemaining > 0
    ) {
      const installment = asV2Cents(Math.min(amount, debtRemaining));
      const applied = asV2Cents(Math.min(paymentPool, installment));
      const status: ObligationStatus =
        applied >= installment
          ? "paid"
          : compareCalendarDates(nextPaymentDate, today) < 0
            ? "overdue"
            : "upcoming";
      result.push(
        makeObligation({
          key: `debt:${account.id}:${nextPaymentDate}`,
          name: account.name,
          amountCents: installment,
          date: nextPaymentDate,
          status,
          kind: "debt-payment",
          required: true,
          sourceId: account.id,
          paidCents: applied,
        }),
      );
      paymentPool -= applied;
      debtRemaining -= installment;
      installmentOffset += 1;
      if (account.paymentFrequency === "semimonthly") {
        result.push(
          makeObligation({
            key: `debt:${account.id}:unknown-future-schedule`,
            name: account.name,
            amountCents: amount,
            date: null,
            status: "unknown",
            kind: "debt-payment",
            required: true,
            sourceId: account.id,
          }),
        );
        break;
      }
      nextPaymentDate = debtDateAfter(
        scheduleAnchor,
        account,
        installmentOffset,
      );
    }
  }

  const rank: Record<ObligationStatus, number> = {
    overdue: 0,
    upcoming: 1,
    unknown: 2,
    cancelled: 3,
    paid: 4,
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
      confidence: "scheduled",
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
        confidence: "scheduled",
        required: false,
      });
    }
  }

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
    const remaining = obligation.remainingCents ?? obligation.amountCents;
    if (!remaining) continue;
    events.push({
      key: `obligation:${obligation.key}`,
      date:
        compareCalendarDates(obligation.date, today) < 0
          ? today
          : obligation.date,
      label: obligation.name,
      amountCents: remaining,
      direction: "outflow",
      kind: obligation.kind,
      confidence: "scheduled",
      required: obligation.required,
    });
  }

  const history = calculateCategorySpendingHistory(
    uniqueById(workspace.expenseEvents),
    today,
  );
  const definitions = uniqueDefinitions(workspace.expenseDefinitions).filter(
    (definition) =>
      definition.status !== "paused" && definition.status !== "cancelled",
  );
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
    scheduledIncomeCents: sum(
      (event) =>
        event.confidence === "scheduled" && event.direction === "inflow",
    ),
    scheduledOutflowCents: sum(
      (event) =>
        event.confidence === "scheduled" && event.direction === "outflow",
    ),
    estimatedOutflowCents:
      reliableMonthlyEveryday > 0
        ? sum(
            (event) =>
              event.confidence === "estimated" && event.direction === "outflow",
          )
        : null,
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
      (sum, item) => sum + (item.remainingCents ?? item.amountCents ?? 0),
      0,
    );
    return {
      priority: 1,
      title: "Check an overdue payment",
      amountCents: asV2Cents(total),
      explanation: `${overdue.length === 1 ? firstOverdue.name : `${overdue.length.toString()} payments`} ${overdue.length === 1 ? "is" : "are"} overdue.`,
      actionLabel: "Review payments",
      actionHref: "/accounts",
    };
  }
  if (forecast.shortageDate) {
    return {
      priority: 2,
      title: "Cash may run short",
      amountCents: asV2Cents(Math.abs(Math.min(0, forecast.lowestCashCents))),
      explanation: "A scheduled payment may put available cash below $0.",
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
      amountCents: asV2Cents(spending.spentThisMonthCents - recordedIncome),
      explanation: "Check for missing income or adjust this month's plan.",
      actionLabel: "Review monthly plan",
      actionHref: "/plan",
    };
  }
  if (spending.meaningfulOverages.length > 0) {
    const first = spending.meaningfulOverages[0];
    if (!first) throw new Error("Expected a budget overage.");
    return {
      priority: 3,
      title: `${BUDGET_CATEGORIES[first.category]} is over plan`,
      amountCents: first.amountCents,
      explanation: "Review the amount planned for this category.",
      actionLabel: "Review monthly plan",
      actionHref: "/plan",
    };
  }
  const unusual = spending.unusualCategories[0];
  if (unusual) {
    return {
      priority: 4,
      title: `${BUDGET_CATEGORIES[unusual.category]} is higher than usual`,
      amountCents: unusual.spentCents,
      explanation: `Usual monthly average: ${cad(unusual.historicalAverageCents)}.`,
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
      amountCents:
        unknownRequired.remainingCents ?? unknownRequired.amountCents,
      explanation: `${unknownRequired.name} needs an amount or date.`,
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
      amountCents: null,
      explanation:
        "Forecasts cannot include income until an amount and date are saved.",
      actionLabel: "Review accounts",
      actionHref: "/accounts",
    };
  }
  return {
    priority: 5,
    title: "Your next 30 days look covered",
    amountCents: forecast.endCashCents,
    explanation: "Based on the balances and dates saved.",
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
