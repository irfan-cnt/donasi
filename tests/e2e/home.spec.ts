import { expect, test } from "@playwright/test";

test("home renders without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tebar Kebaikan" })).toBeVisible();
  expect(errors).toEqual([]);
});
