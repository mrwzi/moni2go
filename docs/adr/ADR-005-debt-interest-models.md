# ADR-005: Limited typed debt-interest models

## Status

Accepted

## Context

Canadian debt products differ in accrual, compounding, grace periods, fees, rate changes, and minimum-payment formulas. A generic calculator must not imply lender-statement accuracy. V1 models only entered monthly debt payments and must remain unchanged.

## Decision

The initial V2 debt contract supports exactly two typed models:

```ts
type DebtInterestModel =
  | { kind: "interest-free" }
  | {
      kind: "apr-estimate";
      aprBasisPoints: number;
      dayCount: "actual-365";
      interestPosting: "monthly";
      rounding: "half-away-from-zero-at-posting";
    };
```

Every payoff result includes the model kind and an assumption disclosure. The user enters the contractual minimum payment; moni2go does not derive lender-specific minimums.

The initial model excludes variable-rate mortgages, compound structures not represented above, new purchases, cash advances, grace periods, fees, penalty APRs, promotional financing, and lender-specific formulas. Unsupported behavior returns a typed unsupported result.

## Consequences

- “APR estimate” is visible wherever payoff/interest is shown.
- High-precision intermediate interest may be used, but posting rounds to integer cents by the declared rule.
- Bank of Canada rates are never substituted for the entered APR.
- Specialized products cannot be approximated by adding undocumented switches.

## Alternatives considered

- **One universal amortization formula:** rejected as materially misleading.
- **No interest model:** rejected because a bounded estimate is valuable when assumptions are explicit.
- **Promotional rates in the base contract:** deferred; promotions require a dedicated rate-schedule model and tests.

## Future extension path

Add new discriminated model variants (for example, a reviewed installment-loan schedule) behind a common simulation result. Existing debt records retain their original model version; migrations never silently change calculation semantics.
