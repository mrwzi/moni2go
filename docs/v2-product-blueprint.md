# moni2go V2 Product and Technical Blueprint

Status: proposed; implementation requires phase approval  
Date: 2026-09-23  
Scope: specification only  
V1 compatibility rule: preserve the tested V1 financial engine and Scenario Lab

## 1. Product purpose

moni2go V2 is a local-first personal money, cash-flow, debt, budgeting, and financial-decision engine for Canadians. It helps a user model what money is available, when income and obligations occur, where money is allocated, which dated conditions need attention, and what inputs would produce a selected outcome.

V2 expands the V1 question—“What happens if one monthly value changes?”—into:

> Given my current cash, dated income, obligations, spending, debts, periodic expenses, and goals, what is my projected position, when are pressure points, and what alternatives can I model?

moni2go remains an analysis product. It does not make affordability decisions, rank a person’s choices morally, or provide individualized financial advice.

## 2. Initial users

The initial V2 audience is Canadian students, recent graduates, workers with one or more income sources, people with irregular pay, and households that need a clear short-term cash-flow view without connecting a bank account. The first release should optimize for a single person managing CAD cash flow. Shared-household collaboration, multi-currency accounting, business bookkeeping, tax preparation, and investment portfolio management are non-goals.

## 3. Product principles

1. **Dates before averages.** Short-term projections use expected dated events. Monthly averages are summaries and planning aids, not substitutes for event timing.
2. **Deterministic numerical truth.** Every number and attention item comes from a tested domain function with traceable inputs and assumptions.
3. **Local first.** Raw personal financial data remains in the browser unless a future, separately approved export or connector flow makes a specific disclosure and obtains consent.
4. **Facts without judgment.** Say what occurs, by how much, and when. Do not tell the user that a choice is bad, irresponsible, unhealthy, or unaffordable.
5. **Progressive value.** A user can see a useful 30-day projection after entering current cash, the next income, and major obligations. Detailed categorization is optional.
6. **Cent-safe money.** CAD amounts are integer cents. UI components never perform financial arithmetic.
7. **Calendar-safe timing.** Dated models use calendar dates rather than implicit UTC timestamps. Recurrence expansion is explicit and bounded.
8. **Source clarity.** Personal calculations and public Canadian context are separate layers. Public data always shows source, observation date, retrieval time, geography, and limitations.
9. **V1 is an asset.** Existing formulas, fixtures, methodology, privacy controls, and tests remain protective contracts. V2 extends around them.
10. **No universal budget rule.** moni2go models entered obligations and goals. It does not impose 50/30/20 or another rule as a personalized target.

## 4. Product modes and information architecture

### 4.1 Modes

| Mode              | Purpose                                                         | Personal data                         |
| ----------------- | --------------------------------------------------------------- | ------------------------------------- |
| Demo              | Explore complete synthetic timelines and decisions immediately  | None                                  |
| My Money          | Maintain the local financial model and primary dashboard        | Browser-local only                    |
| Advanced Analysis | Preserve the V1 Scenario Lab and add later advanced comparisons | Browser-local or synthetic            |
| Canada Context    | View official economic, price, and rental reference data        | Public-data selections only           |
| Ask moni2go       | Future natural-language interface over deterministic tools      | Not implemented in V2 initial release |

### 4.2 Proposed routes

| Route             | Role                                                  | Migration behavior                                   |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `/`               | Product entry; Demo or My Money                       | Evolved, not removed                                 |
| `/demo`           | Synthetic V2 workspaces                               | Additive; does not replace `/explore`                |
| `/onboarding`     | Progressive Quick Start                               | New                                                  |
| `/today`          | Default My Money dashboard                            | New                                                  |
| `/cash-flow`      | 7/30/60/90-day dated timeline                         | New                                                  |
| `/budget`         | Categories, outflows, and draft allocation            | New                                                  |
| `/debts`          | Debt records and payoff modelling                     | New                                                  |
| `/goals`          | Goals and sinking funds                               | New                                                  |
| `/explore`        | V1 demo picker                                        | Retain during V2; optionally relabel Advanced demos  |
| `/build`          | V1 five-field baseline editor                         | Preserve unless a later explicit decision changes it |
| `/scenario`       | Existing Scenario Lab, branded “Advanced Analysis”    | Preserve URL and query contracts                     |
| `/advanced`       | V2 entry to advanced tools                            | Links to `/scenario`; no duplicated engine           |
| `/canada-context` | Official public-data context                          | New after public-data phase                          |
| `/methodology`    | Methodology hub                                       | Extend with modules and source registry              |
| `/privacy`        | Local-data, export/import, and public-data boundaries | Extend                                               |

Do not redirect existing V1 routes without a later explicit product decision plus direct-navigation, bookmark, and compatibility evidence. A redirect from a new `/advanced/scenario` alias to `/scenario` is acceptable because `/scenario` remains canonical.

### 4.3 Primary dashboard

The first screen is organized by user questions, not methodology terms.

**Today / next 30 days**

- Available cash today.
- Next expected income: amount, source, and date.
- Required obligations before that income.
- Lowest projected balance and date.
- Projected month-end balance.
- Switches for 7, 30, 60, and 90 days.

**Needs attention**

- Dated, factual items ordered by effective date and severity rule.
- Each item exposes “Why this appears” with inputs and calculation.
- Dismissal hides presentation only; it does not mutate financial events.

**Where money goes**

- Category amount and share of modeled outflows.
- Fixed, variable, periodic, debt, savings/goal, and intentionally unallocated groupings.

**Goals**

- Goal and sinking-fund progress, next contribution, projected completion, and deadline variance.

**Explore**

- Housing, income/work, cost-of-living, planned savings, debt-payment, periodic-expense, and goal-solver entry points.
- “Advanced Analysis” opens the preserved V1 Scenario Lab.

## 5. V2 user journeys

### 5.0 Product navigation and Home direction

Primary navigation is **Home · Accounts · Plan · Timeline · Settings**. “Explore” remains a secondary sample/analysis entry, not a primary destination.

Home progressively presents only supported deterministic values: manually entered accounts, spendable cash, total assets, total liabilities, and net worth. Future sections for before-next-pay, coming up, plans, needs attention, and quick actions must remain unavailable until their corresponding engines and creation flows exist. No placeholder balance or forecast may be shown as fact.

### 5.1 Demo

1. Choose a clearly labeled synthetic V2 household.
2. Land on Today with a prebuilt dated timeline.
3. Inspect a factual attention item and its trace.
4. Explore cash flow, budget, debt, goals, or Advanced Analysis.
5. Demo state never overwrites My Money.

### 5.2 Quick Start

1. Manually add asset accounts and liabilities with current values and as-of dates. Classify assets as spendable, restricted, or non-cash.
2. Add one or more next income events with dates.
3. Add major required bills due before/near those dates.
4. Optionally add a debt minimum.
5. See the first 30-day projection.
6. Continue later with categories, recurrences, debts, periodic expenses, goals, and location.

The flow must permit partial-but-valid data. Missing optional detail is labeled “Not entered,” never inferred as zero unless the user explicitly enters zero.

