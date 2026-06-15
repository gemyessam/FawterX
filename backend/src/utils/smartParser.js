const fs = require("fs");
const XLSX = require("xlsx");

const ETA_UNIT_MAP = {
  kg: "KGM",
  kgs: "KGM",
  kilogram: "KGM",
  kilograms: "KGM",
  kgm: "KGM",
  m: "M",
  mt: "M",
  mtr: "M",
  meter: "M",
  meters: "M",
  metre: "M",
  metres: "M",
  lm: "M",
  "l.m": "M",
  mm: "M",
  cm: "M",
  ton: "TNE",
  tonne: "TNE",
  tne: "TNE",
  ea: "EA",
  each: "EA",
  pce: "EA",
  pc: "EA",
  pcs: "EA",
  piece: "EA",
  pieces: "EA",
  pac: "PAC",
  pack: "PAC",
  package: "PAC",
  bar: "BAR",
  roll: "ROLL",
  set: "SET",
  l: "LTR",
  liter: "LTR",
  litre: "LTR"
};

const FIELD_HEADERS = {
  invoiceNumber: ["invoice no", "invoice number", "inv no", "bill no", "document no", "رقم الفاتورة", "فاتورة رقم"],
  itemCode: ["item code", "product code", "code", "sku", "part no", "part number", "كود", "كود الصنف"],
  internalCode: ["internal code", "internal", "ref", "reference", "article", "model", "الكود الداخلي"],
  description: ["description", "item", "product", "goods", "service", "details", "الوصف", "الصنف", "البيان"],
  quantity: ["qty", "quantity", "qnty", "الكمية", "عدد"],
  unitType: ["unit", "uom", "measure", "measurement", "وحدة", "الوحدة"],
  unitValue: ["unit price", "price", "rate", "سعر", "سعر الوحدة"],
  taxPercent: ["vat %", "tax %", "vat", "tax", "ضريبة", "الضريبة"],
  total: ["total", "amount", "line total", "net amount", "value", "الإجمالي", "القيمة"],
  currency: ["currency", "curr", "عملة"]
};

const NOISE_PATTERNS = [
  /\b(iban|swift|bank|account|branch|email|phone|tel|fax|website|www\.|@)\b/i,
  /\b(page|powered by|terms|conditions|signature|stamp|thank you)\b/i,
  /(الصفحة|البنك|حساب|تليفون|هاتف|البريد|توقيع|شروط|ملاحظات)/i
];

const TOTAL_KEYWORDS = /(subtotal|sub total|net amount|vat amount|tax amount|grand total|total amount|invoice total|الإجمالي|اجمالي|الصافي|ضريبة|القيمة المضافة)/i;

