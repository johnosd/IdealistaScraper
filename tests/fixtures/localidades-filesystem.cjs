// Colaboradores de File System Access e Web Locks; sem IO ou mock do exportador.
class MemoryDirectory {
  constructor(name = 'localidades') {
    this.name = name;
    this.kind = 'directory';
    this.permission = 'granted';
    this.directories = new Map();
    this.files = new Map();
  }
  async queryPermission() { return this.permission; }
  async requestPermission() { throw new Error('Permission prompts belong to a user gesture in the UI'); }
  async getDirectoryHandle(name, options = {}) {
    if (!this.directories.has(name)) {
      if (!options.create) throw new DOMException('Directory not found', 'NotFoundError');
      this.directories.set(name, new MemoryDirectory(name));
    }
    return this.directories.get(name);
  }
  async getFileHandle(name, options = {}) {
    if (!this.files.has(name)) {
      if (!options.create) throw new DOMException('File not found', 'NotFoundError');
      this.files.set(name, new MemoryFile(name));
    }
    return this.files.get(name);
  }
  snapshot() {
    return {
      directories: [...this.directories].map(([name, dir]) => [name, dir.snapshot()]),
      files: [...this.files].map(([name, file]) => [name, file.contents]),
    };
  }
}

class MemoryFile {
  constructor(name, contents = '') {
    this.name = name;
    this.kind = 'file';
    this.contents = contents;
    this.failAt = null;
    this.aborts = 0;
  }
  async getFile() { return new Blob([this.contents], { type: 'application/json' }); }
  async createWritable(options = {}) {
    let staged = options.keepExistingData ? this.contents : '';
    return {
      write: async value => {
        if (this.failAt === 'write') throw new DOMException('Disk write failed', 'NotReadableError');
        const text = value instanceof Blob ? await value.text() : String(value);
        // Uma escrita na posicao zero conserva a cauda se keepExistingData=true.
        staged = text + staged.slice(text.length);
      },
      close: async () => {
        if (this.failAt === 'close') throw new DOMException('Commit failed', 'QuotaExceededError');
        this.contents = staged;
      },
      abort: async () => { this.aborts += 1; staged = ''; },
    };
  }
}

class MemoryLocks {
  constructor() { this.held = new Set(); }
  async request(name, options, callback) {
    if (!options.ifAvailable) throw new Error('Export must not queue a later write');
    if (this.held.has(name)) return callback(null);
    this.held.add(name);
    try { return await callback({ name, mode: 'exclusive' }); }
    finally { this.held.delete(name); }
  }
}

function existingMonthlyFile(directory, contents = 'previous monthly content') {
  const month = new MemoryDirectory('202611');
  const file = new MemoryFile('links_localidades_202611.json', contents);
  month.files.set(file.name, file);
  directory.directories.set(month.name, month);
  return file;
}

module.exports = { MemoryDirectory, MemoryLocks, existingMonthlyFile };
