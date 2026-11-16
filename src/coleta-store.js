function createCollectionStore({ name = 'idealista-coleta-v1', indexedDB: factory = globalThis.indexedDB } = {}) {
  async function open() {
    if (!factory) throw new Error('IndexedDB indisponível');
    return new Promise((resolve, reject) => {
      const r = factory.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('records');
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('Banco de coleta bloqueado'));
      r.onsuccess = () => resolve(r.result);
    });
  }
  async function transaction(keys, mode, mutate) {
    if (!Array.isArray(keys) || !keys.length || keys.some(k => typeof k !== 'string')) throw new TypeError('Chaves inválidas');
    const unique = [...new Set(keys)]; const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('records', mode), store = tx.objectStore('records');
        const rows = {}; let pending = unique.length, result, failure;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure || tx.error || new Error('Persistência cancelada'));
        tx.onerror = () => { /* onabort mantém a atomicidade e o erro original. */ };
        function commit() {
          try {
            if (!mutate) { result = rows; return; }
            const change = mutate(rows);
            if (!change || typeof change.then === 'function') throw new TypeError('Mutator deve ser síncrono');
            for (const [key, value] of Object.entries(change.writes || {})) {
              if (!unique.includes(key)) throw new Error('Chave não declarada');
              if (value === null) store.delete(key); else store.put(value, key);
            }
            result = change.result;
          } catch (error) { failure = error; tx.abort(); }
        }
        for (const key of unique) {
          const r = store.get(key);
          r.onsuccess = () => { rows[key] = r.result ?? null; if (--pending === 0) commit(); };
        }
      });
    } finally { db.close(); }
  }
  return { read: keys => transaction(keys, 'readonly'), transact: (keys, mutate) => transaction(keys, 'readwrite', mutate) };
}
module.exports = { createCollectionStore };
