import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:5001";
const EMAIL = process.env.AOI_EMAIL || "chrislafond@aoglobelife.com";
const PASSWORD = process.env.AOI_PASSWORD || "aointel2025";

async function maybeLogin(page) {
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]').first();
  const submit = page.locator('button[type="submit"]');

  const onLogin = await emailInput.isVisible({ timeout: 6000 }).catch(() => false);
  if (!onLogin) return false;

  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);
  await submit.click();
  await page.waitForTimeout(5000);
  return true;
}

async function closeDisruptiveOverlays(page) {
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(350);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await maybeLogin(page);
    await page.waitForTimeout(2500);
    await page.goto(`${BASE_URL}/application`, { waitUntil: "domcontentloaded", timeout: 45000 });

    await closeDisruptiveOverlays(page);
    await page.screenshot({ path: "C:/dev/AOIrail/scripts/output/form-fill-proof-precheck.png", fullPage: false });

    await page.waitForSelector("text=Who's on This Application?", { timeout: 45000 });

    const primaryInput = page.locator("input").nth(0);
    const spouseToggle = page.locator('button[class*="relative w-10 h-5"]').first();
    await primaryInput.click();
    await primaryInput.fill("ALICE TESTER");

    await spouseToggle.click();
    const spouseInput = page.locator('input[placeholder="SPOUSE NAME"]');
    await spouseInput.waitFor({ state: "visible", timeout: 10000 });
    await spouseInput.click();
    await spouseInput.fill("BOB TESTER");

    // Wait longer than the polling interval to verify no focus/typing disruption.
    await page.waitForTimeout(7000);

    const primaryValue = await primaryInput.inputValue();
    const spouseValue = await spouseInput.inputValue();
    const focusTag = await page.evaluate(() => document.activeElement?.tagName || "");
    const focusType = await page.evaluate(() => {
      const el = document.activeElement;
      return el && "type" in el ? el.type : "";
    });

    const primaryOk = primaryValue === "ALICE TESTER";
    const spouseOk = spouseValue === "BOB TESTER";

    const result = {
      url: page.url(),
      primaryValue,
      spouseValue,
      primaryOk,
      spouseOk,
      activeElement: `${focusTag}:${focusType}`,
      status: primaryOk && spouseOk ? "PASS" : "FAIL",
    };

    console.log(JSON.stringify(result, null, 2));
    await page.screenshot({ path: "C:/dev/AOIrail/scripts/output/form-fill-proof.png", fullPage: false });

    if (!primaryOk || !spouseOk) {
      process.exitCode = 2;
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FORM_PROOF_ERROR", err);
  process.exit(1);
});
