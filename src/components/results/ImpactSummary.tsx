import { formatCad, formatPercent, formatSignedCad } from "../../domain/money";
import type {
  CalculatedPosition,
  ImpactExplanation,
  PositionComparison,
} from "../../domain/types";
import { MetricCard } from "./MetricCard";

const impactMethodologyIds = [
  "core-surplus",
  "remaining-flexible-cash",
  "monthly-impact",
  "annual-impact",
] as const;

function direction(delta: number | null): "positive" | "negative" | "neutral" {
  if (delta === null || delta === 0) return "neutral";
  return delta > 0 ? "positive" : "negative";
}

export function ImpactSummary({
  current,
  scenario,
  comparison,
  explanation,
}: Readonly<{
  current: CalculatedPosition;
  scenario: CalculatedPosition;
  comparison: PositionComparison;
  explanation: ImpactExplanation;
}>) {
  const coreDelta = comparison.coreSurplus.delta;
  const relative = comparison.coreSurplusRelativeChange;
  const noChange = explanation.direction === "unchanged";
  const plannedSavingsExcess =
    scenario.plannedSavingsCents - scenario.coreSurplusCents;
  return (
    <section
      className="impact-summary"
      aria-labelledby="impact-heading"
      aria-live="polite"
    >
      <div className="impact-heading-row">
        <div>
          <p className="eyebrow">Scenario result</p>
          <h2 id="impact-heading">
            {noChange
              ? "No change from your baseline."
              : "Your modeled monthly position"}
          </h2>
        </div>
        <p>
          {noChange
            ? "The scenario values match your current monthly position."
            : explanation.message.replace("Your ", "Your modeled ")}
        </p>
      </div>
      <div className="impact-grid">
        <MetricCard
          label="Monthly impact"
          value={formatSignedCad(explanation.monthlyDifferenceCents)}
          detail="Remaining flexible cash"
          direction={direction(explanation.monthlyDifferenceCents)}
          featured
        />
        <MetricCard
          label="Annual impact"
          value={formatSignedCad(explanation.annualDifferenceCents)}
          detail="Monthly impact × 12"
          direction={direction(explanation.annualDifferenceCents)}
          featured
        />
        <MetricCard
          label="Core surplus"
          value={
            <>
              {formatCad(current.coreSurplusCents)}{" "}
              <span aria-hidden="true">→</span>{" "}
              {formatCad(scenario.coreSurplusCents)}
            </>
          }
          detail={
            relative === null
              ? "Relative change N/A"
              : `${formatPercent(relative)} relative change`
          }
          direction={direction(coreDelta)}
        />
        <MetricCard
          label="Remaining flexible cash"
          value={
            <>
              {formatCad(current.remainingFlexibleCashCents)}{" "}
              <span aria-hidden="true">→</span>{" "}
              {formatCad(scenario.remainingFlexibleCashCents)}
            </>
          }
          detail="After planned savings"
          direction={direction(comparison.remainingFlexibleCash.delta)}
        />
      </div>
      {plannedSavingsExcess > 0 ? (
        <aside className="neutral-notice" aria-label="Planned savings notice">
          <strong>
            Planned savings exceed core surplus by{" "}
            {formatCad(plannedSavingsExcess)} per month.
          </strong>
          <p>
            moni2go preserves your entered savings amount, resulting in negative
            remaining flexible cash.
          </p>
        </aside>
      ) : null}
      <details className="impact-methodology">
        <summary>How are these calculated?</summary>
        <dl>
          {impactMethodologyIds.map((id) => {
            const metric = METRIC_METHODOLOGY[id];
            return (
              <div key={id}>
                <dt>{metric.name}</dt>
                <dd>{metric.formula}</dd>
              </div>
            );
          })}
        </dl>
        <Link href="/methodology">View full methodology</Link>
      </details>
    </section>
  );
}
import Link from "next/link";

import { METRIC_METHODOLOGY } from "../../data/metric-methodology";
