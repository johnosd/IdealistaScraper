const test = require('node:test'), assert = require('node:assert/strict');
const { DEFAULT_POLICY, validatePolicy } = require('../../src/coleta-policy');
test('limites não podem ser zero, infinitos ou strings e padrões não são mutáveis', () => {
  for (const value of [0, Infinity, NaN, '10', -1, 1.5]) assert.throws(() => validatePolicy({ ...DEFAULT_POLICY, minIntervalMs: value }));
  assert.equal(validatePolicy(DEFAULT_POLICY).minIntervalMs, 10000);
});
