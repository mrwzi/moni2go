# ADR-008: Isolated public Canadian-data boundary

## Status

Accepted

## Context

moni2go may display official CPI, retail-price, household-spending, or Bank of Canada context. Those sources do not need a user’s balances, income, expenses, debts, or goals. Combining personal calculations with upstream requests would undermine the local-first guarantee.

## Decision

Public data follows this boundary:

```text
browser/personal financial model
  └─ no personal financial values
     → same-origin public-data adapter
       → allowlisted official public source
```

Requests accept only allowlisted dataset/series IDs, geography codes, product codes, and observation ranges. Responses normalize source, dataset/series ID, geography, observation/reference date, retrieval timestamp, unit, freshness, and limitations.

Start with standard Next.js server-side caching/revalidation. Do not add Redis, a database, or another persistent cache without evidence and a later decision. Public context remains optional and the financial product works when upstream data fails.

## Consequences

- Domain/persistence modules cannot be imported into upstream request construction.
- Free-form labels and personal values cannot be query parameters or telemetry.
- Adapters validate official responses and expose stale/unavailable states.
- Policy rates remain context and never replace a personal APR.

## Alternatives considered

- **Browser calls directly to every source:** rejected as the only architecture because CORS, schema normalization, and caching differ.
- **Send a personal model for contextualization:** rejected as unnecessary disclosure.
- **Persistent cache from day one:** rejected until framework caching proves insufficient.

## Future extension path

If measured reliability requires durable last-known-good public observations, a later ADR may approve non-personal cache infrastructure with retention and provenance rules. It does not authorize storage of personal data.
