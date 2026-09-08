export function getDelmarPool(activeDispatches = []) {
  const pool = [];
  if (Array.isArray(activeDispatches) && activeDispatches.length > 0) {
    for (let dIdx = 0; dIdx < activeDispatches.length; dIdx++) {
      const d = activeDispatches[dIdx];
      if (d.isCompleted || d.isCancelled || !['in_coating', 'ready_from_coating'].includes(d.currentStage)) continue;
      if (Array.isArray(d.items)) {
        for (let iIdx = 0; iIdx < d.items.length; iIdx++) {
          const it = d.items[iIdx];
          const rawTotal = Number(it.quantityBar || it.bars || 0);
          const delivered = Number(it.deliveredQuantityBar || 0);
          const q = Math.max(0, rawTotal - delivered);
          if (q > 0) {
            const len = Number(it.lengthMm || 6000);
            let bp = Number(it.barPrice || 0);
            let up = Number(it.unitPrice || 0);
            if (bp === 0 && up > 0 && len > 0) bp = Number(((up * len) / 1000).toFixed(4));
            if (up === 0 && bp > 0 && len > 0) up = Number(((bp * 1000) / len).toFixed(4));

            pool.push({
              key: `${d.id || dIdx}_${iIdx}`,
              dispatchId: d.id,
              dispatchNumber: d.dispatchNumber || '',
              deliveryNote: d.deliveryNote || '',
              customerName: d.customerName || '',
              itemCode: it.itemCode || '',
              customerCode: it.customerCode || '',
              color: it.color || it.finish || '',
              lengthMm: len,
              barPrice: bp,
              unitPrice: up,
              netTotal: Number((q * bp).toFixed(2)),
              totalBars: rawTotal,
              remainingBars: q,
              allocatedLines: [],
            });
          }
        }
      }
    }
  }
  return pool;
}

export function findDelmarPoolMatches(line, delmarPool = [], aliasesMap = {}) {
  const clean = (value) => String(value || '').trim().toUpperCase();
  const aliases = new Map(Object.values(aliasesMap || {}).map((a) => [clean(a.aliasCode), clean(a.targetItemCode)]));
  const canonical = (value) => aliases.get(clean(value)) || clean(value);
  const codes = [line.itemCode, line.customerCode].filter(Boolean).map(canonical);
  return delmarPool.filter(
    (item) =>
      Number(item.lengthMm || 6000) === Number(line.lengthMm || line.length || 6000) &&
      [item.itemCode, item.customerCode].filter(Boolean).some((code) => codes.includes(canonical(code)))
  );
}
