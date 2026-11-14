function getMunicipalityDestination({ startedAt, nome, totalPages }) {
  if (!(startedAt instanceof Date) || !Number.isFinite(startedAt.getTime())) throw new TypeError('Data inicial inválida');
  const year = startedAt.getFullYear();
  if (year < 0 || year > 9999) throw new RangeError('Ano fora do intervalo');
  if (!Number.isSafeInteger(totalPages) || totalPages < 1) throw new TypeError('Número de páginas inválido');
  if (typeof nome !== 'string') throw new TypeError('Nome inválido');
  const base = Array.from(nome.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim())
    .slice(0, 100).join('').replace(/[. ]+$/g, '') || 'municipio';
  const yearMonth = String(year).padStart(4, '0') + String(startedAt.getMonth() + 1).padStart(2, '0');
  const fileName = `${base}-Paginas${totalPages}.json`;
  return { yearMonth, fileName, relativePath: `${yearMonth}/${fileName}` };
}
async function writeMunicipality({ directory, records, startedAt, nome, totalPages, locks }) {
  const { yearMonth, fileName, relativePath } = getMunicipalityDestination({ startedAt, nome, totalPages });
  if (!Array.isArray(records) || Array.from(records).some(r => !r || typeof r !== 'object' || Array.isArray(r))) {
    throw new TypeError('Registros devem ser uma lista de objetos');
  }
  const serialized = JSON.stringify(records, null, 2);
  // toJSON também não pode converter registros em valores inválidos.
  const snapshot = JSON.parse(serialized);
  if (!Array.isArray(snapshot) || snapshot.some(r => !r || typeof r !== 'object' || Array.isArray(r))) throw new TypeError('JSON inválido');
  const total = snapshot.length;
  const result = status => ({ status, total, relativePath });
  if (!total) return result('empty');
  if (!locks?.request) throw new Error('Web Locks indisponível');
  return locks.request('idealista-municipios:write', { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) return result('busy');
    if (!directory || await directory.queryPermission({ mode: 'readwrite' }) !== 'granted') return result('permission-required');
    async function findOrCreate(parent, method, name) {
      try { return await parent[method](name, { create: false }); }
      catch (error) {
        if (error.name !== 'NotFoundError') throw error;
        return parent[method](name, { create: true });
      }
    }
    const month = await findOrCreate(directory, 'getDirectoryHandle', yearMonth);
    const file = await findOrCreate(month, 'getFileHandle', fileName);
    const writable = await file.createWritable({ keepExistingData: false });
    try { await writable.write(serialized); await writable.close(); }
    catch (error) { try { await writable.abort(); } catch { /* manter erro original */ } throw error; }
    return result('saved');
  });
}
module.exports = { getMunicipalityDestination, writeMunicipality };
