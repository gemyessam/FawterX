const { gzipSync, gunzipSync } = require('node:zlib');
const { createHash, randomUUID } = require('node:crypto');
const { COLLECTIONS, validId, problem, projectOperation } = require('./warehousePersistence');
const CHUNK_BYTES = 400 * 1024;
const digest = data => createHash('sha256').update(data).digest('hex');

// Tagged values preserve Firestore types without reserving keys in customer data.
function encode(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) return ['number', String(value)];
  if (value === null || typeof value !== 'object') return ['scalar', value];
  if (Buffer.isBuffer(value)) return ['bytes', value.toString('base64')];
  if (value instanceof Date) return ['date', value.toISOString()];
  if (typeof value.toDate === 'function' && Number.isInteger(value.nanoseconds)) return ['timestamp', value.seconds, value.nanoseconds];
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number' && typeof value.isEqual === 'function') return ['geo', value.latitude, value.longitude];
  if (typeof value.path === 'string' && value.firestore) return ['ref', value.path];
  if (Array.isArray(value)) return ['array', value.map(encode)];
  return ['map', Object.entries(value).map(([key, val]) => [key, encode(val)])];
}
function decode(node, db, admin) {
  const [tag, value, second] = node;
  switch (tag) {
    case 'scalar': return value;
    case 'number': return Number(value);
    case 'bytes': return Buffer.from(value, 'base64');
    case 'date': return new Date(value);
    case 'timestamp': return new admin.firestore.Timestamp(value, second);
    case 'geo': return new admin.firestore.GeoPoint(value, second);
    case 'ref': return db.doc(value);
    case 'array': return value.map(item => decode(item, db, admin));
    case 'map': return Object.fromEntries(value.map(([key, val]) => [key, decode(val, db, admin)]));
    default: throw problem('Unsupported snapshot value.', 400);
  }
}

