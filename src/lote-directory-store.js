function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('idealista-municipios', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Banco de destinos bloqueado por outra página'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function transact(mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', mode);
      let result;
      transaction.oncomplete = () => resolve(result ?? null);
      transaction.onabort = () => reject(transaction.error || new Error('Transação do destino cancelada'));
      transaction.onerror = () => reject(transaction.error || new Error('Falha no banco de destinos'));
      const request = action(transaction.objectStore('settings'));
      request.onsuccess = () => { result = request.result; };
    });
  } finally { db.close(); }
}

function loadDirectory() { return transact('readonly', store => store.get('directory')); }
async function saveDirectory(handle) { await transact('readwrite', store => store.put(handle, 'directory')); }
module.exports = { loadDirectory, saveDirectory };
