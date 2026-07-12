import { expect, test } from "@playwright/test";

import { exampleUrl } from "../playwright.config";

test("a real file input carries browser files into schema validation", async ({
  page,
}) => {
  await page.goto(`${exampleUrl}/arrays-files`);

  const attachment = page.getByLabel("PNG attachment");
  await attachment.setInputFiles({
    buffer: Buffer.from("not-a-png"),
    mimeType: "text/plain",
    name: "notes.txt",
  });
  expect(await attachment.evaluate((input: HTMLInputElement) => ({
    name: input.files?.[0]?.name,
    type: input.files?.[0]?.type,
  }))).toEqual({ name: "notes.txt", type: "text/plain" });

  await page.getByRole("button", { name: "Submit" }).click();
  await expect(attachment).toBeFocused();
  await expect(attachment).toHaveAttribute("aria-invalid", "true");

  await attachment.setInputFiles({
    buffer: Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]),
    mimeType: "image/png",
    name: "tiny.png",
  });
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(attachment).not.toHaveAttribute("aria-invalid", "true");
});

test("an object-level error renders inline on its group and clears", async ({
  page,
}) => {
  await page.goto(`${exampleUrl}/arrays-files`);

  await page.getByRole("textbox", { name: "Email" }).fill("owner@example.com");
  await page.getByRole("button", { name: "Submit" }).click();

  const message = page.getByText("The project owner is already included", {
    exact: true,
  }).last();
  await expect(message).toBeVisible();
  const group = page.getByRole("group", { name: "Collaborators item" });
  const errorId = await message.getAttribute("id");
  expect(errorId).toBeTruthy();
  await expect(group).toHaveAttribute("aria-invalid", "true");
  await expect(group).toHaveAttribute("aria-describedby", errorId ?? "");

  await page.getByRole("textbox", { name: "Email" }).fill("ada@example.com");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(message).not.toBeVisible();
  await expect(group).not.toHaveAttribute("aria-invalid", "true");
});

test("the native HTML adapter validates without design-system setup", async ({
  page,
}) => {
  await page.goto(`${exampleUrl}/html`);

  const email = page.getByRole("textbox", { name: "Email" });
  await expect(email).not.toHaveClass(/(?:^|\s)input(?:\s|$)/u);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a valid email", { exact: true }).last())
    .toBeVisible();

  await email.fill("ada@example.com");
  await page.getByRole("textbox", { name: "Message" }).fill(
    "Analytical engine notes",
  );
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
});

for (const [name, route] of [
  ["Base UI", "/shadcn"],
  ["Radix UI", "/shadcn-radix"],
] as const) {
  test(`the ${name} shadcn connector renders source-owned components`, async ({
    page,
  }) => {
    await page.goto(`${exampleUrl}${route}`);

    const email = page.getByRole("textbox", { name: "Email" });
    await expect(email).not.toHaveClass(/(?:^|\s)input(?:\s|$)/u);

    const initialStyle = await email.evaluate((element) => ({
      borderColor: getComputedStyle(element).borderTopColor,
      borderRadius: getComputedStyle(element).borderRadius,
    }));
    expect(Number.parseFloat(initialStyle.borderRadius)).toBeGreaterThan(0);

    const lightBackground = await page.locator("body").evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await page.locator("html").evaluate((element) => {
      element.classList.add("dark");
    });
    const darkTheme = await email.evaluate((element) => ({
      background: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(element).color,
    }));
    expect(darkTheme.background).not.toBe(lightBackground);
    expect(darkTheme.color).not.toBe(darkTheme.background);
    await page.locator("html").evaluate((element) => {
      element.classList.remove("dark");
    });

    await page.getByRole("button", { name: "Submit" }).click();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Enter a valid email", { exact: true }).last())
      .toBeVisible();

    const invalidBorderColor = await email.evaluate(
      (element) => getComputedStyle(element).borderTopColor,
    );
    expect(invalidBorderColor).not.toBe(initialStyle.borderColor);
  });
}

test("the Next.js Server Action reports pending, routes errors, and succeeds", async ({
  page,
}) => {
  await page.goto(`${exampleUrl}/next-server-action`);

  await expect(page.getByText("Loading saved progress…"))
    .not.toBeVisible();
  const email = page.getByRole("textbox", { name: "Work email" });
  await expect(email).toBeEnabled();
  await email.fill("used@example.com");

  const next = page.getByRole("button", { name: "Next", exact: true });
  await next.focus();
  await page.keyboard.press("Enter");
  const launchHeading = page.getByRole("heading", {
    level: 2,
    name: "Launch setup",
  });
  await expect(launchHeading).toBeFocused();

  let releaseRequest: (() => void) | undefined;
  let markRequestStarted: (() => void) | undefined;
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve;
  });
  let heldRequest = false;
  await page.route("**/next-server-action", async (route) => {
    if (route.request().method() !== "POST" || heldRequest) {
      await route.continue();
      return;
    }
    heldRequest = true;
    markRequestStarted?.();
    await new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await route.continue();
  });

  const submit = page.getByRole("button", { name: "Submit" });
  const submitClick = submit.click();
  await requestStarted;
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
  releaseRequest?.();
  await submitClick;

  await expect(page.getByRole("heading", { level: 2, name: "Identity" }))
    .toBeVisible();
  await expect(email).toBeFocused();
  await expect(page.getByText("That email already belongs to an account", {
    exact: true,
  }).last()).toBeVisible();

  await email.fill("new@example.com");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Onboarding saved", { exact: true }))
    .toBeVisible();
});
