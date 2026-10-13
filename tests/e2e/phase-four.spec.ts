import { expect, test } from "@playwright/test";

test("methodology exposes every trust section and keyboard-addressable metric", async ({
  page,
}) => {
  await page.goto("/methodology");
  await expect(
    page.getByRole("heading", {
      name: "Every result has a traceable calculation",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Baseline financial model" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Scenario calculations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Synthetic demo data" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /Limitations and what moni2go does not do/i,
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Metric reference" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#metric-reference$/);
  await expect(
    page.getByRole("heading", { name: "Metric reference" }),
  ).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("Scenario Lab provides contextual formulas for the renter reference case", async ({
  page,
}) => {
  await page.goto("/scenario?profile=student-renter");
  await page.getByLabel("Scenario housing").fill("1050");
  await expect(
    page
      .getByRole("row")
      .filter({
        has: page.getByRole("rowheader", {
          name: "Housing / income",
          exact: true,
        }),
      })
      .getByText("+12.1 percentage points"),
  ).toBeVisible();
  await expect(page.getByText("-90.9% relative change")).toBeVisible();
  await page.getByText("View calculation details").click();
  await expect(
    page.getByText(/\$1,650\.00 income − \$1,050\.00 housing/),
  ).toContainText("$20.00 core surplus");
  await expect(
    page.getByText(/\$20\.00 core surplus − \$150\.00 planned savings/),
  ).toContainText("−$130.00 remaining flexible cash");
  await expect(page.getByText("−$2,400.00", { exact: true })).toBeVisible();

  const link = page.getByRole("link", { name: "How calculated: Core surplus" });
  await link.first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/methodology#core-surplus$/);
  await expect(
    page.getByRole("heading", { name: "Core surplus", exact: true }),
  ).toBeVisible();
});

test("demo profiles disclose synthetic provenance without average claims", async ({
  page,
}) => {
  await page.goto("/explore");
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(4);
  for (const card of await cards.all()) {
    await expect(
      card.getByText("Synthetic demo", { exact: true }),
    ).toBeVisible();
    await card.getByText("About this synthetic profile").click();
    await expect(
      card.getByText(/does not represent a real person/i),
    ).toBeVisible();
    await expect(card.getByText(/not a statistical average/i)).toBeVisible();
    expect((await card.textContent()) ?? "").not.toMatch(
      /typical Canadian|average Canadian|average student/i,
    );
  }
});

test("privacy and methodology explain automatic signed-in sync", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByText(/No account or bank connection is required/i),
  ).toBeVisible();
  await expect(
    page.getByText(
      /synchronizes the newest valid workspace across your devices/i,
    ),
  ).toBeVisible();

  await page.goto("/methodology#privacy-boundary");
  await expect(
    page.getByText(/No account or bank connection is required/i),
  ).toBeVisible();
  await expect(
    page.getByText(/Signed-in workspaces synchronize automatically/i),
  ).toBeVisible();
  await expect(
    page.getByText(/keeping a local copy on each device/i),
  ).toBeVisible();
});