### 5.3 Irregular-income planning

1. Add historical received-income records or enter summarized months.
2. Inspect average, median, lowest, and highest complete observed month.
3. Select average, median, low month, or custom as the monthly planning basis.
4. Short-term cash flow still uses dated expected income events.

### 5.4 Known future expense

1. Enter the expense, target amount, amount reserved, and due date.
2. Choose contribution cadence.
3. See the required reservation per remaining contribution date.
4. Add the reservation to a draft budget or timeline explicitly.

### 5.5 Debt decision

1. Enter balance, contractual minimum, planned payment, supported interest model, due date, and optional deadline.
2. See disclosed payoff and interest estimates.
3. Compare extra-payment amounts without mutating the saved plan.
4. If a deadline is entered, show the payment required under the chosen debt assumptions and whether the current plan reaches it.

### 5.6 Goal solver

1. Select a desired outcome and target remainder/deadline.
2. Choose the variable moni2go may solve (income, housing, savings, debt payment, or periodic reservation).
3. Lock all other inputs.
4. Show the deterministic solved value, feasibility state, and substituted equation.

### 5.7 Future next-pay planning

A later budgeting phase should support **Plan my next pay**. Given an expected income event, required obligations before the subsequent expected income, user-entered plans, debt minimums, and flexible budget allocations, moni2go may produce a deterministic, editable allocation draft. Every proposed reservation must explain why it exists. moni2go must not silently move real money or claim that there is only one correct allocation.

The future product UI groups `FinancialGoal` and `SinkingFund` records under **Plans**. This is presentation language, not a third `Plan` domain entity. A goal and a known future expense remain distinct concepts.

### 5.8 Future safe-to-use metric

A later cash-flow/budget phase may define **Safe to use** (final UX wording pending) as currently available consolidated cash minus cash explicitly reserved or required under a selected planning horizon. That phase must freeze the exact formula. The value must always trace to included events and reservations; it must never be an approximate or opaque AI-generated number.

### 5.9 Future what-if purchase scenario

A later scenario phase should support **What if I spend $X today?** by inserting a temporary modeled expense into a cash-flow projection. The result should show resulting current cash, the lowest projected future balance, affected obligations/plans, and a relevant shortfall date when present. This is modeled analysis only and does not mutate saved financial records.

## 6. Domain architecture

Use immutable plain TypeScript values validated at boundaries. IDs are opaque UUID strings generated locally. Dates are ISO `YYYY-MM-DD` calendar dates. Instants such as `createdAt` use ISO 8601 UTC strings. User-facing projections are evaluated in a stored IANA time zone, but daily domain calculations operate on calendar dates and must not rely on JavaScript `Date` parsing of bare date strings.

```ts
type Cents = number;
type BasisPoints = number; // 1999 = 19.99%
type LocalDate = string; // validated YYYY-MM-DD
type EntityId = string;
type Currency = "CAD";

type EntityMeta = Readonly<{
  id: EntityId;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}>;
```

All persisted financial entities include an `ownerSource: "synthetic-demo" | "user-entered"`. Synthetic workspace IDs and user workspace IDs occupy separate stores/namespaces; copying a demo creates a new user workspace only after an explicit action.

### 6.1 Workspace and context

```ts
type FinancialWorkspace = EntityMeta &
  Readonly<{
    schemaVersion: 2;
    ownerSource: "synthetic-demo" | "user-entered";
    name: string;
    currency: "CAD";
    asOfDate: LocalDate;
    timeZone: string;
    accountGroups: readonly AccountGroup[];
    assetAccounts: readonly AssetAccount[];
    liabilityAccounts: readonly LiabilityAccount[];
    allocationRules: readonly AllocationRule[];
    defaultProjectionDays: 30 | 60 | 90;
    planningBasis: IncomePlanningBasis;
    context?: UserContext;
  }>;

type UserContext = Readonly<{
  province?: CanadianProvinceTerritoryCode;
  populationCentreId?: string;
  // No street address, postal address, or precise coordinates.
  preferences?: {
    firstDayOfWeek: "monday" | "sunday";
    defaultContributionCadence?: Recurrence;
  };
}>;
```

City/population-centre choices come from a versioned public geography list and store a stable source identifier plus display label. Do not require exact address or infer location from IP.

### 6.2 Recurrence

```ts
type Recurrence =
  | {
      kind: "weekly";
      intervalWeeks: number;
      weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    }
  | { kind: "biweekly"; anchorDate: LocalDate }
  | { kind: "semimonthly"; firstDay: number; secondDay: number }
  | { kind: "monthly"; day: number; monthEndPolicy: "clamp" }
  | { kind: "irregular" }
  | { kind: "one-time" };

type RecurrenceBounds = Readonly<{
  startDate: LocalDate;
  endDate?: LocalDate;
}>;
```

Rules:

- `intervalWeeks` is a positive integer; biweekly means every 14 calendar days from the anchor.
- Semimonthly is two configured days per month, not “every 15 days.” Days must be distinct and ordered.
- A monthly/semimonthly day absent from a month clamps to that month’s last calendar day.
- Expansion includes occurrences on both horizon boundaries and respects optional end date.
- Irregular records require explicit dated occurrences. One-time records emit once.
- Recurrence expansion is bounded by caller horizon and a safety limit; it never creates an unbounded series.
- Editing a recurrence supports “this occurrence” as an exception and “this and future” as a new series, but that UI is not required in the first engine phase.

### 6.3 Manual accounts and derived totals

V2 stores manually entered asset and liability accounts. The records are not connected or synchronized bank accounts, and individual records are the only authoritative source for all totals.

Accounts may be organized under an `AccountGroup`, representing a manually named bank, credit union, online bank, investment platform, crypto platform, cash location, or other provider. A group has no monetary value; it is only a container. One bank can therefore contain chequing, savings, credit-card, and other accounts without conflating the bank with an account balance.

```ts
type AccountGroup = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    name: string;
    type:
      | "bank"
      | "credit-union"
      | "online-bank"
      | "investment-platform"
      | "crypto-platform"
      | "cash"
      | "other";
    status: "active" | "archived";
  }>;

type AssetAccount = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    groupId?: EntityId;
    ownerSource: "synthetic-demo" | "user-entered";
    name: string;
    type:
      | "chequing"
      | "savings"
      | "cash"
      | "prepaid"
      | "tfsa"
      | "rrsp"
      | "fhsa"
      | "non-registered-investment"
      | "crypto"
      | "other-asset";
    currentValueCents: Cents; // signed, within the V2 money limit
    valueAsOfDate: LocalDate;
    spendability: "spendable" | "restricted" | "non-cash";
    includeInNetWorth: boolean;
    status: "active" | "archived";
    institutionLabel?: string; // descriptive only
    note?: string;
  }>;

type LiabilityAccount = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    groupId?: EntityId;
    ownerSource: "synthetic-demo" | "user-entered";
    name: string;
    type:
      | "credit-card"
      | "line-of-credit"
      | "student-loan"
      | "personal-loan"
      | "auto-loan"
      | "mortgage"
      | "other-debt";
    currentBalanceCents: Cents; // non-negative
    balanceAsOfDate: LocalDate;
    includeInNetWorth: boolean;
    status: "active" | "archived";
    institutionLabel?: string;
    note?: string;
  }>;
```

