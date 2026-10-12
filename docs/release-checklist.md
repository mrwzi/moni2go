# moni2go release checklist

Status labels:

- **PASS** — completed by automated verification in this repository.
- **FIXED DURING PHASE 5** — a defect was found, corrected, and covered.
- **MANUAL VERIFICATION REQUIRED** — cannot be truthfully completed by this environment.
- **BLOCKER** — prevents release.

## Automated verification

| Area                             | Status               | Evidence                                                                                                                                |
| -------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Domain and boundary tests        | PASS                 | `npm test`; includes zero, one-cent, decimal, half-cent, deficit, exact-zero, near-zero-income, and maximum-field cases.                |
| Component tests                  | PASS                 | `npm run test:components`.                                                                                                              |
| End-to-end flows                 | PASS                 | `npm run test:e2e`; 80 tests across desktop and mobile projects.                                                                        |
| Accessibility automation         | PASS                 | `npm run test:a11y`; axe WCAG 2 A/AA, 2.1 A/AA, and supported 2.2 AA tags on all routes and both baseline sources. No rules suppressed. |
| Scrollable table keyboard access | FIXED DURING PHASE 5 | Comparison region is named and focusable; axe regression coverage.                                                                      |
| Keyboard workflows               | PASS                 | Demo and custom-baseline workflows use keyboard activation through scenarios, disclosures, navigation, reset, and clearing.             |
| Viewport automation              | PASS                 | 320, 375, 430, 768, 1024, and 1440 CSS-pixel widths; no page-level horizontal overflow.                                                 |
| Financial boundary review        | PASS                 | `tests/unit/release-boundaries.test.ts` and existing domain suites.                                                                     |
| Negative-zero currency           | FIXED DURING PHASE 5 | `formatCad(-0)` and `formatSignedCad(-0)` now produce `$0.00`; unit regression coverage.                                                |
| Privacy and leakage audit        | PASS                 | Distinctive `$12,345.67` sentinel absent from URLs, bodies, request transcript, title, metadata, and console; no cookies.               |
| Console/runtime audit            | PASS                 | Major flows capture console errors/warnings, page errors, and failed requests; none observed.                                           |
| Corrupted-state handling         | PASS                 | Malformed, partial, unsupported-version, invalid-query, missing-baseline, refresh, and external-clear cases.                            |
| Production build                 | PASS                 | `npm run build`.                                                                                                                        |
| TypeScript, lint, formatting     | PASS                 | `npm run typecheck`, `npm run lint`, `npm run format:check`.                                                                            |
| Dependency audit                 | PASS                 | `npm audit --audit-level=low`; zero known vulnerabilities at verification time.                                                         |
| Secrets review                   | PASS                 | Pattern and tracked-file review found no application credentials or secrets. This is not a penetration test.                            |
| Methodology consistency          | PASS                 | Renter reference values agree across domain, UI, methodology, substituted calculations, and browser regressions.                        |
| README                           | PASS                 | Commands, architecture, privacy contract, current functionality, and limitations documented.                                            |

## Manual release checks

| Area                      | Status                       | Required action                                                                                                                                                                                     |
| ------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screen readers            | MANUAL VERIFICATION REQUIRED | Test the primary flows with NVDA + Firefox/Chrome, VoiceOver + Safari, and TalkBack where supported. Confirm landmarks, labels, live-region timing, table navigation, and disclosure announcements. |
| Subjective visual quality | MANUAL VERIFICATION REQUIRED | Inspect all routes for typography, wrapping, overlap, focus visibility, and table scroll affordance at representative widths.                                                                       |
| Physical devices          | MANUAL VERIFICATION REQUIRED | Exercise touch, virtual keyboard, orientation change, and browser zoom on representative iOS and Android devices.                                                                                   |
| Browser matrix            | MANUAL VERIFICATION REQUIRED | Smoke-test current Chrome, Firefox, Safari, and Edge production builds.                                                                                                                             |
| 200%/400% zoom and reflow | MANUAL VERIFICATION REQUIRED | Manually inspect primary flows and ensure content remains operable without two-dimensional page scrolling.                                                                                          |
| Production hosting        | MANUAL VERIFICATION REQUIRED | Verify HTTPS, headers, caching, 404 behavior, deployment logs, and final canonical/metadata behavior on the selected host.                                                                          |

No accessibility-rule exceptions or suppressions are recorded.
