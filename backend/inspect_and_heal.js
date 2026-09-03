const admin = require('./src/services/firebaseAdmin');
const db = admin.firestore();
const { resolveCanonicalItemCost } = require('./src/services/warehouseStore');

async function main() {
  const projSnap = await db.collection('warehouseProjects').get();
  for (const pDoc of projSnap.docs) {
    const pRef = pDoc.ref;
    const invSnap = await pRef.collection('invoices').get();
    if (invSnap.empty) continue;

    console.log(`\n========================================`);
    console.log(`PROJECT: ${pDoc.id} (${pDoc.data().name})`);
    console.log(`========================================`);

    for (const iDoc of invSnap.docs) {
      const inv = iDoc.data();
      if (inv.movementType === 'outbound') {
        console.log(`\n--- OUTBOUND INVOICE: ${iDoc.id} ---`);
        console.log(`Number: ${inv.invoiceNumber} | File: ${inv.fileName}`);
        console.log(`Source Invoice ID: ${inv.sourceInvoiceId}, Number: ${inv.sourceInvoiceNumber}`);
        console.log(`Recorded Total Amount: ${inv.totalAmount} EGP | Bars: ${inv.totalQuantityBar} | LM: ${inv.totalQuantityLm}`);

        // Fetch movements
        const mSnap = await pRef.collection('movements').where('invoiceId', '==', iDoc.id).get();
        console.log(`Movements count: ${mSnap.size}`);
        let calculatedTrueTotal = 0;

        for (const mDoc of mSnap.docs) {
          const m = mDoc.data();
          const len = Number(m.lengthMm || 6000);
          const lenM = len / 1000;
          const qtyBar = Number(m.quantityBar || m.quantity || 0);
          const qtyLm = Number(m.quantityLm || (qtyBar * len) / 1000);

          // Canonical cost resolution
          const canonical = await resolveCanonicalItemCost(pRef, {
            itemKey: m.itemKey,
            itemCode: m.itemCode,
            customerCode: m.customerCode,
            lengthMm: len,
            sourceInvoiceId: inv.sourceInvoiceId || m.sourceInvoiceId || null,
          });

          const trueBarPrice = canonical.barPrice;
          const trueUnitPrice = canonical.unitPrice;
          const trueNetTotal = Number((qtyBar * trueBarPrice).toFixed(2));
          calculatedTrueTotal += trueNetTotal;

          console.log(`  > Item: ${m.itemCode} | Bars: ${qtyBar} | LM: ${qtyLm.toFixed(1)} | oldNet: ${m.netTotal} => trueBarPrice: ${trueBarPrice} | trueNet: ${trueNetTotal} (${canonical.source})`);
        }

        console.log(`>> SUMMARY FOR INVOICE ${inv.invoiceNumber}:`);
        console.log(`   Old Total: ${inv.totalAmount} EGP`);
        console.log(`   Calculated True Total: ${calculatedTrueTotal.toFixed(2)} EGP`);
      }
    }
  }
}

main().catch(console.error);
