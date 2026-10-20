import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const accounts = () =>
  JSON.parse(
    readFileSync(
      process.env.E2E_ACCOUNTS_FILE || ".local/browser/browser-accounts.json",
      "utf8",
    ),
  ) as Record<string, { email: string; password: string }>;
async function login(page: Page, role: string) {
  const a = accounts()[role];
  await page.goto(role === "customer" ? "/login" : "/admin");
  await page.getByLabel("Email address", { exact: true }).fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: role === "customer" ? "Your little world." : "A good day to glow.",
    }),
  ).toBeVisible();
}
async function fill(page: Page, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values))
    await page.getByLabel(label, { exact: true }).fill(value);
}
const localDate = (time = new Date()) =>
  new Date(time.getTime() - time.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
test("guest request, owner quote, manual review and fulfillment persist across sessions", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await login(owner, "owner");
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const guest = await guestContext.newPage();
  await guest.goto("/");
  await guest
    .getByRole("button", { name: "Add Sample Jar Candle to bag", exact: true })
    .click();
  await expect(guest.getByRole("status")).toContainText("added to your bag");
  await guest.goto("/cart");
  await guest
    .getByRole("link", { name: "Request your order", exact: false })
    .click();
  await fill(guest, {
    "Full name": "Synthetic Browser Customer",
    "Email address": "browser-guest@example.test",
    "Phone number": "+919000000000",
    "Address line 1": "Synthetic browser test address",
    City: "Kannur",
    "PIN code": "670001",
  });
  await guest
    .getByLabel("I accept the ordering terms", { exact: true })
    .selectOption("true");
  await guest
    .getByRole("button", { name: "Submit order request", exact: true })
    .click();
  await guest.waitForURL("**/orders/*");
  const orderId = guest.url().split("/").at(-1)!;
  await expect(
    guest
      .locator(".status-chip")
      .filter({ hasText: "awaiting shipping quote" }),
  ).toBeVisible();
  await owner.goto("/admin/orders");
  await owner.getByRole("button", { name: /^AF-/ }).first().click();
  await fill(owner, {
    "Shipping charge in INR": "50",
    "Quote deadline": localDate(new Date(Date.now() + 3600000)),
  });
  await owner
    .getByRole("button", { name: "Issue final quote", exact: true })
    .click();
  await expect(
    owner
      .getByLabel("Orders table")
      .getByText("awaiting payment", { exact: true })
      .first(),
  ).toBeVisible();
  await guest.reload();
  await guest.getByRole("checkbox").check();
  await guest.getByRole("button", { name: "Manual payment options" }).click();
  await expect(
    guest.getByText("Destination: NOT-A-REAL-ACCOUNT"),
  ).toBeVisible();
  await guest
    .getByLabel("Payment reference", { exact: true })
    .fill("SYNTHETIC-REFERENCE-" + orderId);
  await guest
    .getByRole("button", {
      name: "Submit payment for owner review",
      exact: true,
    })
    .click();
  await expect(
    guest.getByText("Your manual payment is under review.", { exact: false }),
  ).toBeVisible();
  await owner.reload();
  await owner.getByRole("button", { name: /^AF-/ }).first().click();
  await fill(owner, {
    "Verified bank reference": "SYNTHETIC-BANK-" + orderId,
    "Received amount in INR": "399.50",
    "Received date and time": localDate(),
  });
  await owner
    .getByLabel("Independent funds verification", { exact: true })
    .selectOption("true");
  await owner
    .getByRole("button", {
      name: "Approve verified received payment",
      exact: true,
    })
    .click();
  await owner
    .getByRole("button", { name: "Begin packing", exact: true })
    .click();
  await fill(owner, {
    Carrier: "Synthetic fixture carrier",
    "Tracking number": "SYNTHETIC-TRACKING",
  });
  await owner
    .getByRole("button", { name: "Record dispatch", exact: true })
    .click();
  await owner
    .getByRole("button", { name: "Record delivery", exact: true })
    .click();
  await expect(
    owner
      .getByRole("dialog", { name: "Order details" })
      .getByText("completed", { exact: true }),
  ).toBeVisible();
  await guest.reload();
  await expect(
    guest.getByText("Synthetic fixture carrier", { exact: true }),
  ).toBeVisible();
  await ownerContext.close();
  await guestContext.close();
});
test("owner screens, long content, seven widths and mobile focus remain usable", async ({
  page,
}) => {
  await login(page, "owner");
  for (const name of [
    "Products",
    "Inventory",
    "Enquiries",
    "Collections",
    "Website content",
    "Delivery areas",
    "Team & access",
    "My profile",
    "Payments & audit",
  ]) {
    await page.locator("nav").getByRole("link", { name, exact: true }).click();
    await expect(page.locator("main.page")).toBeVisible();
  }
  await page.goto("/admin/content");
  await fill(page, {
    "Hero headline": "Longcandlelight".repeat(12),
    "Hero subtitle": "A little warmth. ".repeat(100),
    "Button label": "Morelovelymoments".repeat(6),
  });
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const box = (await page.locator(".hero-preview").boundingBox())!;
    for (const s of ["h2", "p", ".preview-cta", ".art"]) {
      const child = (await page.locator(".hero-preview " + s).boundingBox())!;
      expect(child.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(child.x + child.width).toBeLessThanOrEqual(box.x + box.width + 1);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Studio navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
});
test("fulfillment membership cannot call owner operations or see financial controls", async ({
  page,
}) => {
  await login(page, "fulfillment");
  await expect(
    page.getByRole("link", { name: "Team & access", exact: true }),
  ).toHaveCount(0);
  const r = await page.request.get("/api/v1/admin/team");
  expect([403, 404]).toContain(r.status());
  await page.goto("/admin/finance");
  await expect(
    page.getByRole("heading", { name: "Owner access is required." }),
  ).toBeVisible();
});

test("customer saves and edits an address through the real account API", async ({
  page,
}) => {
  await login(page, "customer");
  await fill(page, {
    "Address line 1": "Synthetic saved address",
    "Address line 2": "Development fixture",
    City: "Kannur",
    "PIN code": "670001",
  });
  await page
    .getByRole("button", { name: "Save new address", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic saved address, Kannur, 670001", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit address", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit saved address" });
  await dialog.getByLabel("City", { exact: true }).fill("Kochi");
  await dialog.getByLabel("PIN code", { exact: true }).fill("682001");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic saved address, Kochi, 682001", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Synthetic saved address, Kochi, 682001", { exact: true }),
  ).toBeVisible();
});
test("owner creates a photographed product variant and records its stock separately", async ({
  page,
}) => {
  await login(page, "owner");
  const suffix = Date.now().toString();
  const title = "Synthetic Browser Candle " + suffix;
  const sku = "BROWSER-" + suffix;
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "+ Add candle", exact: true }).click();
  await fill(page, {
    "Product name": title,
    "Page slug": "synthetic-browser-" + suffix,
    Description: "Synthetic development fixture only; not a real product.",
  });
  await page
    .getByRole("button", { name: "Create draft candle", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Candle details" });
  await expect(
    dialog.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ Add variant", exact: true })
    .click();
  await fill(page, { SKU: sku, "Price in INR": "399.50" });
  await page.getByRole("button", { name: "Save variant", exact: true }).click();
  await expect(dialog.getByText(sku, { exact: false })).toBeVisible();
  // Keep the genuine reference photo, with a legal RIFF padding chunk above PHP's old 2MiB default.
  const originalPhoto = readFileSync("apps/web/public/images/design/jar.webp");
  const padding = Buffer.alloc(3 * 1024 * 1024 + 8);
  padding.write("JUNK", 0, "ascii");
  padding.writeUInt32LE(padding.length - 8, 4);
  const cameraPhoto = Buffer.concat([originalPhoto, padding]);
  cameraPhoto.writeUInt32LE(cameraPhoto.length - 8, 4);
  await page
    .getByLabel("Upload product photograph", { exact: true })
    .setInputFiles({
      name: "synthetic-camera-metadata.webp",
      mimeType: "image/webp",
      buffer: cameraPhoto,
    });
  await expect(dialog.locator("img")).toHaveCount(1);
  await dialog.getByLabel("Status", { exact: true }).selectOption("active");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.locator(".product-card").filter({ hasText: title }),
  ).toContainText("active");
  await page.getByRole("button", { name: "Close Candle details" }).click();
  await page.goto("/admin/inventory");
  const row = page.getByRole("row").filter({ hasText: sku });
  await row.getByRole("button", { name: "Adjust / history" }).click();
  await fill(page, {
    "Quantity change (use a minus for a reduction)": "3",
    "Adjustment reason": "Synthetic initial stock count",
  });
  await page
    .getByRole("button", { name: "Record adjustment", exact: true })
    .click();
  await expect(row).toContainText("3");
  await page.goto("/products/synthetic-browser-" + suffix);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to bag", exact: false }),
  ).toBeEnabled();
});

test("introduction skip, Escape, reduced motion and mobile shop navigation work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Skip intro", exact: false }).click();
  await expect(page.locator(".opening-overlay")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Replay introduction", exact: false })
    .click();
  await expect(page.locator(".opening-overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".opening-overlay")).toHaveCount(0);
  await expect(page.locator("[inert]")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Replay introduction", exact: false })
    .click();
  await expect(page.locator(".opening-overlay")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open shop navigation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Shop navigation", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open shop navigation" }),
  ).toBeFocused();
});

