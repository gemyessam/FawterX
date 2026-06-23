/**
 * ETA Document Local Validator
 * يعمل validation محلي كامل على الـ ETA document بدون إرسال لـ ETA
 */

const REQUIRED_DOC_FIELDS = [
  "issuer", "receiver", "documentType", "documentTypeVersion",
  "dateTimeIssued", "taxpayerActivityCode", "internalID", "invoiceLines",
  "totalSalesAmount", "totalItemsDiscountAmount", "netAmount", "totalAmount", "taxTotals",
];

const REQUIRED_LINE_FIELDS = [
  "description", "itemType", "itemCode", "unitType",
  "quantity", "unitValue", "salesTotal", "netTotal", "total", "taxableItems",
];

function checkRequired(obj, fields, prefix = "") {
  const errors = [];
  fields.forEach(field => {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      errors.push(`الحقل "${prefix}${field}" مطلوب وغير موجود`);
    }
  });
  return errors;
}

function validateFinancials(doc) {
  const errors   = [];
  const warnings = [];

  const lines = doc.invoiceLines || [];
  let calcSalesTotal = 0, calcNetTotal = 0, calcTotal = 0, calcTaxTotal = 0;

  lines.forEach((line, i) => {
    const n = i + 1;
    const price    = line.unitValue?.amountEGP || 0;
    const qty      = line.quantity || 0;
    const expected_salesTotal = parseFloat((price * qty).toFixed(5));
    const taxRate  = line.taxableItems?.[0]?.rate || 0;
    const expected_taxAmount  = parseFloat((expected_salesTotal * taxRate / 100).toFixed(5));
    const expected_total      = parseFloat((expected_salesTotal + expected_taxAmount).toFixed(5));

    if (Math.abs((line.salesTotal || 0) - expected_salesTotal) > 0.01)
      errors.push(`Line ${n} (${line.description}): salesTotal = ${line.salesTotal} ≠ المتوقع ${expected_salesTotal}`);
    
    if (Math.abs((line.total || 0) - expected_total) > 0.01)
      errors.push(`Line ${n}: total = ${line.total} ≠ المتوقع ${expected_total}`);

    if (qty <= 0)   warnings.push(`Line ${n}: الكمية = ${qty} (يجب أن تكون أكبر من صفر)`);
    if (price <= 0) warnings.push(`Line ${n}: السعر = ${price} (يجب أن يكون أكبر من صفر)`);

    calcSalesTotal += line.salesTotal || 0;
    calcNetTotal   += line.netTotal   || 0;
    calcTotal      += line.total      || 0;
    calcTaxTotal   += line.taxableItems?.[0]?.amount || 0;
  });

  calcSalesTotal = parseFloat(calcSalesTotal.toFixed(5));
  calcNetTotal   = parseFloat(calcNetTotal.toFixed(5));
  calcTotal      = parseFloat(calcTotal.toFixed(5));
  calcTaxTotal   = parseFloat(calcTaxTotal.toFixed(5));

  if (Math.abs((doc.totalSalesAmount || 0) - calcSalesTotal) > 0.01) errors.push(`totalSalesAmount ≠ مجموع البنود`);
  if (Math.abs((doc.totalAmount || 0) - calcTotal) > 0.01) errors.push(`totalAmount ≠ مجموع البنود`);

  return {
    errors, warnings,
    calculatedTotals: { totalSalesAmount: calcSalesTotal, netAmount: calcNetTotal, totalAmount: calcTotal, taxTotal: calcTaxTotal, linesCount: lines.length },
  };
}

