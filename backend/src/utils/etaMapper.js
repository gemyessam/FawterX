const UNIT_MAP = {
  "m": "M",
  "mtr": "M",
  "lm": "M",
  "meter": "M",
  "متر": "M",
  "متر طولي": "M",
  "متر طول": "M",
  "kg": "KGM",
  "kgm": "KGM",
  "كيلو": "KGM",
  "ea": "EA",
  "ton": "TNE",
  "bar": "BAR"
};

/**
 * يحول بيانات الـ Excel المعيّنة إلى ETA Document JSON Format
 * ويدعم تعدد الفواتير (Grouping by Invoice Number)
 *
 * @param {object} mapping - { etaField: excelColumnName }
 * @param {object[]} rows  - Array of row objects من Excel
 * @param {object} issuer  - بيانات المُصدر الثابتة
 * @param {object} metadata - بيانات إضافية من ملف Excel
 * @returns {object[]} - Array of ETA Document objects
 */
function mapToETADocument(mapping, rows, issuer, metadata = {}) {
  console.log("=== ETA MAPPER INPUT ===", {
    rows,
    mapping,
    metadata
  });

  // 1. Group rows by Invoice Number / internalID
  const invoiceGroups = {};
  
  // نستخدم الـ internalID المستخرج من الميتاداتا كافتراضي إذا لم يتم ربط رقم الفاتورة أو كان مفقوداً
  const defaultInvoiceNo = metadata.internalID || `INV-${Date.now()}`;

  rows.forEach((row, idx) => {
    let invNo = row[mapping.invoiceNumber];
    if (!invNo || String(invNo).trim() === "") {
      invNo = defaultInvoiceNo;
    }
    invNo = String(invNo).trim();

    if (!invoiceGroups[invNo]) {
      invoiceGroups[invNo] = [];
    }
    invoiceGroups[invNo].push({ row, idx });
  });

  // 2. Generate an ETA Document for each group
  const documents = [];
  const issuerId = metadata.issuerVat || metadata.supplierVat || issuer.registrationNumber || "";
  const issuerName = metadata.issuer || metadata.supplierName || issuer.name || "";
  
  const documentType = metadata.documentType || "I";
  const documentTypeVersion = metadata.documentTypeVersion || "1.0";
  const dateTimeIssued = metadata.dateTimeIssued || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const taxpayerActivityCode = metadata.taxpayerActivityCode || issuer.activityCode || "1234";

  for (const [invoiceNumber, groupRows] of Object.entries(invoiceGroups)) {
    const invoiceLines = groupRows.map(({ row, idx }) => {
      const parsedVal = parseFloat(row[mapping.unitValue]);
      const unitValue = parseFloat((isNaN(parsedVal) ? 0 : parsedVal).toFixed(4));

      const parsedQty = parseFloat(row[mapping.quantity]);
      const quantity  = parseFloat((isNaN(parsedQty) ? 1 : parsedQty).toFixed(4));

      const parsedTax = parseFloat(row[mapping.taxPercent]);
      const taxPercent = parseFloat((isNaN(parsedTax) ? 14 : parsedTax).toFixed(4));

      const salesTotal = parseFloat((unitValue * quantity).toFixed(4));
      const taxAmount  = parseFloat(((salesTotal * taxPercent) / 100).toFixed(4));
      const netTotal   = parseFloat(salesTotal.toFixed(4));
      const total      = parseFloat((netTotal + taxAmount).toFixed(4));

      const desc = String(row[mapping.description] || `Item ${idx + 1}`);

      // Unit Type Mapping
      const rawUnit = String(row[mapping.unitType] || "EA").toLowerCase().trim();
      let unitType = "EA";
      
      if (rawUnit.includes("متر") || rawUnit === "m" || rawUnit === "lm" || rawUnit === "meter" || rawUnit === "mtr") {
        unitType = "M";
      } else if (rawUnit.includes("كيلو") || rawUnit.includes("كجم") || rawUnit === "kg" || rawUnit === "kgm" || rawUnit === "kgms") {
        unitType = "KGM";
      } else if (rawUnit.includes("طن") || rawUnit === "ton" || rawUnit === "tne") {
        unitType = "TNE";
      } else if (rawUnit.includes("بار") || rawUnit === "bar") {
        unitType = "BAR";
      } else if (rawUnit.includes("قطعة") || rawUnit.includes("حبة") || rawUnit.includes("عدد") || rawUnit === "ea") {
        unitType = "EA";
      } else {
        unitType = UNIT_MAP[rawUnit] || rawUnit.toUpperCase();
      }

      // Code Type
      const codeTypeMapped = String(row[mapping.codeType] || "EGS").toUpperCase().trim();
      const itemType = codeTypeMapped === "EGS" || codeTypeMapped === "GS1" ? codeTypeMapped : "EGS";

      let itemCode = String(row[mapping.itemCode] || "").trim();
      if (itemType === "EGS" && itemCode && !itemCode.toUpperCase().startsWith("EG-")) {
        itemCode = `EG-${itemCode}`;
      }

      const codeName = desc.split(" | ")[0] || desc;

      console.log("ETA ITEM MAPPING", {
        codeType: itemType,
        itemCode: itemCode,
        internalCode: row[mapping.internalCode] || `ITEM-${idx + 1}`,
        description: desc
      });

      return {
        description:       desc,
        itemType:          itemType,
        itemCode:          itemCode,
        unitType:          unitType,
        quantity,
        internalCode:      String(row[mapping.internalCode] || `ITEM-${idx + 1}`),
        salesTotal,
        total,
        valueDifference:   0,
        totalTaxableFees:  0,
        netTotal,
        itemsDiscount:     0,
        discount: { rate: 0, amount: 0 },
        unitValue: {
          currencySold:        String(row[mapping.currency] || "EGP").toUpperCase(),
          amountEGP:           unitValue,
          amountSold:          String(row[mapping.currency] || "EGP").toUpperCase() === "EGP" ? 0 : unitValue,
          currencyExchangeRate: String(row[mapping.currency] || "EGP").toUpperCase() === "EGP" ? 0 : 1,
        },
        taxableItems: [
          {
            taxType:   "T1",
            amount:    taxAmount,
            subType:   "V009",
            rate:      taxPercent,
          },
        ],
      };
    });

    const totalSalesAmount = invoiceLines.reduce((s, l) => s + l.salesTotal, 0);
    const totalNetAmount   = invoiceLines.reduce((s, l) => s + l.netTotal, 0);
    const totalAmount      = invoiceLines.reduce((s, l) => s + l.total, 0);
    const taxTotals = [
      {
        taxType: "T1",
        amount: parseFloat(invoiceLines.reduce((s, l) => s + (l.taxableItems[0]?.amount || 0), 0).toFixed(4)),
      },
    ];

    const firstRow = groupRows[0].row;
    
    // استخدام ميتاداتا المستلم إذا وجدت، وإلا الرجوع للمربوط في الصفوف
    const receiverId = (metadata.receiverVat || String(firstRow[mapping.receiverId] || "")).replace(/[^0-9A-Za-z]/g, "");
    const receiverName = metadata.receiver || String(firstRow[mapping.receiverName] || "");
    
    let receiverType = metadata.receiverType;
    if (!receiverType) {
      receiverType = "B";
      if (receiverId.length === 14 && /^\d+$/.test(receiverId)) receiverType = "P";
      else if (receiverId === "") receiverType = "P";
    }

    const receiverCountry = metadata.receiverCountry || "EG";

    documents.push({
      issuer: {
        address: {
          branchID:    issuer.branchID    || "0",
          country:     issuer.country     || "EG",
          governate:   issuer.governate   || "Cairo",
          regionCity:  issuer.regionCity  || "Cairo",
          street:      issuer.street      || "Main Street",
          buildingNumber: issuer.buildingNumber || "1",
        },
        type: issuer.type || "B",
        id:   issuerId,
        name: issuerName,
      },
      receiver: {
        address: {
          country:        receiverCountry,
          governate:      metadata.receiverGovernate || "Cairo",
          regionCity:     metadata.receiverRegionCity || "Cairo",
          street:         metadata.receiverStreet || "Main Street",
          buildingNumber: metadata.receiverBuildingNumber || "1"
        },
        type: receiverType,
        id:   receiverId,
        name: receiverName,
      },
      documentType,
      documentTypeVersion,
      dateTimeIssued,
      taxpayerActivityCode,
      internalID:      String(invoiceNumber),
      invoiceLines,
      totalSalesAmount:   parseFloat(totalSalesAmount.toFixed(5)),
      totalDiscountAmount: 0,
      netAmount:          parseFloat(totalNetAmount.toFixed(5)),
      taxTotals,
      totalAmount:        parseFloat(totalAmount.toFixed(5)),
      totalItemsDiscountAmount: 0,
      extraDiscountAmount: 0,
      payment: {
        bankName: "",
        bankAddress: "",
        bankAccountNo: "",
        bankAccountIBAN: "",
        swiftCode: "",
        terms: ""
      }
    });
  }

  console.log("=== GENERATED DOCUMENT ===", documents);
  return documents;
}

module.exports = { mapToETADocument };
