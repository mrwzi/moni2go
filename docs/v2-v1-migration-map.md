# moni2go V1 → V2 Migration Map

Status: companion to `docs/v2-product-blueprint.md`  
Rule: extend around V1; do not rewrite the tested engine

## 1. Migration strategy

V2 is an additive architecture. Existing V1 domain modules remain a frozen compatibility package. New dated financial entities and engines live under `src/domain/v2/`. An explicit adapter derives a five-field V1 baseline from a selected V2 period when the user opens Advanced Analysis.

The migration has three independent concerns:

1. **Code migration:** retain tested V1 modules/routes while adding V2 modules.
2. **Data migration:** copy a validated V1 browser baseline into a V2 legacy snapshot without inventing dates or categories.
3. **Experience migration:** make `/today` the V2 center while keeping `/scenario` available as Advanced Analysis.

## 2. File-by-file map

### 2.1 Domain and data

| Current V1 file                  | V2 disposition                              | V2 use/change                                                                                                                                                                        | Protection                                           |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `src/domain/money.ts`            | **Keep unchanged initially**                | Reuse CAD parsing, formatting, safe-cent assertions, and half-away-from-zero rounding. V2 may add bounded allocation/rate helpers in `src/domain/v2/money/`, not alter V1 semantics. | Existing money and release-boundary tests            |
| `src/domain/types.ts`            | **Keep as V1 types**                        | Do not overload `Baseline` with V2 entities. New types live under `src/domain/v2/types/`.                                                                                            | TypeScript plus all V1 imports/tests                 |
| `src/domain/schemas.ts`          | **Keep V1 schemas**                         | Continue validating V1 baseline/scenarios/storage. V2 schemas are separate and may import the cents limit only where appropriate.                                                    | Schema, storage, form, and scenario tests            |
| `src/domain/finance.ts`          | **Freeze**                                  | `calculatePosition` remains numerical truth for V1 monthly baseline. Called by Advanced Analysis only.                                                                               | `finance.test.ts`, fixture and boundary suites       |
| `src/domain/scenarios.ts`        | **Freeze**                                  | Preserve four scenario contracts and no-stacking behavior.                                                                                                                           | `scenarios.test.ts`, Scenario Lab tests              |
| `src/domain/comparison.ts`       | **Freeze**                                  | Preserve comparison and deterministic impact templates unless a separately reviewed defect exists.                                                                                   | Scenario/unit/component golden cases                 |
| `src/domain/index.ts`            | **Keep V1 exports**                         | Do not make it a mixed catch-all. Add `src/domain/v2/index.ts` for V2 public APIs.                                                                                                   | Compile boundary tests                               |
| `src/data/demo-profiles.ts`      | **Keep unchanged**                          | Existing four audited V1 profiles remain Advanced Analysis demos. Add separate V2 dated demo workspaces; never replace these numbers in components.                                  | `demo-profiles.test.ts`, profile component/E2E tests |
| `src/data/metric-methodology.ts` | **Keep and extend by registry composition** | V1 metric IDs/definitions remain. V2 methodology registries use namespaced IDs such as `cash-flow.projected-balance`.                                                                | Methodology unit/component/E2E tests                 |

### 2.2 Storage and hooks