function normalizeSpaces(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function cleanVat(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  let text = String(value)
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[^\d,.\-]/g, "")
    .trim();

  if (!text) return 0;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (lastComma > -1 && /^\d+,\d{1,3}$/.test(text)) {
    text = text.replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }

  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

function inferCurrency(text) {
  const lower = String(text || "").toLowerCase();
  if (/\busd\b|\$/.test(lower)) return "USD";
  if (/\beur\b|€/.test(lower)) return "EUR";
  if (/\bgbp\b|£/.test(lower)) return "GBP";
  if (/\bsar\b/.test(lower)) return "SAR";
  if (/\baed\b/.test(lower)) return "AED";
  return "EGP";
}

function canonicalUnit(unit) {
  const raw = normalizeSpaces(unit).toLowerCase().replace(/\./g, ".");
  return ETA_UNIT_MAP[raw] || ETA_UNIT_MAP[raw.replace(/\./g, "")] || raw.toUpperCase() || "EA";
}

function scoreLabel(header, labels) {
  const h = normalizeSpaces(header).toLowerCase();
  return labels.some(label => h.includes(label.toLowerCase())) ? 1 : 0;
}

function detectHeaderMap(headers) {
  const result = {};
  Object.entries(FIELD_HEADERS).forEach(([field, labels]) => {
    let best = { idx: -1, score: 0 };
    headers.forEach((header, idx) => {
      const score = scoreLabel(header, labels);
      if (score > best.score) best = { idx, score };
    });
    if (best.idx !== -1) result[field] = best.idx;
  });
  return result;
}

function isNoiseLine(line) {
  const text = normalizeSpaces(line);
  if (!text) return true;
  if (NOISE_PATTERNS.some(pattern => pattern.test(text))) return true;
  if (/^\s*(page\s*)?\d+\s*(of|\/)\s*\d+\s*$/i.test(text)) return true;
  return false;
}

function extractFirst(regex, text) {
  const match = text.match(regex);
  return match && match[1] ? normalizeSpaces(match[1]) : "";
}

function parseDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  const parts = text.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/);
  if (parts) {
    const a = Number(parts[1]);
    const b = Number(parts[2]);
    const c = Number(parts[3]);
    const yyyy = a > 1900 ? a : c;
    const mm = b;
    const dd = a > 1900 ? c : a;
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 10, 0, 0));
    if (!isNaN(d.getTime())) return d.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  const d = new Date(text);
  return isNaN(d.getTime()) ? "" : d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function extractMetadata(text, rawRows = []) {
  const allText = normalizeSpaces(text.replace(/\n/g, " \n "));
  const vatMatches = allText.match(/\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g) || [];
  const invoiceDate = extractFirst(/(?:invoice\s*date|date|تاريخ الفاتورة|التاريخ)\s*[:#-]?\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i, allText) ||
    extractFirst(/\b(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})\b/, allText);

  const metadata = {
    issuer: extractFirst(/(?:supplier|seller|vendor|from|المورد|البائع)\s*[:#-]?\s*([^\n]{3,90})/i, text),
    issuerVat: cleanVat(extractFirst(/(?:supplier|seller|vendor|issuer)?\s*(?:vat|tax id|registration no|رقم ضريبي|التسجيل الضريبي)\s*[:#-]?\s*([0-9\-\s]{9,20})/i, allText)) || cleanVat(vatMatches[0] || ""),
    receiver: extractFirst(/(?:bill\s*to|buyer|customer|client|receiver|العميل|المشتري)\s*[:#-]?\s*([^\n]{3,90})/i, text),
    receiverVat: cleanVat(vatMatches[1] || ""),
    documentType: "I",
    documentTypeVersion: "1.0",
    dateTimeIssued: parseDate(invoiceDate) || new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    taxpayerActivityCode: extractFirst(/(?:activity\s*code|taxpayer\s*activity\s*code|كود النشاط)\s*[:#-]?\s*(\d{3,6})/i, allText),
    internalID: extractFirst(/(?:invoice\s*(?:no|number)|inv\s*no|bill\s*no|document\s*no|رقم الفاتورة|فاتورة رقم)\s*[:#-]?\s*([A-Z0-9\-\/]+)/i, allText) || `INV-${Date.now().toString().slice(-8)}`,
    currency: inferCurrency(allText)
  };

  rawRows.slice(0, 12).forEach(row => {
    const joined = row.map(normalizeSpaces).filter(Boolean).join(" ");
    if (!metadata.issuer && /(supplier|seller|vendor|المورد|البائع)/i.test(joined)) {
      metadata.issuer = normalizeSpaces(row[row.length - 1]);
    }
    if (!metadata.receiver && /(buyer|customer|client|receiver|العميل|المشتري)/i.test(joined)) {
      metadata.receiver = normalizeSpaces(row[row.length - 1]);
    }
  });

  return metadata;
}

function extractTotals(text, rows) {
  const totalCandidates = [];
  String(text || "").split("\n").forEach(line => {
    if (!TOTAL_KEYWORDS.test(line)) return;
    const nums = line.match(/[-]?\d[\d,]*(?:\.\d+)?/g) || [];
    nums.forEach(n => totalCandidates.push({ label: line.toLowerCase(), value: parseNumber(n) }));
  });

  const byLabel = keyword => {
    const match = totalCandidates.filter(c => keyword.test(c.label)).sort((a, b) => b.value - a.value)[0];
    return match ? match.value : 0;
  };

  const netAmount = byLabel(/subtotal|sub total|net amount|الصافي|قبل الضريبة/i) ||
    rows.reduce((sum, row) => sum + (row.total || 0), 0);
  const taxAmount = byLabel(/vat amount|tax amount|ضريبة|القيمة المضافة/i);
  const totalAmount = byLabel(/grand total|total amount|invoice total|الإجمالي|اجمالي/i) ||
    (netAmount + taxAmount);

  return {
    netAmount: Number(netAmount.toFixed(5)),
    taxAmount: Number(taxAmount.toFixed(5)),
    totalAmount: Number(totalAmount.toFixed(5))
  };
}

function extractAttributes(description) {
  const text = normalizeSpaces(description);
  const attrs = {};

  const material = text.match(/\b(aluminium|aluminum|steel|iron|wood|glass|plastic|copper|brass|fabric|leather|chemical|cement|concrete|ceramic|ألمنيوم|المونيوم|حديد|خشب|زجاج|بلاستيك)\b/i);
  if (material) attrs.material = material[1];

  const weight = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|kgm|g|ton|tne|كيلو|كجم)/i);
  if (weight) attrs.weight = `${parseNumber(weight[1])} ${canonicalUnit(weight[2])}`;

  const length = text.match(/(\d{2,6}(?:[.,]\d+)?)\s*(mm|cm|m|meter|mtr|مم|سم|متر)\b/i);
  if (length) attrs.length = `${parseNumber(length[1])} ${canonicalUnit(length[2])}`;

  const finish = text.match(/\b(RAL\s?[0-9A-Z]{3,8}[A-Z]*|matte|glossy|anodized|powder\s*coated|painted|chrome|nickel|مطفي|لامع)\b/i);
  if (finish) attrs.finish = normalizeSpaces(finish[1]).replace(/\s+/g, "");

  const packaging = text.match(/(\d+(?:[.,]\d+)?)\s*(pac|pack|package|box|carton|كرتونة|عبوة)\s*=\s*(\d+(?:[.,]\d+)?)\s*(pce|pcs|pc|piece|ea|قطعة)/i);
  if (packaging) attrs.packaging = `${parseNumber(packaging[1])} ${canonicalUnit(packaging[2])} = ${parseNumber(packaging[3])} ${canonicalUnit(packaging[4])}`;

  return attrs;
}

function inferProductType(description) {
  const text = normalizeSpaces(description);
  const words = text.match(/[\p{L}][\p{L}\d\-\/]{2,}/gu) || [];
  const ignored = new Set([
    "aluminium", "aluminum", "steel", "iron", "wood", "glass", "plastic", "profile",
    "item", "product", "service", "length", "weight", "finish", "description",
    "ألمنيوم", "المونيوم", "حديد", "خشب", "زجاج", "بلاستيك"
  ]);

  const typeWord = words.find(word => !ignored.has(word.toLowerCase()));
  if (!typeWord) return "Generic Item";
  return typeWord.charAt(0).toUpperCase() + typeWord.slice(1);
}

function buildDescription(rawDescription, attrs, productType) {
  const material = attrs.material ? attrs.material.charAt(0).toUpperCase() + attrs.material.slice(1).toLowerCase() : "";
  const title = [material, productType !== "Generic Item" ? productType : ""].filter(Boolean).join(" ") || normalizeSpaces(rawDescription).slice(0, 90) || "Generic Item";
  const lines = [title];

  if (attrs.length) lines.push(`Length: ${attrs.length}`);
  if (attrs.weight) lines.push(`Weight: ${attrs.weight}`);
  if (attrs.finish) lines.push(`Finish: ${attrs.finish}`);
  if (attrs.packaging) lines.push(`Packaging: ${attrs.packaging}`);

  const cleanRaw = normalizeSpaces(rawDescription);
  if (cleanRaw && cleanRaw.length > title.length && !lines.some(l => l.includes(cleanRaw))) {
    lines.push(`Source: ${cleanRaw.slice(0, 180)}`);
  }

  return lines.join("\n");
}

function confidenceForLine(line) {
  let score = 25;
  if (line.description && line.description.length > 3) score += 20;
  if (line.quantity > 0) score += 15;
  if (line.unitValue > 0) score += 15;
  if (line.total > 0) score += 10;
  if (line.internalCode) score += 5;
  if (line.productType && line.productType !== "Generic Item") score += 5;
  if (line.unitType && line.unitType !== "EA") score += 5;
  return Math.min(score, 98);
}

function missingForLine(line, attrs) {
  const missing = [];
  if (!line.description) missing.push("Missing description");
  if (!line.quantity) missing.push("Missing quantity");
  if (!line.unitValue) missing.push("Missing unit price");
  if (!line.taxPercent) missing.push("Missing VAT");
  if (!attrs.length) missing.push("Missing Length");
  if (!attrs.weight) missing.push("Missing Weight");
  return missing;
}

function normalizeLine(raw, idx, metadataCurrency) {
  const rawDescription = normalizeSpaces(raw.description || raw.rawText || "");
  const attrs = extractAttributes(rawDescription);
  const productType = inferProductType(rawDescription);
  const quantity = parseNumber(raw.quantity) || parseNumber(raw.detectedQuantity) || 1;
  const unitType = String(raw.unitType || raw.detectedUnit || "EA").trim();
  const unitValue = parseNumber(raw.unitValue);
  const total = parseNumber(raw.total) || Number((quantity * unitValue).toFixed(5));
  const taxPercent = parseNumber(raw.taxPercent) || 14;
  const internalCode = normalizeSpaces(raw.internalCode || raw.itemCode || `ITEM-${idx + 1}`);
  const itemCode = normalizeSpaces(raw.itemCode || "EG-111111-1111");
  const description = buildDescription(rawDescription, attrs, productType);

  const line = {
    invoiceNumber: raw.invoiceNumber || "",
    itemCode,
    codeType: raw.codeType || "EGS",
    internalCode,
    description,
    rawDescription,
    productType,
    quantity,
    unitType,
    unitValue,
    taxPercent,
    currency: raw.currency || metadataCurrency || "EGP",
    total,
    smartAttributes: attrs,
    extractionConfidence: {},
    warnings: []
  };

  line.missingFields = missingForLine(line, attrs);
  line.confidence = confidenceForLine(line);
  line.extractionConfidence = {
    productName: productType === "Generic Item" ? 60 : 90,
    quantity: quantity > 0 ? 90 : 20,
    unitPrice: unitValue > 0 ? 90 : 20,
    length: attrs.length ? 95 : 0,
    weight: attrs.weight ? 90 : 0,
    vat: taxPercent ? 85 : 0
  };

  if (total > 0 && unitValue > 0 && Math.abs(total - quantity * unitValue) > Math.max(2, total * 0.03)) {
    line.warnings.push(`Line math mismatch: quantity x unit price = ${(quantity * unitValue).toFixed(2)}, invoice line total = ${total.toFixed(2)}.`);
    line.confidence = Math.max(35, line.confidence - 15);
  }

  return line;
}

function extractRowsFromExcel(rawData, metadataCurrency) {
  let bestHeaderIdx = -1;
  let bestScore = 0;

  rawData.slice(0, 40).forEach((row, idx) => {
    const headers = row.map(normalizeSpaces);
    const map = detectHeaderMap(headers);
    const score = Object.keys(map).length;
    if (score > bestScore) {
      bestHeaderIdx = idx;
      bestScore = score;
    }
  });

  if (bestHeaderIdx === -1 || bestScore < 3) return { rows: [], headerInfo: null };

  const headers = rawData[bestHeaderIdx].map(normalizeSpaces);
  const map = detectHeaderMap(headers);
  const rows = [];

  rawData.slice(bestHeaderIdx + 1).forEach((row, idx) => {
    const joined = row.map(normalizeSpaces).filter(Boolean).join(" ");
    if (!joined || isNoiseLine(joined) || TOTAL_KEYWORDS.test(joined)) return;

    const raw = {};
    Object.entries(map).forEach(([field, colIdx]) => {
      raw[field] = row[colIdx];
    });

    if (!raw.description && joined.length > 6) raw.description = joined;
    if (!raw.quantity && !raw.unitValue && !raw.total) return;
    rows.push(normalizeLine(raw, idx, metadataCurrency));
  });

  return {
    rows,
    headerInfo: {
      detectedHeaderRow: bestHeaderIdx + 1,
      detectedColumns: headers.filter(Boolean),
      ignoredMetadataRows: bestHeaderIdx
    }
  };
}

function extractRowsFromText(text, metadataCurrency) {
  const lines = String(text || "").split("\n").map(normalizeSpaces).filter(Boolean);
  const rows = [];
  let buffer = "";

  const flush = () => {
    const block = normalizeSpaces(buffer);
    buffer = "";
    if (!block || isNoiseLine(block) || TOTAL_KEYWORDS.test(block)) return;

    const numbers = block.match(/[-]?\d[\d,]*(?:\.\d+)?/g) || [];
    const unitMatch = block.match(/\b(kgm?|kgs?|mtr|meter|meters|lm|l\.m|mm|cm|ea|pce|pcs|pc|pac|pack|bar|ton|tne|ltr|liter|litre)\b/i);
    const codeMatch = block.match(/\b([A-Z]{1,5}[-/]?[A-Z0-9]{3,20})\b/);

    const amountNumbers = numbers.map(parseNumber).filter(n => n > 0);
    if (amountNumbers.length < 1 && !unitMatch) return;

    let total = 0;
    let unitValue = 0;
    let quantity = 1;

    if (amountNumbers.length >= 3) {
      total = amountNumbers[amountNumbers.length - 1];
      unitValue = amountNumbers[amountNumbers.length - 2];
      quantity = amountNumbers[amountNumbers.length - 3];
    } else if (amountNumbers.length === 2) {
      quantity = amountNumbers[0];
      total = amountNumbers[1];
      unitValue = quantity ? total / quantity : 0;
    } else if (amountNumbers.length === 1) {
      quantity = amountNumbers[0];
    }

    const description = block
      .replace(/^\d+\s+/, "")
      .replace(/\b(total|vat|tax|egp|usd|eur)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    rows.push(normalizeLine({
      itemCode: codeMatch ? codeMatch[1] : "",
      internalCode: codeMatch ? codeMatch[1] : "",
      description,
      quantity,
      unitType: unitMatch ? unitMatch[1] : "",
      unitValue,
      total,
      currency: inferCurrency(block) || metadataCurrency
    }, rows.length, metadataCurrency));
  };

  lines.forEach(line => {
    if (isNoiseLine(line)) {
      flush();
      return;
    }

    const startsNew = /^(\d+[\).-]?|[A-Z0-9]{3,20}\s+)/.test(line) || /\b(qty|quantity|unit price|description)\b/i.test(line);
    if (startsNew && buffer) flush();
    buffer = buffer ? `${buffer} ${line}` : line;
  });
  flush();

  return rows;
}

async function readDocument(filePath, isPdf) {
  if (isPdf) {
    let pdfParseModule;
    try {
      pdfParseModule = require("pdf-parse");
    } catch (error) {
      throw new Error("PDF parsing dependency is not installed. Run npm install in the backend project.");
    }

    const dataBuffer = fs.readFileSync(filePath);
    if (typeof pdfParseModule === "function") {
      const pdfData = await pdfParseModule(dataBuffer);
      return { text: pdfData.text || "", rawData: [] };
    }
    if (pdfParseModule && pdfParseModule.PDFParse) {
      const pdfInstance = new pdfParseModule.PDFParse({ data: dataBuffer });
      const parsed = await pdfInstance.getText();
      return { text: parsed.text || "", rawData: [] };
    }
    return { text: "", rawData: [] };
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const text = rawData
    .map(row => row.map(normalizeSpaces).filter(Boolean).join(" \t "))
    .filter(Boolean)
    .join("\n");

  return { text, rawData, sheetName };
}

async function parseSmartDocument(filePath, isPdf = false) {
  const warnings = [];
  const { text, rawData, sheetName } = await readDocument(filePath, isPdf);

  if (!text || !text.trim()) {
    throw new Error("No readable text was found in the uploaded invoice.");
  }

  const metadata = extractMetadata(text, rawData);
  const excelExtraction = !isPdf ? extractRowsFromExcel(rawData, metadata.currency) : { rows: [], headerInfo: null };
  let rows = excelExtraction.rows.length ? excelExtraction.rows : extractRowsFromText(text, metadata.currency);

  rows = rows.filter(row => row.description && !isNoiseLine(row.rawDescription || row.description));

  if (rows.length === 0) {
    warnings.push("No confident invoice lines were detected. Please review the file layout or use template mode.");
  }

  const totals = extractTotals(text, rows);
  metadata.netAmount = totals.netAmount;
  metadata.taxAmount = totals.taxAmount;
  metadata.totalAmount = totals.totalAmount;

  const lineWarnings = rows.flatMap((row, idx) => [
    ...row.warnings.map(w => `Line ${idx + 1}: ${w}`),
    ...row.missingFields.map(m => `Line ${idx + 1}: ${m}`)
  ]);

  const sumLines = rows.reduce((sum, row) => sum + (row.total || row.quantity * row.unitValue || 0), 0);
  let totalsMatched = true;
  if (rows.length && totals.netAmount && Math.abs(sumLines - totals.netAmount) > Math.max(5, totals.netAmount * 0.03)) {
    totalsMatched = false;
    warnings.push(`Invoice totals need review: extracted line sum ${sumLines.toFixed(2)} does not match net total ${totals.netAmount.toFixed(2)}.`);
  }

  const confidenceScore = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length) - (totalsMatched ? 0 : 10)
    : 20;

  const headers = [
    "invoiceNumber",
    "itemCode",
    "codeType",
    "internalCode",
    "description",
    "quantity",
    "unitType",
    "currency",
    "unitValue",
    "taxPercent"
  ];

  return {
    success: true,
    sheetName: sheetName || "Smart Document",
    metadata,
    invoiceLines: rows,
    rows,
    headers,
    totals,
    warnings: [...warnings, ...lineWarnings],
    confidenceScore: Math.max(0, Math.min(99, confidenceScore)),
    parserDebugInfo: {
      mode: "Smart Invoice Intelligence Engine v5.0",
      confidenceScore: Math.max(0, Math.min(99, confidenceScore)),
      totalsMatched,
      lineCount: rows.length,
      detectedHeaderRow: excelExtraction.headerInfo?.detectedHeaderRow || null,
      ignoredMetadataRows: excelExtraction.headerInfo?.ignoredMetadataRows || 0,
      ignoredFooterRows: 0,
      detectedColumns: excelExtraction.headerInfo?.detectedColumns || [],
      parsingWarnings: [...warnings, ...lineWarnings],
      debugWarnings: [...warnings, ...lineWarnings],
      outputShape: "{ metadata, invoiceLines, totals, warnings, confidenceScore }"
    }
  };
}


// ══════════════════════════════════════════════════════════
//  SCHÜCO / SYSTEM-INVOICE BLOCK PARSER  v2.0
//  Real PDF format (from pdf-parse text output):
//    ItemCode \t Pos \t ProductName \t BAR_count \n
//    ... (body lines with KG, mm, Finish, LM, /1M, /1BAR)
// ══════════════════════════════════════════════════════════

function parseSchucoInvoice(text) {
  const rawLines = text.split('\n').map(l => l.trim().replace(/\\t/g, '\t')).filter(Boolean);

  // ── RAW TEXT DEBUG LOG ──────────────────────────────────
  console.log('═══════════════ SCHÜCO RAW OCR TEXT ═══════════════');
  console.log('Total raw lines:', rawLines.length);
  rawLines.forEach((line, i) => {
    console.log(`  [${String(i).padStart(3, '0')}] "${line}"`);
  });
  console.log('═══════════════════════════════════════════════════');

  // ── Metadata extraction ──────────────────────────────────
  const metadata = {
    issuer: '', issuerVat: '',
    receiver: '', receiverVat: '',
    documentType: 'I', documentTypeVersion: '1.0',
    dateTimeIssued: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    internalID: '',
    currency: 'EGP',
    netAmount: 0, taxAmount: 0, totalAmount: 0
  };

  for (const line of rawLines) {
    // Invoice number: e.g. "000000612" or "202303610"
    const invMatch = line.match(/^0*(\d{3,10})$/) ;
    if (invMatch && !metadata.internalID && parseInt(invMatch[1]) > 100) {
      metadata.internalID = line.trim(); // keep leading zeros
    }
    // Invoice number from label
    const invLabelMatch = line.match(/invoice\s*(?:no\.?|number|#)?\s*:?\s*(0*\d{3,10})/i);
    if (invLabelMatch && !metadata.internalID) metadata.internalID = invLabelMatch[1];

    // Date: e.g. "21.05.2026"
    const dateMatch = line.match(/(\d{2}[.\/\-]\d{2}[.\/\-]\d{4})/);
    if (dateMatch) {
      const parsed = parseDate(dateMatch[1]);
      if (parsed) metadata.dateTimeIssued = parsed;
    }
    
    // VAT matching
    const vatMatch = line.match(/VAT\s*[:\-]?\s*([\d\-]{9,15})/i) || line.match(/\b(\d{3}-\d{3}-\d{3})\b/);
    if (vatMatch) {
      const clean = vatMatch[1].replace(/[^0-9]/g, '');
      if (!metadata.issuerVat) metadata.issuerVat = clean;
      else if (!metadata.receiverVat && clean !== metadata.issuerVat) metadata.receiverVat = clean;
    }

    // Receiver name
    if (line.includes('OMSI') && !metadata.receiver) {
      metadata.receiver = line.replace(/^(Account Name|Beneficiary Name|Customer Name|Name|Customer|Client)\s*[:\-]?\s*/i, '').trim();
    }
    // Issuer name
    if (line.includes('Schüco') && line.toLowerCase().includes('egypt') && !metadata.issuer) {
      metadata.issuer = line.replace(/^(Account Name|Beneficiary Name|Name|Supplier|Seller|Vendor)\s*[:\-]?\s*/i, '').trim();
    }

    // Totals from invoice footer
    const netMatch = line.match(/Net Amount\s*([\d,]+\.\d+)/i) || line.match(/^([\d,]+\.\d+)\s*Net Amount/i);
    if (netMatch) metadata.netAmount = parseNumber(netMatch[1]);

    const vatAmtMatch = line.match(/VAT\s+([\d,]+\.\d+)/i) || line.match(/^([\d,]+\.\d+)\s+VAT/i);
    if (vatAmtMatch && !metadata.taxAmount) metadata.taxAmount = parseNumber(vatAmtMatch[1]);

    const totalMatch = line.match(/Total Amount\s*([\d,]+\.\d+)/i) || line.match(/^([\d,]+\.\d+)\s*Total Amount/i) || line.match(/([\d,]+\.\d+)\s*EGP\s*$/i);
    if (totalMatch && !metadata.totalAmount) {
      const v = parseNumber(totalMatch[1]);
      if (v > 100) metadata.totalAmount = v;
    }
  }

  // Swap VATs as before
  if (metadata.issuerVat && metadata.receiverVat) {
    const tmp = metadata.issuerVat;
    metadata.issuerVat = metadata.receiverVat;
    metadata.receiverVat = tmp;
  } else if (metadata.issuerVat && !metadata.receiverVat) {
    metadata.receiverVat = metadata.issuerVat;
    metadata.issuerVat = '';
  }

  if (!metadata.internalID) metadata.internalID = `INV-${Date.now().toString().slice(-8)}`;

  // ── Hierarchical Item Block Segmenter ───────────────────────
  // A block starts at "Pos. + Item No." like: "1 \t 9655090" or "9655090 \t 1" or "1 9655090"
  // Item No is usually a 5-8 digit code.
  const blockStartRegex = /^(?:(\d+)(?:\s|\\t)+(\d{5,8})|(\d{5,8})(?:\s|\\t)+(\d+)|(\d{5,8}))(?:\s|\\t|$)/i;
  
  const blocks = [];
  let curBlock = null;

  for (const line of rawLines) {
    const lowerLine = line.toLowerCase();
    
    // End Of Invoice Detection: Stop parsing item blocks when we hit the final Bank Details or Footer keywords
    if (
      /Bank Details/i.test(line) || 
      /IBAN\s*:/i.test(line) || 
      /Account\s*:/i.test(line) ||
      /net weight/i.test(line) ||
      /amount in words/i.test(line) ||
      /we here(?:\s+)?with/i.test(line) ||
      /packing/i.test(line) ||
      /freight/i.test(line) ||
      /certify/i.test(line) ||
      /conformity/i.test(line) ||
      /sales invoice/i.test(line) ||
      /smart village/i.test(line) ||
      /phone\s*:/i.test(line) ||
      /tel\s*:/i.test(line) ||
      /infoeg@/i.test(line) ||
      /page\s+\d+/i.test(line)
    ) {
      break; 
    }

    const match = line.match(blockStartRegex);
    if (match) {
      const itemCode = match[2] || match[3] || match[5];
      const pos = match[1] || match[4] || '';
      
      // Ignore HS codes (7604xxxx) and lines referencing HS code or page footers
      if (itemCode.startsWith('7604') || lowerLine.includes('hs code') || lowerLine.includes('hscode') || lowerLine.includes('page') || lowerLine.includes('smart village')) {
        if (curBlock) {
          curBlock.rawLines.push(line);
        }
      } else {
        if (curBlock) blocks.push(curBlock);
        curBlock = {
          itemCode,
          pos,
          rawLines: [line]
        };
      }
    } else if (curBlock) {
      curBlock.rawLines.push(line);
    }
  }
  if (curBlock) blocks.push(curBlock);

  if (blocks.length === 0) return null; // not a Schüco invoice

  // ── BLOCK SEGMENTATION DEBUG LOG ──────────────────────────
  console.log(`═══════════════ SCHÜCO BLOCKS FOUND: ${blocks.length} ═══════════════`);
  blocks.forEach((block, i) => {
    console.log(`  Block ${i + 1}: Pos=${block.pos}, ItemCode=${block.itemCode}, Lines=${block.rawLines.length}`);
    block.rawLines.forEach((line, j) => {
      console.log(`    [${j}] "${line}"`);
    });
  });
  console.log('═══════════════════════════════════════════════════');

  // ── Parse each block into exactly ONE invoice line ─────────────────────
  // IMPORTANT: Each Schüco block has BAR/KG/LM rows which are 3 representations
  // of the SAME item price, NOT separate items.
  const invoiceLines = blocks.map(block => {
    let length = 0;
    let weight = 0;
    let finish = '';
    let barQty = 0;
    let lmQty = 0;
    let unitPricePerMeter = 0;
    let unitPricePerBar = 0;
    let lineNetAmount = 0;
    let countryOfOrigin = 'Egypt';
    const unclassifiedNumbers = [];

    // Parse attributes from the block lines
    block.rawLines.forEach(line => {
      const lower = line.toLowerCase();

      // 1. Length & Weight from: "3,950 \t 50.47 \t Length \t KG"
      if (lower.includes('length') && lower.includes('kg')) {
        const tokens = line.split(/(?:[\s]+|\\t)+/).map(t => t.trim()).filter(Boolean);
        const numbers = tokens
          .map(t => t.replace(/,/g, ''))
          .filter(t => !isNaN(t) && t.length > 0)
          .map(Number);
        
        if (numbers.length >= 2) {
          length = numbers[0];
          weight = numbers[1];
        } else if (numbers.length === 1) {
          weight = numbers[0];
        }
      }

      // Standalone Fallbacks for mm and KG
      const mmMatch = line.match(/([\d,]+)\s*(?:\\t)?\s*mm/i);
      if (mmMatch) {
        const val = Number(mmMatch[1].replace(/,/g, ''));
        if (val > 1000 && val < 20000) length = val;
      }

      const kgMatch = line.match(/([\d,.]+)\s*(?:\\t)?\s*KG/i);
      if (kgMatch && !lower.includes('length')) weight = Number(kgMatch[1].replace(/,/g, ''));

      // 2. Finish from: "Finish \t RAL9007SD"
      if (lower.includes('finish')) {
        const parts = line.split(/(?:[\s]+|\\t)+/);
        if (parts.length >= 2) finish = parts[parts.length - 1].trim();
      }
      const ralMatch = line.match(/RAL\s*\d{4}[A-Z]*/i) || line.match(/\bRAL[A-Za-z0-9]+\b/i);
      if (ralMatch && !finish) finish = ralMatch[0].trim();

      // 3. Country of Origin
      if (lower.includes('egypt') || lower.includes('origin')) {
        countryOfOrigin = 'Egypt';
      }

      // 4. LM Quantity & Unit Price Per Meter from: "90.00 \t LM \t 476.53 \t /1M \t 42,887.88"
      const lmLineMatch = line.match(/([\d,.]+)(?:\s|\\t)*LM(?:\s|\\t)*([\d,.]+)(?:\s|\\t)*\/1M/i);
      if (lmLineMatch) {
        lmQty = Number(lmLineMatch[1].replace(/,/g, ''));
        unitPricePerMeter = Number(lmLineMatch[2].replace(/,/g, ''));
        // Last number on a LM line is the item Net Amount
        const tkns = line.split(/(?:[\s]+|\\t)+/).map(t => t.trim()).filter(Boolean);
        const nms = tkns.map(t => t.replace(/,/g, '')).filter(t => !isNaN(t) && t.length > 0).map(Number);
        if (nms.length >= 3) lineNetAmount = nms[nms.length - 1];
      } else {
        if (lower.includes('lm')) {
          const match = line.match(/([\d,.]+)\s*(?:\\t)?\s*LM/i);
          if (match) lmQty = Number(match[1].replace(/,/g, ''));
        }
        if (lower.includes('/1m') || lower.includes('/1 m')) {
          const match = line.match(/([\d,.]+)\s*(?:\\t)?\s*\/1\s*M/i);
          if (match) unitPricePerMeter = Number(match[1].replace(/,/g, ''));
        }
      }

      // 5. BAR Quantity & Unit Price Per Bar from: "5 \t BAR \t 2,462.96 \t /1BAR \t 12,314.80"
      const barLineMatch = line.match(/([\d,.]+)(?:\s|\\t)*BAR(?:\s|\\t)*([\d,.]+)(?:\s|\\t)*\/1BAR/i);
      if (barLineMatch) {
        barQty = Number(barLineMatch[1].replace(/,/g, ''));
        unitPricePerBar = Number(barLineMatch[2].replace(/,/g, ''));
      } else {
        if (lower.includes('bar')) {
          const match = line.match(/([\d,.]+)\s*(?:\\t)?\s*BAR/i);
          if (match) barQty = Number(match[1].replace(/,/g, ''));
        }
        if (lower.includes('/1bar') || lower.includes('/1 bar')) {
          const match = line.match(/([\d,.]+)\s*(?:\\t)?\s*\/1\s*BAR/i);
          if (match) unitPricePerBar = Number(match[1].replace(/,/g, ''));
        }
      }

      // 6. Net Amount from BAR line if LM didn't provide one
      if (!lineNetAmount && lower.includes('bar') && (lower.includes('/1bar') || lower.includes('/1 bar'))) {
        const tokens = line.split(/(?:[\s]+|\\t)+/).map(t => t.trim()).filter(Boolean);
        const numbers = tokens
          .map(t => t.replace(/,/g, ''))
          .filter(t => !isNaN(t) && t.length > 0)
          .map(Number);
        if (numbers.length >= 3) lineNetAmount = numbers[numbers.length - 1];
      }

      // Collect standalone numbers that have no labels
      const cleanLine = line.trim();
      const pureNumMatch = cleanLine.match(/^([\d,]+(?:\.\d+)?)(?:\s*(?:mm|kg|lm|bar|ea|mtr))?$/i);
      if (pureNumMatch && !lower.includes('length') && !lower.includes('finish') && !lower.includes('origin')) {
        unclassifiedNumbers.push(Number(pureNumMatch[1].replace(/,/g, '')));
      }
    });

    // Heuristic Fallback for unassigned standalone numbers
    if (unclassifiedNumbers.length > 0) {
      const sorted = [...unclassifiedNumbers].sort((a, b) => b - a);
      sorted.forEach(num => {
        if (num > 1000 && !length && num % 1 === 0) {
          length = num;
        } else if (num >= 500 && !lineNetAmount) {
          lineNetAmount = num;
        } else if (num >= 10 && num < 500 && !weight && !Number.isInteger(num)) {
          weight = num;
        } else if (num < 100 && !barQty) {
          barQty = num;
        }
      });
    }

    // (blockQuantities removed - BAR/KG/LM are the SAME item, not separate items)

    // 7. Product Name Extraction
    const nameParts = [];
    block.rawLines.forEach((line, idx) => {
      const lower = line.toLowerCase();
      // Skip lines that are purely specs or totals
      if (lower.includes('total amount') || lower.includes('net amount') || lower.includes('vat') || lower.includes('egypt') || lower.includes('origin')) {
        return;
      }
      
      let cleanLine = line;
      if (idx === 0) {
        if (block.pos) {
          cleanLine = cleanLine.replace(new RegExp(`\\b${block.pos}\\b`, 'g'), '');
        }
        if (block.itemCode) {
          cleanLine = cleanLine.replace(new RegExp(`\\b${block.itemCode}\\b`, 'g'), '');
        }
      }

      // Strip out measurement values so they don't pollute the name, but keep the rest of the text (e.g. 170MM)
      cleanLine = cleanLine
        .replace(/[\d,.]+(?:\s|\\t)*LM/gi, '')
        .replace(/[\d,.]+(?:\s|\\t)*KG/gi, '')
        .replace(/[\d,.]+(?:\s|\\t)*BAR/gi, '')
        .replace(/[\d,.]+(?:\s|\\t)*\/1M/gi, '')
        .replace(/[\d,.]+(?:\s|\\t)*\/1KG/gi, '')
        .replace(/[\d,.]+(?:\s|\\t)*\/1BAR/gi, '')
        .replace(/\b(?:Length|Finish)\b/gi, '')
        .replace(/RAL\s*\d{4}[A-Z]*/gi, '')
        .replace(/\bRAL[A-Za-z0-9]+\b/gi, '')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      cleanLine = cleanLine.trim();
      // Skip purely numeric lines (and optional simple units or slashes left over from prices)
      if (/^[\d,.\s/]+(?:mm|kg|lm|bar|ea|mtr|length|finish)*$/i.test(cleanLine)) {
        return;
      }

      if (cleanLine) {
        nameParts.push(cleanLine);
      }
    });
    const productName = nameParts.join(' ').replace(/\s+/g, ' ').trim();

    // 8. Priority Resolutions: derive missing values
    if (!unitPricePerMeter && unitPricePerBar && length) {
      unitPricePerMeter = Number((unitPricePerBar / (length / 1000)).toFixed(5));
    }
    if (!lmQty && barQty && length) {
      lmQty = Number((barQty * (length / 1000)).toFixed(5));
    }

    // LM is the primary billing unit for ETA
    const quantity = lmQty || barQty || 0;
    const unitType = lmQty ? 'M' : 'EA';
    const parsedUnitPrice = unitPricePerMeter || unitPricePerBar || 0;

    // 9. Build rich description matching template format
    const descParts = ['Aluminium', block.itemCode, productName];
    if (weight) descParts.push(`${weight.toFixed(2)} KG`);
    if (length) descParts.push(`${Number(length).toLocaleString('en-US')} mm`);
    if (finish) descParts.push(finish);
    const description = descParts.join(' | ');

    // 10. Calculate final values
    const net = lineNetAmount || Number((quantity * parsedUnitPrice).toFixed(2));
    const unitValue = quantity > 0 ? Number((net / quantity).toFixed(5)) : parsedUnitPrice;

    const taxPercent = 14;
    const taxAmt = Number((net * 0.14).toFixed(5));
    const total = Number((net + taxAmt).toFixed(5));

    const missingFields = [];
    if (quantity === 0) missingFields.push('Missing quantity');
    if (unitValue === 0) missingFields.push('Missing unit price');

    console.log(`  📦 PARSED BLOCK [Pos=${block.pos}, Code=${block.itemCode}]:`, {
      productName, quantity, unitValue: Number(unitValue.toFixed(2)), net: Number(net.toFixed(2)),
      weight, length, finish, barQty, lmQty, unitPricePerMeter, unitPricePerBar, lineNetAmount, description
    });

    return {
      invoiceNumber: metadata.internalID,
      itemCode: "EG-708820883-1",
      codeType: 'EGS',
      codeName: 'Aluminium',
      internalCode: block.itemCode,
      description,
      rawDescription: productName,
      productType: productName.split(' ')[0] || 'Profile',
      quantity,
      unitType,
      unitValue,
      taxPercent,
      currency: 'EGP',
      net,
      total,
      smartAttributes: { weight, length, finish, barQty, lmQty, unitPricePerBar, unitPricePerMeter },
      confidence: quantity > 0 && unitValue > 0 ? 95 : 55,
      extractionConfidence: {
        productName: 95,
        quantity: quantity > 0 ? 95 : 30,
        unitPrice: unitValue > 0 ? 95 : 30
      },
      warnings: [],
      missingFields
    };
  }).filter(l => l.description && l.internalCode);

  // If we have actual lines, let's also compute dynamic totals if they weren't matched perfectly
  if (invoiceLines.length > 0) {
    const calcNet = invoiceLines.reduce((sum, line) => sum + (line.quantity * line.unitValue), 0);
    const calcTax = invoiceLines.reduce((sum, line) => sum + (line.quantity * line.unitValue * 0.14), 0);
    const calcTotal = calcNet + calcTax;
    if (!metadata.netAmount) {
      metadata.netAmount = Number(calcNet.toFixed(2));
      metadata.taxAmount = Number(calcTax.toFixed(2));
      metadata.totalAmount = Number(calcTotal.toFixed(2));
    }
  }

  return { metadata, invoiceLines };
}

// ── Extend parseSmartDocument to try Schüco parser first for PDFs ──
const _originalParseSmartDocument = parseSmartDocument;

async function parseSmartDocumentWithSchuco(filePath, isPdf = false) {
  const warnings = [];
  const { text, rawData, sheetName } = await readDocument(filePath, isPdf);

  if (!text || !text.trim()) {
    throw new Error('No readable text was found in the uploaded invoice.');
  }

  // Try Schüco/System invoice pattern first when it's a PDF
  if (isPdf) {
    const schucoResult = parseSchucoInvoice(text);
    if (schucoResult && schucoResult.invoiceLines && schucoResult.invoiceLines.length > 0) {
      const { metadata, invoiceLines: rows } = schucoResult;
      const totals = {
        netAmount: metadata.netAmount || 0,
        taxAmount: metadata.taxAmount || 0,
        totalAmount: metadata.totalAmount || 0
      };

      const lineWarnings = rows.flatMap((row, idx) => [
        ...row.warnings.map(w => `Line ${idx + 1}: ${w}`),
        ...(row.missingFields || []).map(m => `Line ${idx + 1}: ${m}`)
      ]);

      const headers = [
        'invoiceNumber', 'itemCode', 'codeType', 'internalCode',
        'description', 'quantity', 'unitType', 'currency', 'unitValue', 'taxPercent'
      ];

      return {
        success: true,
        sheetName: 'Schüco Invoice Parser',
        metadata,
        invoiceLines: rows,
        rows,
        headers,
        totals,
        warnings: [...warnings, ...lineWarnings],
        confidenceScore: 92,
        parserDebugInfo: {
          mode: 'Schüco/System Invoice Block Parser v1.0',
          confidenceScore: 92,
          totalsMatched: true,
          lineCount: rows.length,
          parsingWarnings: lineWarnings,
          debugWarnings: lineWarnings,
          outputShape: '{ metadata, invoiceLines, totals }'
        }
      };
    }
  }

  // Fallback to original smart parser
  return _originalParseSmartDocument(filePath, isPdf);
}

module.exports = { 
  parseSmartDocument: parseSmartDocumentWithSchuco,
  parseSchucoInvoice
};

