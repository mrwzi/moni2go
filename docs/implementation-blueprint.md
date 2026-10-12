# moni2go V1 Implementation Blueprint

Status: approved for implementation after review  
Product scope: Canadian students and young adults  
Currency: CAD  
Data policy: personal financial inputs remain in the browser

## 1. Product contract

moni2go is a forward-looking financial scenario simulator. It compares a user's current monthly baseline with one hypothetical change and explains the numerical effect. It does not provide financial advice, connect to bank accounts, or predict an individual's future.

The V1 promise is:

> See how a change in housing, income, everyday costs, or planned savings affects your monthly flexibility.

### V1 includes

- No-account demo mode using four synthetic Canadian profiles.
- A five-field custom baseline form.
- Housing, income, cost-of-living, and planned-savings scenarios.
- A current-versus-scenario comparison with monthly and annual differences.
- Transparent formulas and plain-language explanations.
- Local-only draft persistence.
- Responsive and accessible presentation.

### V1 excludes

- Bank connections or transaction imports.
- Personalized recommendations or affordability approvals.
- Authentication and server-side storage of personal inputs.
- Bank-plan comparison.
- Loan amortization or automatic mapping from the Bank of Canada policy rate to a personal loan.
- AI-generated calculations or advice.
- Live economic indicators until the deterministic engine and interface pass their tests.

## 2. Terminology and financial model

The interface and code must use the following terms consistently.

| Term                    | Definition                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Income                  | Monthly take-home income.                                                                                                 |
| Housing                 | Monthly rent, residence fee, or housing payment entered by the user.                                                      |
| Other expenses          | Monthly non-housing consumption. In the five-field V1 form, this entire amount is eligible for a cost-of-living scenario. |
| Debt payments           | Required monthly debt payments. These are excluded from cost-of-living changes.                                           |
| Planned savings         | An intentional monthly allocation, not an expense.                                                                        |
| Core surplus            | Income minus housing, other expenses, and debt payments.                                                                  |
| Remaining flexible cash | Core surplus minus planned savings.                                                                                       |
| Non-savings outflows    | Housing plus other expenses plus debt payments. Use this label instead of the ambiguous `total expenses`.                 |
| Deficit                 | A negative core surplus or negative remaining flexible cash. Negative results are preserved, never clamped.               |

### Canonical formulas

All monetary values are represented internally as integer cents.

```text
nonSavingsOutflows = housing + otherExpenses + debtPayments
coreSurplus = income - nonSavingsOutflows
remainingFlexibleCash = coreSurplus - plannedSavings

housingToIncome = housing / income
coreSurplusRate = coreSurplus / income
plannedSavingsRate = plannedSavings / income
flexibleCashRate = remainingFlexibleCash / income

monthlyDifference = scenarioValue - currentValue
annualDifference = monthlyDifference * 12
percentagePointDifference = (scenarioRatio - currentRatio) * 100
```

When income is zero, every income-based ratio is `null` and displayed as `N/A`. Negative income is invalid. Ratios may be negative when their numerator is negative.

### Precision and display

- Parse user-entered decimal dollars into integer cents before calculation.
- Never calculate money with binary floating-point dollars.
- Display currency as Canadian dollars with two decimals using `Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" })`.
- Derive ratios from unrounded cent values and display percentages to one decimal place.
- Display percentage changes in a ratio as percentage points (`pp`), not percent.
- Display negative money as `−$145.00`, not `$-145.00` and not zero.
- A zero change is displayed as `—` in comparison tables and as `$0.00` where a numeric result is required.
- Annual impact is exactly the monthly difference multiplied by 12. V1 does not compound or model a changing monthly path.

## 3. Baseline input contract

The custom form contains exactly five required monthly fields:

1. Monthly take-home income
2. Housing
3. Other monthly expenses
4. Debt payments
5. Planned savings

All fields accept CAD dollar values with no more than two decimal places. Zero is valid. Empty, negative, non-numeric, infinite, and values over `$1,000,000.00` per month are invalid. Commas and a leading dollar sign may be accepted as input formatting but must be normalized before validation.

