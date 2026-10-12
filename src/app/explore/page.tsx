import type { Metadata } from "next";

import { ProfileList } from "../../components/baseline/ProfileList";
import type { ScenarioType } from "../../components/scenario/ScenarioPicker";

export const metadata: Metadata = { title: "Explore demos" };

const scenarioTypes: readonly ScenarioType[] = [
  "housing",
  "income",
  "cost-of-living",
  "savings",
];

export default async function ExplorePage({
  searchParams,
}: PageProps<"/explore">) {
  const type = (await searchParams).type;
  const initialScenarioType =
    typeof type === "string" && scenarioTypes.includes(type as ScenarioType)
      ? (type as ScenarioType)
      : undefined;
  return (
    <section className="section shell narrow-wide">
      <div className="section-heading page-heading">
        <p className="eyebrow">Explore a demo</p>
        <h1>Choose a synthetic starting point</h1>
        <p>
          Each profile is an illustrative example created for moni2go. The
          values are not Canadian averages and selecting one does not replace
          information saved in your browser.
        </p>
      </div>
      <ProfileList
        {...(initialScenarioType === undefined ? {} : { initialScenarioType })}
      />
    </section>
  );
}
