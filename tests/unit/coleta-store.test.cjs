const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
let browser, page;
before(async () => {
  browser = await chromium.launch({ headless: true }); page = await browser.newPage();
  await page.route('https://**/*', route => route.fulfill({ body: '<html></html>' }));
  await page.goto('https://store.invalid/');
  await page.evaluate(source => { const module = { exports: {} }; new Function('module', source)(module); window.createStore = module.exports.createCollectionStore; }, fs.readFileSync(require.resolve('../../src/coleta-store'), 'utf8'));
});
after(async () => { await browser?.close(); });
test('IndexedDB commit dura em nova instância e mutator rejeitado não grava parcialmente', async () => {
  const result = await page.evaluate(async () => {
    const s = createStore({ name: 'unit-commit' });
    await s.transact(['a'], () => ({ writes: { a: { count: 1 } }, result: 'done' }));
    let rejected = false;
    try { await s.transact(['a'], async () => ({ writes: { a: 2 } })); } catch { rejected = true; }
    return { rejected, rows: await createStore({ name: 'unit-commit' }).read(['a','missing']) };
  });
  assert.equal(result.rejected, true); assert.deepEqual(result.rows, { a: { count: 1 }, missing: null });
});
test('transações concorrentes não perdem incremento e chaves não declaradas abortam', async () => {
  const result = await page.evaluate(async () => {
    const s = createStore({ name: 'unit-race' });
    await Promise.all(Array.from({ length: 8 }, () => s.transact(['a'], rows => ({ writes: { a: (rows.a || 0)+1 } }))));
    try { await s.transact(['a'], () => ({ writes: { a: -1, other: 1 } })); } catch {}
    return s.read(['a','other']);
  });
  assert.deepEqual(result, { a: 8, other: null });
});
