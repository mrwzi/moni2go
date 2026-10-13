import { expect, test, type Page } from "@playwright/test";

const storageKey = "finscope:baseline:v1";
const sentinel = "12345.67";

async function fillBaseline(page: Page, income = "3000") {
  for (const [label, value] of [
    ["Monthly take-home income", income],
    ["Housing", "1200.10"],
    ["Other monthly expenses", "700.05"],
    ["Debt payments", "200"],
    ["Planned savings", "300.10"],
  ] as const) {
    await page.getByLabel(label).fill(value);
  }
}

test("completes the demo workflow with keyboard activation only", async ({
  page,
}) => {
  await page.goto("/");
  const explore = page.getByRole("link", {
    name: "Try a demo",
    exact: true,
  });
  await explore.focus();
  await expect(explore).toBeFocused();
  await page.keyboard.press("Enter");

  const profile = page
    .getByRole("article")
    .filter({ hasText: "Student renting near university" })
    .getByRole("link", { name: "Use this profile" });
  await profile.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/profile=student-renter/);

  const costOfLiving = page.getByRole("button", {
    name: /^Cost of living/i,
  });
  await costOfLiving.focus();
  await page.keyboard.press("Space");
  await expect(costOfLiving).toHaveAttribute("aria-pressed", "true");
  const value = page.getByLabel("Other-expense percentage change");
  await value.focus();
  await page.keyboard.type("10");
  await expect(
    page
      .getByRole("rowheader", { name: "Other monthly expenses" })
      .locator(".."),
  ).toContainText("$638.00");

  const disclosure = page.getByText("View calculation details");
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Scenario core surplus" }),
  ).toBeVisible();
  const methodology = page
    .getByRole("link", { name: "How calculated: Core surplus" })
    .first();
  await methodology.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/methodology#core-surplus/);
  await page.goBack();
  const reset = page.getByRole("button", { name: "Reset scenario" });
  await reset.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Try a housing scenario")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("completes the custom-baseline workflow and clears local data with the keyboard", async ({
  page,
}) => {
  await page.goto("/build");
  await page.getByLabel("Monthly take-home income").focus();
  for (const input of ["3000", "1200", "700", "200", "300"]) {
    await page.keyboard.type(input);
    await page.keyboard.press("Tab");
  }
  await expect(
    page.getByRole("button", { name: "Save baseline and continue" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/scenario\?source=user/);

  const savings = page.getByRole("button", { name: /^Planned savings/i });
  await savings.focus();
  await page.keyboard.press("Space");
  const scenarioSavings = page.getByLabel("Scenario planned savings");
  await scenarioSavings.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("400");
  await expect(
    page
      .getByRole("rowheader", { name: "Remaining flexible cash" })
      .locator(".."),
  ).toContainText("−$100.00");

  const settings = page.getByRole("link", { name: "Settings" });
  await settings.focus();
  await page.keyboard.press("Enter");
  await page.getByText("Privacy and technical details").click();
  const methodology = page.getByRole("link", {
    name: /How calculations work/,
  });
  await methodology.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/methodology/);
  const settingsFromMethodology = page.getByRole("link", { name: "Settings" });
  await settingsFromMethodology.focus();
  await page.keyboard.press("Enter");
  await page.getByText("Privacy and technical details").click();
  const privacy = page
    .getByRole("navigation", { name: "Settings information" })
    .getByRole("link", { name: /^Privacy/ });
  await privacy.focus();
  await page.keyboard.press("Enter");
  const clear = page.getByRole("button", { name: "Clear my data" });
  await clear.focus();
  await page.keyboard.press("Space");
  await expect(clear).toBeDisabled();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull();
});