The form may warn, but must not reject, when outflows exceed income or planned savings exceed core surplus. These are valid financial states and should produce a deficit.

## 4. Scenario contracts

Only one scenario is active at a time in V1. Applying a new scenario always recalculates from the immutable baseline, preventing accidental scenario stacking.

### Housing change

Input mode: absolute new monthly housing amount or signed dollar adjustment.

```text
scenario.housing = newHousing
all other baseline fields unchanged
```

The resolved housing amount must be zero or greater.

### Income change

Input mode: absolute new monthly take-home income or signed percentage adjustment.

```text
scenario.income = roundToCents(baseline.income * (1 + percent / 100))
all other baseline fields unchanged
```

The resolved income must be zero or greater. Percentage input cannot be less than `-100%`.

### Cost-of-living change

Input mode: signed percentage applied only to `otherExpenses`.

```text
scenario.otherExpenses = roundToCents(
  baseline.otherExpenses * (1 + percent / 100)
)
housing, debtPayments, and plannedSavings unchanged
```

The percentage cannot be less than `-100%`. The UI must explicitly say what is and is not affected. The methodology page must note that the five-field model treats all `otherExpenses` as eligible; category-level eligibility is a post-V1 enhancement.

### Planned-savings change

Input mode: absolute new monthly allocation or signed dollar adjustment.

```text
scenario.plannedSavings = newPlannedSavings
income, housing, otherExpenses, and debtPayments unchanged
```

The resolved amount must be zero or greater. This scenario changes remaining flexible cash but not core surplus.

### Comparison contract

Every result presents:

- Current value.
- Scenario value.
- Signed monthly difference.
- Signed annual difference for monetary metrics.

The primary comparison includes income, non-savings outflows, core surplus, planned savings, remaining flexible cash, and housing-to-income. The hero result should emphasize the change in remaining flexible cash, while also showing core surplus so savings is never mistaken for spending.

## 5. Synthetic profiles

Synthetic values are illustrative and must be labeled as examples, not Canadian averages. Each fixture stores a short provenance note explaining that it was constructed for product demonstration.

| ID                  | Profile                           |    Income |   Housing | Other expenses |    Debt | Planned savings | Core surplus | Flexible cash |
| ------------------- | --------------------------------- | --------: | --------: | -------------: | ------: | --------------: | -----------: | ------------: |
| `student-family`    | Student living with family        | $1,400.00 |   $300.00 |        $650.00 | $100.00 |         $200.00 |      $350.00 |       $150.00 |
| `student-renter`    | Student renting near university   | $1,650.00 |   $850.00 |        $580.00 |   $0.00 |         $150.00 |      $220.00 |        $70.00 |
| `student-part-time` | Student working part-time         | $1,950.00 |   $750.00 |        $700.00 | $150.00 |         $200.00 |      $350.00 |       $150.00 |
| `recent-graduate`   | Recent graduate working full-time | $3,600.00 | $1,450.00 |      $1,000.00 | $350.00 |         $500.00 |      $800.00 |       $300.00 |

The original `$1,650 / $1,430 / $220` example maps to `student-renter` before planned savings: `$850 + $580 = $1,430` in non-savings outflows and a `$220` core surplus. After the planned `$150` savings allocation, remaining flexible cash is `$70`.

Fixtures store cents, not dollars:

```ts
type Baseline = {
  incomeCents: number;
  housingCents: number;
  otherExpensesCents: number;
  debtPaymentsCents: number;
  plannedSavingsCents: number;
};

type DemoProfile = {
  id:
    | "student-family"
    | "student-renter"
    | "student-part-time"
    | "recent-graduate";
  name: string;
  description: string;
  baseline: Baseline;
  provenance: "Synthetic example created for moni2go; not a statistical average.";
};
```

## 6. Technical architecture

### Stack

- Next.js with the App Router and TypeScript in strict mode.
- React for interactive scenario controls.
- CSS variables plus Tailwind CSS for tokens and layout.
- Zod for boundary validation and local-storage migration validation.
- Vitest for domain and schema tests.
- React Testing Library for component behavior.
- Playwright for critical user flows and accessibility smoke tests.
- ESLint and Prettier for static consistency.

