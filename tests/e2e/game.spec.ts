import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function enterRace(page: Page) {
  await page.getByRole('button', { name: '静音', exact: true }).click();
  await page.locator('[data-action="start"]').click();
  await expect(page.getByRole('heading', { name: '准备好出发了吗？' })).toBeVisible();
  await page.getByRole('button', { name: '出发', exact: true }).click();
  await expect(page.locator('#race-overlay')).toBeHidden();
  await expect(page.locator('canvas')).toHaveCount(1);
}

test('default equipment, four events, Huangshan categories and saved preferences', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Marathon');
  await expect(page.locator('[data-character="runner"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shoe="cumulus"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-event="xiamen"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-event]')).toHaveCount(4);
  await expect(page.locator('[data-category]')).toHaveCount(0);
  await expect(page.locator('[data-shoe="cumulus"] strong')).toHaveText('ASICS GEL-CUMULUS 25');
  await expect(page.locator('[data-shoe="260x"] strong')).toHaveText('特步 260X');
  await expect(page.locator('[data-shoe="160x"] strong')).toHaveText('特步 160X 7.0');
  await page.locator('[data-event="huangshan"]').click();
  await expect(page.locator('[data-event="huangshan"]')).toHaveCount(1);
  await expect(page.locator('[data-category]')).toHaveCount(2);
  await page.locator('[data-category="full"]').click();
  await page.locator('[data-character="worker"]').click();
  await page.locator('[data-shoe="160x"]').click();
  await page.reload();
  await expect(page.locator('[data-category="full"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-character="worker"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shoe="160x"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-event="shanghai"]').click();
  await expect(page.locator('.selected-summary>strong')).toHaveText('上海马拉松');
  await expect(page.locator('[data-category]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('race renders, keyboard works, pause freezes time and repeated starts leave one canvas', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await enterRace(page);
  await page.keyboard.down('Space');
  await expect(page.locator('#effort-hint')).toContainText('冲刺');
  await page.keyboard.down('ArrowDown');
  await expect(page.locator('#effort-hint')).toContainText('恢复体力');
  await page.keyboard.up('ArrowDown'); await page.keyboard.up('Space');
  await page.getByRole('button', { name: '暂停比赛', exact: true }).click();
  const elapsed = await page.locator('#elapsed').innerText();
  await expect(page.getByRole('heading', { name: '比赛已暂停' })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('#elapsed')).toHaveText(elapsed);
  await page.getByRole('button', { name: '继续比赛' }).click();
  await expect(page.locator('#effort-hint')).toContainText('巡航');
  await expect(page.locator('#elapsed')).not.toHaveText(elapsed);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('heading', { name: '比赛已暂停' })).toBeVisible();
  await page.getByRole('button', { name: '继续比赛' }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => page.locator('canvas').evaluate(canvas => Math.abs(canvas.getBoundingClientRect().width - window.innerWidth) < 2)).toBe(true);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '暂停比赛', exact: true }).click();
    await page.getByRole('button', { name: '结束本场，返回准备' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.locator('[data-action="start"]').click();
    await page.getByRole('button', { name: '出发', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(1);
  }
  await page.reload();
  await expect(page.locator('[data-action="start"]')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile buttons accept multiple pointers, recovery wins, cancellation releases inputs', async ({ page, context, browserName, isMobile }) => {
  test.skip(!isMobile || browserName !== 'chromium', 'Native multitouch exercised through Chromium CDP; WebKit touch smoke is separate.');
  await page.goto('/'); await enterRace(page);
  const session = await context.newCDPSession(page);
  const center = async (selector: string) => { const box = await page.locator(selector).boundingBox(); return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }; };
  const sprint = await center('[data-control="sprint"]'); const recover = await center('[data-control="recover"]'); const left = await center('[data-control="left"]');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...sprint, id: 1 }] });
  await expect(page.locator('#effort-hint')).toContainText('冲刺');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...sprint, id: 1 }, { ...left, id: 2 }, { ...recover, id: 3 }] });
  await expect(page.locator('[data-control="left"]')).toHaveClass(/held/);
  await expect(page.locator('#effort-hint')).toContainText('恢复体力');
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('[data-control].held')).toHaveCount(0);
  await expect(page.locator('#effort-hint')).toContainText('巡航');
});

test('touch down and up control the runner on mobile engines', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.goto('/'); await enterRace(page);
  await page.locator('[data-control="left"]').tap();
  await page.locator('[data-control="sprint"]').tap();
  await expect(page.locator('[data-control].held')).toHaveCount(0);
  await page.getByRole('button', { name: '暂停比赛', exact: true }).tap();
  await expect(page.getByRole('heading', { name: '比赛已暂停' })).toBeVisible();
});

test('corrupt and blocked browser storage degrade gracefully', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('marathon:save:v1', '{broken'));
  await page.goto('/');
  await expect(page.locator('.storage-warning')).toContainText('存档无法读取');
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
  await page.reload();
  await expect(page.locator('.storage-warning')).toContainText('存储不可用');
  await page.locator('[data-character="worker"]').click();
  await expect(page.locator('[data-character="worker"]')).toHaveAttribute('aria-pressed', 'true');
  await enterRace(page);
  await expect(page.locator('canvas')).toBeVisible();
});

test('built site uses same-origin assets and exposes no missing requests', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => { if (!request.url().startsWith('data:')) failures.push(request.url()); });
  await page.goto('/'); await enterRace(page);
  expect(failures).toEqual([]);
  const scripts = await page.locator('script[src]').evaluateAll(elements => elements.map(e => e.getAttribute('src')));
  expect(scripts.every(src => src?.startsWith('/assets/'))).toBe(true);
  const notice = await page.request.get('/THIRD_PARTY_NOTICES.txt'); expect(notice.ok()).toBe(true);
});
