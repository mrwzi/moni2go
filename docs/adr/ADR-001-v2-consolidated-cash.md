# ADR-001: Manual financial accounts with derived totals

## Status

Accepted (superseded and broadened 2026-09-25)

## Context

moni2go must let a person describe where their money exists and what they owe without implying bank connectivity or implementing a full accounting ledger. The earlier liquid-only `CashAccount` model could not represent registered savings, investments, crypto, or manually entered liabilities, and its inclusion boolean did not explain why an asset was or was not spendable.

## Decision

The workspace stores manually named `AccountGroup` containers plus separate `AssetAccount` and `LiabilityAccount` records. A group represents a place or provider—bank, credit union, online bank, investment platform, crypto platform, cash, or other—and may contain several accounts. It never carries a balance itself. Asset types are chequing, savings, cash, prepaid, TFSA, RRSP, FHSA, non-registered investment, crypto, and other asset. Liability types are credit card, line of credit, student loan, personal loan, auto loan, mortgage, and other debt.

Every asset has an explicit spendability classification:

- `spendable`: included in the derived spendable-cash view;
- `restricted`: owned value not treated as currently spendable;
- `non-cash`: an investment or other asset not treated as cash.

The authoritative values are the individual account records. Totals are derived and never persisted independently:

```text
spendable cash = sum(active assets classified spendable)
total assets = sum(active assets included in net worth)
total liabilities = sum(active liabilities included in net worth)
net worth = total assets − total liabilities
```

Asset values are signed so an overdrawn deposit account can be represented. Liability balances are non-negative amounts owed. Available credit, overdraft capacity, and credit limits are not assets. Archived records do not contribute to totals.

Each value has a date-only `valueAsOfDate` or `balanceAsOfDate`. Staleness is deterministic and the default account-review threshold is 14 calendar days. Reminder preference supports weekly, biweekly, monthly, or never; notification delivery is a later application concern.

Accounts are manually entered. The contract excludes credentials, bank/card/account numbers, transit numbers, institution numbers, CVVs, and OAuth tokens. Institution labels and notes are descriptive only.

The initial release does not model transfers, account-specific payment routing, holdings, market pricing, reconciliation, overdraft facilities, or available credit.

## Planning language

The product groups `FinancialGoal` and `SinkingFund` under **Plans** without adding a redundant Plan entity. Allocation-rule contracts group future paycheck allocations into required obligations, essential flexible spending, protection/reserves, long-term building, and lifestyle/flexible spending. The contracts do not calculate recommendations.

## Compatibility

This is a pre-release breaking replacement of workspace `cashAccounts` with `accountGroups`, `assetAccounts`, and `liabilityAccounts`; no persisted second cash total is retained. `accountGroups` defaults to an empty collection when an earlier valid V2 workspace is read, so existing ungrouped asset/liability accounts remain valid. Existing experimental payloads using `cashAccounts` fail validation rather than being guessed or silently rewritten. V1 migration creates no groups, accounts, or balances because V1 knows none of those facts.

## Consequences

- Home can truthfully show manually entered assets, liabilities, spendable cash, and net worth.
- TFSA, RRSP, investments, and crypto can be represented without pretending they are spendable cash.
- Debt capacity can never inflate owned assets.
- Every total remains reproducible from the account records.
- Cash-flow projection, paycheck allocation, notifications, and account transfers remain later phases.