function validateStructure(doc) {
  const errors   = [];
  const warnings = [];
  const missingFields = [];

  // Document-level fields
  REQUIRED_DOC_FIELDS.forEach(field => {
    if (doc[field] === undefined || doc[field] === null || doc[field] === "") {
      errors.push(`الحقل الأساسي "${field}" مفقود`);
      missingFields.push(field);
    }
  });

  // Issuer checks
  if (doc.issuer) {
    if (!doc.issuer.id) { errors.push('الرقم الضريبي للمُصدر (issuer.id) مطلوب'); missingFields.push("issuer.id"); }
    if (!doc.issuer.name) { errors.push('اسم الشركة (issuer.name) مطلوب'); missingFields.push("issuer.name"); }
    if (!doc.issuer.address?.governate) warnings.push('المحافظة للمصدر غير محددة');
  }

  // Receiver checks
  if (doc.receiver) {
    if (!doc.receiver.name) { errors.push('اسم العميل (receiver.name) مطلوب للإرسال الناجح'); missingFields.push("receiver.name"); }
    if ((doc.receiver.type === "B" || doc.receiver.type === "F") && !doc.receiver.id) {
      errors.push('رقم المستلم مطلوب للعملاء الشركات أو الأجانب (Receiver Type: B/F)');
      missingFields.push("receiver.id");
    }
    if (doc.receiver.type === "F") {
      if (!doc.receiver.address?.country) {
        errors.push('Country مطلوب للمستلم الأجنبي');
        missingFields.push("receiver.address.country");
      } else if (String(doc.receiver.address.country).toUpperCase() === "EG") {
        errors.push('المستلم الأجنبي لا يجوز أن يكون Country = EG');
        missingFields.push("receiver.address.country");
      }
    }
    if (doc.receiver.type === "P" && (!doc.receiver.id || doc.receiver.id.length !== 14)) {
      if (doc.totalAmount >= 50000) {
        errors.push('الرقم القومي للعميل (14 رقم) مطلوب للفواتير >= 50000 ج.م');
        missingFields.push("receiver.id (14 digits)");
      } else {
        warnings.push('الرقم القومي غير موجود أو غير كامل، لكن مسموح لأن الفاتورة < 50000 ج.م');
      }
    }
  }

  // Document type
  if (doc.documentType && !["I", "C", "D"].includes(doc.documentType)) {
    errors.push(`نوع المستند غير صحيح`);
  }

  // Invoice lines (Item Code Validation)
  if (!Array.isArray(doc.invoiceLines) || doc.invoiceLines.length === 0) {
    errors.push("يجب أن يحتوي المستند على بند واحد على الأقل");
  } else {
    doc.invoiceLines.forEach((line, i) => {
      const lineErrors = checkRequired(line, REQUIRED_LINE_FIELDS, `invoiceLines[${i}].`);
      if (lineErrors.length > 0) {
        errors.push(...lineErrors);
        missingFields.push(`invoiceLines[${i}] required fields`);
      }

      if (line.itemCode && line.itemCode.includes("XXXXX")) {
        errors.push(`كود الصنف (itemCode) في البند ${i+1} يحتوي على قيم وهمية XXXXX. يجب توفير كود GS1 أو EGS حقيقي.`);
        missingFields.push(`itemCode (Line ${i+1})`);
      }
      
      if (!["EGS", "GS1"].includes(line.itemType)) {
         errors.push(`Item Type في البند ${i+1} يجب أن يكون EGS أو GS1`);
      }
    });
  }

  // Date format
  if (doc.dateTimeIssued && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(doc.dateTimeIssued)) {
    errors.push(`صيغة dateTimeIssued غير صحيحة`);
  }

  // Compliance Score calculation
  const totalChecks = REQUIRED_DOC_FIELDS.length + 3; // +3 for basic structure checks
  const score = Math.max(0, Math.round(((totalChecks - missingFields.length) / totalChecks) * 100));

  return { errors, warnings, missingFields, score };
}

function validateSingleETADocument(doc) {
  const structResult    = validateStructure(doc);
  const financialResult = validateFinancials(doc);

  const allErrors   = [...structResult.errors,   ...financialResult.errors];
  const allWarnings = [...structResult.warnings,  ...financialResult.warnings];

  return {
    valid:            allErrors.length === 0,
    errors:           allErrors,
    warnings:         allWarnings,
    missingFields:    structResult.missingFields,
    complianceScore:  structResult.score,
    calculatedTotals: financialResult.calculatedTotals,
  };
}

function validateETADocument(document) {
  console.log("=== VALIDATOR INPUT ===", document);
  console.log("=== VALIDATOR TYPE ===", typeof document);
  console.log("=== IS ARRAY ===", Array.isArray(document));

  if (Array.isArray(document)) {
    const results = document.map(d => validateSingleETADocument(d));
    const allErrors = [];
    const allWarnings = [];
    const allMissingFields = [];
    let sumScore = 0;
    
    let calcSalesTotal = 0;
    let calcNetTotal = 0;
    let calcTotal = 0;
    let calcTaxTotal = 0;
    let calcLinesCount = 0;

    results.forEach(r => {
      allErrors.push(...r.errors);
      allWarnings.push(...r.warnings);
      allMissingFields.push(...r.missingFields);
      sumScore += r.complianceScore;
      
      calcSalesTotal += r.calculatedTotals.totalSalesAmount;
      calcNetTotal += r.calculatedTotals.netAmount;
      calcTotal += r.calculatedTotals.totalAmount;
      calcTaxTotal += r.calculatedTotals.taxTotal;
      calcLinesCount += r.calculatedTotals.linesCount;
    });

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      missingFields: [...new Set(allMissingFields)],
      complianceScore: results.length > 0 ? Math.round(sumScore / results.length) : 100,
      calculatedTotals: {
        totalSalesAmount: parseFloat(calcSalesTotal.toFixed(5)),
        netAmount: parseFloat(calcNetTotal.toFixed(5)),
        totalAmount: parseFloat(calcTotal.toFixed(5)),
        taxTotal: parseFloat(calcTaxTotal.toFixed(5)),
        linesCount: calcLinesCount
      }
    };
  } else {
    return validateSingleETADocument(document);
  }
}

module.exports = { validateETADocument };
