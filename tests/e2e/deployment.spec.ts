import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/accounts",
  "/plan",
  "/settings",
  "/auth",
  "/explore",
  "/build",
  "/scenario",
  "/scenario?profile=student-renter",
  "/methodology",
  "/privacy",
] as const;

for (const route of routes) {
  test(`loads and refreshes ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page.locator("main")).toBeVisible();
    await page.reload();
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "moni2go home" }),
    ).toBeVisible();
  });
}

test("returns a branded 404 with safe navigation", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This page is not available." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();
  await expect(page).toHaveTitle(/Page not found · moni2go/);
});

test("persists and deletes a custom baseline after hard navigation", async ({
  page,
}) => {
  await page.goto("/build");
  for (const [label, value] of [
    ["Monthly take-home income", "4321.09"],
    ["Housing", "1234.56"],
    ["Other monthly expenses", "765.43"],
    ["Debt payments", "210"],
    ["Planned savings", "456.78"],
  ] as const) {
    await page.getByLabel(label).fill(value);
  }
  await page
    .getByRole("button", { name: "Save baseline and continue" })
    .click();
  await expect(page).toHaveURL(/scenario\?source=user/);
  await page.reload();
  await expect(page.getByText("Your financial baseline")).toBeVisible();

  await page.goto("/privacy");
  await page.getByRole("button", { name: "Clear my data" }).click();
  await expect(
    page.getByRole("button", { name: "Clear my data" }),
  ).toBeDisabled();
  await page.goto("/scenario");
  await expect(
    page.getByRole("heading", {
      name: /Start with a demo or enter your own monthly values/i,
    }),
  ).toBeVisible();
});
