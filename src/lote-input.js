function validateBatchURL(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Informe um destino HTTPS do Idealista');
  let url;
  try { url = new URL(value.trim(), 'https://www.idealista.pt'); }
  catch { throw new TypeError('URL de destino inválida'); }
  if (url.protocol !== 'https:' || !(url.hostname === 'idealista.pt' || url.hostname.endsWith('.idealista.pt')) || url.username || url.password || url.port) {
    throw new TypeError('O destino deve ser HTTPS do Idealista, sem credenciais ou porta alternativa');
  }
  // Endereços relativos legados são caminhos, não texto arbitrário de uma linha.
  if (!value.trim().startsWith('/') && !/^https:\/\//i.test(value.trim())) {
    throw new TypeError('Informe uma URL HTTPS ou caminho iniciado por /');
  }
  return url.href;
}

function normalizeBatchItem(item) {
  if (typeof item === 'string') { const url = validateBatchURL(item); return { url, nome: url }; }
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('Registro de localidade inválido');
  const url = validateBatchURL(item.link || item.url || item.URL);
  const nome = [item.nome, item.Texto, item.texto, item['Município'], item['Sub-região'], item['Região']]
    .find(value => typeof value === 'string' && value.trim());
  return { url, nome: nome?.trim() || url };
}

function parseBatchInput(text) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Cole uma lista de localidades ou URLs');
  let items;
  try { items = JSON.parse(text); }
  catch { items = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean); }
  if (!Array.isArray(items) || !items.length) throw new TypeError('A lista deve ser um array JSON não vazio ou URLs por linha');
  return Array.from(items, (item, index) => {
    try { return normalizeBatchItem(item); }
    catch (error) { throw new TypeError(`Item ${index + 1}: ${error.message}`); }
  });
}

module.exports = { validateBatchURL, normalizeBatchItem, parseBatchInput };
