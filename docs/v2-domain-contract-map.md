# moni2go V2 Domain Contract Map

Status: Phase 1 contract freeze  
Date: 2026-09-23  
Implementation: none; this document defines framework-independent boundaries

## 1. Boundary rules

- Proposed V2 domain code will live under `src/domain/v2/` and have no React, Next.js, browser storage, network, or UI dependencies.
- Public functions accept validated immutable values and return new immutable values or typed errors. No module mutates inputs.
- CAD money is integer cents at persisted/public domain boundaries.
- Financial dates are canonical date-only strings, not JavaScript `Date` objects or UTC instants.
- Existing V1 domain modules remain frozen. Only the V1 adapter may depend on their types/functions as documented below.
- Components consume domain/application results; they never implement recurrence, money, projection, debt, budget, goal, or attention formulas.
- This contract map names proposed modules. It does not create their application code.

## 2. Shared domain vocabulary

```ts
type Cents = number; // safe integer CAD cents
type BasisPoints = number; // safe integer; 1999 = 19.99%
type LocalDate = string; // canonical YYYY-MM-DD, validated as a real date
type Instant = string; // canonical ISO 8601 UTC timestamp for audit metadata only
type EntityId = string; // opaque locally generated identifier
type Provenance = "synthetic-demo" | "user-entered";
type Commitment = "required" | "flexible" | "optional";
type Actuality = "expected" | "actual" | "cancelled";
```

`LocalDate` and `Instant` are intentionally different types. Financial scheduling uses `LocalDate`; `createdAt`, `updatedAt`, `exportedAt`, and `retrievedAt` use `Instant`.

## 3. Module inventory

### 3.1 `calendar/local-date`

| Contract item        | Definition                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Parse, validate, compare, format, and perform calendar arithmetic on date-only values.                                             |
| Inputs               | Untrusted strings at parsing boundary; validated `LocalDate`; signed integer day/month offsets.                                    |
| Outputs              | `Result<LocalDate, LocalDateError>`, comparison values, year/month/day parts, days-between counts.                                 |
| Invariants           | Canonical `YYYY-MM-DD`; real proleptic Gregorian date; same input produces same output in every timezone; no implicit time-of-day. |
| Money                | None.                                                                                                                              |
| Dates                | Owns the canonical date contract in section 4.                                                                                     |
| Mutation             | Never mutates input.                                                                                                               |
| V1 dependency        | None.                                                                                                                              |
| Non-responsibilities | Locale display copy, recurrence expansion, holiday/banking-day calendars, timestamps, event sorting.                               |

### 3.2 `calendar/recurrence`

| Contract item        | Definition                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Responsibility       | Expand a validated recurrence into occurrence dates within a bounded inclusive horizon.                                                                                        |
| Inputs               | `Recurrence`, recurrence start/end, inclusive horizon start/end, exception set, maximum occurrence count.                                                                      |
| Outputs              | Ordered unique `readonly LocalDate[]` or typed invalid/unbounded/limit error.                                                                                                  |
| Invariants           | Deterministic; bounded; no duplicate dates; dates inside both recurrence and horizon bounds; monthly clamp rule; biweekly is 14 days; semimonthly is twice per calendar month. |
| Money                | None.                                                                                                                                                                          |
| Dates                | Delegates all arithmetic/validation to `calendar/local-date`.                                                                                                                  |
| Mutation             | Never.                                                                                                                                                                         |
| V1 dependency        | None.                                                                                                                                                                          |
| Non-responsibilities | Producing money events, shifting for statutory holidays, deciding whether an occurrence is required, editing recurrence series.                                                |

### 3.2a `accounts`

