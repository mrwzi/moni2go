# moni2go V2 mobile app-shell direction

Status: presentation contract; future financial features remain gated by their deterministic domain phases.

## Navigation

The intended mature mobile information architecture is **Home**, **Money**, **Plan**, **Timeline**, and **More**. The current shell exposes only working destinations:

- Home → `/`
- Money → `/build`
- Explore → `/explore` and the existing `/scenario` flow
- More → `/methodology`, with Privacy available from the desktop navigation, footer, and linked product content

Plan and Timeline must not appear as live destinations until their underlying V2 data, engines, empty states, and tests exist.

## Future local-workspace Home

When the corresponding approved phases exist, the local personal workspace Home is intended to organize:

- **Your money:** manually entered cash accounts and total available cash derived from included balances.
- **Before next pay:** next expected income, required obligations before it, and a future traceable “Safe to use” value after its formula is approved.
- **Coming up:** dated income and obligations.
- **Plans:** financial goals and sinking funds.
- **Needs attention:** deterministic attention items with calculation traces.
- **Quick actions:** add income, expense, bill, account, debt, or plan.

No section may display invented values or placeholders that resemble calculated financial facts.

## Future Quick Add

Quick Add may later use an accessible floating action button or prominent plus control that opens a keyboard-operable bottom sheet. Choices may include Income, Expense, Bill, Account, Debt, and Plan only when each creation flow exists. It must use native buttons, visible focus, clear labels, Escape/close behavior, and must not depend on swipe gestures.

## Mobile interaction rules

- Primary controls target at least 44–48 CSS pixels.
- Fixed bottom navigation accounts for `env(safe-area-inset-bottom)`.
- Page content includes enough bottom padding to remain visible above navigation.
- Financial inputs retain visible labels and explicit CAD/percentage units.
- Tables may scroll inside a named, focusable region; the page itself must not overflow horizontally.
- Mobile copy stays concise, with methodology and detailed explanations progressively disclosed.