Package versions should be pinned when the project is initialized; this specification intentionally does not prescribe stale version numbers.

### Runtime boundaries

- The calculation engine is a pure TypeScript module with no React, browser, or server dependencies.
- User baselines and scenarios are held in client state and optionally persisted to `localStorage`.
- No custom financial values are sent to an application API, analytics event, log, or error-reporting payload.
- Demo profiles are static, version-controlled data imported at build time.
- The future economic-context endpoint is read-only and contains no personal inputs.

### Database decision

V1 has no application database. A database would add operational and privacy cost without serving the product contract.

- Personal inputs: browser state and versioned `localStorage` only.
- Synthetic profiles: repository fixtures.
- Methodology content: repository content.
- Future economic observations: fetched server-side and cached; persistence may be added later only if historical snapshots become a product requirement.

## 7. Repository structure

```text
moni2go/
├─ docs/
│  └─ implementation-blueprint.md
├─ public/
│  └─ icons/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  ├─ explore/page.tsx
│  │  ├─ build/page.tsx
│  │  ├─ scenario/page.tsx
│  │  ├─ methodology/page.tsx
│  │  ├─ privacy/page.tsx
│  │  └─ api/economic-context/route.ts   # disabled until the live-data phase
│  ├─ components/
│  │  ├─ baseline/BaselineForm.tsx
│  │  ├─ baseline/ProfileCard.tsx
│  │  ├─ scenario/ScenarioPicker.tsx
│  │  ├─ scenario/HousingControls.tsx
│  │  ├─ scenario/IncomeControls.tsx
│  │  ├─ scenario/CostOfLivingControls.tsx
│  │  ├─ scenario/SavingsControls.tsx
│  │  ├─ results/ComparisonTable.tsx
│  │  ├─ results/ImpactSummary.tsx
│  │  ├─ results/MetricCard.tsx
│  │  └─ shared/Disclaimer.tsx
│  ├─ domain/
│  │  ├─ money.ts
│  │  ├─ finance.ts
│  │  ├─ scenarios.ts
│  │  ├─ comparison.ts
│  │  ├─ schemas.ts
│  │  └─ types.ts
│  ├─ data/demo-profiles.ts
│  ├─ hooks/useLocalBaseline.ts
│  ├─ storage/baseline-storage.ts
│  └─ styles/globals.css
├─ tests/
│  ├─ unit/
│  │  ├─ money.test.ts
│  │  ├─ finance.test.ts
│  │  ├─ scenarios.test.ts
│  │  └─ schemas.test.ts
│  ├─ components/
│  │  ├─ BaselineForm.test.tsx
│  │  └─ ComparisonTable.test.tsx
│  └─ e2e/
│     ├─ demo-scenario.spec.ts
│     ├─ custom-baseline.spec.ts
│     └─ local-privacy.spec.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

## 8. Domain types and pure functions

```ts
type Cents = number;
type Ratio = number | null;

type CalculatedPosition = Baseline & {
  nonSavingsOutflowsCents: Cents;
  coreSurplusCents: Cents;
  remainingFlexibleCashCents: Cents;
  housingToIncome: Ratio;
  coreSurplusRate: Ratio;
  plannedSavingsRate: Ratio;
  flexibleCashRate: Ratio;
};

type Scenario =
  | { type: "housing"; mode: "absolute" | "delta"; value: number }
  | { type: "income"; mode: "absolute" | "percent"; value: number }
  | { type: "cost-of-living"; mode: "percent"; value: number }
  | { type: "savings"; mode: "absolute" | "delta"; value: number };

type MetricDifference = {
  current: number | null;
  scenario: number | null;
  delta: number | null;
  annualDelta?: number;
};
```

Required public functions:

```ts
parseCadToCents(input: string): Result<Cents, MoneyParseError>
formatCad(cents: Cents): string
formatSignedCad(cents: Cents): string
formatPercent(ratio: Ratio): string