| Contract item        | Definition                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Represent manually entered assets and liabilities and derive spendable cash, total assets, total liabilities, and net worth.                             |
| Inputs               | Validated `AccountGroup[]`, `AssetAccount[]`, and `LiabilityAccount[]` with dated values, statuses, net-worth inclusion, and asset spendability.         |
| Outputs              | Checked signed cent totals derived from active included records.                                                                                         |
| Invariants           | Groups carry no balance; group references resolve; stable IDs and workspace ownership; account type unions are disjoint; no credentials/account numbers. |
| Money                | Asset values may be signed; liability balances are non-negative; all values and derived totals are checked integer cents within the V2 ceiling.          |
| Dates                | Each value has a validated date-only as-of date. Freshness uses deterministic calendar-day difference.                                                   |
| Mutation             | Never.                                                                                                                                                   |
| V1 dependency        | None. V1 migration must not invent accounts, balances, values, institutions, or dates.                                                                   |
| Non-responsibilities | Bank connectivity, market pricing, holdings, synchronization, transfers, reconciliation, account-specific payment routing, or credit-limit modelling.    |

### 3.3 `events/normalize`

| Contract item        | Definition                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Convert validated income, expense, debt-payment, goal-transfer, and sinking-fund inputs into canonical financial events.                          |
| Inputs               | Source entities, expanded occurrence dates, projection inclusion policy.                                                                          |
| Outputs              | `readonly FinancialEvent[]` plus exclusions/normalization diagnostics.                                                                            |
| Invariants           | Stable IDs; non-negative magnitude; explicit direction; source/provenance retained; required/flexible/optional preserved; no event appears twice. |
| Money                | Integer cents; normalization does not calculate percentage money.                                                                                 |
| Dates                | One canonical `LocalDate` per event.                                                                                                              |
| Mutation             | Never.                                                                                                                                            |
| V1 dependency        | None.                                                                                                                                             |
| Non-responsibilities | Projecting balances, choosing event order within a date, classifying user records automatically, writing storage.                                 |

### 3.4 `cash-flow/project`

| Contract item        | Definition                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Calculate consolidated dated balances and same-day uncertainty from opening cash and normalized included events.                                                            |
| Inputs               | Consolidated opening `Cents` derived from included manual cash accounts, as-of `LocalDate`, inclusive through date, normalized events, explicit inclusion policy.           |
| Outputs              | `CashFlowProjection`: daily groups, closing balances, next income, obligations before it, lowest balance/date, month-end balance, shortfall and timing-uncertainty records. |
| Invariants           | Reconciles to the cent; input array order cannot affect output; cancelled/excluded events have no effect; no hidden within-day priority; tie-breaking is documented.        |
| Money                | Signed safe integer cents after each aggregate operation.                                                                                                                   |
| Dates                | Inclusive start/end; same-date grouping per section 4.                                                                                                                      |
| Mutation             | Never.                                                                                                                                                                      |
| V1 dependency        | None.                                                                                                                                                                       |
| Non-responsibilities | Generating recurrences, inferring commitment, account-specific liquidity, advice, probability forecasts.                                                                    |

### 3.5 `cash-flow/queries`

| Contract item        | Definition                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Responsibility       | Derive display-independent queries from a completed projection.                                          |
| Inputs               | `CashFlowProjection`.                                                                                    |
| Outputs              | Next expected income, obligations before income, 7/30/60/90 summaries, date ranges and trace references. |
| Invariants           | Cannot alter projection; every result points to event IDs/dates in the projection.                       |
| Money                | Reads integer cents only.                                                                                |
| Dates                | Uses projection dates; no new recurrence logic.                                                          |
| Mutation             | Never.                                                                                                   |
| V1 dependency        | None.                                                                                                    |
| Non-responsibilities | Formatting, attention severity, recalculation.                                                           |

### 3.6 `income/statistics`

| Contract item        | Definition                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Aggregate actual historical income by complete calendar month and calculate average, median, low, and high month.                       |
| Inputs               | Actual historical income records; inclusive observation start/end; partial-month inclusion flag.                                        |
| Outputs              | Ordered monthly totals and rounded statistics with source-month traces.                                                                 |
| Invariants           | Every complete month in the range participates, including zero-record months; cancelled/expected records excluded; stable tie-breaking. |
| Money                | Totals integer cents; division rounds once using the money contract.                                                                    |
| Dates                | Month membership derives from `LocalDate`; no timezone conversion.                                                                      |
| Mutation             | Never.                                                                                                                                  |
| V1 dependency        | None.                                                                                                                                   |
| Non-responsibilities | Forecasting an income event, replacing dated income in cash flow, recommending a planning basis.                                        |

