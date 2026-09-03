const admin = require('./src/services/firebaseAdmin');
const db = admin.firestore();

async function main() {
  const projSnap = await db.collection('warehouseProjects').get();
  for (const pDoc of projSnap.docs) {
    const pRef = pDoc.ref;
    const invSnap = await pRef.collection('invoices')
      .where('movementType', '==', 'outbound')
      .get();
    if (invSnap.empty) continue;

    console.log(`\n======================================================`);
    console.log(`PROJECT: ${pDoc.id} (${pDoc.data().name})`);
    console.log(`======================================================`);

    const outboundLines = [];
    for (const iDoc of invSnap.docs) {
      const inv = iDoc.data();
      const mSnap = await pRef.collection('movements').where('invoiceId', '==', iDoc.id).get();
      console.log(`\nInvoice ${inv.invoiceNumber} (ID: ${iDoc.id}): Total=${inv.totalAmount}, Bars=${inv.totalQuantityBar}, LM=${inv.totalQuantityLm}`);
      for (const mDoc of mSnap.docs) {
        const m = mDoc.data();
        outboundLines.push({
          invoiceNumber: inv.invoiceNumber,
          itemCode: m.itemCode,
          customerCode: m.customerCode || '',
          quantityBar: m.quantityBar,
          lengthMm: m.lengthMm,
          quantityLm: m.quantityLm,
          unitPrice: m.unitPrice,
          barPrice: m.barPrice,
          netTotal: m.netTotal,
        });
        console.log(`  - Item: ${m.itemCode} | len: ${m.lengthMm} | bars: ${m.quantityBar} | LM: ${m.quantityLm} | uPrice: ${m.unitPrice} | bPrice: ${m.barPrice} | net: ${m.netTotal}`);
      }
    }

    console.log(`\n------------------------------------------------------`);
    console.log(`AGGREGATED OUTBOUND ITEMS (DELMAR DISPATCHED):`);
    console.log(`------------------------------------------------------`);
    const aggMap = new Map();
    for (const l of outboundLines) {
      const key = `${l.itemCode}_${l.lengthMm}`;
      if (!aggMap.has(key)) {
        aggMap.set(key, { itemCode: l.itemCode, lengthMm: l.lengthMm, quantityBar: 0, quantityLm: 0, netTotal: 0, uPrice: l.unitPrice, bPrice: l.barPrice });
      }
      const item = aggMap.get(key);
      item.quantityBar += Number(l.quantityBar || 0);
      item.quantityLm += Number(l.quantityLm || 0);
      item.netTotal += Number(l.netTotal || 0);
    }

    let totalDispatchedBars = 0;
    let totalDispatchedLm = 0;
    let totalDispatchedCost = 0;
    for (const [k, v] of aggMap.entries()) {
      totalDispatchedBars += v.quantityBar;
      totalDispatchedLm += v.quantityLm;
      totalDispatchedCost += v.netTotal;
      console.log(`  * ${v.itemCode} (len: ${v.lengthMm}mm): bars=${v.quantityBar}, LM=${v.quantityLm.toFixed(1)}, bPrice=${v.bPrice}, uPrice=${v.uPrice}, net=${v.netTotal.toFixed(2)}`);
    }
    console.log(`TOTAL DISPATCHED: Bars=${totalDispatchedBars}, LM=${totalDispatchedLm.toFixed(1)}, Cost=${totalDispatchedCost.toFixed(2)} EGP`);
  }
}

main().catch(console.error);
