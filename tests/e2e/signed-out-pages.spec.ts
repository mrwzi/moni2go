import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const signedOutEnvironment = process.env.PLAYWRIGHT_SIGNED_OUT === "1";

async function waitForSignedOutCard(page: Page, heading: string) {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({
    timeout: 10_000,
  });
  return page.locator(".signed-out-card");
}

test.describe("signed-out Home, Accounts, and Plan pages", () => {
  test.skip(
    !signedOutEnvironment,
    "Requires a browser server configured for signed-out Supabase auth.",
  );

  test("shows page-specific copy and working actions", async ({ page }) => {
    await page.goto("/");
    await waitForSignedOutCard(page, "Sign in to see your money.");
    await expect(page.getByText("Private workspace")).toBeVisible();
    await page.getByRole("link", { name: "Sign in or create account" }).click();
    await expect(page).toHaveURL(/\/auth$/);

    await page.goto("/accounts");
    await waitForSignedOutCard(page, "Your accounts are private");
    await page.getByRole("link", { name: "View sample accounts" }).click();
    await expect(page).toHaveURL(/\/explore$/);

    await page.goto("/plan");
    await waitForSignedOutCard(page, "Your plan is private");
    await expect(
      page.getByRole("link", { name: "View sample plan" }),
    ).toHaveAttribute("href", "/explore");
  });

  for (const width of [320, 360, 375, 390, 412, 430] as const) {
    test(`keeps Accounts and Plan stable without overflow at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      const cardBoxes = [];

      for (const destination of [
        {
          path: "/accounts",
          heading: "Your accounts are private",
          active: "Accounts",
        },
        {
          path: "/plan",
          heading: "Your plan is private",
          active: "Plan",
        },
      ] as const) {
        await page.goto(destination.path);
        const card = await waitForSignedOutCard(page, destination.heading);
        const box = await card.boundingBox();
        if (!box) throw new Error(`${destination.path} card was not visible.`);
        cardBoxes.push(box);
        await expect(
          page
            .getByRole("navigation", { name: "App navigation" })
            .getByRole("link", { name: destination.active }),
        ).toHaveAttribute("aria-current", "page");

        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(
          dimensions.clientWidth,
        );
      }

      const [accountsBox, planBox] = cardBoxes;
      if (!accountsBox || !planBox)
        throw new Error("Both signed-out cards must be measurable.");
      expect(Math.abs(accountsBox.x - planBox.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(accountsBox.y - planBox.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(accountsBox.width - planBox.width)).toBeLessThanOrEqual(
        1,
      );
      expect(Math.abs(accountsBox.height - planBox.height)).toBeLessThanOrEqual(
        1,
      );
    });
  }

  test("keeps the cards bounded on tablet and desktop", async ({ page }) => {
    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/accounts");
      const card = await waitForSignedOutCard(
        page,
        "Your accounts are private",
      );
      const box = await card.boundingBox();
      if (!box) throw new Error("The Accounts card was not visible.");
      expect(box.width).toBeLessThanOrEqual(544);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
  });

  test("has no automated accessibility violations", async ({ page }) => {
    for (const destination of [
      { path: "/", heading: "Sign in to see your money." },
      { path: "/accounts", heading: "Your accounts are private" },
      { path: "/plan", heading: "Your plan is private" },
    ] as const) {
      await page.goto(destination.path);
      await waitForSignedOutCard(page, destination.heading);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations,
        JSON.stringify(results.violations, null, 2),
      ).toEqual([]);
    }
  });
});