### 3.7 `income/planning-basis`

| Contract item        | Definition                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Responsibility       | Resolve the user-selected average, median, low-month, or custom monthly planning amount.                   |
| Inputs               | Valid income statistics or custom cents plus selected basis.                                               |
| Outputs              | `PlanningIncome` containing amount, basis, observation range, and trace.                                   |
| Invariants           | Does not silently change basis; custom value is validated; unavailable history returns insufficient-input. |
| Money                | Integer cents.                                                                                             |
| Dates                | Carries observation range only.                                                                            |
| Mutation             | Never.                                                                                                     |
| V1 dependency        | None.                                                                                                      |
| Non-responsibilities | Dated cash-flow inflows, advice, probability/confidence intervals.                                         |

### 3.8 `expenses/categories`

| Contract item        | Definition                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Validate built-in/custom category IDs and parent group mappings.                                              |
| Inputs               | Category records and IDs.                                                                                     |
| Outputs              | Valid category descriptor or typed unknown/conflict error.                                                    |
| Invariants           | Built-in IDs cannot be redefined; category is independent of commitment and timing; custom IDs remain stable. |
| Money                | None.                                                                                                         |
| Dates                | None.                                                                                                         |
| Mutation             | Never.                                                                                                        |
| V1 dependency        | None.                                                                                                         |
| Non-responsibilities | Inferring requiredness, calculating budgets, importing merchant data.                                         |

### 3.9 `budget/summarize`

| Contract item        | Definition                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Responsibility       | Calculate monthly modeled income, category/group totals, outflow shares, committed outflows, and currently unallocated cash.                                             |
| Inputs               | Selected planning month/basis, included expense/debt/goal/sinking-fund records, categories.                                                                              |
| Outputs              | `BudgetSummary` with exact totals, nullable shares, and source-ID traces.                                                                                                |
| Invariants           | Every included cent belongs to exactly one output bucket; shares are null when denominator is zero; savings/goals remain distinct from consumption; negatives preserved. |
| Money                | Integer cents; ratios from unrounded totals.                                                                                                                             |
| Dates                | Period is explicit; recurring records are expanded elsewhere or passed as period totals.                                                                                 |
| Mutation             | Never.                                                                                                                                                                   |
| V1 dependency        | None; terminology aligns with V1 but formulas are not substituted implicitly.                                                                                            |
| Non-responsibilities | Universal percentage targets, applying a draft, dated liquidity projection.                                                                                              |

### 3.10 `budget/allocate`

| Contract item        | Definition                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Validate and reconcile a draft allocation of available monthly cash.                                                             |
| Inputs               | Available amount, allocation lines, intentional-unallocated amount, optional over-allocation permission.                         |
| Outputs              | Reconciled draft, difference, and trace or typed invalid result.                                                                 |
| Invariants           | Sum is exact to one cent; no duplicate line IDs; over-allocation is never silently clamped; targets are descriptive, not advice. |
| Money                | Integer cents; deterministic remainder handling if percentage inputs are later supported.                                        |
| Dates                | None.                                                                                                                            |
| Mutation             | Never.                                                                                                                           |
| V1 dependency        | None.                                                                                                                            |
| Non-responsibilities | Persisting/applying events, ranking allocations, cash-flow projection.                                                           |

### 3.11 `debt/simulate`