`spendableCashCents`, total assets, total liabilities, and net worth are checked derivations and are never independently persisted. Spendable cash sums active assets classified `spendable`; net worth subtracts included active liabilities from included active assets. Negative deposit-account values are allowed. Overdraft availability and credit limits are never counted as assets.

Accounts never store usernames, passwords, bank/card/account numbers, transit or institution numbers, CVVs, credentials, or OAuth tokens. Asset and liability type unions are separate. Account-to-account transfers, holdings, market pricing, account-specific payment routing, reconciliation, and overdraft facilities are outside the initial V2 contract.

The UI labels this area **Accounts**, identifies records as manually added, and presents spendable cash, assets, liabilities, and net worth without implying bank connectivity. Account values have explicit as-of dates. The default stale-review threshold is 14 calendar days; reminder preference is weekly, biweekly, monthly, or never.

### 6.4 Income

```ts
type IncomeSource = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    name: string;
    defaultAmountCents?: Cents;
    recurrence: Recurrence;
    bounds: RecurrenceBounds;
    expectedDateAdjustment?: "none" | "previous-weekday" | "next-weekday";
  }>;

type IncomeEvent = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    sourceId?: EntityId;
    name: string;
    amountCents: Cents;
    expectedDate: LocalDate;
    status: "expected" | "received" | "missed" | "cancelled";
    receivedDate?: LocalDate;
    generatedFromOccurrence?: LocalDate;
  }>;

type HistoricalIncomeRecord = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    sourceId?: EntityId;
    amountCents: Cents;
    receivedDate: LocalDate;
  }>;

type IncomePlanningBasis =
  | { kind: "average"; observationStart: LocalDate; observationEnd: LocalDate }
  | { kind: "median"; observationStart: LocalDate; observationEnd: LocalDate }
  | {
      kind: "low-month";
      observationStart: LocalDate;
      observationEnd: LocalDate;
    }
  | { kind: "custom"; monthlyCents: Cents };
```

Expected and received are separate states; receipt does not overwrite the original expected date. Historical records may be imported later, but manual entry is sufficient initially.

### 6.5 Expenses and normalized categories

```ts
type ExpenseTiming = "fixed" | "variable" | "periodic" | "unexpected";
type Flexibility = "required" | "flexible" | "optional";

type ExpenseDefinition = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    name: string;
    amountCents: Cents;
    categoryId: BudgetCategoryId;
    timing: ExpenseTiming;
    flexibility: Flexibility;
    recurrence: Recurrence;
    bounds: RecurrenceBounds;
    dueDayPolicy?: "exact" | "previous-weekday" | "next-weekday";
  }>;

type ExpenseEvent = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    definitionId?: EntityId;
    name: string;
    amountCents: Cents;
    categoryId: BudgetCategoryId;
    flexibility: Flexibility;
    dueDate: LocalDate;
    status: "expected" | "paid" | "overdue" | "cancelled";
    paidDate?: LocalDate;
    generatedFromOccurrence?: LocalDate;
  }>;
```

Canonical categories:

| ID                         | Label                      | Group                      |
| -------------------------- | -------------------------- | -------------------------- |
| `housing`                  | Housing                    | essential outflow          |
| `utilities`                | Utilities                  | essential outflow          |
| `groceries`                | Groceries                  | variable outflow           |
| `restaurants`              | Restaurants / eating out   | flexible outflow           |
| `transportation`           | Transportation             | mixed outflow              |
| `insurance`                | Insurance                  | essential/periodic outflow |
| `phone-internet`           | Phone / internet           | outflow                    |
| `health-personal-care`     | Health / personal care     | mixed outflow              |
| `education`                | Education                  | mixed/periodic outflow     |
| `subscriptions`            | Subscriptions              | flexible outflow           |
| `entertainment-recreation` | Entertainment / recreation | flexible outflow           |
| `clothing`                 | Clothing                   | flexible/periodic outflow  |
| `shopping`                 | Shopping                   | flexible outflow           |
| `debt-payment`             | Debt payments              | debt obligation            |
| `savings-goals`            | Savings / goals            | planned transfer           |
| `other`                    | Other                      | user-classified            |

Categories describe purpose; `timing` and `flexibility` are independent dimensions. Users may add custom categories with a stable ID and parent group, but built-in IDs cannot be redefined. “Unexpected” is a recorded/planned modelling classification, not a sinking fund.

### 6.6 Debts

```ts
type DebtInterestModel =
  | { kind: "interest-free" }
  | {
      kind: "simple-daily-apr";
      aprBasisPoints: BasisPoints;
      dayCount: "actual-365";
      posting: "monthly";
    };

type Debt = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    name: string;
    type:
      | "credit-card"
      | "line-of-credit"
      | "student-loan"
      | "personal-loan"
      | "auto-loan"
      | "family"
      | "other";
    balanceCents: Cents;
    balanceAsOfDate: LocalDate;
    interestModel: DebtInterestModel;
    minimumPayment: { kind: "fixed"; amountCents: Cents };
    plannedPaymentCents: Cents;
    dueDay: number;
    payoffDeadline?: LocalDate;
    modelDisclosure: string;
  }>;
```

The first debt engine deliberately supports only interest-free and a disclosed APR-based estimated-interest model. Product-specific grace periods, new purchases, cash advances, fees, variable-rate formulas, compounding structures, promotional financing, penalty APRs, and issuer-specific minimum-payment formulas are not silently approximated. A user enters the contractual minimum shown by the lender. Unsupported products receive an `unsupported-interest-model` result rather than being coerced into the estimate model.

### 6.7 Goals and sinking funds

```ts
type FinancialGoal = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    name: string;
    type:
      | "emergency-fund"
      | "tuition"
      | "vehicle"
      | "travel"
      | "general-savings"
      | "custom";
    currentAmountCents: Cents;
    targetAmountCents: Cents;
    plannedContributionCents: Cents;
    contributionRecurrence: Recurrence;
    deadline?: LocalDate;
  }>;

type SinkingFund = EntityMeta &
  Readonly<{
    workspaceId: EntityId;
    name: string;
    targetExpenseCents: Cents;
    reservedCents: Cents;
    dueDate: LocalDate;
    contributionRecurrence: Recurrence;
    nextContributionDate: LocalDate;
    linkedExpenseEventId?: EntityId;
  }>;
```

A sinking fund is for a known future expense. An emergency fund is a user-defined goal for unknown events. The UI must not merge these concepts.

## 7. Calculation contracts

### 7.1 Money and rounding

- Persist and calculate money in safe integer cents.
- Percent/rate values are integers in basis points or validated rational inputs at boundaries.
- Division that produces cents uses one named rounding policy at the final allocation boundary: half away from zero unless a debt contract explicitly requires another documented method.
- Allocation algorithms distribute remainder cents deterministically by earliest due date, then stable ID.
- Display rounding never feeds later calculations.
- Values beyond safe aggregate limits produce a typed domain error rather than overflow.

