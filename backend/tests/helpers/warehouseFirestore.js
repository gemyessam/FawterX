// Isolated Firestore contract fake. No Firebase SDK, network, or credentials.
function createFirestore(seed = {}) {
  const rows = new Map(Object.entries(seed));
  const versions = new Map([...rows.keys()].map(key => [key, 1]));
  let serial = Promise.resolve(), id = 0;
  const clone = value => value === undefined ? undefined : require('node:v8').deserialize(require('node:v8').serialize(value));
  const version = path => ({ value: versions.get(path) || 0, isEqual(other) { return this.value === other.value; } });
  const dataSnapshot = ref => ({ id: ref.id, ref, exists: rows.has(ref.path), updateTime: version(ref.path), data: () => clone(rows.get(ref.path)) });
  function query(path, filters = [], max = Infinity, order) {
    const ref = { path, id: path.split('/').pop(),
      doc: name => document(path + '/' + (name || `generated-${++id}`)),
      where: (key, op, value) => query(path, [...filters, [key, op, value]], max, order),
      orderBy: (key, direction) => query(path, filters, max, [key, direction]),
      limit: count => query(path, filters, count, order),
      async get() {
        if (db.failRead === path) throw new Error('injected read failure');
        let docs = [...rows.keys()].filter(key => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1).map(key => dataSnapshot(document(key)));
        docs = docs.filter(doc => filters.every(([key, op, val]) => op === '==' ? doc.data()[key] === val : op === 'in' ? val.includes(doc.data()[key]) : false));
        if (order) docs.sort((a, b) => String(a.data()[order[0]]).localeCompare(String(b.data()[order[0]])) * (order[1] === 'desc' ? -1 : 1));
        docs = docs.slice(0, max);
        return { docs, size: docs.length, empty: !docs.length };
      },
      async add(data) { const doc = ref.doc(); await doc.set(data); return doc; },
    }; return ref;
  }
  function apply(method, ref, data, options) {
    if (method === 'delete') rows.delete(ref.path);
    else {
      if (method === 'update' && !rows.has(ref.path)) throw new Error('missing update target');
      if (method === 'create' && rows.has(ref.path)) throw new Error('duplicate create');
      const old = rows.get(ref.path) || {};
      const next = method === 'update' || options?.merge ? { ...old } : {};
      for (const [key, val] of Object.entries(data)) {
        if (val?.__operation === 'increment') next[key] = Number(old[key] || 0) + val.value;
        else if (val?.__operation === 'arrayUnion') next[key] = [...new Set([...(old[key] || []), ...val.value])];
        else if (val?.__operation === 'arrayRemove') next[key] = (old[key] || []).filter(v => !val.value.includes(v));
        else next[key] = clone(val);
      }
      rows.set(ref.path, next);
    }
    versions.set(ref.path, (versions.get(ref.path) || 0) + 1);
  }
  function document(path) {
    const ref = { path, id: path.split('/').pop(), collection: name => query(path + '/' + name), get: async () => dataSnapshot(ref) };
    for (const method of ['set', 'update', 'create', 'delete']) ref[method] = async (...args) => apply(method, ref, ...args);
    return ref;
  }
  function batch() {
    const pending = [], writer = {};
    for (const method of ['set', 'update', 'create', 'delete']) writer[method] = (ref, ...args) => { pending.push([method, ref, ...args]); return writer; };
    writer.commit = async () => {
      if (db.failCommit) throw new Error('injected commit failure');
      const saved = new Map(rows), oldVersions = new Map(versions);
      try { for (const args of pending) apply(...args); }
      catch (error) { rows.clear(); saved.forEach((v, k) => rows.set(k, v)); versions.clear(); oldVersions.forEach((v, k) => versions.set(k, v)); throw error; }
    };
    return writer;
  }
  const db = { rows, collection: query, doc: document, batch,
    runTransaction(fn) {
      const operation = serial.then(async () => {
        const writer = batch(); let writing = false;
        const tx = { get: async ref => { if (writing) throw new Error('read after write'); return ref.get(); } };
        for (const method of ['set', 'update', 'create', 'delete']) tx[method] = (...args) => { writing = true; writer[method](...args); };
        const result = await fn(tx); await writer.commit(); return result;
      });
      serial = operation.catch(() => {}); return operation;
    },
  }; return db;
}
module.exports = { createFirestore };