| Contract item        | Definition                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Simulate payoff under one accepted typed interest model and payment schedule.                                                                       |
| Inputs               | Debt balance/as-of date, `DebtInterestModel`, user-entered minimum, planned payments, simulation horizon/cap.                                       |
| Outputs              | Payoff schedule/result, total paid, estimated interest, payoff/deadline status, model and assumption trace; or unsupported/non-amortizing result.   |
| Invariants           | Principal never drops below zero; final payment does not exceed amount due; model kind/version always returned; unsupported behavior never coerced. |
| Money                | Boundaries in integer cents; interest intermediates use the high-precision rule in section 5.                                                       |
| Dates                | Calendar elapsed days and declared posting/payment dates.                                                                                           |
| Mutation             | Never.                                                                                                                                              |
| V1 dependency        | None. V1 debt payment field is not a debt model.                                                                                                    |
| Non-responsibilities | Lender statement reproduction, minimum-payment inference, new purchases, fees, promotions, variable rates, recommendations.                         |

### 3.12 `debt/deadline-solver`

| Contract item        | Definition                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Find the minimum integer-cent periodic payment that reaches an entered deadline under `debt/simulate`.                           |
| Inputs               | Valid debt, deadline, payment recurrence, lower/upper search bounds.                                                             |
| Outputs              | Solved cents and simulation proof, already-satisfied/no-solution/insufficient-input.                                             |
| Invariants           | Returned value succeeds and one cent less fails when a monotonic solution exists; bounded search; same assumptions as simulator. |
| Money                | Integer-cent binary search; no UI floating point.                                                                                |
| Dates                | Deadline and payment dates from calendar modules.                                                                                |
| Mutation             | Never.                                                                                                                           |
| V1 dependency        | None.                                                                                                                            |
| Non-responsibilities | Choosing a deadline, comparing debt strategies, advising payment priority.                                                       |

### 3.13 `goals/project`

| Contract item        | Definition                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Project goal progress/completion from current amount, target, and planned contributions.                        |
| Inputs               | Goal, contribution occurrence dates, optional deadline.                                                         |
| Outputs              | Remaining cents, projected completion or not-projected, deadline variance, trace.                               |
| Invariants           | Already-complete goals stay complete; zero contribution never produces invented completion; no returns assumed. |
| Money                | Integer cents.                                                                                                  |
| Dates                | Contribution dates and optional deadline are `LocalDate`.                                                       |
| Mutation             | Never.                                                                                                          |
| V1 dependency        | None.                                                                                                           |
| Non-responsibilities | Investment growth, emergency-fund target advice, scheduling transfers automatically.                            |

### 3.14 `goals/sinking-fund`

| Contract item        | Definition                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Calculate exact reservations required for a known future expense over eligible contribution dates.                                            |
| Inputs               | Target cents, reserved cents, due date, contribution recurrence/next date.                                                                    |
| Outputs              | Per-date reservation schedule, funding gap/status, monthly-equivalent display input, trace.                                                   |
| Invariants           | Reservations sum exactly to remaining requirement; extra cents go to earliest dates; no divide-by-zero; already-funded returns zero schedule. |
| Money                | Integer cents and deterministic remainder distribution.                                                                                       |
| Dates                | Eligible dates through due date inclusive.                                                                                                    |
| Mutation             | Never.                                                                                                                                        |
| V1 dependency        | None.                                                                                                                                         |
| Non-responsibilities | Unexpected-emergency modelling, investment returns, writing expense events.                                                                   |

### 3.15 `attention/evaluate`

| Contract item        | Definition                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Responsibility       | Evaluate registered factual rules against completed domain results and emit traceable attention items.                   |
| Inputs               | Projection, budget, debt, goal, sinking-fund results and as-of date.                                                     |
| Outputs              | Stable ordered `readonly AttentionItem[]`.                                                                               |
| Invariants           | Registered deterministic rule only; explicit condition ID; neutral template; source/result trace; no opaque score or AI. |
| Money                | Reads domain result cents; does not recalculate formulas.                                                                |
| Dates                | Related/effective dates already validated.                                                                               |
| Mutation             | Never.                                                                                                                   |
| V1 dependency        | None.                                                                                                                    |
| Non-responsibilities | Advice, behavioral scoring, notification delivery, dismiss-state persistence.                                            |

