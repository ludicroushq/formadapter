import { expect, test } from "@playwright/test";

import { docsUrl } from "../playwright.config";

test("the hero responds, validates with prefixed styles, and returns typed output", async ({
  page,
}) => {
  await page.goto(docsUrl);
  expect(await page.evaluate(() => ({
    activeElement: document.activeElement?.tagName,
    scrollY: window.scrollY,
  }))).toEqual({ activeElement: "BODY", scrollY: 0 });

  const heroCard = page.locator(".hero-example");
  const initialBox = await heroCard.boundingBox();
  expect(initialBox).not.toBeNull();

  await page.getByRole("radio", { name: "Personal" }).check();
  await expect(page.getByRole("textbox", { name: "Company name" }))
    .toHaveCount(0);
  await expect.poll(async () => (await heroCard.boundingBox())?.height)
    .toBeLessThan((initialBox?.height ?? 0) - 30);

  await page.getByRole("radio", { name: "Company" }).check();
  const company = page.getByRole("textbox", { name: "Company name" });
  await company.clear();
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(company).toBeFocused();
  await expect(company).toHaveAttribute("aria-invalid", "true");
  const fieldError = page.locator("p.text-error", {
    hasText: "Company name is required",
  });
  await expect(fieldError).toBeVisible();
  await expect(fieldError).toHaveClass(/\btext-error\b/u);
  await expect(fieldError).not.toHaveClass(/\bfa-text-error\b/u);
  expect(await fieldError.evaluate((element) => getComputedStyle(element).color))
    .toBe("rgb(220, 38, 38)");

  await company.fill("Analytical Engines");
  await page.getByRole("button", { name: "Create workspace" }).click();
  const output = page.getByRole("region", { name: "Typed output" })
    .locator("code");
  await expect(output).toContainText('"company":"Analytical Engines"');
  expect(JSON.parse(await output.innerText())).toEqual({
    accountType: "company",
    company: "Analytical Engines",
    email: "ada@example.com",
  });

  const serverError = page.locator(".server-form-demo p.text-error", {
    hasText: "Already registered",
  });
  await expect(serverError).toBeVisible();
  await expect(serverError).toHaveClass(/\btext-error\b/u);
  await expect(serverError).not.toHaveClass(/\btext-success\b/u);
});
