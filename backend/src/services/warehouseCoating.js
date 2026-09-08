const { problem } = require('./warehousePersistence');
const clean = value => String(value || '').trim().toUpperCase();
async function allocateCoating(project, lines) {
  if (!lines.some(line => line.delmarCovered && !line.ignored && !line.isService)) return lines;
  const docs = await project.collection('dispatches').get();
  const aliasDocs = await project.collection('itemAliases').get();
  const aliases = new Map(aliasDocs.docs.map(doc => [clean(doc.data().aliasCode), clean(doc.data().targetItemCode)]));
  const canonical = value => aliases.get(clean(value)) || clean(value);
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
    for (const entry of pool) {
      const sameCode = [line.itemCode, line.customerCode].filter(Boolean).some(code => [entry.item.itemCode, entry.item.customerCode].filter(Boolean).some(other => canonical(code) === canonical(other)));
      const sameLength = Number(line.lengthMm || line.length || 6000) === Number(entry.item.lengthMm || entry.item.length || 6000);
      if (!sameCode || !sameLength || entry.available <= 0 || remaining <= 0) continue;
      const quantity = Math.min(entry.available, remaining);
      allocations.push({ dispatchId: entry.dispatchId, itemIndex: entry.itemIndex, bars: quantity });
      entry.available -= quantity; remaining -= quantity;
    }
    if (remaining > 0.00001) throw problem('الكمية المطلوبة من الدهان غير متاحة لهذا الصنف والطول. راجع أوامر الصرف وربط الأكواد.');
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