### 3.16 `solver/*`

| Contract item        | Definition                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Responsibility       | Solve one explicitly selected variable for desired income remainder, housing, savings, debt deadline, or periodic reservation. |
| Inputs               | Goal kind, desired result, locked validated inputs and constraints.                                                            |
| Outputs              | Solved/already-satisfied/no-solution/insufficient-input plus substituted equation and proof trace.                             |
| Invariants           | Changes one variable only; non-negative constraints explicit; no silent relaxation; debt solution delegates to debt solver.    |
| Money                | Integer cents; algebraic divisions use final rounding rule.                                                                    |
| Dates                | Only deadline-aware solvers consume `LocalDate`.                                                                               |
| Mutation             | Never.                                                                                                                         |
| V1 dependency        | Housing/income/savings monthly solvers may use V1 `calculatePosition` through the adapter, never duplicate its formula.        |
| Non-responsibilities | Multi-variable optimization, recommendations, UI state.                                                                        |

### 3.17 `adapters/v1-baseline`

| Contract item        | Definition                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Preserve a validated V1 snapshot and derive an auditable V1 `Baseline` from an explicitly selected V2 period for Advanced Analysis.                         |
| Inputs               | Existing V1 loader result or selected V2 period/entities and mapping choices.                                                                               |
| Outputs              | `LegacyMonthlyBaselineSnapshot` or `V1BaselineDerivation` with included IDs and assumptions.                                                                |
| Invariants           | Never invents missing facts; every derived cent traces to source IDs; five V1 fields remain semantically unchanged.                                         |
| Money                | Uses V1 `Cents`/`Baseline`.                                                                                                                                 |
| Dates                | Snapshot has no inferred financial date; derivation names its selected period.                                                                              |
| Mutation             | Never.                                                                                                                                                      |
| V1 dependency        | May import `Baseline`, `baselineSchema`, `calculatePosition`, and existing storage loader at the application/persistence boundary. It does not modify them. |
| Non-responsibilities | Migrating IndexedDB, selecting a period automatically, V1 scenario calculation, inventing categories/dates/APRs.                                            |

### 3.18 `public-data/normalize`

| Contract item        | Definition                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility       | Convert validated allowlisted official-source payloads into a source-neutral public observation contract.                                                     |
| Inputs               | Source adapter result plus allowlisted dataset/series/geography metadata.                                                                                     |
| Outputs              | `PublicObservation<T>` with source, identifiers, geography, observation date, retrieval instant, unit, freshness and limitations.                             |
| Invariants           | No personal financial value in input/output/request context; observation and retrieval dates distinct; source URL retained; missing/suppressed data explicit. |
| Money                | Public values retain source units/precision; they are not merged into personal cents without an explicit scenario action.                                     |
| Dates                | Observation may be date/month/year per source contract; retrieval is an instant.                                                                              |
| Mutation             | Never.                                                                                                                                                        |
| V1 dependency        | None.                                                                                                                                                         |
| Non-responsibilities | Fetching network data, caching, personalized recommendations, CMHC scraping.                                                                                  |

## 4. Frozen calendar-date contract

### 4.1 Canonical representation

`LocalDate` is a branded/validated string in exact ASCII `YYYY-MM-DD` form:

```text
2026-01-05  valid and canonical
2026-1-5    invalid
2026-02-29  invalid (2026 is not leap)
2028-02-29  valid
```

The supported year range will be a named constant selected during implementation and must cover all allowed financial horizons. Parsing performs syntactic validation and Gregorian calendar validation. Parsing never invokes `new Date("YYYY-MM-DD")`, `Date.parse`, locale parsing, or an implicit timezone.

### 4.2 Timezone independence and formatting

