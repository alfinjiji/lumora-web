import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await page.addInitScript(() => {
    window.labMetrics = { lcp: 0, cls: 0, longTasks: [] };
    new PerformanceObserver((list) =>
      list.getEntries().forEach((e) => (window.labMetrics.lcp = e.startTime)),
    ).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) =>
      list.getEntries().forEach((e) => {
        if (!e.hadRecentInput) window.labMetrics.cls += e.value;
      }),
    ).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) =>
      list
        .getEntries()
        .forEach((e) => window.labMetrics.longTasks.push(e.duration)),
    ).observe({ type: "longtask", buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 93750,
  });
  await page.goto(process.env.PERFORMANCE_URL || "http://127.0.0.1:8080/", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(5000);
  console.log(
    JSON.stringify(
      await page.evaluate(() => ({
        ...window.labMetrics,
        transferBytes: performance
          .getEntriesByType("resource")
          .reduce((sum, e) => sum + e.transferSize, 0),
        domContentLoaded:
          performance.getEntriesByType("navigation")[0]
            .domContentLoadedEventEnd,
      })),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
