// Colaborador transacional novo: o fake de filesystem existente não representa
// transações de estado. Falhas são injetadas no commit, com rollback integral.
class MemoryCollectionStore {
  constructor() { this.rows = new Map(); this.queue = Promise.resolve(); this.failNextCommit = false; }
  async read(keys) {
    await this.queue;
    return Object.fromEntries(keys.map(key => [key, structuredClone(this.rows.get(key) ?? null)]));
  }
  transact(keys, mutate) {
    const pending = this.queue.then(() => {
      const rows = Object.fromEntries(keys.map(key => [key, structuredClone(this.rows.get(key) ?? null)]));
      const change = mutate(rows);
      if (change && typeof change.then === 'function') throw new Error('Mutator must be synchronous');
      const writes = Object.entries(change.writes || {});
      if (writes.some(([key]) => !keys.includes(key))) throw new Error('Undeclared transaction key');
      if (this.failNextCommit) { this.failNextCommit = false; throw new Error('fixture quota exceeded'); }
      for (const [key, value] of writes) {
        if (value === null) this.rows.delete(key); else this.rows.set(key, structuredClone(value));
      }
      return structuredClone(change.result);
    });
    this.queue = pending.catch(() => {});
    return pending;
  }
}
module.exports = { MemoryCollectionStore };