- Domain comparisons and arithmetic operate on year/month/day parts or a date-only library with equivalent semantics.
- Changing device timezone cannot change an event’s date or recurrence output.
- IANA workspace timezone is retained only for converting explicit instants (such as an imported transaction timestamp) into a date through an explicit conversion function.
- User display formatting receives a validated locale and `LocalDate`; it does not round-trip through an instant.
- Audit instants are UTC ISO strings and never substitute for financial dates.

### 4.3 Gregorian rules

- Leap year: divisible by 4, except century years not divisible by 400.
- February has 29 days only in a leap year.
- Month lengths are Gregorian 28/29/30/31.
- Adding calendar days crosses month/year boundaries without timezone/DST effects.
- `daysBetween(a, b)` counts midnight-free calendar boundaries and is antisymmetric; debt models must document whether start/end dates accrue interest.

### 4.4 Projection boundaries

Projection horizons are closed intervals `[startDate, endDate]`: events on both dates are included. `startDate` is the workspace as-of date unless explicitly provided. Opening available cash is measured at the start of `startDate`; completed events already reflected in that opening cash must not be included again.

“Before next income” means a due date strictly earlier than the next expected income date. Required events on the same date are reported in the same-day group/uncertainty rather than “before.” Month-end balance means closing balance on the last calendar day of the named month, using all included events through that date.

### 4.5 Recurrence semantics

**Weekly:** emit on ISO weekday 1 (Monday) through 7 (Sunday) at `intervalWeeks`; the first result is the first matching date on/after recurrence start.

**Biweekly:** emit every 14 calendar days from an explicit anchor occurrence. The anchor need not be inside the requested horizon. Do not approximate as twice monthly.

**Semimonthly:** two distinct ordered nominal days per calendar month, such as 15 and 31. It is not a 15-day interval. Each nominal day independently applies the month-end clamp. If both nominal days clamp to the same actual date (for example 30 and 31 in February), emit one occurrence and a `coalesced-occurrence` diagnostic rather than double charging silently. This coalescing behavior is the frozen contract and must be tested.

**Monthly:** a nominal day 1–31. If absent, clamp to the month’s final day. A recurrence anchored on January 31 therefore emits February 28/29, March 31, April 30; the nominal day remains 31 and is not changed to 28.

**Irregular:** no generated dates; explicit events only.

**One-time:** one validated date inside bounds.

Recurrence bounds and projection bounds are inclusive. Optional recurrence end date suppresses later occurrences. Expansion requires a finite horizon and maximum occurrence count.

### 4.6 Same-date grouping

All events with identical canonical date strings form one `DailyEventGroup`, regardless of input order. The group has stable event ordering only for presentation (for example label then ID); calculation uses sums and makes no posting-order claim.

```ts
type SameDayTimingUncertainty = Readonly<{
  date: LocalDate;
  relatedEventIds: readonly EntityId[];
  openingBalanceCents: Cents;
  includedInflowCents: Cents;
  includedOutflowCents: Cents;
  possibleLowBeforeInflowsCents: Cents;
  endOfDayBalanceCents: Cents;
  reason: "date-only-order-unknown";
}>;
```

Emit uncertainty when the group contains at least one inflow and one outflow and ordering changes whether available cash could fall below zero, or otherwise crosses a configured factual availability boundary. No event is assigned a hidden time.

## 5. Frozen money contract

### 5.1 Representation and limits

- Currency is CAD for V2.
- Persisted and public personal-money fields are signed or non-negative safe integer cents according to their semantic type.
- User-entered amounts generally require non-negative cents; calculated balances/differences may be negative.
- V1 keeps `MAX_MONTHLY_CENTS = 100_000_000` per input field unchanged.
- V2 uses an absolute single-value ceiling of 10,000,000,000 cents. Manual cash-account balances and their derived consolidated total are signed values within this ceiling. Every arithmetic operation checks `Number.isSafeInteger`; overflow returns a typed error.
- No UI component adds, subtracts, multiplies, divides, annualizes, accrues, or rounds money.

### 5.2 Arithmetic

