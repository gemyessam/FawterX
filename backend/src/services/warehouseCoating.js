const { problem } = require('./warehousePersistence');
const clean = value => String(value || '').trim().toUpperCase();
async function allocateCoating(project, lines) {
  if (!lines.some(line => line.delmarCovered && !line.ignored && !line.isService)) return lines;
  const docs = await project.collection('dispatches').get();
  const aliasDocs = await project.collection('itemAliases').get();
  
  // Bidirectional alias equivalence mapping
  const parent = new Map();
  const findRoot = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, findRoot(parent.get(x)));
    return parent.get(x);
  };
  const unionCodes = (x, y) => {
    const rx = findRoot(x);
    const ry = findRoot(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  for (const doc of aliasDocs.docs) {
    const d = doc.data() || {};
    const a = clean(d.aliasCode || d.sourceCode);
    const t = clean(d.targetItemCode || d.targetCode);
    if (a && t) unionCodes(a, t);
  }

  const canonical = value => {
    const c = clean(value);
    return c ? findRoot(c) : '';
  };

  const pool = [];
  for (const doc of docs.docs) {
    const data = doc.data();
    if (data.isCompleted || data.isCancelled || !['in_coating', 'ready_from_coating'].includes(data.currentStage)) continue;
    (data.items || []).forEach((item, index) => pool.push({ dispatchId: doc.id, itemIndex: index, item, available: Number(item.quantityBar || item.bars || 0) - Number(item.deliveredQuantityBar || 0) }));
  }
  return lines.map(line => {
    if (!line.delmarCovered || line.ignored || line.isService) return { ...line, dispatchAllocations: [] };
    const bars = Number(line.quantityBar || line.quantity || line.qtyBar || line.bars || 0);
    const wanted = Number(line.delmarBars ?? (line.delmarMode === 'full' ? bars : line.delmarShortage || 0));
    if (!Number.isFinite(wanted) || wanted < 0 || wanted > bars) throw problem('Invalid coating allocation.', 400);
    let remaining = wanted;
    const allocations = [];
    const lineCodes = [line.itemCode, line.customerCode, line.manualTargetCode].filter(Boolean).map(canonical);
    const targetLength = Number(line.lengthMm || line.length || 6000);

    for (const entry of pool) {
      const entryCodes = [entry.item.itemCode, entry.item.customerCode].filter(Boolean).map(canonical);
      const sameCode = lineCodes.some(code => entryCodes.includes(code));
      const entryLength = Number(entry.item.lengthMm || entry.item.length || 6000);
      const sameLength = targetLength === entryLength;
      if (!sameCode || !sameLength || entry.available <= 0 || remaining <= 0) continue;
      const quantity = Math.min(entry.available, remaining);
      allocations.push({ dispatchId: entry.dispatchId, itemIndex: entry.itemIndex, bars: quantity });
      entry.available -= quantity; remaining -= quantity;
    }
    if (remaining > 0.00001) {
      const codeLabel = line.itemCode || line.customerCode || '—';
      const allocatedSoFar = Math.max(0, wanted - remaining);
      throw problem(`الصنف [${codeLabel}] (طول ${targetLength} مم): الكمية المطلوبة من الدهان (${wanted} عود) غير متاحة في أوامر دهان دلمار المفتوحة (المتاح المتبقي لهذا الصنف: ${allocatedSoFar} عود). يرجى ربط كود الصنف (Alias) بكود أمر الدهان في كانكس، أو تعديل كمية الصرف من المستودع.`);
    }
    return { ...line, delmarBars: wanted, dispatchAllocations: allocations };
  });
}
async function applyAllocations(project, lines, invoiceNumber, reverse = false) {
  const grouped = new Map();
  for (const line of lines || []) for (const allocation of line.dispatchAllocations || []) {
    if (!grouped.has(allocation.dispatchId)) grouped.set(allocation.dispatchId, []);
    grouped.get(allocation.dispatchId).push(allocation);
  }
  let completed = 0;
  for (const [id, allocations] of grouped) {
    const ref = project.collection('dispatches').doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data().isCancelled) throw problem('Linked coating dispatch is unavailable.');
    const data = snap.data(), items = (data.items || []).map(item => ({ ...item }));
    for (const allocation of allocations) {
      const item = items[allocation.itemIndex];
      if (!item || !Number.isFinite(allocation.bars) || allocation.bars <= 0) throw problem('Invalid linked dispatch allocation.');
      const delivered = Number(item.deliveredQuantityBar || 0) + (reverse ? -1 : 1) * allocation.bars;
      if (delivered < -0.00001 || delivered > Number(item.quantityBar || item.bars || 0) + 0.00001) throw problem('Coating allocation exceeds linked quantity.');
      item.deliveredQuantityBar = Math.max(0, delivered);
    }
    const isCompleted = items.length > 0 && items.every(item => Number(item.deliveredQuantityBar || 0) >= Number(item.quantityBar || item.bars || 0));
    const stage = isCompleted ? 'delivered_to_customer' : (data.currentStage === 'ready_from_coating' ? 'ready_from_coating' : 'in_coating');
    await ref.update({ items, isCompleted, currentStage: stage, completedAt: isCompleted ? new Date().toISOString() : null,
      stageHistory: [...(data.stageHistory || []), { stage, timestamp: new Date().toISOString(), label: reverse ? 'عكس تخصيص الفاتورة' : 'تسليم كمية مرتبطة بالفاتورة', invoiceNumber }] });
    if (isCompleted) completed++;
  }
  return completed;
}
module.exports = { allocateCoating, applyAllocations };
