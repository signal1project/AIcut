const { _electron: electron } = require('@playwright/test');

async function activeWindow(app) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    for (const page of app.windows()) {
      if (!page.isClosed()) {
        const url = page.url();
        if (!url.includes('splash.html')) return page;
      }
    }
    try {
      const page = await app.waitForEvent('window', { timeout: 1000 });
      if (!page.isClosed() && !page.url().includes('splash.html')) return page;
    } catch {}
  }
  throw new Error('No non-splash Electron window appeared');
}

(async () => {
  const app = await electron.launch({
    executablePath: 'release/1.0.0/linux-unpacked/master-ai-social',
    args: ['--no-sandbox', '--disable-gpu'],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
    timeout: 30000,
  });
  const errors = [];
  const page = await activeWindow(app);
  page.on('pageerror', (err) => errors.push(err.message));
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => { window.location.hash = '#/mas/omobono'; });
  await page.getByText('Omobono Social Engine').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Build Omobono package/i }).click();
  await page.waitForTimeout(7000);
  const apiInfo = await page.evaluate(() => window.ipcRenderer.invoke('mas:api-info'));
  const directCreate = await page.evaluate(async (info) => {
    const res = await fetch(`${info.baseUrl}/api/workflow/campaign-package`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${info.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignTitle: 'Smoke Test Campaign',
        objective: 'Verify Omobono workflow persistence',
        niche: 'web design',
        platforms: ['instagram', 'youtube'],
        approvalMode: 'dale_required',
      }),
    });
    return { status: res.status, body: await res.json() };
  }, apiInfo);
  const packagesResponse = await page.evaluate(async (info) => {
    const res = await fetch(`${info.baseUrl}/api/workflow/campaign-packages?limit=5`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    return res.json();
  }, apiInfo);
  const body = await page.locator('body').innerText({ timeout: 5000 });
  console.log(JSON.stringify({
    title: await page.title(),
    url: page.url(),
    hasOmobono: body.includes('Omobono Social Engine'),
    hasApprovalQueue: body.includes('Approval queue') || body.includes('package history'),
    hasCapCut: body.includes('CapCut package'),
    hasAdapters: body.includes('Hermes') || body.includes('adapter'),
    directCreateStatus: directCreate.status,
    directCreateHasPersisted: Boolean(directCreate.body.persistedPackage),
    directCreateError: directCreate.body.error ?? null,
    apiPackageCount: Array.isArray(packagesResponse.packages) ? packagesResponse.packages.length : null,
    latestPackageStatus: packagesResponse.packages?.[0]?.status ?? null,
    failedText: body.includes('Campaign package failed'),
    errors,
  }, null, 2));
  await app.close();
})();