- Addition/subtraction operates only on integer cents and checks the result.
- Summation starts at integer zero and checks each/aggregate result.
- Annualization of an invariant monthly amount is exact integer multiplication by 12. Dated annual totals instead sum actual events and are not called annualized monthly impact.
- Ratios are derived from unrounded integer totals. Zero denominator returns `null`, never Infinity/NaN.
- Percentage application calculates in a domain helper and rounds once at the output boundary.

### 5.3 Rounding

V1’s `roundHalfAwayFromZero` remains the default conversion from a fractional-cent result to cents. Display rounding never becomes calculation input. Exact-cent allocation uses quotient/remainder distribution rather than rounding each share independently:

```text
base = floor(total / count)
remainder = total mod count
first `remainder` stable recipients receive base + 1 cent
others receive base cents
```

Signed allocation, if later needed, distributes magnitude then reapplies sign under a separately tested helper.

### 5.4 Debt-interest intermediate precision

Debt inputs/outputs and posted schedule entries are integer cents. The future APR estimate may need precision below one cent between posting boundaries. It must use an exact rational or reviewed arbitrary-precision decimal representation—not binary floating-point dollars.

Conceptually:

```text
unpostedInterest = principalCents × aprBasisPoints × elapsedDays
                   / (10_000 × 365)
postedInterestCents = halfAwayFromZero(unpostedInterest)
```

The implementation retains the exact numerator/denominator or decimal equivalent until the declared monthly posting boundary, then rounds once to cents. It must not round daily interest to cents and sum those rounded values. Every result states `actual-365`, monthly posting, and half-away-from-zero posting rounding. Other methods require a new typed model.

### 5.5 Import/export

- JSON encodes money as integer cents, never formatted strings or decimal dollars.
- Every export declares CAD, export format version, and data schema version.
- Import rejects non-integers, unsafe integers, values outside the eventual named V2 limits, missing currency, and unsupported currencies.
- CSV transaction staging, when implemented, parses decimal text into cents at the local boundary before domain use.

## 6. Frozen normalized-event contract

```ts
type FinancialEventKind =
  | "income"
  | "expense"
  | "debt-payment"
  | "goal-transfer"
  | "sinking-fund-reservation";

type FinancialEvent = Readonly<{
  id: EntityId;
  date: LocalDate;
  amountCents: Cents; // non-negative magnitude
  direction: "inflow" | "outflow";
  kind: FinancialEventKind;
  sourceEntityId: EntityId;
  commitment: Commitment;
  actuality: Actuality;
  provenance: Provenance;
  label: string;
  generatedFromOccurrence?: LocalDate;
}>;
```

### 6.1 Kind and direction rules

| Kind                       | Allowed direction | Default commitment                                                                                                           | Spendable-cash effect                                                       |
| -------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `income`                   | inflow            | required is not applicable; normalize expected income as `required` only for inclusion mechanics, while UI calls it expected | increases consolidated cash when included                                   |
| `expense`                  | outflow           | source value: required/flexible/optional                                                                                     | decreases consolidated cash when included                                   |
| `debt-payment`             | outflow           | required for contractual minimum; flexible/optional for explicit additional payment                                          | decreases consolidated cash when included                                   |
| `goal-transfer`            | outflow           | flexible unless the user explicitly schedules/classifies it                                                                  | decreases spendable cash; increases goal tracking balance in its own module |
| `sinking-fund-reservation` | outflow           | flexible or required as explicitly selected                                                                                  | decreases spendable cash only when money is treated as reserved/unavailable |

The projection consumes only the cash side of an event. Goal/sinking-fund modules consume the allocation side. A shared event ID/link prevents counting the cash outflow twice.

### 6.2 Transfers and reservations

Initial V2 has no account-to-account event because consolidated cash would not change and multi-account semantics are deferred. Manually entered cash accounts establish the opening cash view only; moving money between them cannot create a normalized event in the initial contract.