test("does not leak sentinel financial values or produce runtime failures", async ({
  page,
}) => {
  const network: string[] = [];
  const consoleFailures: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("request", (request) =>
    network.push(
      `${request.method()} ${request.url()} ${request.postData() ?? ""}`,
    ),
  );
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      consoleFailures.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(
      `${request.url()} ${request.failure()?.errorText ?? ""}`,
    ),
  );

  await page.goto("/build");
  await fillBaseline(page, sentinel);
  await page
    .getByRole("button", { name: "Save baseline and continue" })
    .click();
  await page.getByLabel("Scenario housing").fill("2345.67");
  await page.getByText("View calculation details").click();
  await page.goto("/methodology");
  await page.goto("/privacy");

  expect(network.join("\n")).not.toContain(sentinel);
  expect(network.join("\n")).not.toContain("1234567");
  expect(consoleFailures).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(await page.context().cookies()).toEqual([]);
  await expect(page).not.toHaveTitle(/12345|12,345/);
  const html = await page.locator("html").innerHTML();
  expect(html).not.toContain("12345.67");
});

for (const [name, record] of [
  ["unsupported", { version: 99, baseline: {} }],
  [
    "partial",
    {
      version: 1,
      savedAt: "2026-01-01T00:00:00.000Z",
      baseline: { incomeCents: 100 },
    },
  ],
  [
    "corrupt",
    { version: 1, savedAt: "not-a-date", baseline: { incomeCents: "corrupt" } },
  ],
] as const) {
  test(`recovers from ${name} stored baseline data`, async ({ page }) => {
    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, value);
      },
      { key: storageKey, value: JSON.stringify(record) },
    );
    await page.goto("/build");
    await expect(page.getByRole("status")).toContainText(/reset/i);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
    ).toBeNull();
  });
}

test("handles invalid scenario query parameters without an exception", async ({
  page,
}) => {
  await page.goto("/scenario?profile=student-renter&type=not-real");
  await expect(page.getByLabel("Scenario housing")).toBeVisible();
  await page.goto("/scenario?profile=not-real");
  await expect(
    page.getByRole("heading", { name: /demo profile is not available/i }),
  ).toBeVisible();
  await page.goto("/scenario");
  await expect(
    page.getByRole("heading", {
      name: /Start with a demo or enter your own monthly values/i,
    }),
  ).toBeVisible();
});

test("refresh discards a scenario experiment while preserving its local baseline", async ({
  page,
}) => {
  await page.goto("/build");
  await fillBaseline(page);
  await page
    .getByRole("button", { name: "Save baseline and continue" })
    .click();
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  );
  await page.getByLabel("Scenario housing").fill("1500");
  await page.reload();
  await expect(page.getByLabel("Scenario housing")).toHaveValue("1200.10");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(stored);
});

test("clearing local data elsewhere produces a safe empty state", async ({
  page,
}) => {
  await page.goto("/build");
  await fillBaseline(page);
  await page
    .getByRole("button", { name: "Save baseline and continue" })
    .click();
  await expect(page).toHaveURL(/scenario\?source=user/);
  await page.evaluate((key) => {
    localStorage.removeItem(key);
  }, storageKey);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: /Start with a demo or enter your own monthly values/i,
    }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 320, height: 700 },
  { width: 360, height: 740 },
  { width: 375, height: 760 },
  { width: 390, height: 780 },
  { width: 412, height: 800 },
  { width: 430, height: 820 },
  { width: 768, height: 900 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const) {
  test(`contains content at ${String(viewport.width)}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/scenario?profile=recent-graduate");
    await page.getByLabel("Scenario housing").fill("1000000");
    await expect(page.getByLabel("Scenario housing")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reset scenario" }),
    ).toBeVisible();
    await page.getByText("View calculation details").click();
    await expect(
      page.getByRole("heading", { name: "Scenario core surplus" }),
    ).toBeVisible();
    const size = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(size.scroll).toBeLessThanOrEqual(size.client);
    const table = page.locator(".comparison-table-wrap");
    expect(
      await table.evaluate(
        (element) => element.scrollWidth >= element.clientWidth,
      ),
    ).toBe(true);
  });
}
