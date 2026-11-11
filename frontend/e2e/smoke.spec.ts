import { expect, test } from "@playwright/test";

test("sample edition reads, changes theme, and saves to the local library", async ({ page }) => {
  await page.goto("/demo");

  await expect(
    page.getByRole("heading", { name: "The quiet architecture of attention", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Security Lab" })).toHaveCount(0);

  await page.getByTitle("Night theme").click();
  await expect(page.locator(".reader-root").first()).toHaveAttribute("data-reader-theme", "night");

  await page.reload();
  await expect(page.locator(".reader-root").first()).toHaveAttribute("data-reader-theme", "night");

  await page.locator('button[title="Save to library"]').first().click();
  await expect(page.getByRole("status")).toContainText("Saved to your local library.");

  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "The quiet architecture of attention" }),
  ).toBeVisible();
  await expect(page.getByText("An empty shelf, for now.")).toHaveCount(0);
});

test("sample newspaper is immersive and printable", async ({ page }) => {
  await page.goto("/newspaper/demo");

  await expect(page.getByText("The Ghost Review", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Security Lab" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Reader view/ })).toBeVisible();
});

test("security lab runs a local defensive scenario when the API is available", async ({
  page,
  request,
}) => {
  const response = await request
    .get(process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:8000/api/v1/health/ready")
    .catch(() => null);
  test.skip(!response?.ok(), "The Ghost Reader API is not running.");

  await page.goto("/security-lab");
  await page.getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Scenario complete")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/SIMULATED HTTP/)).toBeVisible();
});