A goal transfer or sinking-fund reservation affects available/spendable cash only after the user explicitly chooses that the allocation is set aside and unavailable for obligations. If a reservation is only a budget intention, it remains in the budget plan and is not emitted into cash flow. The normalization diagnostic records this distinction.

The future payment of a known periodic expense must not count both the reservation and the expense as consumption in the same metric. Reservation is a cash allocation; the later expense consumes reserved funds. Budget and net-worth views will need paired linkage, while consolidated spendable-cash flow includes each actual movement according to the selected reservation policy.

### 6.3 Status and provenance

- `expected` participates when included by policy.
- `actual` is historical/confirmed; an actual event on/after the opening balance date participates only if opening cash predates it.
- `cancelled` never affects calculations.
- Synthetic and user-entered events may be processed by identical engines but cannot share a workspace or overwrite each other silently.
- `label` is explanatory content only; it never selects a formula or classification.

## 7. Frozen attention classification

```ts
type AttentionLevel = "information" | "upcoming" | "attention" | "urgent";

type AttentionItem = Readonly<{
  id: string;
  conditionId: string;
  level: AttentionLevel;
  explanation: string;
  effectiveDate?: LocalDate;
  relatedEntityIds: readonly EntityId[];
  trace: Readonly<{
    inputRefs: readonly string[];
    calculatedValues: Readonly<Record<string, number | string | null>>;
    methodologyId: string;
  }>;
}>;
```

Levels are operational presentation groups, not judgments:

- `information`: factual context with no approaching entered date or modeled gap.
- `upcoming`: a required entered obligation/deadline is within a documented look-ahead window, with no projected coverage failure.
- `attention`: a modeled mismatch exists, such as an underfunded sinking fund, planned allocations above projected available cash, same-day timing uncertainty, or debt deadline extending beyond the entered date.
- `urgent`: only when a required obligation is due before projected available funds are sufficient to cover it, including an already overdue unpaid required event under the entered data. “Urgent” cannot be triggered by expense category, absolute amount, ratio threshold, or AI opinion.

Every condition has a registry entry defining exact inputs, predicate, level, message template, methodology, and non-trigger cases. Items sort by effective date, level order only as a deterministic secondary key, registry order, then ID. Dismissal is UI state and does not delete the underlying condition.

Prohibited output language includes “bad,” “dangerous,” “unhealthy,” “irresponsible,” “stupid,” and unsupported “cannot afford.” Acceptable output identifies amount, date, source condition, and assumptions.

## 8. V1 compatibility guarantees

1. `src/domain/money.ts`, `finance.ts`, `scenarios.ts`, `comparison.ts`, `schemas.ts`, and `types.ts` remain unchanged unless a separately documented genuine defect is approved.
2. V1 uses its existing `$1,000,000.00` per-field validation and rounding behavior; V2 limits do not alter it.
3. `finscope:baseline:v1` remains readable/writable by the existing storage module during compatibility.
4. Migration preserves the exact five V1 values and source; it adds no dated facts.
5. `/scenario`, `/build`, `/explore`, `/methodology`, and `/privacy` remain available. Existing scenario query parameters and methodology anchors remain protected.
6. The Scenario Lab remains the sole implementation of V1 housing, income, cost-of-living, and planned-savings scenarios and becomes Advanced Analysis.
7. A V2 workspace enters Advanced Analysis only through a visible `V1BaselineDerivation` naming period, included entity IDs, and assumptions.
8. Existing V1 unit, component, E2E, privacy, accessibility, route-refresh, and production-build tests remain release gates.

## 9. Contract-level unresolved questions

Approved product decisions are closed. These implementation choices remain for later phases and cannot alter the contracts above without a new ADR:

1. Audit exact dates and values for the four V2 synthetic personas in the fixture phase.
2. Freeze the traceable “Safe to use” formula in the approved cash-flow/budget phase.
3. Define any future account-specific liquidity or transfer semantics through a separate ADR; the initial engine remains consolidated.

None of these questions blocks completion of Phase 1. They are inputs to the next contract/implementation planning gate and do not authorize Phase 2.