| Current V1 file/key                                 | V2 disposition                       | V2 use/change                                                                                                                                         | Protection                                                  |
| --------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/storage/baseline-storage.ts`                   | **Keep compatibility loader**        | Remains the only reader/writer/migrator for `finscope:baseline:v1`. A new migration adapter calls `loadBaseline`; React must not duplicate its logic. | `storage.test.ts`, LocalBaseline tests, malformed-state E2E |
| `finscope:baseline:v1`                              | **Retain for compatibility release** | Source for optional V2 migration and continued `/scenario` custom baseline. Remove only through explicit clear-all or later approved retirement.      | Persistence/delete/refresh E2E                              |
| `src/hooks/useLocalBaseline.ts`                     | **Keep for V1 routes**               | Scenario/build continue using it. V2 hooks target repository/application ports over IndexedDB.                                                        | LocalBaseline component tests                               |
| New `src/persistence/indexed-db/*`                  | **Add**                              | V2 system of record for workspaces/entities; no duplication into localStorage.                                                                        | New repository/migration/browser tests                      |
| New `src/persistence/legacy/v1-baseline-adapter.ts` | **Add**                              | Validated, idempotent migration preview and transaction; no inferred dates/APRs.                                                                      | New migration matrix                                        |

### 2.3 Scenario and result UI

| Current V1 file                                                  | V2 disposition                    | V2 use/change                                                                                                                                | Protection                                      |
| ---------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `src/components/scenario/ScenarioLab.tsx`                        | **Survives as Advanced Analysis** | May receive a V2-derived `Baseline` and derivation disclosure. It still calls existing domain functions; formulas are not copied into React. | `ScenarioLab.test.tsx`, phase-three/release E2E |
| `ScenarioPicker.tsx`                                             | **Keep**                          | Retains four V1 scenario types. V2 debt/goal solvers are separate tools, not new union variants forced into V1.                              | Component and keyboard E2E                      |
| `HousingControls.tsx`                                            | **Keep**                          | Advanced housing scenario control.                                                                                                           | Component/E2E housing cases                     |
| `IncomeControls.tsx`                                             | **Keep**                          | Advanced monthly income scenario control; distinct from dated V2 income events.                                                              | Component/E2E income cases                      |
| `CostOfLivingControls.tsx`                                       | **Keep**                          | Advanced aggregate other-expense percentage; V2 budget may offer category-specific modelling separately.                                     | Cost-of-living isolation tests                  |
| `SavingsControls.tsx`                                            | **Keep**                          | Advanced planned-savings scenario; V2 goals remain separate entities.                                                                        | Savings/core-surplus invariants                 |
| `control-utils.ts`, `ModeSelector.tsx`, `ScenarioValueField.tsx` | **Reuse within V1**               | May inspire shared accessible field primitives, but do not couple V2 date/entity forms to V1 scenario state.                                 | Existing interaction tests                      |
| `src/components/results/ImpactSummary.tsx`                       | **Keep**                          | Advanced result summary. V2 dashboard uses new cash-flow view models.                                                                        | Neutral-language and known-value tests          |
| `ComparisonTable.tsx`                                            | **Keep**                          | Advanced current/scenario comparison only.                                                                                                   | Semantic table/a11y tests                       |
| `CalculationDisclosure.tsx`, `MetricCard.tsx`                    | **Reuse carefully**               | Preserve V1 substituted math; style primitives may be shared without moving formulas into UI.                                                | Methodology/component tests                     |

### 2.4 Baseline UI

| Current V1 file                              | V2 disposition                | V2 use/change                                                                                                                       | Protection                  |
| -------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `BaselineForm.tsx`                           | **Keep for V1 compatibility** | Edits the five-field aggregate baseline only. Do not expand it into V2 onboarding.                                                  | Baseline form tests         |
| `BuildBaselineExperience.tsx`                | **Keep at `/build`**          | Label as Advanced Analysis baseline during V2. Link to Quick Start for a dated workspace.                                           | Phase-two/browser tests     |
| `ActiveBaseline.tsx`                         | **Extend at boundary only**   | Continue selecting synthetic vs user-entered V1 sources. A future adapter may supply a derived baseline plus derivation disclosure. | Source discrimination tests |
| `BaselineSummary.tsx`                        | **Keep**                      | V1 monthly summary; not the V2 dashboard.                                                                                           | Component/E2E metrics       |
| `ProfileList.tsx`, `ProfileCard.tsx`         | **Keep**                      | Existing V1 synthetic demo entry. New V2 demos use distinct fixtures/components.                                                    | Profile tests               |
| `LocalDataControls.tsx`, `StorageNotice.tsx` | **Extend/compose**            | Clear-all must eventually cover IndexedDB and V1 key. Notices should distinguish V1 reset from V2 recovery.                         | Storage/privacy E2E         |

### 2.5 Shared UI and pages

| Current file/route                      | V2 disposition           | V2 use/change                                                                                  | Protection                                    |
| --------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `src/app/page.tsx` `/`                  | **Evolve**               | Entry choices become Demo and My Money; retain link to Advanced Analysis.                      | Landing/keyboard/release E2E                  |
| `src/app/explore/page.tsx` `/explore`   | **Retain**               | V1 synthetic profiles; a redirect requires a later explicit product decision.                  | Profile and route refresh tests               |
| `src/app/build/page.tsx` `/build`       | **Retain**               | V1 aggregate baseline. V2 onboarding is `/onboarding`.                                         | Form/persistence tests                        |
| `src/app/scenario/page.tsx` `/scenario` | **Retain**               | Canonical V1 Advanced Analysis route. Preserve `profile` and `type` query validation.          | Invalid query, direct navigation, refresh E2E |
| `src/app/methodology/page.tsx`          | **Extend**               | Becomes hub; V1 sections/anchors survive and V2 module/source sections are added.              | Anchor and formula tests                      |
| `src/app/privacy/page.tsx`              | **Extend**               | Explain IndexedDB, export/import, clear-all, and public-data request boundary.                 | Privacy consistency/leakage tests             |
| `src/app/not-found.tsx`                 | **Keep**                 | Shared 404.                                                                                    | Deployment E2E                                |
| `src/app/layout.tsx`                    | **Extend navigation**    | Add Today/My Money/Canada Context/Advanced links without altering global disclaimer semantics. | Route/a11y tests                              |
| `PrivacyNotice.tsx`                     | **Extend**               | Mention V2 local database without promising that browser clearing cannot remove it.            | Privacy visibility tests                      |
| `HowCalculated.tsx`, `Disclaimer.tsx`   | **Reuse**                | Namespaced methodology IDs may require a registry-agnostic interface; V1 links remain valid.   | Methodology tests                             |
| `src/styles/globals.css`                | **Incrementally extend** | Preserve V1 selectors; add V2 component styles/tokens rather than wholesale replacement.       | Viewport/overflow/a11y E2E                    |

### 2.6 Configuration and documentation

| Current file                                                                   | V2 disposition                                                                                                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, lockfile                                                       | Keep until an approved implementation phase needs a dependency; this blueprint installs nothing.                                                   |
| `next.config.ts`, `tsconfig.json`, ESLint/Prettier/Vitest/Playwright configs   | Preserve; extend test discovery only when V2 files exist. Read the installed Next.js documentation before code changes as required by `AGENTS.md`. |
| `README.md`                                                                    | Update only during an implementation/release phase to distinguish V1 production behavior from proposed V2.                                         |
| `docs/implementation-blueprint.md`                                             | Freeze as the V1 source of truth.                                                                                                                  |
| `docs/release-readiness.md`, `docs/release-checklist.md`, `docs/deployment.md` | Preserve as V1 evidence; create V2 release evidence rather than rewriting historical claims.                                                       |

## 3. Current test map

| Current suite                             | V2 policy                                      | What it continues to protect                                                                  |
| ----------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tests/unit/money.test.ts`                | Run unchanged                                  | CAD parsing/display/rounding and negative-zero regression                                     |
| `tests/unit/finance.test.ts`              | Run unchanged                                  | V1 surplus, ratios, zero income, deficit, large values                                        |
| `tests/unit/scenarios.test.ts`            | Run unchanged                                  | Four scenarios, audited housing case, isolation, no mutation/compounding, neutral explanation |
| `tests/unit/schemas.test.ts`              | Run unchanged                                  | Baseline/scenario validation boundaries                                                       |
| `tests/unit/storage.test.ts`              | Run unchanged; add separate V2 migration suite | V1 key/version/malformed/reset contract                                                       |
| `tests/unit/demo-profiles.test.ts`        | Run unchanged                                  | Four audited synthetic fixtures and provenance                                                |
| `tests/unit/methodology.test.ts`          | Run unchanged; add V2 registry tests           | Formula/limitation completeness                                                               |
| `tests/unit/release-boundaries.test.ts`   | Run unchanged                                  | cent safety, zero/deficit/max, ratio and rounding boundaries                                  |
| `tests/components/BaselineForm.test.tsx`  | Run unchanged                                  | decimals, zero, validation, focus/tab order                                                   |
| `tests/components/LocalBaseline.test.tsx` | Run unchanged; add IndexedDB integration tests | persistence/source/reset/privacy                                                              |
| `tests/components/ProfileList.test.tsx`   | Run unchanged                                  | all V1 demos and keyboard selection                                                           |
| `tests/components/ScenarioLab.test.tsx`   | Run unchanged                                  | all V1 controls, empty/no-change/reset, known values, neutral savings notice                  |
| `tests/components/Methodology.test.tsx`   | Run unchanged                                  | traceable calculations and neutral copy                                                       |
| `tests/e2e/phase-two.spec.ts`             | Compatibility gate                             | V1 demo/build/persist/delete/privacy/keyboard/non-transmission                                |
| `tests/e2e/phase-three.spec.ts`           | Compatibility gate                             | V1 Scenario Lab known values/types/reset/transience/mobile/non-transmission                   |
| `tests/e2e/phase-four.spec.ts`            | Compatibility gate                             | methodology/provenance/privacy consistency                                                    |
| `tests/e2e/accessibility.spec.ts`         | Expand route matrix                            | WCAG smoke checks and semantic tables/errors                                                  |
| `tests/e2e/deployment.spec.ts`            | Expand route matrix                            | refresh, 404, hard-navigation persistence                                                     |
| `tests/e2e/release-hardening.spec.ts`     | Preserve and extend                            | keyboard flows, leakage/runtime/corruption/query/viewport boundaries                          |

V2 tests should be added under parallel `tests/unit/v2`, `tests/components/v2`, `tests/integration/persistence`, and `tests/e2e/v2` paths. Do not weaken or delete a V1 assertion merely because V2 has richer concepts. If visible V1 branding changes to “Advanced Analysis,” update only copy assertions and retain numerical/behavioral assertions.

## 4. Data migration mapping

| V1 field              | Safe V2 representation                             | Must not infer                                             |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `incomeCents`         | Legacy monthly aggregate income                    | source count, pay dates, recurrence, gross income, history |
| `housingCents`        | Legacy monthly aggregate housing                   | due date, rent vs mortgage, account, geography             |
| `otherExpensesCents`  | Legacy monthly aggregate uncategorized consumption | category split, fixed/flexible status, due dates           |
| `debtPaymentsCents`   | Legacy monthly aggregate debt payments             | debt count, balances, APRs, minimums, deadlines            |
| `plannedSavingsCents` | Legacy monthly aggregate planned savings           | goal count, target, account, deadline                      |
| `savedAt`             | Migration provenance timestamp                     | financial as-of date                                       |
| source `user-entered` | V2 user workspace provenance                       | identity/account ownership                                 |

V1 contains no current-cash value, asset value, liability balance, account name, institution, provider, or account structure. Migration therefore leaves `accountGroups`, `assetAccounts`, and `liabilityAccounts` empty and must not synthesize banks, platforms, chequing, savings, registered, investment, crypto, physical-cash, credit, loan, or mortgage records. The user adds account information explicitly after migration.

Recommended migrated record:

```ts
type LegacyMonthlyBaselineSnapshot = Readonly<{
  id: EntityId;
  workspaceId: EntityId;
  source: "v1-local-baseline";
  migratedAt: string;
  originalSavedAt: string;
  baseline: Baseline;
  completeness: "monthly-aggregate-only";
}>;
```

This snapshot can populate a V2 monthly summary and Advanced Analysis immediately. It cannot produce a dated cash-flow projection until the user supplies available cash, dates, and at least one event.

## 5. Route compatibility sequence

1. Add V2 routes without changing V1 URLs.
2. Change primary navigation to Today/My Money only after onboarding and empty states pass E2E.
3. Relabel `/scenario` presentation as Advanced Analysis while retaining its URL and query schema.
4. Add `/advanced` as an index/link page; do not duplicate Scenario Lab under another route.
5. Keep `/build` as “Advanced monthly baseline” and offer a clear route to V2 onboarding.
6. Keep `/explore` throughout V2 implementation. A future redirect requires a later explicit product decision, direct-navigation tests, and synthetic-source tests.

## 6. Migration acceptance gate

Migration is accepted only when:

- all existing V1 financial and Scenario Lab tests pass;
- a valid V1 baseline is previewed and copied atomically exactly once;
- malformed V1 data follows the existing safe reset contract;
- no pay date, due date, category breakdown, debt APR/balance, or goal deadline is invented;
- interrupted migration resumes or rolls back safely;
- `/scenario?source=user` still works throughout the compatibility release;
- demo and user-entered data remain distinguishable;
- export includes the migrated legacy snapshot;
- clear-all removes both IndexedDB personal data and `finscope:baseline:v1`;
- sentinel personal values do not appear in network traffic, URLs, logs, metadata, or public-data requests.

## 7. Replacement criteria

No V1 code is replaced merely for architectural consistency. Replacement is allowed only when all of the following are true:

1. A documented defect or user need cannot be met through extension/adapter composition.
2. The replacement has equivalent golden tests for every existing contract.
3. Storage and route compatibility are explicitly handled.
4. The product owner approves the behavior change.
5. Rollback does not make locally saved data unreadable.

Until those conditions hold, V1 remains a supported Advanced Analysis subsystem inside V2.
