const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
let browser, page;
before(async () => {
  browser = await chromium.launch({ headless: true }); page = await browser.newPage();
  await page.route('https://**/*', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.goto('https://www.idealista.pt/test-fixture');
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/content.js'), 'utf8');
  await page.addScriptTag({ content: source.slice(0, source.indexOf('const { installCollectionExecutor }')) });
});
after(async () => { await browser?.close(); });
function card(counter = '', oldParking = '', details = 'Garagem incluída') {
  return `<section class="items-container items-list"><article class="item" data-element-id="123"><div class="item-info-container"><a class="item-link" href="/imovel/123/">Apartamento São João</a><div class="price-row"><span class="item-price">900 €</span>${oldParking}</div><div class="item-detail-char"><span class="item-detail">T2</span><span class="item-detail">90 m² área bruta</span><span class="item-detail">${details}</span></div></div>${counter}</article></section>`;
}
async function extract(markup) { await page.setContent(markup); return page.evaluate(() => extrairDaRaiz(document).itens[0]); }
test('contador atual/legado usa total; ausente/malformado mantém null e demais campos iguais', async () => {
  const baseline = await extract(card()); assert.equal(Object.keys(baseline).length, 17);
  for (const [markup, expected] of [
    ['<div class="item-multimedia-pictures__counter"><span>1/</span><span>9</span></div>', 9],
    ['<div class="item-multimedia-pictures--old"><span>1/</span><span>12</span></div>', 12],
    ['<div class="item-multimedia-pictures__counter">2/15</div>', 15],
    ['<div class="item-multimedia-pictures__counter"><span>1/</span><span>?</span></div>', null], ['', null],
  ]) {
    const row = await extract(card(markup)); assert.equal(row.imagens, expected);
    const omit = ({ imagens, estacionamento, ...other }) => other;
    assert.deepEqual(omit(row), omit(baseline));
  }
});
test('garagem explícita atual/legada e ausência no campo estacionamento', async () => {
  assert.equal((await extract(card())).estacionamento, 'Garagem incluída');
  assert.equal((await extract(card('', '<span class="item-parking">Lugar de garagem incluído</span>', ''))).estacionamento, 'Lugar de garagem incluído');
  assert.equal((await extract(card('', '', '2º andar com elevador'))).estacionamento, null);
});
