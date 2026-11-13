// Escrita mensal independente da UI; prompts de permissão pertencem ao clique.
function getMonthlyDestination(startedAt) {
  if (!(startedAt instanceof Date) || !Number.isFinite(startedAt.getTime())) {
    throw new TypeError('A data inicial da extração deve ser válida');
  }
  const year = startedAt.getFullYear();
  if (year < 0 || year > 9999) throw new RangeError('O ano deve ter quatro dígitos');
  const yearMonth = String(year).padStart(4, '0') + String(startedAt.getMonth() + 1).padStart(2, '0');
  const fileName = `links_localidades_${yearMonth}.json`;
  return { yearMonth, fileName, relativePath: `${yearMonth}/${fileName}` };
}

async function exportLocalities({ directory, records, startedAt, confirmOverwrite, locks }) {
  const { yearMonth, fileName, relativePath } = getMonthlyDestination(startedAt);
  if (!Array.isArray(records) || Array.from(records).some(record => !record || typeof record !== 'object' || Array.isArray(record))) {
    throw new TypeError('Os registros devem ser uma lista de objetos');
  }
  // Capturar tudo antes do primeiro await: a coleta e o relógio podem mudar.
  const total = records.length;
  const serialized = JSON.stringify(records, null, 2);
  const result = status => ({ status, relativePath, total });
  if (!total) return result('empty');
  if (!locks || typeof locks.request !== 'function') {
    throw new Error('Web Locks indisponível; não é possível gravar com segurança');
  }

  return locks.request('idealista-localidades:write', { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) return result('busy');
    if (await directory.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      return result('permission-required');
    }

    let month;
    let file;
    try {
      month = await directory.getDirectoryHandle(yearMonth, { create: false });
    } catch (error) {
      if (error.name !== 'NotFoundError') throw error;
    }
    if (month) {
      try {
        file = await month.getFileHandle(fileName, { create: false });
      } catch (error) {
        if (error.name !== 'NotFoundError') throw error;
      }
    }
    if (file) {
      const confirmed = await confirmOverwrite({ directoryName: directory.name, relativePath, total });
      if (confirmed !== true) return result('cancelled');
    }
    if (!month) month = await directory.getDirectoryHandle(yearMonth, { create: true });
    if (!file) file = await month.getFileHandle(fileName, { create: true });

    // A API mantém as alterações staged até close; nunca truncar o original.
    const writable = await file.createWritable({ keepExistingData: false });
    try {
      await writable.write(serialized);
      await writable.close();
    } catch (error) {
      try { await writable.abort(); } catch { /* Preservar o erro da escrita. */ }
      throw error;
    }
    return result('saved');
  });
}

module.exports = { getMonthlyDestination, exportLocalities };
