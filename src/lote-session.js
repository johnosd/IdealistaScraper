function createBatchSession({ items, startedAt, collect, save, commit }) {
  if (!Array.isArray(items) || !(startedAt instanceof Date) || !Number.isFinite(startedAt.getTime())) throw new TypeError('Sessão inválida');
  const copy = value => structuredClone(value);
  let remaining = copy(items), pending = null, receipt = null, busy = false;
  const initialDate = new Date(startedAt);
  return {
    getState() { return copy({ remaining, pending, startedAt: initialDate }); },
    async advance() {
      if (busy) return { status: 'busy' };
      if (!remaining.length) return { status: 'done' };
      busy = true;
      try {
        if (!pending) {
          const result = await collect(copy(remaining[0]));
          if (!Array.isArray(result?.records) || result.records.some(r => !r || typeof r !== 'object' || Array.isArray(r)) || !Number.isSafeInteger(result.totalPages) || result.totalPages < 1) throw new TypeError('Resultado inválido da coleta');
          const records = JSON.parse(JSON.stringify(result.records));
          if (records.some(r => !r || typeof r !== 'object' || Array.isArray(r))) throw new TypeError('Resultado inválido da coleta');
          pending = { item: copy(remaining[0]), records, totalPages: result.totalPages, startedAt: new Date(initialDate) };
        }
        if (!receipt) {
          const result = await save(copy(pending));
          if (result?.status !== 'saved') return result;
          receipt = copy(result);
        }
        await commit({ completed: copy(remaining[0]), remaining: copy(remaining.slice(1)) });
        remaining = remaining.slice(1); pending = null;
        const result = receipt; receipt = null;
        return result;
      } finally { busy = false; }
    },
  };
}
module.exports = { createBatchSession };
