const DEFAULT_POLICY = Object.freeze({ minIntervalMs: 10000, windowMs: 3600000, maxPagesPerWindow: 60,
  maxPagesPerRun: 200, maxPagesPerItem: 100, maxAttempts: 3, requestTimeoutMs: 30000,
  maxSessionMs: 21600000, backoffBaseMs: 30000, maxNoNewPages: 3 });
const RANGES = Object.freeze({ minIntervalMs: [1000,300000], windowMs: [60000,86400000], maxPagesPerWindow: [1,1000],
  maxPagesPerRun: [1,2000], maxPagesPerItem: [1,1000], maxAttempts: [1,5], requestTimeoutMs: [5000,120000],
  maxSessionMs: [60000,604800000], backoffBaseMs: [10000,300000], maxNoNewPages: [1,10] });
function validatePolicy(input) {
  const result = {};
  for (const [key, [min,max]] of Object.entries(RANGES)) {
    const value = input?.[key];
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(`Limite inválido: ${key}`);
    result[key] = value;
  }
  return result;
}
module.exports = { DEFAULT_POLICY, RANGES, validatePolicy };