### 7.2 Cash-flow event normalization

All sources normalize into:

```ts
type CashFlowEvent = Readonly<{
  id: EntityId;
  date: LocalDate;
  kind:
    | "income"
    | "expense"
    | "debt-payment"
    | "goal-transfer"
    | "sinking-fund-transfer"
    | "account-transfer";
  amountCents: Cents; // non-negative magnitude
  direction: "inflow" | "outflow" | "neutral-transfer";
  requiredness: "required" | "planned" | "optional";
  status: "expected" | "completed" | "cancelled";
  sourceEntityId: EntityId;
  label: string;
}>;
```

Cancelled events are excluded. Completed events before the as-of date are historical and do not affect the opening balance. Expected events after the horizon are not expanded.

For each calendar date:

```text
opening(date) = prior day closing balance
requiredOutflows(date) = sum expected required outflows
otherOutflows(date) = sum expected planned/optional outflows selected for projection
inflows(date) = sum expected inflows
closing(date) = opening + inflows − requiredOutflows − otherOutflows
```

Bank posting order within a date is unknowable. Therefore the engine also calculates:

```text
conservativeSameDayLow = opening − requiredOutflows − otherOutflows
```

If `conservativeSameDayLow < 0` but `closing >= 0` because income occurs on the same date, report “same-day timing uncertainty,” not a definite dated shortfall. A definite projected shortfall requires negative end-of-day closing or an explicitly timed event model added later.

### 7.3 Cash-flow outputs

```ts
type CashFlowProjection = Readonly<{
  asOfDate: LocalDate;
  throughDate: LocalDate;
  openingCashCents: Cents;
  nextExpectedIncome?: CashFlowEvent;
  obligationsBeforeNextIncome: readonly CashFlowEvent[];
  daily: readonly {
    date: LocalDate;
    events: readonly CashFlowEvent[];
    openingBalanceCents: Cents;
    conservativeSameDayLowCents: Cents;
    closingBalanceCents: Cents;
  }[];
  lowestClosingBalanceCents: Cents;
  lowestClosingBalanceDate: LocalDate;
  monthEndBalanceCents: Cents;
  firstShortfall?: { date: LocalDate; amountCents: Cents };
  sameDayTimingRisks: readonly { date: LocalDate; amountCents: Cents }[];
}>;
```

“Obligations before next income” includes required expense and debt events strictly before the next expected-income date. Same-date obligations are separately disclosed due to posting-order uncertainty. The 7/30/60/90 views use the same engine with different inclusive horizon end dates.

### 7.4 Irregular-income statistics

Historical received-income records are grouped by calendar month across an explicit inclusive observation window. Every complete month in that window participates; a month with no received records contributes zero. A partial current month is excluded unless the user explicitly includes it.

```text
monthlyTotal[m] = sum(received income in month m)
average = round(sum(monthlyTotal) / numberOfCompleteMonths)
median = middle value, or rounded mean of two middle values
lowMonth = minimum monthlyTotal (earliest month wins a tie)
highMonth = maximum monthlyTotal (earliest month wins a tie)
```

For summary-only recurrence conversion:

```text
weekly monthly equivalent = amount × 52 / 12
biweekly monthly equivalent = amount × 26 / 12
semimonthly monthly equivalent = amount × 2
monthly equivalent = amount
```

These equivalents use final cent rounding and never populate the dated short-term timeline. Irregular and one-time income have no automatic monthly equivalent.

### 7.5 Budget engine

The initial implemented planner derives its planning base from manually entered
spendable accounts or an explicitly entered next-payment amount. Category
amounts remain user-controlled. moni2go calculates category shares from those
amounts and runs five transparent checks: exact-cent reconciliation,
affordability, debt visibility, emergency-allocation visibility, and dated
benchmark context. Canadian household averages are contextual comparisons only
and are never silently applied as recommended targets.

The purchase what-if subtracts a temporary modeled purchase from the selected
planning base and matching category allocation. It does not mutate accounts,
saved balances, or actual spending records.

The budget engine operates on a selected planning month or a user-selected monthly planning basis.

```text
modeledIncome = selected planning-basis income
fixedExpenses = category sum where timing=fixed
variableExpenses = category sum where timing=variable
periodicReservations = active sinking-fund reservation requirements
debtObligations = entered minimum payments
plannedGoals = selected goal contributions
committedOutflows = fixed + variable + periodicReservations + debtObligations + plannedGoals
unallocatedCash = modeledIncome − committedOutflows − draftFlexibleAllocations
categoryShare = categoryOutflow / totalModeledOutflows
```

If total modeled outflows are zero, category shares are `null`. Negative unallocated cash is preserved. Draft allocations may target emergency fund, additional debt payment, general savings, goals, entertainment, restaurants, custom flexible categories, or intentionally unallocated cash. The sum must reconcile exactly to the available draft amount unless the user explicitly saves an over-allocated draft, in which case a factual attention item is produced.

Budget results do not rewrite dated events until the user explicitly applies a draft. A monthly budget can be valid while the dated cash-flow projection contains a timing shortfall; both states must be shown.

### 7.6 Sinking-fund engine

```text
remainingRequired = max(0, targetExpense − reserved)
eligibleContributionDates = recurrence dates from nextContributionDate through dueDate inclusive
baseReservation = floor(remainingRequired / count)
remainder = remainingRequired mod count
```

The first `remainder` contribution dates receive one extra cent so scheduled reservations sum exactly to the remaining requirement. If there are no eligible contribution dates and a positive remainder exists, the result is `deadline-passed-or-no-contribution-date`, not division by zero. The engine reports required amount per date, equivalent monthly display amount, funding gap, and whether the current planned reservations meet the entered deadline.

### 7.7 Debt engine

For `interest-free`, payments reduce principal directly. For `simple-daily-apr`:

```text
dailyRate = aprBasisPoints / 10_000 / 365
periodInterestUnrounded = principalCents × dailyRate × elapsedDays
postedInterestCents = roundAtPostingBoundary(periodInterestUnrounded)
paymentApplied = min(payment, principal + postedInterest)
```

The simulation advances between payment/posting dates and stops when balance reaches zero, the simulation cap is reached, or progress is impossible. Assumptions shown with every result:

- no new purchases, fees, missed-payment penalties, grace-period behavior, variable rates, promotional financing, or lender-specific formulas;
- APR/day-count/posting model used;
- payment date and amount schedule;
- the contractual minimum was user-entered, not inferred;
- estimates may differ from lender statements.

Outputs include payoff date, number of payments, total paid, estimated interest, final payment, deadline variance, and a schedule trace. If planned payment is below the entered minimum, surface the fact. If payments do not exceed accruing interest, return `non-amortizing-under-assumptions` rather than an invented payoff date.

Payment required for a deadline is solved with a monotonic integer-cent binary search over the disclosed simulation, bounded from entered minimum through current balance plus maximum simulated interest. Verify the returned cents value succeeds and one cent less fails when such a solution exists.

Future comparison strategies (`interest-first`, `balance-first`, `deadline-first`) consume the same debt results and explain trade-offs. They are not universal recommendations.

