function retryAfterUntil(value, now, serverDate) {
  if (typeof value !== 'string' || !value.trim()) return now + 900000;
  const raw = value.trim(); let delay;
  if (/^\d+$/.test(raw)) delay = Number(raw) * 1000;
  else {
    const date = Date.parse(raw), server = Date.parse(serverDate);
    if (!Number.isFinite(date)) return now + 900000;
    delay = date - (Number.isFinite(server) ? Math.min(server, now) : now);
  }
  if (!Number.isSafeInteger(delay)) return now + 900000;
  return now + Math.max(60000, delay);
}
function classifyResponse(facts) {
  if (facts.functionalError) return 'unexpected-content';
  if (facts.proxyError || facts.status === 407) return 'proxy-error';
  if (facts.challenge || facts.status === 403 || facts.mitigated === 'challenge') return 'access-blocked';
  if (facts.status === 429) return 'rate-limit';
  if (facts.login || facts.status === 401) return 'authentication-required';
  if (facts.transportError || [408,500,502,503,504].includes(facts.status)) return 'transient';
  if (!Number.isInteger(facts.status) || facts.status < 200 || facts.status >= 400) return 'http-error';
  if (facts.destinationUrl) return 'destination';
  if (facts.listing) return 'success';
  if (facts.empty && !facts.nextUrl) return 'empty';
  return 'unexpected-content';
}
module.exports = { retryAfterUntil, classifyResponse };
