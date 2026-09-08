const { problem, validId } = require('./warehousePersistence');
const numericFields = ['quantityBar', 'quantity', 'qtyBar', 'bars', 'quantityLm', 'qtyLm', 'quantityKg', 'weightKg', 'unitPrice', 'barPrice', 'netTotal', 'delmarBars', 'delmarShortage', 'lengthMm', 'length'];
function validateLines(type, lines) {
  if (!['inbound', 'outbound'].includes(type)) throw problem('Invalid warehouse movement type.', 400);
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) throw problem('Use between 1 and 100 lines per warehouse document.', 400);
  let active = 0;
  for (const line of lines) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) throw problem('Invalid invoice line.', 400);
    if (line.ignored || line.isService) continue;
    active++;
    if (line.itemKey) validId(line.itemKey);
    if (!String(line.itemCode || line.internalCode || '').trim()) throw problem('Item code is required.', 400);
    for (const key of numericFields) if (line[key] !== undefined && line[key] !== null && line[key] !== '') {
      const value = Number(line[key]);
      if (!Number.isFinite(value) || value < 0 || value > 1e12) throw problem('Invalid non-negative number: ' + key, 400);
      if ((key === 'lengthMm' || key === 'length') && value === 0) throw problem('Item length must be positive.', 400);
    }
    const bars = Number(line.quantityBar ?? line.quantity ?? line.qtyBar ?? line.bars ?? 0);
    const lm = Number(line.quantityLm ?? line.qtyLm ?? 0);
    const kg = Number(line.quantityKg ?? line.weightKg ?? 0);
    if (bars === 0 && lm === 0 && kg === 0) throw problem('A positive quantity is required.', 400);
  }
  if (!active) throw problem('At least one stock line is required.', 400);
}
async function reserveStock(project, key, quantities, consumed) {
  let state = consumed.get(key);
  if (!state) {
    const doc = await project.collection('stock').doc(validId(key)).get();
    const deleted = await project.collection('deletedStock').doc(key).get();
    state = deleted.exists ? {} : (doc.exists ? doc.data() : {});
    consumed.set(key, state = { ...state });
  }
  for (const [field, quantity] of Object.entries(quantities)) {
    const available = Number(state[field] || 0);
    if (!Number.isFinite(quantity) || quantity < 0 || available + 0.011 < quantity) throw problem('رصيد غير كافٍ للصنف ' + key + ' (' + field + '). لم يتم حفظ الحركة.');
    state[field] = available - quantity;
  }
}
module.exports = { validateLines, reserveStock };
