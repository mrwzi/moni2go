# ADR-009: Defer CMHC rental integration

## Status

Accepted

## Context

CMHC publishes authoritative rental-market tables, but Phase 1 has not verified a stable supported API contract suitable for automated production retrieval. Scraping would be brittle and could misrepresent provenance or terms.

## Decision

CMHC rental context is disabled and is not required for the initial V2 release. moni2go will not scrape CMHC pages, reverse-engineer private endpoints, or invent an API.

Before implementation using an official downloadable table, documentation must record its official URL, format/schema, geographic dimensions, reference period, refresh schedule, terms/provenance, validation, failure behavior, and test fixture policy.

## Consequences

- Canada Context may launch with Statistics Canada and Bank of Canada sources only.
- UI and marketing cannot promise CMHC rental comparisons before an ingestion contract is approved.
- An empty adapter interface may exist later, but no production fetcher or hard-coded rental data is allowed under this ADR.

## Alternatives considered

- **Scrape published pages:** rejected for stability and source-discipline reasons.
- **Hard-code current rental values:** rejected because values become stale and untraceable.
- **Make CMHC a launch blocker:** rejected because the core V2 product does not depend on rental context.

## Future extension path

A later ADR may approve a documented official API or a reviewed downloadable-table ingestion pipeline. It must include schema monitoring and source/reference-date display before the feature is enabled.
