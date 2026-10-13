import type { Metadata } from "next";

import { Disclaimer } from "../../components/shared/Disclaimer";
import { DEMO_PROFILES, DEMO_PROFILE_CONTEXT } from "../../data/demo-profiles";
import { METRIC_METHODOLOGY_LIST } from "../../data/metric-methodology";

export const metadata: Metadata = { title: "Methodology" };

export default function MethodologyPage() {
  return (
    <section className="section shell prose-shell">
      <div className="section-heading page-heading">
        <p className="eyebrow">Methodology</p>
        <h1>Every result has a traceable calculation</h1>
        <p>
          moni2go compares a validated monthly baseline with one hypothetical
          change. The same inputs and scenario always produce the same result.
        </p>
      </div>

      <nav className="methodology-nav" aria-label="Methodology sections">
        <a href="#baseline-model">Baseline model</a>
        <a href="#scenarios">Scenarios</a>
        <a href="#metric-reference">Metric reference</a>
        <a href="#synthetic-data">Synthetic data</a>
        <a href="#limitations">Limitations</a>
      </nav>

      <div className="methodology-stack">
        <article className="prose-card" id="what-moni2go-models">
          <h2>What moni2go models</h2>
          <p>
            moni2go models how one housing, income, other-expense, or
            planned-savings assumption changes a simplified monthly financial
            position. It reports arithmetic differences, not predictions or
            recommendations.
          </p>
        </article>

        <article className="prose-card" id="baseline-model">
          <h2>Baseline financial model</h2>
          <p>
            A baseline contains monthly take-home income, housing, other monthly
            expenses, debt payments, and planned savings. Non-savings outflows
            combine housing, other monthly expenses, and debt payments.
          </p>
          <h3>Core surplus versus remaining flexible cash</h3>
          <p>
            Core surplus is calculated before planned savings. Remaining
            flexible cash applies the planned savings allocation afterward.
            Planned savings are intentionally not treated as consumption
            spending.
          </p>
          <div className="formula-block">
            <code>
              core surplus = income − housing − other monthly expenses − debt
              payments
            </code>
            <code>
              remaining flexible cash = core surplus − planned savings
            </code>
          </div>
        </article>

        <article className="prose-card" id="scenarios">
          <h2>Scenario calculations</h2>
          <ul>
            <li>
              <strong>Housing:</strong> changes housing only.
            </li>
            <li>
              <strong>Income:</strong> changes monthly take-home income only, by
              a new amount or percentage.
            </li>
            <li>
              <strong>Cost of living:</strong> changes the full
              other-monthly-expenses amount only. Housing, debt payments, and
              planned savings do not change automatically.
            </li>
            <li>
              <strong>Planned savings:</strong> changes the savings allocation
              and remaining flexible cash, but does not change core surplus.
            </li>
          </ul>
          <p>
            Only one scenario is active at a time. Every edit starts from the
            immutable baseline, so adjustments do not stack or compound.
          </p>
        </article>

        <article className="prose-card" id="ratios-rounding">
          <h2>Ratios, annualization, rounding, and currency</h2>
          <p>
            Money is converted to integer cents before calculation and formatted
            as CAD with two decimal places. Scenario boundaries follow the
            audited half-away-from-zero cent-rounding rule. Intermediate display
            values are not repeatedly rounded.
          </p>
          <p>
            Ratios use unrounded values and display one decimal place. When
            income is zero, income-based ratios display N/A. A direct change
            between two ratios is reported in percentage points; a relative
            change is separately labeled as a relative percentage change.
          </p>
          <p>
            Annual impact is monthly impact multiplied by 12. It does not
            compound or represent a month-by-month forecast.
          </p>
        </article>

        <article className="prose-card" id="metric-reference">
          <h2>Metric reference</h2>
          <p>
            Each entry documents the display contract used by the application.
          </p>
          <div className="metric-reference-list">
            {METRIC_METHODOLOGY_LIST.map((metric) => (
              <section
                className="metric-reference"
                id={metric.id}
                key={metric.id}
                tabIndex={-1}
              >
                <h3>{metric.name}</h3>
                <p>{metric.definition}</p>
                <dl>
                  <div>
                    <dt>Formula</dt>
                    <dd>
                      <code>{metric.formula}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Units</dt>
                    <dd>{metric.unit}</dd>
                  </div>
                  <div>
                    <dt>Display</dt>
                    <dd>{metric.display}</dd>
                  </div>
                  {metric.zeroIncome === undefined ? null : (
                    <div>
                      <dt>Zero-income behavior</dt>
                      <dd>{metric.zeroIncome}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Important limitation</dt>
                    <dd>{metric.limitation}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
        </article>

        <article className="prose-card" id="synthetic-data">
          <h2>Synthetic demo data</h2>
          <p>
            Every demo profile is fully synthetic, represents no real person,
            and is not presented as a Canadian or student statistical average.
          </p>
          <div className="fixture-methodology-list">
            {DEMO_PROFILES.map((profile) => (
              <section key={profile.id}>
                <h3>{profile.name}</h3>
                <p>{DEMO_PROFILE_CONTEXT[profile.id].purpose}</p>
                <p>{DEMO_PROFILE_CONTEXT[profile.id].construction}</p>
                <p className="fixture-note">{profile.provenance}</p>
              </section>
            ))}
          </div>
        </article>

        <article className="prose-card" id="assumptions">
          <h2>Assumptions</h2>
          <ul>
            <li>Entered amounts describe one monthly baseline.</li>
            <li>
              Monthly take-home income already reflects any taxes or deductions
              the user intends to represent.
            </li>
            <li>
              The selected scenario changes only the fields specified above.
            </li>
            <li>
              Negative core surplus and remaining flexible cash are preserved as
              calculated deficits.
            </li>
          </ul>
        </article>

        <article className="prose-card" id="limitations">
          <h2>Limitations and what moni2go does not do</h2>
          <ul>
            <li>
              Models simplified scenarios; it does not predict future economic
              conditions.
            </li>
            <li>
              Does not determine whether a financial decision is good or bad and
              does not provide financial advice.
            </li>
            <li>
              Does not calculate taxes separately from entered take-home income.
            </li>
            <li>
              Does not model every loan structure, interest mechanism,
              investment return, or financial product.
            </li>
            <li>
              Does not connect to real financial institutions and does not
              currently use live economic data.
            </li>
            <li>
              Uses synthetic demo profiles rather than real-person or
              statistical-average data.
            </li>
          </ul>
        </article>

        <article className="prose-card" id="privacy-boundary">
          <h2>Privacy boundary</h2>
          <p>
            No account or bank connection is required. A custom baseline is
            stored in the user&apos;s browser when saved; scenario experiments
            are transient. Signed-in workspaces synchronize automatically using
            the newest workspace update while keeping a local copy on each
            device. Demo data is never uploaded as a personal workspace.
          </p>
        </article>
      </div>
      <Disclaimer />
    </section>
  );
}
