const { AsyncLocalStorage } = require('node:async_hooks');
const context = new AsyncLocalStorage();

const COLLECTIONS = ['stock', 'items', 'invoices', 'movements', 'dispatches', 'itemAliases', 'deletedStock', 'auditLogs'];
function problem(message, statusCode = 409) {
  return Object.assign(new Error(message), { statusCode });
}
function validId(id) {
  if (typeof id !== 'string' || !id.trim() || id.includes('/') || id === '.' || id === '..' || Buffer.byteLength(id) > 1500) {
    throw problem('Invalid warehouse document ID.', 400);
  }
  return id;
}
function activeRoot(db, id, metadata) {
  const ref = db.collection('warehouseProjects').doc(validId(id));
  return metadata.activeGeneration ? ref.collection('generations').doc(validId(metadata.activeGeneration)) : ref;
}

// Bind every project operation to one Firestore transaction. Existing services use
// batches and direct writes; defer those writes until ALL reads have completed.
// A failed/oversized operation therefore commits neither stock nor partial history.
function scopedDb(db, transaction, projectId, metadata, writes) {
  const unwrap = new WeakMap();
  const raw = value => unwrap.get(value) || value;
  const wrapSnapshot = snap => {
    if (snap.docs) {
      const docs = snap.docs.map(wrapSnapshot);
      return { empty: snap.empty, size: snap.size, docs, forEach: callback => docs.forEach(callback) };
    }
    return { id: snap.id, exists: snap.exists, updateTime: snap.updateTime, data: () => snap.data(), ref: wrap(snap.ref) };
  };
  const queue = (method, ref, args) => {
    writes.push({ method, ref: raw(ref), args });
    return Promise.resolve();
  };
  function wrap(ref) {
    const proxy = new Proxy(ref, { get(target, key) {
      if (key === 'get') return async () => {
        try { return wrapSnapshot(await transaction.get(target)); }
        catch (error) { writes.failure = error; throw error; }
      };
      if (['set', 'update', 'delete', 'create'].includes(key)) return (...args) => queue(key, target, args);
      if (key === 'add') return async data => { const doc = target.doc(); await queue('create', doc, [data]); return wrap(doc); };
      if (key === 'collection') return name => {
        if (target.path === `warehouseProjects/${projectId}` && COLLECTIONS.includes(name)) {
          return wrap(activeRoot(db, projectId, metadata).collection(name));
        }
        return wrap(target.collection(name));
      };
      if (['doc', 'where', 'orderBy', 'limit', 'startAfter', 'select'].includes(key)) return (...args) => {
        if (key === 'doc' && args.length) validId(args[0]);
        return wrap(target[key](...args));
      };
      const value = target[key];
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    unwrap.set(proxy, ref);
    return proxy;
  }
  return { collection: name => wrap(db.collection(name)), batch: () => {
    const pending = [];
    const batch = {};
    for (const method of ['set', 'update', 'delete', 'create']) batch[method] = (ref, ...args) => { pending.push({ method, ref: raw(ref), args }); return batch; };
    batch.commit = async () => { writes.push(...pending); pending.length = 0; };
    return batch;
  }};
}
function getScopedDb(db) { return context.getStore()?.db || db; }
function projectOperation(getDb, fn, { readOnly = false } = {}) {
  return async (projectId, ...args) => {
    validId(projectId);
    const db = getDb();
    if (!db) throw problem('Firestore is unavailable.', 503);
    return db.runTransaction(async transaction => {
      const ref = db.collection('warehouseProjects').doc(projectId);
      const snap = await transaction.get(ref);
      if (!snap.exists) throw problem('Warehouse project not found. Refresh the project list.', 404);
      const metadata = snap.data();
      if (metadata.status === 'archived') throw problem('This warehouse is archived. Restore it from project management first.');
      const writes = [];
      const scoped = scopedDb(db, transaction, projectId, metadata, writes);
      const result = await context.run({ db: scoped }, () => fn(projectId, ...args));
      if (writes.failure) throw writes.failure;
      if (readOnly && writes.length) throw problem('A read operation attempted to change warehouse data.', 500);
      if (writes.length > 450) throw problem('This operation is too large to save atomically. Split the invoice into smaller documents.', 413);
      for (const write of writes) transaction[write.method](write.ref, ...write.args);
      if (writes.length) transaction.update(ref, { warehouseRevision: Number(metadata.warehouseRevision || 0) + 1 });
      return result;
    });
  };
}

module.exports = { COLLECTIONS, problem, validId, activeRoot, getScopedDb, projectOperation };