### 7.8 Goal engine

```text
remaining = max(0, target − current)
contributionDates = recurrence expansion from next contribution
timeToTarget = first date cumulative contributions >= remaining
```

If contribution is zero and remaining is positive, completion is `not-projected`. With a deadline, report required contribution schedule using the same exact-cent distribution as sinking funds, and report the difference between planned and required contributions. Investment returns are zero unless a future, explicit return model is introduced; V2 initial goals do not project returns.

### 7.9 Goal solver equations

Solvers accept locked inputs and return a typed result: `solved`, `already-satisfied`, `no-solution-under-constraints`, or `insufficient-input`.

```text
requiredMonthlyIncome = modeledMonthlyObligations + plannedAllocations + desiredRemaining
maximumHousingForDesiredRemaining = income − otherOutflows − plannedAllocations − desiredRemaining
maximumSavingsForDesiredRemaining = coreSurplus − desiredRemaining
periodicReservationPerOccurrence = exact distribution of (target − reserved) over remaining dates
requiredDebtPayment = minimum integer cents whose disclosed payoff simulation reaches deadline
```

Negative solved housing or savings returns “no non-negative solution under the entered constraints.” Solvers do not silently change locked values. Each result includes substituted inputs, constraint set, and one-cent verification where applicable.

## 8. Deterministic attention engine

```ts
type AttentionItem = Readonly<{
  id: string;
  ruleId: AttentionRuleId;
  effectiveDate?: LocalDate;
  level: "information" | "upcoming" | "attention" | "urgent";
  title: string;
  facts: readonly string[];
  sourceEntityIds: readonly EntityId[];
  trace: Readonly<Record<string, string | number | null>>;
}>;
```

Rules are ordered by effective date, then a documented stable rule priority. No opaque score or behavioral label is used. `urgent` is reserved for a required obligation that is due before projected available funds can cover it; it is never assigned by tone, amount size, or an AI model.

| Rule                         | Trigger                                                                     | Example output                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `obligations-before-income`  | One or more required obligations occur before next expected income          | “Three required obligations totalling $420 occur before your next expected income on October 8.” |
| `projected-negative-balance` | End-of-day projected balance falls below zero                               | “Your projected balance first falls below $0 by $74 on October 4.”                               |
| `same-day-timing-risk`       | Conservative same-day low is negative but closing is not                    | “Income and obligations occur on October 4; posting order may affect availability by $74.”       |
| `overdue-required-payment`   | Required unpaid event due before as-of date                                 | “A required $85 payment was due September 20 and is not marked paid.”                            |
| `required-payment-soon`      | Required unpaid event within user-visible threshold                         | “A required $85 payment is due in 3 days.”                                                       |
| `debt-minimum-due`           | Debt minimum event due in horizon                                           | “Debt A has a $60 entered minimum due October 2.”                                                |
| `debt-deadline-risk`         | Planned payment simulation ends after entered deadline or does not amortize | “At the entered payment, Debt B extends beyond its June 2027 deadline.”                          |
| `sinking-fund-gap`           | Reserved plus scheduled contributions is below target at due date           | “The tuition fund is projected to be $320 below its entered target on January 5.”                |
| `allocation-overflow`        | Planned transfers exceed projected available cash                           | “Planned allocations exceed projected remaining cash by $140 this month.”                        |

Every rule is independently testable and links to its methodology. The engine never uses terms such as “bad,” “unhealthy,” “too high,” or “cannot afford.”

## 9. V1 coexistence and Advanced Analysis

The V1 `Baseline`, `calculatePosition`, `applyScenario`, `comparePositions`, and `describeImpact` remain frozen. V2 introduces an adapter, not a replacement:

```ts
type V1BaselineDerivation = Readonly<{
  baseline: Baseline;
  periodStart: LocalDate;
  periodEnd: LocalDate;
  includedEntityIds: readonly EntityId[];
  assumptions: readonly string[];
}>;
```

The adapter derives a V1 monthly baseline from an explicitly selected month/planning basis:

- `incomeCents`: selected monthly planning-basis income or dated income total for the selected month;
- `housingCents`: housing-category expenses;
- `otherExpensesCents`: non-housing, non-debt consumption expenses;
- `debtPaymentsCents`: required/planned debt payments according to a visible selection;
- `plannedSavingsCents`: selected goal and savings transfers.

The user sees the derivation before opening Advanced Analysis. The original V1 custom baseline remains usable independently during migration. V2 must not make a richer workspace appear to have a canonical five-field monthly truth without naming the selected period and aggregation assumptions.

## 10. Local persistence and privacy

### 10.1 Persistence decision

Use **IndexedDB as the V2 system of record**, while retaining localStorage only for the existing V1 record and small non-financial bootstrap preferences. IndexedDB is preferable for normalized collections, atomic multi-store migrations, indexes by date/workspace, larger histories, and local export/import. Do not mirror personal entities into localStorage.

Database: `finscope`, IndexedDB physical version 1. Keep physical IndexedDB versioning separate from workspace `schemaVersion: 2`.

Object stores:

- `workspaces`, containing complete validated workspace aggregates
- `meta`, containing only active-workspace and migration/persistence metadata

The initial stores have no indexes. Financial subcollections are not duplicated into separate stores. Complete workspace writes are atomic.

### 10.2 V1 migration

1. On first V2 My Money load, read `finscope:baseline:v1` through the existing validated loader.
2. If absent, create nothing.
3. If malformed/unsupported, preserve the existing reset notice behavior; do not attempt heuristic repair.
4. If valid and no completed migration journal exists, present a migration preview.
5. On confirmation, create one V2 workspace and five clearly marked monthly aggregate records or retain the V1 baseline as a `legacyMonthlyBaseline` projection source. **Recommended:** retain it as a legacy snapshot plus derived monthly summary; do not invent due dates or recurrence.
6. Commit the V2 workspace and migration journal atomically.
7. Keep the V1 localStorage record during a compatibility release so `/scenario` continues to work.
8. Provide “Remove legacy copy” only after V2 export and Scenario Lab derivation are stable.

Migration must never invent pay dates, bill due dates, APRs, categories beyond the five known V1 fields, or historical records. The user progressively enriches the migrated model.

### 10.3 Export, import, recovery, and clearing

- Export is a locally generated UTF-8 JSON file with product name, export format version, generated timestamp, workspace data, and a SHA-256 integrity digest. It contains an explicit warning that the file includes financial data and is not encrypted by moni2go.
- Import parses locally, validates every record, shows a count/validation preview, and requires an explicit replace or merge choice. No network upload occurs.
- Merge uses entity IDs and rejects source/type collisions; it does not silently overwrite newer records.
- Before a destructive migration, create an in-database recovery snapshot and retain at most one prior schema snapshot.
- Unsupported future schema versions are read-only/rejected with export guidance; they are not reset automatically.
- Malformed individual V2 records are quarantined in a recovery report where safe; a database-level failure offers export-if-readable and reset.
- “Clear all personal data” deletes the IndexedDB database, V1 localStorage keys, local preferences that contain user content, and any registered offline caches containing personal documents. Demo fixtures/public caches may remain only if clearly non-personal.

