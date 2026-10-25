import { expect, test } from '@playwright/test';

// Full-distance checks do not need a Retina framebuffer; touch projects cover high DPR separately.
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });

test('a complete half marathon saves results, splits, PB and medal; replay does not duplicate them', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Full production simulation is exercised on both desktop browser engines.');
  // Software-rendered WebKit on Linux can take several minutes to draw a whole race.
  test.setTimeout(360000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  // Move the browser clock, keeping the production fixed-step rules unchanged.
  // Render at 10 fps to avoid drawing 16,000 frames while advancing a whole race.
  await page.clock.install({ time: new Date('2026-10-26T00:00:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: '静音', exact: true }).click();
  await page.locator('[data-event="yangzhou"]').click();
  await page.locator('[data-action="start"]').click();
  await page.getByRole('button', { name: '出发', exact: true }).click();
  await page.clock.pauseAt(new Date('2026-10-26T01:00:00Z'));
  await page.evaluate(() => {
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 100);
    window.cancelAnimationFrame = id => window.clearTimeout(id);
  });
  for (let i = 0; i < 90; i++) await page.clock.runFor(3000);
  await expect(page.getByRole('region', { name: '完赛成绩' })).toBeVisible();
  await expect(page.locator('.result-badges')).toContainText('PERSONAL BEST');
  await expect(page.locator('.result-badges')).toContainText('首次完赛奖牌');
  await page.getByText('查看分段成绩').click();
  await expect(page.locator('.split-details tbody tr')).toHaveCount(5);
  await expect(page.locator('.split-details tbody tr').last()).toContainText('21.0975 km');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('marathon:save:v1')!));
  expect(data.results).toHaveLength(1); expect(data.medals).toEqual(['yangzhou:half']);
  expect(data.best['yangzhou:half:runner'].shoe).toBe('cumulus');
  await page.getByRole('button', { name: '再跑一次' }).click();
  await page.clock.resume();
  await page.getByRole('button', { name: '返回准备', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '我的纪录' }).click();
  await expect(page.locator('.collection-item.earned')).toHaveCount(1);
  await expect(page.locator('.record-list')).toHaveCount(2);
  await expect(page.locator('.record-list').first()).toContainText('ASICS GEL-CUMULUS 25');
  expect(errors).toEqual([]);
});