test("a signed-in customer requests an order and finds it in their account", async ({
  page,
}) => {
  await login(page, "customer");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add Sample Jar Candle to bag", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("added to your bag");
  await page.goto("/checkout");
  await fill(page, {
    "Full name": "Customer Fixture",
    "Email address": accounts().customer.email,
    "Phone number": "+919000000000",
    "Address line 1": "Synthetic account checkout",
    City: "Kannur",
    "PIN code": "670001",
  });
  await page
    .getByLabel("I accept the ordering terms", { exact: true })
    .selectOption("true");
  await page
    .getByRole("button", { name: "Submit order request", exact: true })
    .click();
  await page.waitForURL("**/orders/*");
  const number = await page
    .locator("h2")
    .filter({ hasText: /^AF-/ })
    .innerText();
  await page.goto("/account");
  await expect(
    page.getByRole("link", { name: new RegExp(number) }),
  ).toBeVisible();
});
test("a staff direct order follows server pricing and waits for owner shipping", async ({
  page,
}) => {
  await login(page, "fulfillment");
  await page.goto("/admin/orders");
  await page
    .getByRole("button", { name: "+ Add direct order", exact: true })
    .click();
  const picker = page.getByRole("combobox", {
    name: "Candle variant",
    exact: true,
  });
  const value = await picker
    .locator("option")
    .filter({ hasText: "SYNTHETIC-JAR" })
    .getAttribute("value");
  await picker.selectOption(value!);
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await fill(page, {
    "Customer name": "Synthetic Direct Customer",
    "Customer email": "direct-customer@example.test",
    "Phone number": "+919000000000",
    "Delivery address": "Synthetic direct-order address",
    "City in Kerala": "Kannur",
    "PIN code": "670001",
  });
  await page.getByLabel("Order channel", { exact: true }).selectOption("phone");
  await page
    .getByRole("button", { name: "Create order request", exact: true })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Order details",
    exact: true,
  });
  await expect(
    detail.getByText("awaiting shipping quote", { exact: true }),
  ).toBeVisible();
  await expect(detail.getByText("phone", { exact: true })).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Issue final quote", exact: true }),
  ).toHaveCount(0);
  await expect(detail).toContainText("349.50");
});
test("event enquiry assignment, private notes, draft and public content publication persist", async ({
  browser,
}) => {
  const publicContext = await browser.newContext({ reducedMotion: "reduce" });
  const customer = await publicContext.newPage();
  const contactName = "Synthetic Celebration Contact " + Date.now();
  await customer.goto("/");
  await customer.locator(".occasion-grid button.occasion").click();
  await fill(customer, {
    "Your name": contactName,
    Email: "celebration@example.test",
    "Phone number": "+919000000000",
    "What do you have in mind?":
      "Synthetic event enquiry for browser qualification.",
  });
  await customer
    .getByRole("button", { name: "Send enquiry", exact: true })
    .click();
  await expect(customer.getByRole("status")).toContainText(
    "Your enquiry is saved",
  );
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await login(owner, "owner");
  await owner.goto("/admin/enquiries");
  await owner
    .getByRole("row")
    .filter({ hasText: contactName })
    .getByRole("button", { name: "Open enquiry", exact: true })
    .click();
  await owner
    .getByLabel("Follow-up status", { exact: true })
    .selectOption("in_progress");
  await owner
    .getByLabel("Assigned team member", { exact: true })
    .selectOption({ label: "Fulfillment Fixture" });
  await owner
    .getByRole("button", { name: "Save follow-up status", exact: true })
    .click();
  await owner
    .getByLabel("Note", { exact: true })
    .fill("Synthetic private follow-up");
  await owner
    .getByRole("button", { name: "Add internal note", exact: true })
    .click();
  await expect(
    owner.getByText("Synthetic private follow-up", { exact: true }),
  ).toBeVisible();
  await owner.goto("/admin/content");
  const campaign = "A synthetic campaign for testing.";
  await fill(owner, {
    "Hero headline": campaign,
    Announcement: "DEVELOPMENT PUBLICATION CHECK",
  });
  await owner.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    owner.getByText("Draft saved. The published website is unchanged.", {
      exact: true,
    }),
  ).toBeVisible();
  await customer.goto("/");
  await expect(
    customer.getByRole("heading", { name: campaign, exact: true }),
  ).toHaveCount(0);
  await owner
    .getByRole("button", { name: "Publish saved draft", exact: true })
    .click();
  await expect(
    owner.getByText("The saved draft is now published.", { exact: true }),
  ).toBeVisible();
  await customer.reload();
  await expect(
    customer.getByRole("heading", { name: campaign, exact: true }),
  ).toBeVisible();
  await expect(customer.locator(".announcement")).toContainText(
    "DEVELOPMENT PUBLICATION CHECK",
  );
  await expect(
    customer.getByText("Synthetic private follow-up", { exact: true }),
  ).toHaveCount(0);
  await ownerContext.close();
  await publicContext.close();
});
