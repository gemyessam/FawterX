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

  // Predefined system cross-reference (Schüco 515750 <=> Canex 515756)
  unionCodes('515750', '515756');

  // Auto-persist default alias to project database if not present
  try {
    const hasAlias = aliasDocs.docs.some(doc => {
      const d = doc.data() || {};
      const a = clean(d.aliasCode || d.sourceCode);
      const t = clean(d.targetItemCode || d.targetCode);
      return (a === '515750' && t === '515756') || (a === '515756' && t === '515750');
    });
    if (!hasAlias && typeof project?.collection === 'function') {
      project.collection('itemAliases').doc('alias_515750_515756').set({
        aliasCode: '515750',
        cleanDocId: 'alias_515750_515756',
        targetItemCode: '515756',
        targetDescription: 'Schüco 515750 <=> Canex 515756',
        source: 'system_predefined',
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    }
  } catch (_) {}

  const canonical = value => {
    const c = clean(value);
    return c ? findRoot(c) : '';
  };

  const pool = [];
  for (const doc of docs.docs) {
    const data = doc.data();
    if (data.isCompleted || data.isCancelled || !['in_coating', 'ready_from_coating', 'partially_delivered'].includes(data.currentStage)) continue;
    (data.items || []).forEach((item, index) => {
      const avail = Math.max(0, Number(item.quantityBar || item.bars || 0) - Number(item.deliveredQuantityBar || 0) - Number(item.scrapQuantityBar || 0));
      if (avail > 0) {
        pool.push({ dispatchId: doc.id, itemIndex: index, item, available: avail });
      }
    });
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
      const totalItemBars = Number(item.quantityBar || item.bars || 0);
      const scrapBars = Number(item.scrapQuantityBar || 0);
      if (delivered < -0.00001 || (delivered + scrapBars) > totalItemBars + 0.00001) throw problem('Coating allocation exceeds linked quantity.');
      item.deliveredQuantityBar = Math.max(0, delivered);
    }

    const totalDelivered = items.reduce((sum, it) => sum + Number(it.deliveredQuantityBar || 0), 0);
    const totalScrap = items.reduce((sum, it) => sum + Number(it.scrapQuantityBar || 0), 0);
    const totalBars = items.reduce((sum, it) => sum + Number(it.quantityBar || it.bars || 0), 0);
    const totalRemaining = Math.max(0, totalBars - totalDelivered - totalScrap);

    const isCompleted = items.length > 0 && items.every(item => (Number(item.deliveredQuantityBar || 0) + Number(item.scrapQuantityBar || 0)) >= Number(item.quantityBar || item.bars || 0));

    let stage = data.currentStage;
    if (isCompleted) {
      stage = 'delivered_to_customer';
    } else if (totalDelivered > 0 || totalScrap > 0) {
      stage = 'partially_delivered';
    } else {
      stage = data.currentStage === 'ready_from_coating' ? 'ready_from_coating' : 'in_coating';
    }

    const historyLabel = reverse
      ? 'عكس تخصيص الفاتورة'
      : isCompleted
        ? `🏁 تم إتمام وتسليم كامل أعواد أمر الصرف للعميل النهائي (${totalDelivered} عود مسلّم${totalScrap > 0 ? ` + ${totalScrap} عود هادر دهان` : ''})`
        : `📦 تسليم جزئي مرتبط بالفاتورة ${invoiceNumber || '—'}: تم تسليم ${allocations.reduce((sum, a) => sum + a.bars, 0)} عود (المتبقي بالتشغيل: ${totalRemaining} عود)`;

    await ref.update({
      items,
      isCompleted,
      currentStage: stage,
      completedAt: isCompleted ? new Date().toISOString() : null,
      stageHistory: [
        ...(data.stageHistory || []),
        {
          stage,
          timestamp: new Date().toISOString(),
          label: historyLabel,
          invoiceNumber: invoiceNumber || '',
          deliveredBars: totalDelivered,
          remainingBars: totalRemaining,
          scrapBars: totalScrap,
        }
      ]
    });
    if (isCompleted) completed++;
  }
  return completed;
}
module.exports = { allocateCoating, applyAllocations };