No account, cookie, analytics event, server log, error payload, or URL may contain raw personal financial values. Service workers, if later added, must not cache pages containing rendered personal values.

## 11. Canadian public-data architecture

Public-data requests are independent of personal financial values. The browser sends only allowlisted public selections such as table/series ID, geography code, product ID, and requested observation range. A province selected for Canada Context may be passed as a public geography filter; no balances, income, expenses, debt, goals, names, or free text are sent.

```ts
type PublicObservation<T> = Readonly<{
  datasetId: string;
  seriesId: string;
  value: T;
  unit: string;
  observationDate: LocalDate;
  geography: { code: string; label: string };
  source: { publisher: string; title: string; url: string };
  retrievedAt: string;
  status: "current" | "stale";
  limitations: readonly string[];
}>;
```

Adapters normalize upstream data into this contract. UI never consumes raw upstream payloads.

### 11.1 Statistics Canada

The official [Web Data Service](https://www.statcan.gc.ca/en/developers/wds) exposes documented REST methods for metadata, vectors, latest periods, date ranges, and full CSV/SDMX table downloads. The [WDS user guide](https://www.statcan.gc.ca/en/developers/wds/user-guide) documents request limits, scalar/decimal metadata, release timing, and temporary `409` availability during updates.

Recommended retrieval:

- Use WDS vector/latest-period methods for a small allowlisted set of display series.
- Use `getCubeMetadata` during adapter development to verify dimensions and stable vector mappings.
- Use full-table CSV downloads in an offline ingestion/build job only where selecting vectors is impractical; validate ZIP/CSV schema and do not process these large files per user request.
- Store upstream release/reference date separately from `retrievedAt`.
- Apply scalar factors and published decimal precision explicitly.

Candidate datasets:

- CPI: [Table 18-10-0004-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401), monthly not seasonally adjusted. Use it for price-index change, not absolute shopping prices.
- Retail prices: [Table 18-10-0245-02](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810024502), monthly food reference prices. Confirm product/geography vectors through current metadata before coding; do not infer vector IDs from table labels.
- Household spending: tables 11-10-0222-01 through 11-10-0227-01 and 11-10-0125-01, described by the official [Survey of Household Spending guide](https://www150.statcan.gc.ca/n1/pub/62f0026m/62f0026m2025001-eng.htm). Display only as dated contextual household estimates with geography/sample/quality limitations, never as a recommended personal budget.

### 11.2 Grocery reference basket

The optional feature uses allowlisted products available in the current retail-price metadata. A basket item stores official product/size labels and quantity in compatible units. The reference total is:

```text
itemReference = officialAveragePrice × selectedCompatibleQuantity
basketReference = sum(itemReference)
```

Do not convert across incompatible package definitions without an explicit normalized-size field supplied by the source. Show the exact official product definition, reference month, geography, unit/size, missing observations, and retrieval time. Required copy:

> These are average reference prices. Brand, package size, quality, retailer, availability, and local geography vary. This is not a guaranteed shopping price.

Statistics Canada cautions that product rotation, quality/quantity changes, and preferences can affect average prices; use CPI rather than averaging product prices to describe inflation. Product membership must be data-driven—chicken, ground beef, eggs, milk, bread, rice, fruit, and vegetables are candidates only when the current official table contains compatible observations. Do not hard-code current prices.

### 11.3 CMHC rental context

The official [CMHC Rental Market Data](https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/rental-market) page publishes national, provincial, and local tables including vacancy rates and average rents for purpose-built rental housing and population centres.

No stable documented public API was confirmed during this blueprint review. Therefore:

- do not scrape the portal or invent endpoints;
- implement a `CmhcRentalAdapter` interface without a production fetcher first;
- prefer a documented downloadable table with a versioned ingestion manifest if CMHC terms and format permit;
- store source file URL, retrieval time, reference year, geography, structure type, bedroom type, and table notes;
- disable the feature gracefully if a maintainable machine-readable source is not confirmed.

Average rent is market context, not a statement of what the user should pay, and may not represent currently available units.

### 11.4 Bank of Canada

The official [Valet API](https://www.bankofcanada.ca/valet/docs/) provides documented series/group metadata and observation endpoints in JSON, CSV, and XML. Routes use the documented `https://www.bankofcanada.ca/valet/` base described in the [Valet how-to guide](https://www.bankofcanada.ca/valet-api-how-to/).

Use an allowlisted series registry with human-reviewed labels. Validate observations and cache them. Policy rates and macroeconomic series are context only; never substitute them for a user’s debt APR or forecast their payment.

### 11.5 Cache and failure policy

- Adapter responses have schema validation, source-specific freshness windows, ETag/Last-Modified support where available, and last-success metadata.
- UI remains useful without public data and labels unavailable/stale state.
- Start with standard Next.js server-side caching and revalidation. If later evidence proves that a durable last-known-good cache is required, approve that infrastructure separately; do not introduce Redis or a database pre-emptively.
- External response fixtures are sanitized public records and contract-tested. Integration tests use recorded schemas; a scheduled smoke test checks upstream compatibility without blocking the core app.

## 12. Future CSV and open-banking boundaries

Transaction import is future-ready through a local `TransactionCandidate` staging type containing date, description, signed cents amount, optional account reference, import batch ID, and categorization status. CSV files are parsed and validated in the browser where possible. Imported rows remain staged until the user reviews duplicates and mappings. Never use screen scraping.

A future regulated connector implements a `FinancialDataProvider` port returning the same normalized local entities. Provider tokens, consent, refresh, revocation, server boundary, and Canadian regulatory requirements require a separate threat model and product approval. Core engines depend only on normalized domain data and therefore do not need redesign. No bank credential collection is planned.

## 13. Future Ask moni2go architecture

AI is not part of the initial V2 implementation. The future boundary is:

```text
validated local data
  → deterministic domain tools
  → structured results and traces
  → optional natural-language renderer
```

Tool contracts include:

- `getCashFlowProjection`
- `getBudgetSummary`
- `compareScenario`
- `calculateDebtPayoff`
- `solveGoal`
- `getUpcomingObligations`
- `getCategoryAnalysis`

The model may select tools and explain their returned fields. It may not calculate financial results independently, mutate saved data without an explicit user action, or conceal tool assumptions. The provider is behind a `NaturalLanguageProvider` interface so local and cloud models can be evaluated.

Before any cloud-AI release, approve answers to: exactly which fields leave the device; whether minimization/aggregation is sufficient; explicit per-request consent; retention and training policies; regional processing; deletion; age considerations; incident logging/redaction; prompt-injection isolation; tool authorization; and a fully local/non-AI path. Raw data must never silently leave the browser.

## 14. Repository/module architecture

```text
src/
├─ domain/
│  ├─ ...existing V1 files (frozen)
│  └─ v2/
│     ├─ types/{workspace,dates,recurrence,income,expenses,debts,goals}.ts
│     ├─ schemas/{entities,import-export}.ts
│     ├─ calendar/{local-date,recurrence}.ts
│     ├─ cash-flow/{normalize-events,project,queries}.ts
│     ├─ income/{statistics,planning-basis}.ts
│     ├─ budget/{summarize,allocate}.ts
│     ├─ debt/{simulate,deadline-solver}.ts
│     ├─ goals/{project,sinking-fund}.ts
│     ├─ attention/{rules,explain}.ts
│     ├─ solver/{income,housing,savings,debt,periodic}.ts
│     └─ adapters/v1-baseline.ts
├─ persistence/
│  ├─ indexed-db/{database,repositories,migrations}.ts
│  ├─ export-import/{export,import,integrity}.ts
│  └─ legacy/v1-baseline-adapter.ts
├─ public-data/
│  ├─ contracts.ts
│  ├─ source-registry.ts
│  ├─ statcan/{client,adapter}.ts
│  ├─ bank-of-canada/{client,adapter}.ts
│  └─ cmhc/{adapter.ts, README.md}
├─ application/
│  ├─ workspace/
│  ├─ projections/
│  └─ commands/
├─ components/v2/
│  ├─ onboarding/
│  ├─ today/
│  ├─ cash-flow/
│  ├─ budget/
│  ├─ debts/
│  ├─ goals/
│  └─ attention/
└─ app/ ...routes listed above
```

Domain modules remain framework-free. Persistence implements repository ports. React hooks call application services; components receive display-ready view models and never duplicate formulas. Public-data adapters cannot import persistence repositories or personal domain entities.

## 15. Testing plan

### 15.1 Domain tests

- Money: safe-cent bounds, negative balances, half-cent boundaries, exact allocation remainder, and no `NaN`/Infinity.
- Calendar: inclusive bounds, weekly and 14-day biweekly sequences, semimonthly dates, month-end clamp, February, leap years, DST-adjacent dates, end dates, exceptions, and safety cap.
- Cash flow: multiple events/day, next income, obligations strictly before it, same-day timing uncertainty, definite shortfall, lowest/date tie-breaking, month end, status exclusion, neutral transfers, and 7/30/60/90 horizons.
- Income: multiple sources, complete zero-income months, average/median even and odd sets, lowest/highest tie-breaking, partial-month exclusion, recurrence monthly equivalents, and planning-basis selection.
- Budget: category totals, zero-outflow `null` shares, fixed/variable/periodic/debt/goal separation, exact draft reconciliation, negative unallocated cash, and custom categories.
- Sinking funds: already funded, one-cent remainder distribution, no contribution dates, deadline today/past, different cadences, and linked-expense non-duplication.
- Debt: 0% debt, the APR estimate model, leap-year elapsed days under the disclosed day-count assumption, minimum/planned payment handling, final small payment, non-amortizing payment, deadline binary-search minimality, zero balance, high APR, cent rounding, simulation cap, and explicit rejection of unsupported product behavior.
- Goals: already complete, zero contribution, exact completion, deadline requirement, no remaining dates, and optional deadline.
- Attention: every rule trigger/non-trigger, exact trace, stable ordering, neutral language lint, and no duplicated source event.
- Solvers: algebraic boundary cases, non-negative constraints, impossible states, and one-cent minimality.
- V1 adapter: exact five-field mapping, selected-period disclosure, and no invented dates/rates.

Use property-based tests where valuable for recurrence monotonicity, projection reconciliation, debt balance non-negativity, and exact-cent allocation sums.

### 15.2 Persistence and privacy tests

- IndexedDB repository CRUD and transaction rollback.
- V1 valid, empty, malformed, unsupported, already-migrated, and interrupted-migration states.
- Idempotent migration journal.
- Export round trip, integrity mismatch, unsupported version, partial corruption, merge conflict, and replace flow.
- Clearing removes all personal stores and legacy keys.
- Synthetic/user source discrimination.
- Sentinel personal values absent from URLs, request bodies, headers, logs, analytics, public-data calls, metadata, and caches.

### 15.3 Public-data tests

- Schema fixtures for WDS and Valet.
- Decimal/scalar application, missing/suppressed observations, geography labels, observation versus retrieval date, freshness, stale fallback, timeout, `409`, rate limiting, malformed payload, and source-link integrity.
- Grocery unit compatibility and unavailable-product behavior.
- CMHC feature disabled when no supported adapter exists.
- Core My Money functionality works with all public-data calls blocked.

### 15.4 Component/E2E/accessibility tests

- Quick Start gives value with minimum fields and supports progressive continuation.
- Full keyboard create/edit/delete/export/import flows.
- Screen-reader headings, landmarks, field errors, timeline tables/lists, live-region restraint, and focus restoration.
- Mobile timeline and dense financial tables have named, focusable scroll regions.
- Color is never the only attention/status cue.
- Demo never overwrites My Money.
- Direct navigation and refresh on every retained/new route.
- V1 suite remains green unchanged except intentional copy/route adapters.
- Browser matrix expands beyond Chromium before release; real assistive-technology checks remain manual gates.

## 16. Accessibility requirements

- Target WCAG 2.2 AA for primary journeys.
- Prefer semantic lists/tables over chart-only information; every visualization has an equivalent textual summary.
- Dated events expose full date, label, amount, status, and projected balance to assistive technology.
- Never announce every recalculation while typing; announce committed/settled summaries politely.
- Date controls support typed entry and do not require a pointer calendar.
- Drag-and-drop allocation has buttons/inputs providing the same operation.
- Focus moves to the first validation error and returns predictably after dialogs.
- Attention levels include text/icons, not color alone.
- Respect reduced motion, 200% zoom, high contrast, and touch targets.
- Plain language appears first; formulas and assumptions use progressive disclosure.

## 17. Staged implementation plan and gates

### Phase V2.0 — Contract freeze and decision records

**Modules/files:** this blueprint, ADRs for dates, IndexedDB, debt assumptions, category taxonomy.  
**Functionality:** TypeScript contracts and worked examples only.  
**Tests:** compile-only contract fixtures and golden examples.  
**Gate:** approval of unresolved decisions in section 20; no V1 behavior changes.  
**Out of scope:** persistence and UI.

### Phase V2.1 — Domain/data specification

**Modules/files:** `src/domain/v2/types`, schemas, local-date and recurrence modules.  
**Functionality:** normalized entities, validation, recurrence expansion.  
**Tests:** recurrence/date/leap-year/month-length/bounds suites.  
**Gate:** pure, framework-free domain; exhaustive fixtures pass; existing V1 suite passes unchanged.  
**Out of scope:** IndexedDB and projections.

### Phase V2.2 — Local persistence and V1 migration

**Modules/files:** `src/persistence`, repository ports, migration UI shell, export/import.  
**Functionality:** IndexedDB, atomic V1 migration preview, recovery, clear-all, export/import.  
**Tests:** fake IndexedDB/unit, browser persistence, interruption, corruption, sentinel leakage.  
**Gate:** migration is idempotent/recoverable; `/scenario` still reads its V1 record; no raw financial network traffic.  
**Out of scope:** new dashboard.

### Phase V2.3 — Cash-flow engine

**Modules/files:** recurrence normalizer, `cash-flow/project`, income statistics.  
**Functionality:** dated projections, 7/30/60/90 views, irregular-income planning basis.  
**Tests:** event ordering, recurrence, shortfall, same-day uncertainty, statistics, boundaries.  
**Gate:** golden timelines reconcile to the cent and distinguish monthly adequacy from dated shortfall.  
**Out of scope:** recommendations and debt interest.

### Phase V2.4 — Progressive onboarding and Today dashboard

**Modules/files:** `/onboarding`, `/today`, application services, demo V2 fixtures.  
**Functionality:** Quick Start, Today/30 days, initial attention facts, demo mode.  
**Tests:** minimum flow, partial data, keyboard/mobile/a11y, demo isolation, refresh.  
**Gate:** new user reaches a truthful projection with minimum data; no methodology overload; V1 routes remain operational.  
**Out of scope:** detailed budget/debt/goals.

### Phase V2.5 — Expenses and budget

**Modules/files:** expense editors, categories, budget summarize/allocate, `/budget`.  
**Functionality:** categorized outflows, shares, draft allocations, intentionally unallocated cash.  
**Tests:** totals/shares/reconciliation/over-allocation and UI flows.  
**Gate:** all budget totals trace to entities and reconcile; no universal target language.  
**Out of scope:** public benchmarks.

### Phase V2.6 — Debt engine

**Modules/files:** debt simulation/solver, `/debts`, methodology entries.  
**Functionality:** 0% and the disclosed APR estimate model, payoff/deadline/extra-payment comparisons.  
**Tests:** full debt edge matrix and lender-assumption disclosures.  
**Gate:** schedules reconcile to cent; minimal deadline payment verified; unsupported terms are not approximated silently.  
**Out of scope:** product-specific lender engines and strategy recommendations.

### Phase V2.7 — Goals and periodic expenses

**Modules/files:** goal/sinking-fund engines, `/goals`, timeline integration.  
**Functionality:** targets, completion dates, deadline contribution requirements, known periodic expenses.  
**Tests:** exact-cent schedules, deadline boundaries, timeline non-duplication.  
**Gate:** scheduled contributions plus reserved amount reconcile exactly to targets.  
**Out of scope:** investment-return forecasting.

### Phase V2.8 — Full attention engine

**Modules/files:** rule registry, explanation traces, dashboard attention panel.  
**Functionality:** all rules in section 8 and “Why this appears.”  
**Tests:** trigger/non-trigger, ordering, trace, neutral-language snapshot/lint.  
**Gate:** every item maps to a documented rule and source IDs; no opaque score.  
**Out of scope:** behavioral nudges.

### Phase V2.9 — Goal solver and Advanced Analysis adapter

**Modules/files:** solver modules, V1 adapter, `/advanced`; retain `/scenario`.  
**Functionality:** inverse questions and explicit V2-to-V1 derivation.  
**Tests:** solver minimality/impossibility, V1 golden cases, route compatibility.  
**Gate:** original V1 reference values still pass; no duplicated V1 formulas in UI/V2 modules.  
**Out of scope:** multi-variable optimization.

### Phase V2.10 — Canadian public-data layer

**Modules/files:** public-data registry/adapters, allowlisted server routes/cache, `/canada-context`.  
**Functionality:** CPI, grocery references, Bank of Canada context; CMHC only if a supported ingestion contract is approved.  
**Tests:** upstream contracts/failure/freshness/privacy.  
**Gate:** source/date/geography/limitations always visible; core app works offline; no personal values enter requests.  
**Out of scope:** personalized external benchmarks.

### Phase V2.11 — Release hardening

**Modules/files:** full app/tests/docs/deployment.  
**Functionality:** migration rehearsal, performance, browser/a11y/security/privacy review.  
**Tests:** complete V1+V2 suite, physical-device/manual gates, dependency audit, production build.  
**Gate:** zero release-blocking defects; documented rollback including local schema compatibility.  
**Out of scope:** AI and open banking.

### Future Phase — Ask moni2go

Requires separate privacy approval and threat model. It cannot begin merely because V2 engines exist.

## 18. Explicit non-goals

- Financial advice, credit decisions, affordability approvals, or moral judgments.
- Authentication, mandatory accounts, cloud synchronization, or server storage of raw personal finances.
- Bank credential collection, screen scraping, or unregulated open-banking integration.
- Tax calculation/filing, payroll calculation, investment advice/returns, multi-currency, business accounting, or household collaboration.
- Universal budget percentages or automatically imposed emergency-fund targets.
- Automatic use of Bank of Canada rates as personal debt APRs.
- Undocumented public APIs or scraped CMHC data.
- CSV transaction import in the first V2 release.
- AI-authored calculations or an AI release in the implementation phases above.

## 19. Highest risks

1. **Calendar correctness:** recurrence, month-end, leap-year, and same-day posting ambiguity can create misleading shortfall dates.
2. **Debt product diversity:** a generic APR model cannot represent all Canadian credit contracts; scope and disclosures must remain strict.
3. **Migration ambiguity:** V1 monthly aggregates contain no dates/categories/APRs, so enriching them automatically would invent facts.
4. **Local data durability:** browser clearing, private mode, quota, and device loss require prominent export/recovery education.
5. **Complexity overload:** normalized data can recreate accounting software; progressive onboarding and default dashboard restraint are essential.
6. **External-source drift:** table dimensions/vector IDs/download formats change; adapters and contract monitoring are mandatory.
7. **Public-data cache limits:** standard framework caching may not provide a durable last-known-good value across every deployment/runtime; evidence must precede added infrastructure.
8. **Privacy regression:** future imports, error monitoring, AI, or connectors could undermine the current non-transmission guarantee.

## 20. Approved decisions and remaining implementation questions

The product owner approved consolidated cash, legacy-snapshot migration, required-event defaults, same-day uncertainty, limited typed debt models, versioned plain-JSON export, V1 route compatibility, a separated public-data boundary using standard Next.js caching first, CMHC deferment, and four synthetic V2 persona purposes. These decisions are frozen in `docs/adr/ADR-001` through `ADR-010`.

Implementation-level questions that remain intentionally open for later phases are:

1. Which calendar library, if any, best implements the frozen `LocalDate` contract without changing it?
2. What validated aggregate-cent ceiling should V2 use beyond V1's per-field `$1,000,000.00` boundary?
3. Which arbitrary/high-precision representation should implement debt-interest intermediates before the required cent-rounding boundary?
4. What exact synthetic amounts and dates best exercise each approved persona contract?
5. Which official CMHC ingestion mechanism, if any, can later satisfy ADR-009?

## 21. Definition of V2 initial-release done

V2 is ready when a user can locally create or migrate a financial workspace, obtain an exact dated 30-day cash-flow projection, understand the next income and obligations before it, identify a projected shortfall or timing uncertainty, categorize expenses, model debt/goals/known future expenses under disclosed assumptions, inspect traceable attention facts, export and clear all personal data, and still access the tested V1 Scenario Lab as Advanced Analysis. All of this must work without an account, bank connection, AI, or transmission of raw personal financial values.
