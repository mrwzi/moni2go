// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import MethodologyPage from "../../src/app/methodology/page";
import { ScenarioLab } from "../../src/components/scenario/ScenarioLab";
import { getDemoProfile } from "../../src/data/demo-profiles";

const renter = getDemoProfile("student-renter");

describe("methodology experience", () => {
  it("renders formula, assumptions, limitations, provenance, and privacy sections", () => {
    render(<MethodologyPage />);
    expect(
      screen.getByRole("heading", { name: "Baseline financial model" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Scenario calculations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Metric reference" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Synthetic demo data" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Limitations and what moni2go does not do/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not currently use live economic data/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/scenario experiments are transient/i),
    ).toBeInTheDocument();
  });

  it("provides keyboard-operable contextual calculation details", async () => {
    const user = userEvent.setup();
    render(
      <ScenarioLab
        baseline={renter.baseline}
        description="Synthetic test"
        heading={renter.name}
        sourceLabel="Synthetic demo"
      />,
    );

    expect(screen.getByText("Try a housing scenario")).toBeVisible();
    expect(
      screen.queryByText("How are these calculated?"),
    ).not.toBeInTheDocument();
    const input = screen.getByLabelText("Scenario housing");
    await user.clear(input);
    await user.type(input, "1050");

    expect(screen.getByText("How are these calculated?")).toBeVisible();
    const disclosure = screen.getByText("View calculation details");
    disclosure.focus();
    expect(disclosure).toHaveFocus();
    await user.click(disclosure);

    expect(
      screen.getByRole("heading", { name: "Scenario core surplus" }),
    ).toBeVisible();
    expect(
      screen.getByText(/\$1,650\.00 income − \$1,050\.00 housing/i),
    ).toHaveTextContent(
      "$1,650.00 income − $1,050.00 housing − $580.00 other monthly expenses − $0.00 debt payments = $20.00 core surplus",
    );
    expect(
      screen.getByText(/\$20\.00 core surplus − \$150\.00 planned savings/i),
    ).toHaveTextContent(
      "$20.00 core surplus − $150.00 planned savings = −$130.00 remaining flexible cash",
    );
  });

  it("explains negative results neutrally", async () => {
    const user = userEvent.setup();
    render(
      <ScenarioLab
        baseline={renter.baseline}
        description="Synthetic test"
        heading={renter.name}
        sourceLabel="Synthetic demo"
      />,
    );
    const input = screen.getByLabelText("Scenario housing");
    await user.clear(input);
    await user.type(input, "2000");
    const summary = screen.getByRole("region", {
      name: "Your modeled monthly position",
    });
    expect(
      within(summary).getByText(/remaining flexible cash decreases/i),
    ).toBeInTheDocument();
    expect(summary.textContent).not.toMatch(
      /should|recommend|cannot afford|unhealthy|dangerous/i,
    );
    expect(
      screen.getAllByText("−$1,080.00", { exact: false }).length,
    ).toBeGreaterThan(0);
  });
});
