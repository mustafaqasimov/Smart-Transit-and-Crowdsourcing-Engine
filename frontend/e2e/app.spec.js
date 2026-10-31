import { test, expect } from "@playwright/test";
import fs from "node:fs";
const key = fs
  .readFileSync("../.env", "utf8")
  .split("\n")
  .find((x) => x.startsWith("OPERATOR_KEY="))
  .slice(13);
test("passenger report, STOP and operator acknowledgement", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Yolunu bil. Vaxtını qoru." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reysə qoşul" }).click();
  await page
    .getByRole("button", { name: "STOP · Növbəti dayanacaq", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "STOP serverə çatdı" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dolu", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Bildirişiniz hesablamaya əlavə edildi",
  );
  await page
    .getByRole("button", { name: "Operator mərkəzi", exact: true })
    .click();
  await page.getByLabel("Operator açarı").fill(key);
  await page.getByRole("button", { name: "Daxil ol", exact: true }).click();
  await page
    .getByRole("button", { name: "Təsdiqlə", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Sürücü panelində təsdiqləndi" }),
  ).toBeVisible({ timeout: 12000 });
  await page.screenshot({
    path: "../docs/operator-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("mobile passenger layout and route search", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Marşrut axtar").fill("18");
  await expect(page.locator(".route-card")).toHaveCount(1);
  await page.locator(".route-card").click();
  await expect(page.locator(".detail")).toContainText("İçərişəhər");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "../docs/passenger-mobile.png",
    fullPage: true,
  });
});
