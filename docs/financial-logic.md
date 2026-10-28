# Financial logic and safeguards

This document explains how moni2go turns manually entered activity into balances, spending history, plans, and forecasts. It is a technical description of application behavior, not financial advice.

## Sources of truth

1. A workspace contains accounts, transactions, bills, budgets, debts, and balance corrections.
2. Monetary values are stored and calculated as integer cents.
3. IndexedDB is the immediate on-device persistence layer.
4. Supabase is an optional authenticated synchronization copy, not a bank feed.
5. The application never moves money at a financial institution.

## Account classification

- **Spendable:** bank chequing and savings balances that the user marks as available, plus cash.
- **Assets:** spendable accounts plus investments, cryptocurrency, and other owned value.
- **Liabilities:** credit-card balances, loans, and other tracked debt.
- **Net worth:** total assets minus total liabilities.

Credit limits are not assets. Investment and cryptocurrency balances contribute to assets and net worth but are not automatically included in available cash.

## Transaction effects

### Income

Received income increases exactly one selected asset account. Expected income is a schedule used for outlooks and does not change a balance until the user records it as received.

### Purchases and bills

A purchase from a cash account reduces that account. A credit-card purchase increases the amount owed. Both count once in the selected spending category. A scheduled bill does not affect a balance until a payment is recorded.

### Refunds

Refunds increase the selected asset account or reduce the selected credit-card balance and reduce spending in the relevant category.

### Transfers

A tracked transfer reduces the source and increases the destination by the same amount. It is not income or consumption spending. An untracked destination reduces only the tracked source and is labeled transparently.

### Debt payments

A credit-card or loan payment reduces the selected cash account and the tracked debt. It is a movement of money, not a second expense. Existing historical allocation data remains supported, while the everyday form treats a manually entered loan payment as the user's stated debt reduction.

### Savings and investments

Contributions are transfers, not purchases. They may reduce available cash and increase another asset without inflating consumption spending or category averages.

### Balance corrections

A correction records the previous and replacement balance. It does not create income, spending, or a synthetic transaction. Later edits and reversals protect balances that were manually corrected after the original activity.

## Planning and spending history

- Education is a consumption category available to purchases, refunds, planning, guidance, and history.
- Savings & goals is a planning allocation and remains separate from consumption categories.
- Student-loan repayments are debt movements and are not counted again as education spending.
- Refunds reduce category spending.
- Transfers, debt payments, savings contributions, and balance corrections are excluded from consumption averages.
- Missing transaction history is treated as unknown information, not proof of zero spending.

## Forecasting

The outlook starts with current spendable balances and applies dated events chronologically:

1. user-confirmed expected income;
2. scheduled bills;
3. required debt payments;
4. planned savings movements; and
5. everyday spending estimates only when sufficient history exists.

Confirmed, scheduled, estimated, and unknown values remain distinguishable. A forecast does not invent income, interest, returns, expenses, or payment dates. Shortages are detected at the point they occur, including before a later payday.

## Editing and deletion

- Transaction IDs and original creation timestamps are preserved during edits.
- An edit applies only the difference between the original and replacement effects.
- A tracked transfer updates both sides exactly once.
- Reversing a debt payment restores exactly the cash and debt effects that were originally applied.
- If a later verified balance correction makes an automatic reversal unsafe, the operation stops rather than silently changing money.

## Synchronization safety

Every normal save writes locally first. Signed-in workspaces then attempt cloud synchronization using an expected cloud revision. The application also checks after reconnection, when returning to the app, and periodically while open.

If the local and cloud copies both changed from the last known revision, moni2go preserves the local copy and reports a conflict instead of choosing a winner automatically. Cloud deletion and production database authorization require separately reviewed safeguards.

## Important limitations

- All balances are manually supplied and may differ from a bank or lender.
- moni2go does not import statements or verify lender allocations.
- Forecast quality depends on the completeness of entered income, bills, and activity.
- The application does not calculate tax, investment returns, or personalized financial advice.
