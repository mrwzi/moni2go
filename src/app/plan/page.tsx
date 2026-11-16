import type { Metadata } from "next";
import { Suspense } from "react";
import { MoneyPlan } from "../../components/plan/MoneyPlan";
import { LoadingState } from "../../components/shared/LoadingState";

export const metadata: Metadata = { title: "Plan your money" };

export default function PlanPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading your plan…" />}>
      <MoneyPlan />
    </Suspense>
  );
}
