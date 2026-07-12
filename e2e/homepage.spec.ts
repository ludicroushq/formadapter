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

  const command = page.locator(".install-command code");
  const copyButton = page.getByRole("button", { name: "Copy install command" });
  const packageManager = page.getByRole("group", { name: "Package manager" });
  const framework = page.getByRole("group", { name: "Framework" });
  const ui = page.getByRole("group", { name: "UI" });

  await expect(packageManager.getByRole("radio", { name: "bun" }))
    .toBeChecked();
  await expect(framework.getByRole("radio", { name: "React" })).toBeChecked();
  await expect(ui.getByRole("radio", { name: "DaisyUI" })).toBeChecked();
  await expect(command).toHaveText(
    "bun add @formadapter/react @formadapter/daisyui zod daisyui",
  );

  const packageCommands = {
    npm: "npm install",
    pnpm: "pnpm add",
    yarn: "yarn add",
    bun: "bun add",
  } as const;
  for (const [name, prefix] of Object.entries(packageCommands)) {
    await packageManager.getByText(name, { exact: true }).click();
    await expect(packageManager.getByRole("radio", { name, exact: true }))
      .toBeChecked();
    await expect(command).toHaveText(
      `${prefix} @formadapter/react @formadapter/daisyui zod daisyui`,
    );
  }

  await packageManager.getByRole("radio", { name: "npm", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect(packageManager.getByRole("radio", { name: "pnpm" }))
    .toBeChecked();
  await expect(command).toHaveText(
    "pnpm add @formadapter/react @formadapter/daisyui zod daisyui",
  );

  await copyButton.click();
  await expect(copyButton).toHaveText(/Copied|Selected/u);

  await ui.getByText("shadcn", { exact: true }).click();
  await expect(copyButton).toHaveText("Copy");
  await expect(command).toHaveText(
    "pnpm add @formadapter/react @formadapter/shadcn zod",
  );
  await ui.getByText("Bring your own", { exact: true }).click();
  await expect(command).toHaveText(
    "pnpm add @formadapter/react @formadapter/html zod",
  );

  await packageManager.getByText("bun", { exact: true }).click();
  await ui.getByText("DaisyUI", { exact: true }).click();

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

  const errorSummary = page.locator(".server-form-demo [role=alert]", {
    hasText: "Please fix the highlighted fields",
  });
  const summaryLink = errorSummary.getByRole("button", {
    name: "Already registered",
  });
  await expect(summaryLink).toBeVisible();
  await expect(summaryLink).toHaveClass(/\bfa-link\b/u);
  await expect(summaryLink).not.toHaveClass(/\bfa-link-error\b/u);
  const summaryColors = await summaryLink.evaluate((element) => {
    const alert = element.closest<HTMLElement>("[role=alert]");
    if (!alert) throw new Error("Error summary alert was not found");
    return {
      alertBackground: getComputedStyle(alert).backgroundColor,
      alertColor: getComputedStyle(alert).color,
      linkColor: getComputedStyle(element).color,
    };
  });
  expect(summaryColors.linkColor).toBe(summaryColors.alertColor);
  expect(summaryColors.linkColor).not.toBe(summaryColors.alertBackground);
});
