import { expect, test, type Page } from "@playwright/test";

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

for (const width of [320, 360, 375, 390, 412, 430] as const) {
  test(`uses the mobile app shell without overflow at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 760 });
    await page.goto("/");

    const navigation = page.getByRole("navigation", {
      name: "App navigation",
    });
    await expect(navigation).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeHidden();
    await expect(
      navigation.getByRole("link", { name: "Home" }),
    ).toHaveAttribute("aria-current", "page");

    for (const label of ["Home", "Accounts", "Plan", "Settings"] as const) {
      const box = await navigation
        .getByRole("link", { name: label })
        .boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }

    await expectNoPageOverflow(page);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    const overlap = await page.evaluate(() => {
      const footer = document.querySelector(".site-footer");
      const navigationElement = document.querySelector(".mobile-navigation");
      if (
        !(footer instanceof HTMLElement) ||
        !(navigationElement instanceof HTMLElement)
      )
        return true;
      return (
        footer.getBoundingClientRect().bottom >
        navigationElement.getBoundingClientRect().top
      );
    });
    expect(overlap).toBe(false);
  });
}

test("mobile navigation exposes active state and works by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "App navigation" });
  const money = navigation.getByRole("link", { name: "Accounts" });
  await money.focus();
  await expect(money).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(money).toHaveAttribute("aria-current", "page");

  const plan = navigation.getByRole("link", { name: "Plan" });
  await plan.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/plan$/);
  await expect(plan).toHaveAttribute("aria-current", "page");
});

test("desktop uses the top navigation and bounded content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/methodology");
  await expect(
    page.getByRole("navigation", { name: "App navigation" }),
  ).toBeHidden();
  const primary = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(primary).toBeVisible();
  await expect(primary.getByRole("link", { name: "Settings" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expectNoPageOverflow(page);
});

test("small-screen money form keeps labels, units, and controls usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/build");
  const income = page.getByLabel("Monthly take-home income");
  await expect(income).toHaveAttribute("inputmode", "decimal");
  await expect(income).toBeVisible();
  await expect(page.getByText("CAD", { exact: true }).first()).toBeVisible();
  const submit = page.getByRole("button", {
    name: "Save baseline and continue",
  });
  expect((await submit.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expectNoPageOverflow(page);
});

test("landing has one account-first decision and one disclaimer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Add an account", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Try a demo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Questions moni2go is designed to explore"),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Estimates are based on your assumptions. moni2go provides analysis, not financial advice.",
      { exact: true },
    ),
  ).toHaveCount(1);
});

test("the disclaimer can be dismissed and stays hidden", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Dismiss disclaimer" }).click();
  await expect(page.locator(".site-footer")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".site-footer")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("moni2go:disclaimer-dismissed:v1"),
    ),
  ).toBe("true");
});

test("theme control switches modes and persists after reload", async ({
  page,
}) => {
  await page.goto("/plan");
  const toggle = page.getByRole("button", {
    name: /Switch to (dark|light) mode/,
  });
  const initial = await page.locator("html").getAttribute("data-theme");
  await toggle.click();
  const changed = initial === "dark" ? "light" : "dark";
  await expect(page.locator("html")).toHaveAttribute("data-theme", changed);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", changed);
  expect(await page.evaluate(() => localStorage.getItem("moni2go:theme"))).toBe(
    changed,
  );
});