function snapshotService(getDb, rawDb, admin) {
  async function create(projectId, { name, description, isAuto } = {}, userUid, userEmail, userName) {
    const db = getDb();
    const project = db.collection('warehouseProjects').doc(projectId);
    const metadata = (await project.get()).data();
    const collections = {};
    for (const name of COLLECTIONS) {
      const snap = await project.collection(name).get();
      collections[name] = snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    }
    const payload = { schemaVersion: 2, projectId, metadata, collections };
    const encoded = Buffer.from(JSON.stringify(encode(payload)));
    if (encoded.length > 256 * 1024 * 1024) throw problem('Warehouse snapshot exceeds the supported 256 MiB expanded size.', 413);
    const compressed = gzipSync(encoded);
    const chunks = Math.ceil(compressed.length / CHUNK_BYTES);
    const point = project.collection('restorePoints').doc();
    const stock = collections.stock.map(entry => entry.data);
    const summary = {
      schemaVersion: 2, status: 'complete', projectId, name: String(name || 'نقطة حفظ').trim(),
      description: String(description || '').trim(), isAuto: Boolean(isAuto),
      createdAt: new Date().toISOString(), createdBy: userUid || '', createdByEmail: userEmail || '', createdByName: userName || '',
      totalItems: stock.length, totalQuantityBar: stock.reduce((s, i) => s + Number(i.quantityBar || 0), 0),
      totalQuantityLm: stock.reduce((s, i) => s + Number(i.quantityLm || 0), 0),
      totalQuantityKg: stock.reduce((s, i) => s + Number(i.quantityKg || 0), 0),
      collectionCounts: Object.fromEntries(COLLECTIONS.map(key => [key, collections[key].length])),
      chunks, checksum: digest(compressed), compressedBytes: compressed.length,
    };
    // These writes are staged by projectOperation; incomplete points never become visible.
    for (let i = 0; i < chunks; i++) await point.collection('chunks').doc(String(i)).set({ bytes: compressed.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES) });
    await point.set(summary);
    await project.collection('auditLogs').doc().set({ action: 'CREATE_RESTORE_POINT', projectId,
      userUid: userUid || '', createdAt: summary.createdAt, details: { pointId: point.id, name: summary.name } });
    return { ...summary, id: point.id };
  }
  async function list(projectId) {
    const snap = await getDb().collection('warehouseProjects').doc(projectId).collection('restorePoints').orderBy('createdAt', 'desc').get();
    return snap.docs.map(doc => {
      const { stockSnapshot, movementsSnapshot, invoicesSnapshot, dispatchesSnapshot, ...summary } = doc.data();
      return { ...summary, id: doc.id, restorable: summary.schemaVersion === 2 && summary.status === 'complete' };
    });
  }
  async function remove(projectId, pointId) {
    validId(pointId);
    const ref = getDb().collection('warehouseProjects').doc(projectId).collection('restorePoints').doc(pointId);
    const chunks = await ref.collection('chunks').get();
    for (const doc of chunks.docs) await doc.ref.delete();
    await ref.delete();
    return { success: true, pointId };
  }
  async function restore(projectId, pointId, userUid) {
    validId(projectId); validId(pointId);
    const db = rawDb();
    const project = db.collection('warehouseProjects').doc(projectId);
    let before = await project.get();
    if (!before.exists || before.data().status === 'archived') throw problem('Active warehouse project not found.', 404);
    const pointRef = project.collection('restorePoints').doc(pointId);
    const point = await pointRef.get();
    const manifest = point.exists ? point.data() : {};
    if (manifest.schemaVersion !== 2 || manifest.status !== 'complete' || manifest.projectId !== projectId) {
      throw problem('نقطة الحفظ القديمة أو غير المكتملة لا تضمن استعادة جميع البيانات؛ لم يتم تغيير المخزن.', 400);
    }
    const chunks = await pointRef.collection('chunks').get();
    const byId = new Map(chunks.docs.map(doc => [doc.id, doc.data().bytes]));
    if (!Number.isInteger(manifest.chunks) || manifest.chunks < 1 || chunks.size !== manifest.chunks) throw problem('Incomplete restore point.', 400);
    const parts = [];
    for (let i = 0; i < manifest.chunks; i++) {
      if (!Buffer.isBuffer(byId.get(String(i)))) throw problem('Invalid snapshot chunk.', 400);
      parts.push(byId.get(String(i)));
    }
    const compressed = Buffer.concat(parts);
    if (compressed.length !== manifest.compressedBytes || digest(compressed) !== manifest.checksum) throw problem('Restore point checksum mismatch.', 400);
    const payload = decode(JSON.parse(gunzipSync(compressed, { maxOutputLength: 256 * 1024 * 1024 }).toString()), db, admin);
    if (payload.schemaVersion !== 2 || payload.projectId !== projectId) throw problem('Restore point belongs to another project.', 400);
    for (const name of COLLECTIONS) {
      const entries = payload.collections?.[name];
      if (!Array.isArray(entries) || entries.length !== manifest.collectionCounts?.[name]) throw problem('Incomplete snapshot collection: ' + name, 400);
      const seen = new Set();
      for (const entry of entries) {
        validId(entry.id);
        if (!entry.data || typeof entry.data !== 'object' || seen.has(entry.id)) throw problem('Invalid snapshot document.', 400);
        seen.add(entry.id);
      }
    }
    // Keep a user-visible way back, in addition to retaining the old generation.
    await projectOperation(rawDb, create)(projectId, { name: '[تلقائي] قبل استعادة نقطة حفظ', isAuto: true }, userUid);
    before = await project.get();
    if (!before.exists || before.data().status === 'archived') throw problem('Warehouse was archived during restore.');
    const generation = randomUUID();
    const root = project.collection('generations').doc(generation);
    let batch = db.batch(), count = 0;
    for (const name of COLLECTIONS) for (const entry of payload.collections[name]) {
      batch.set(root.collection(name).doc(entry.id), entry.data);
      if (++count === 400) { await batch.commit(); batch = db.batch(); count = 0; }
    }
    if (count) await batch.commit();
    // Old data is retained. A concurrent invoice/archive/restore changes the parent
    // revision and rejects this switch; staging failures never touch active stock.
    await db.runTransaction(async tx => {
      const current = await tx.get(project);
      if (!current.exists || !current.updateTime.isEqual(before.updateTime)) throw problem('المخزن تغير أثناء تجهيز الاستعادة. أعد المحاولة؛ لم يتم استبدال البيانات الحالية.');
      const data = current.data();
      const { activeGeneration, warehouseRevision, status, archivedAt, archivedBy, ...restoredMetadata } = payload.metadata;
      tx.set(root, { sourcePointId: pointId, readyAt: new Date().toISOString() });
      tx.set(root.collection('auditLogs').doc(), { action: 'RESTORE_PROJECT_POINT', projectId, userUid: userUid || '', createdAt: new Date().toISOString(), details: { pointId, previousGeneration: data.activeGeneration || null } });
      tx.set(project, { ...restoredMetadata, status: 'active', activeGeneration: generation, warehouseRevision: Number(data.warehouseRevision || 0) + 1, updatedAt: new Date().toISOString() });
    });
    return { success: true, pointId, pointName: manifest.name, restoredItemsCount: manifest.totalItems };
  }
  return { create, list, remove, restore };
}
module.exports = { snapshotService, encode, decode };