calculatePosition(baseline: Baseline): CalculatedPosition
applyScenario(baseline: Baseline, scenario: Scenario): Baseline
comparePositions(current: CalculatedPosition, scenario: CalculatedPosition): PositionComparison
describeImpact(comparison: PositionComparison, scenario: Scenario): ImpactExplanation
```

`describeImpact` uses deterministic templates and calculated values. It must not infer advice. Acceptable: “Your remaining flexible cash decreases by $200.00 per month.” Not acceptable: “You cannot afford this apartment.”

## 9. Browser storage schema

Storage key: `finscope:baseline:v1`

```ts
type StoredBaselineV1 = {
  version: 1;
  savedAt: string; // ISO 8601
  baseline: Baseline;
};
```

Rules:

- Validate stored data with Zod before use.
- Ignore and remove malformed or unsupported data after showing a non-blocking reset notice.
- Provide a visible “Clear my data” action.
- Do not store the active scenario by default; reopening starts from the saved baseline.
- Do not use cookies for financial inputs.
- The privacy page must plainly state that clearing browser data removes the saved baseline.

## 10. Routes and user flows

### `/`

Landing page. Presents the product promise, four scenario prompts, “Explore a demo,” and “Build my scenario.” A scenario prompt carries only the selected scenario type into the next flow; it does not invent a baseline.

### `/explore`

Displays the four synthetic profiles. Selecting one opens `/scenario?profile=<id>&type=<scenario-type>`. Invalid profile IDs fall back to the picker with an explanatory message.

### `/build`

Displays the five-field baseline form, a local-storage disclosure, derived preview values, and a continue action. Successful submission persists the baseline locally and navigates to `/scenario`.

### `/scenario`

Loads either a validated demo fixture or the validated locally stored custom baseline. If neither exists, redirect to `/build`. Contains the scenario selector, controls, current-versus-scenario results, explanation, reset action, and methodology link.

### `/methodology`

Shows definitions, formulas, inclusions and exclusions, rounding rules, scenario behavior, limitations, and fixture provenance.

### `/privacy`

Explains local-only input storage and states that V1 has no account or bank connection.

## 11. Future economic-context API

This endpoint is specified now but must remain disabled until the core V1 is complete.

`GET /api/economic-context`

```json
{
  "indicators": [
    {
      "id": "canada-cpi-year-over-year",
      "label": "Canada CPI, 12-month change",
      "value": 0.0,
      "unit": "percent",
      "observationDate": "YYYY-MM-DD",
      "source": {
        "name": "Statistics Canada",
        "url": "https://..."
      },
      "retrievedAt": "YYYY-MM-DDTHH:mm:ss.sssZ"
    }
  ],
  "status": "current"
}
```

Requirements:

- Use official sources only.
- Validate upstream responses before returning them.
- Cache server-side and return the last valid observation during a temporary upstream failure with `status: "stale"`.
- Display observation date separately from retrieval time.
- Never silently substitute a policy rate for a personal borrowing rate.
- Never send baseline or scenario values to this endpoint.

## 12. Validation and behavior rules

- Validate at domain boundaries, not only in HTML controls.
- Disable calculation while a field is syntactically incomplete; show an inline message after blur or submission.
- Preserve user text while editing and convert to cents only after successful parsing.
- Sliders must have paired numeric inputs; keyboard users cannot be forced to use a pointer.
- Results update immediately after valid changes and retain the last valid result during a temporarily incomplete edit.
- Changing scenario type discards the previous scenario adjustment after confirmation only when the user has changed it from its default.
- Reset scenario restores the immutable baseline.
- Starting over does not clear a saved custom baseline unless the user chooses “Clear my data.”
- Demo profiles never overwrite a saved custom baseline.
- Query parameters are untrusted and must be parsed through a schema.

## 13. Accessibility and content requirements

- Meet WCAG 2.2 AA for the primary flow.
- Every input has a persistent label, hint, error association, and logical tab order.
- Color is not the only distinction between improvement and decline.
- Announce recalculated headline results through a polite live region without announcing every slider step excessively.
- Respect reduced-motion preferences.
- Use true table markup for comparisons and descriptive headings for screen-reader navigation.
- Use “increase/decrease,” “surplus/deficit,” and “estimate” rather than judgmental language.
- Display: “Estimates based on the assumptions entered. moni2go does not provide financial advice.”

## 14. Required test cases

### Unit: calculations

1. Student-renter baseline returns `$1,430.00` non-savings outflows, `$220.00` core surplus, and `$70.00` remaining flexible cash.
2. A `$200.00` housing increase changes housing to `$1,050.00`, core surplus to `$20.00`, and remaining flexible cash to `−$130.00`.
3. The same housing scenario produces `−$200.00` monthly and `−$2,400.00` annual differences for both surplus measures.
4. Housing-to-income changes from `51.5%` to `63.6%`, a `+12.1 pp` displayed difference.
5. A `10%` cost-of-living increase changes only other expenses: `$580.00` becomes `$638.00`.
6. A savings increase changes remaining flexible cash but leaves core surplus unchanged.
7. Zero income produces `null` ratios and `N/A` output.
8. Negative results remain negative.
9. Values ending in fractional cents are rounded once at the scenario boundary using half-away-from-zero currency rounding.
10. Repeated scenario edits always use the original baseline and do not compound.

### Unit: money and validation

11. `$1,234.56`, `1234.56`, and `1,234.56` parse to `123456` cents.
12. More than two decimal places, negative values, exponent notation, `NaN`, and infinity are rejected.
13. Exactly `$0.00` and `$1,000,000.00` are accepted; a value one cent higher is rejected.
14. Income adjustments below `-100%` are rejected.
15. Malformed local-storage data is not loaded.

### Component and integration

16. Form errors are associated with their inputs and focus moves to the first invalid field on submit.
17. Selecting a demo does not mutate its fixture or overwrite a saved custom baseline.
18. Comparison rows show current, scenario, monthly delta, and annual delta.
19. The savings scenario explains why core surplus is unchanged.
20. Clearing local data removes the storage key and updates the interface.

### End-to-end acceptance

21. A visitor can select “What if my rent increased?”, choose Student renting near university, set `+$200`, and see the verified values from cases 2–4.
22. A visitor can enter a custom baseline, refresh, and resume it locally.
23. A visitor can complete the same flow using only a keyboard.
24. No network request contains custom baseline values.
25. With JavaScript error logging enabled in tests, financial field values never appear in logs.

## 15. Implementation sequence and gates

### Phase 1: foundation and deterministic engine

Initialize the project, add strict tooling, implement money parsing/formatting, schemas, calculations, scenarios, comparisons, and unit tests.

Gate: all domain tests pass, with no React dependency in `src/domain`.

### Phase 2: fixtures and custom baseline

Add audited demo fixtures, the custom form, versioned local persistence, and privacy controls.

Gate: fixture invariants, validation tests, storage tests, and privacy behavior pass.

### Phase 3: scenario experience

Build the landing flow, profile picker, four scenario controls, comparison table, impact summary, responsive layout, and accessible interaction.

Gate: critical component and end-to-end flows pass on mobile and desktop viewports.

### Phase 4: explanations and trust

Add methodology, limitations, provenance, privacy page, disclaimers, and deterministic explanations.

Gate: every displayed metric maps to a documented formula and every claim uses non-advisory language.

### Phase 5: quality release

Run type checking, linting, unit, component, end-to-end, accessibility, and production-build checks. Perform manual browser checks for rounding, narrow screens, keyboard use, and local-data clearing.

Gate: no high-severity accessibility failures, no failing tests, and no financial inputs observed in network or logs.

### Phase 6: live Canadian context (post-core V1)

Add official economic sources, server-side validation and caching, source metadata, stale-data behavior, and data-contract tests.

Gate: the product remains fully useful when the live source is unavailable.

## 16. Definition of done

V1 is complete when a new visitor can choose a synthetic profile or enter five monthly values, run any of the four scenarios, understand the difference between core surplus and remaining flexible cash, inspect the formulas behind the result, clear their locally stored data, and complete the flow accessibly without any personal financial input leaving the browser.
