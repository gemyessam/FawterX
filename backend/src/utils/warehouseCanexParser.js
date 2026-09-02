const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

function clean(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function parseNum(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function parseCanexDate(value) {
  const text = clean(value);
  if (!text) return "";
  const monthMap = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };
  const named = text.match(/^(\d{1,2})\s*[-/\s]\s*([A-Za-z]{3,})\.?\s*[-/\s]\s*(\d{4})$/);
  if (named) {
    const dd = named[1].padStart(2, "0");
    const mm = monthMap[named[2].slice(0, 3).toLowerCase()];
    if (mm) return `${named[3]}-${mm}-${dd}`;
  }
  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const dMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dMatch) {
    return `${dMatch[3]}-${dMatch[2].padStart(2, '0')}-${dMatch[1].padStart(2, '0')}`;
  }
  return text;
}

const KNOWN_LABELS = [
  "commercial invoice",
  "invoice #",
  "invoice date",
  "delivery date",
  "receipt date",
  "sales order",
  "customer reference",
  "customer ref",
  "purchase order",
  "po #",
  "cust ref",
  "currency",
  "invoice amount",
  "tax amount",
  "total amount",
  "description",
  "item code",
  "item number",
  "external",
  "configuration",
  "size",
  "color",
  "warehouse (bars)",
  "warehouse",
  "customer",
  "customer code",
  "bars",
  "quantity",
  "unit price",
  "amount",
  "delivery term",
  "delivery terms",
  "payment term",
  "payment terms",
  "inquiry date",
  "buyer",
  "seller"
];

// Values that should NEVER be captured as metadata field values (delivery terms, payment terms, etc.)
const DISCARD_VALUES = [
  /^ex\s*work(s)?$/i,
  /^fob$/i,
  /^cif$/i,
  /^cfr$/i,
  /^ddp$/i,
  /^dap$/i,
  /^fca$/i,
  /^exw$/i,
  /^cash\s*on\s*delivery$/i,
  /^cod$/i,
  /^net\s*\d+$/i,
  /^prepaid$/i,
  /^(buyer|seller)$/i,
];

function isKnownLabel(str) {
  if (!str) return true;
  const s = String(str).trim().toLowerCase().replace(/^[:,#\t\s]+|[:,#\t\s]+$/g, "");
  if (!s) return true;
  return KNOWN_LABELS.some(label => s === label || label.startsWith(s + " ") || s.startsWith(label + " "));
}

function sanitizeMetaValue(val) {
  if (!val) return "";
  let cleaned = clean(val).replace(/^[:,#\t\s,]+|[:,#\t\s,]+$/g, "").trim();
  if (!cleaned) return "";
  if (/^[:#]/.test(cleaned)) return "";

  // 1. Strip trailing label headers first if multiple fields exist on the same line (e.g. "Q-00235 Inquiry Date: 26 Feb")
  const splitLabelsRegex = /(?:Inquiry Date|Payment Term|Payment Terms|Delivery Term|Delivery Terms|Commercial Invoice|Sales Order|Delivery Date|Invoice Date|Receipt Date|Buyer|Seller|Customer Reference|Customer Ref|Cust Ref|PO #|Purchase Order|Total Amount|Tax Amount|Invoice Amount|Currency|Description|Item Code|Customer Code)/i;
  cleaned = cleaned.split(splitLabelsRegex)[0].trim();
  cleaned = cleaned.replace(/^[:,#\t\s,]+|[:,#\t\s,]+$/g, "").trim();

  // 2. Handle leftover colon prefixes if any exist (e.g. "Ref: Q-00235" or "Delivery Term: EX Work")
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    const prefix = clean(parts[0]).toLowerCase();
    if (prefix.length <= 20 && (/erence|rence|reference|order|date|invoice|ref|cust|so|po|deliver|payment|term|inquiry/i.test(prefix) || KNOWN_LABELS.some(l => l.includes(prefix)))) {
      cleaned = clean(parts.slice(1).join(":")).replace(/^[:,#\t\s,]+|[:,#\t\s,]+$/g, "").trim();
    }
  }

  if (!cleaned) return "";
  const lower = cleaned.toLowerCase();

  // Explicit label fragments or single-word label matches to discard
  if (/^(erence|rence|reference|ref|order|invoice|date|customer)$/i.test(lower)) {
    return "";
  }

  // Discard known delivery/payment term values or dates
  if (/\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/i.test(cleaned)) return "";

  // Discard addresses, locations, cities, countries, building numbers, and company register lines
  if (/\b(egypt|cairo|giza|alexandria|kenya|saudi|uae|germany|kuwait|qatar|jordan|lebanon|smart village|village|building|bldg|street|st\.|plot|governorate|district|floor|flr|avenue|ave|road|rd|po box|p\.o\.|postal|zip|industrial|cr no|tax id|buyer register|seller register|register details)\b/i.test(cleaned)) return "";
  if (/^\d+[a-z]?[\s,]/i.test(cleaned) && (cleaned.includes(",") || /giza|cairo|village|street|building/i.test(cleaned))) return "";
  if (/^\d{3}-\d{3}-\d{3}$/.test(cleaned) || /^\+?\d[\d\s-]{8,}$/.test(cleaned)) return "";

  for (const pattern of DISCARD_VALUES) {
    if (pattern.test(cleaned)) return "";
  }

  for (const label of KNOWN_LABELS) {
    if (lower === label || lower === `:${label}` || lower === `${label}:`) return "";
  }
  return cleaned;
}

function isValidInvoiceNumber(cand) {
  if (!cand) return false;
  const s = String(cand).trim().toLowerCase();
  if (!s || isKnownLabel(s) || s.length > 40) return false;
  if (/\b(egypt|cairo|giza|alexandria|kenya|saudi|uae|germany|schueco|canex|supplier|buyer|seller|smart village|building|street|governorate|district|industrial)\b/i.test(s)) return false;
  if (!/\d/.test(s) && !/[-/]/.test(s)) return false;
  return true;
}

function extractHeaderBlockPairs(text) {
  const pairs = {};
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);

  const keyPatterns = [
    { key: "invoiceNumber", regex: /Commercial\s*Invoice\s*#/i },
    { key: "invoiceDate", regex: /Commercial\s*Invoice\s*Date/i },
    { key: "salesOrder", regex: /Sales\s*Order\s*#/i },
    { key: "customerReference", regex: /Customer\s*Reference/i },
    { key: "inquiryDate", regex: /Inquiry\s*Date/i }
  ];

  // A key line is purely a label if it does NOT contain a value after the label/colon
  const isPureLabelLine = (line, regex) => {
    const match = line.match(regex);
    if (!match) return false;
    const after = line.slice(match.index + match[0].length).replace(/^[:\s,#]+/, "").trim();
    return after.length === 0;
  };

  // Find line indices of each key that is a PURE label (no inline value)
  const foundKeys = [];
  keyPatterns.forEach(kp => {
    const idx = lines.findIndex(l => isPureLabelLine(l, kp.regex));
    if (idx !== -1) foundKeys.push({ key: kp.key, lineIdx: idx });
  });

  // Sort found keys by line index
  foundKeys.sort((a, b) => a.lineIdx - b.lineIdx);

  // If we found at least 3 pure label keys consecutively stacked
  if (foundKeys.length >= 3) {
    const lastKeyLineIdx = foundKeys[foundKeys.length - 1].lineIdx;
    const valueStartIdx = lastKeyLineIdx + 1;

    foundKeys.forEach((fk, offset) => {
      const valLine = lines[valueStartIdx + offset];
      if (valLine) {
        const sanitized = sanitizeMetaValue(valLine);
        if (sanitized && !keyPatterns.some(kp => kp.regex.test(valLine))) {
          pairs[fk.key] = sanitized;
        }
      }
    });
  }

  return pairs;
}

function extractLabelValue(text, labelVariants) {
  for (const label of labelVariants) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: Same line (supports colons, tabs, commas, spaces)
    const regexSameLine = new RegExp(`(?:\\b|_)${escapedLabel}(?:\\b|_)?\\s*[:,\t]*\\s*([^\\r\\n]+)`, 'i');
    const matchSame = text.match(regexSameLine);
    if (matchSame) {
      const cand = sanitizeMetaValue(matchSame[1]);
      if (cand) return cand;
    }

    // Pattern 2: Subsequent line(s) / Column-block layout
    const regexIdx = new RegExp(`(?:\\b|_)${escapedLabel}(?:\\b|_)?`, 'i');
    const matchIdx = text.match(regexIdx);
    if (matchIdx) {
      const idx = matchIdx.index;
      const afterText = text.slice(idx + matchIdx[0].length);
      const afterLines = afterText.split(/\r?\n/).map(clean).filter(Boolean);

      if (afterLines.length > 0) {
        if (!isKnownLabel(afterLines[0]) && !afterLines[0].endsWith(":") && !/^[:#]/.test(afterLines[0])) {
          // Direct next line is a value!
          const cand = sanitizeMetaValue(afterLines[0]);
          if (cand) return cand;
        }
      }
    }
  }
  return "";
}

function extractMetadata(text, fileName) {
  // ============================================================
  // CANEX METADATA PARSER (v2.24.6)
  // - Invoice Number: CNX3-XXXXXX
  // - Sales Order #: Canex Supplier SO (high-range SO-008XXX / SO-007XXX)
  // - Customer Reference: Customer/Schueco Ref (Q-codes, SP-codes,
  //   lower SO-codes like SO-00180, stock/sample names, Arabic phrases)
  // ============================================================

  // 0. Check for 2-column stacked header block pairs
  const blockPairs = extractHeaderBlockPairs(text);

  // 1. Extract Invoice Number (CNX pattern takes highest priority, then valid blockPairs/label values)
  const cnxMatches = (text.match(/\bCNX[A-Za-z0-9_-]*-\d{3,}\b/gi) || text.match(/\bCNX\d*-\d{3,}\b/gi) || []).map(clean);
  let invoiceNumber = "";
  if (cnxMatches.length > 0) {
    invoiceNumber = cnxMatches[0];
  } else {
    const cand = clean(blockPairs.invoiceNumber || extractLabelValue(text, [
      "Commercial Invoice #:", "Commercial Invoice #", "Invoice #:", "Invoice #", "Invoice No:", "Commercial Invoice"
    ]));
    if (isValidInvoiceNumber(cand)) {
      invoiceNumber = cand;
    }
  }

  if (!isValidInvoiceNumber(invoiceNumber)) {
    const backupMatch = text.match(/\b(CNX|INV)[A-Za-z0-9_-]{3,}\b/gi)?.[0];
    if (backupMatch && isValidInvoiceNumber(backupMatch)) {
      invoiceNumber = clean(backupMatch);
    } else {
      invoiceNumber = "";
    }
  }

  // 2. Extract Sales Order (Canex Supplier SO)
  const allSOCodes = (text.match(/\bSO-\d{3,}\b/gi) || []).map(clean);
  let directSO = blockPairs.salesOrder || extractLabelValue(text, [
    "Sales Order #:", "Sales Order #", "Sales Order:", "Sales Order",
    "S.O. #:", "S.O. #", "SO #:", "SO #"
  ]);

  let salesOrder = "";
  if (directSO && /^SO-/i.test(directSO)) {
    salesOrder = directSO;
  } else {
    // Canex SO numbers are in the higher range (SO-008XXX, SO-007XXX, or >= 1000)
    salesOrder = allSOCodes.find(code => {
      const num = parseInt(code.replace(/\D/g, ""), 10);
      return num >= 1000;
    }) || allSOCodes[0] || "";
  }

  // 3. Extract Customer Reference
  // Priority A: Stacked block pair or direct label value
  let customerReference = blockPairs.customerReference || extractLabelValue(text, [
    "Customer Reference:", "Customer Reference", "Customer Ref:", "Customer Ref",
    "Cust. Ref:", "Cust Ref", "Client Ref:", "Client Ref",
    "Purchase Order:", "Purchase Order #:", "PO #:", "PO #"
  ]);

  // Priority B: Standalone Q-codes (e.g. Q-00235)
  if (!customerReference || isKnownLabel(customerReference)) {
    const qMatch = text.match(/\bQ-?\d{3,}[A-Za-z0-9_-]*\b/i)?.[0];
    if (qMatch) {
      customerReference = clean(qMatch);
    } else {
      // Priority C: Standalone SP-codes (e.g. SP-00120)
      const spMatch = text.match(/\bSP-?\d{3,}[A-Za-z0-9_-]*\b/i)?.[0];
      if (spMatch) {
        customerReference = clean(spMatch);
      } else {
        // Priority D: Customer SO code (lower range like SO-00180) that is different from salesOrder
        const customerSOCode = allSOCodes.find(code => code.toUpperCase() !== salesOrder.toUpperCase());
        if (customerSOCode) {
          customerReference = customerSOCode;
        } else {
          // Priority E: Known Stock / Sample names
          const stockMatch = text.match(/\b(Schueco Egypt Samples|Schueco Egypt Stock|Warehouse|Samples|Stock)\b/i)?.[0];
          if (stockMatch) {
            customerReference = clean(stockMatch);
          }
        }
      }
    }
  }

  // 4. Strict Sanitization & Exclusion Filters for Customer Reference
  if (customerReference) {
    customerReference = sanitizeMetaValue(customerReference);
    // Block any invoice number leak (e.g. CNX3-..., CNX$-...)
    if (/^CNX[\$30-9]?-/i.test(customerReference) || customerReference.toLowerCase() === invoiceNumber.toLowerCase()) {
      customerReference = "";
    }
    // Block duplicate of salesOrder
    if (salesOrder && customerReference.toUpperCase() === salesOrder.toUpperCase()) {
      customerReference = "";
    }
  }

  // 5. Dates & Financial Totals
  const allDates = text.match(/\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/g) || [];
  const invoiceDateStr = blockPairs.invoiceDate || text.match(/Commercial Invoice Date:[\s\S]*?(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i)?.[1] || allDates[0] || "";
  const deliveryDateStr = text.match(/Delivery Date:[\s\S]*?(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i)?.[1] || (allDates.length >= 3 ? allDates[2] : allDates[allDates.length - 1]) || "";

  const currencyMatch = text.match(/\b(EGP|USD|EUR|GBP|SAR|AED|KWD)\b/i);
  const currency = clean(currencyMatch?.[1]?.toUpperCase()) || "EGP";

  const invoiceAmount = parseNum(text.match(/Invoice Amount\s+([\d,]+\.?\d*)/i)?.[1]);
  const taxAmount = parseNum(text.match(/Tax Amount\s+([\d,]+\.?\d*)/i)?.[1]);
  const totalAmount = parseNum(text.match(/Total Amount\s+([\d,]+\.?\d*)/i)?.[1]);

  console.log("[CanexParser] Final Extracted:", {
    invoiceNumber,
    salesOrder,
    customerReference
  });

  return {
    invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
    invoiceDate: parseCanexDate(invoiceDateStr),
    receiptDate: parseCanexDate(deliveryDateStr),
    deliveryDate: parseCanexDate(deliveryDateStr),
    supplier: "Canex",
    currency,
    salesOrder: salesOrder || "",
    customerReference: customerReference || "",
    invoiceAmount,
    taxAmount,
    totalAmount,
    fileName,
  };
}

function extractDescriptionAttrs(description) {
  const text = clean(description);
  const lengthMatch = text.match(/length\s*:\s*([\d,.]+)\s*(m|meter|meters|mm)\b/i);
  const lengthValue = parseNum(lengthMatch?.[1]);
  const lengthUnit = (lengthMatch?.[2] || "m").toLowerCase();
  const lengthMm = lengthUnit === "mm" ? lengthValue : lengthValue * 1000;
  const finish = clean(text.match(/surface\s*finish\s*:\s*([^,\n]+)/i)?.[1]) || "MF";
  const temper = clean(text.match(/temper\s*:\s*([^,\n]+)/i)?.[1]);
  const alloy = clean(text.match(/alloy\s*:\s*([^,\n]+)/i)?.[1]);
  const hsCode = clean(text.match(/HS\s*Code\s*:\s*([0-9.]+)/i)?.[1]);

  return {
    lengthMm: lengthMm || 6000,
    finish: finish || "MF",
    temper,
    alloy,
    hsCode,
  };
}

function splitTwoDecimalNumbers(value) {
  const text = String(value || "");
  const results = [];
  for (let i = 0; i < text.length - 1; i += 1) {
    const left = text.slice(0, i + 1);
    const right = text.slice(i + 1);
    if (/^\d[\d,]*\.\d{2}$/.test(left) && /^\d[\d,]*\.\d{2}$/.test(right)) {
      results.push([parseNum(left), parseNum(right)]);
    }
  }
  return results;
}

function parseCompactQuantityLine(line, lengthMm) {
  const compact = clean(line).replace(/\s+/g, "");
  const match = compact.match(/^(\d[\d,.\-]*)([A-Za-z]+)(\d[\d,.\-]*)$/);
  if (!match) return null;

  const beforeUnit = match[1];
  const unit = match[2];
  const afterUnit = match[3];
  const lengthM = Number(lengthMm || 0) / 1000 || 0;
  let best = null;

  for (let prefixLen = 1; prefixLen <= Math.min(5, beforeUnit.length - 6); prefixLen += 1) {
    const bars = parseNum(beforeUnit.slice(0, prefixLen));
    if (!bars) continue;
    const beforeRest = beforeUnit.slice(prefixLen);
    const leftCandidates = splitTwoDecimalNumbers(beforeRest);
    const rightCandidates = splitTwoDecimalNumbers(afterUnit);

    leftCandidates.forEach(([barPrice, lmQty]) => {
      rightCandidates.forEach(([unitPrice, amount]) => {
        const expectedLm = lengthM ? bars * lengthM : lmQty;
        const expectedAmount = lmQty * unitPrice;
        const score =
          Math.abs(lmQty - expectedLm) +
          Math.abs(amount - expectedAmount) / Math.max(1, amount);
        const candidate = { bars, barPrice, lmQty, unit, unitPrice, amount, score };
        if (!best || candidate.score < best.score) best = candidate;
      });
    });
  }

  return best;
}

function matchLineStart(lineStr) {
  let m = lineStr.match(/^(\d+)(\d{3}-\d{6})(\d{3,})(.+)$/);
  if (m) return { position: m[1], itemCode: m[2], customerCode: m[3], rest: m[4] };
  m = lineStr.match(/^(\d+)\s+([A-Za-z0-9_-]+-\d+|[A-Za-z0-9_-]{5,})\s+(\d{3,})\s+(.+)$/);
  if (m) return { position: m[1], itemCode: m[2], customerCode: m[3], rest: m[4] };
  m = lineStr.match(/^(\d+)\s+([A-Za-z0-9_-]+-\d+|[A-Za-z0-9_-]{5,})\s+(.+)$/);
  if (m) return { position: m[1], itemCode: m[2], customerCode: "", rest: m[3] };
  return null;
}

function parseTextLines(text, metadata) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const parsed = [];

  for (let i = 0; i < lines.length; i += 1) {
    const matchedStart = matchLineStart(lines[i]);
    if (!matchedStart) continue;

    const { position, itemCode, customerCode } = matchedStart;
    const descParts = [matchedStart.rest];
    let qtyLine = "";

    for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
      const candidate = lines[j];
      if (matchLineStart(candidate) || /^Invoice Amount/i.test(candidate)) break;
      if (/\d[\d,.\-]*[A-Za-z]+\d[\d,.\-]*$/.test(candidate.replace(/\s+/g, ""))) {
        qtyLine = candidate;
        i = j;
        break;
      }
      descParts.push(candidate);
    }

    const description = clean(descParts.join(" "));
    const attrs = extractDescriptionAttrs(description);
    const qty = parseCompactQuantityLine(qtyLine, attrs.lengthMm);
    if (!qty) continue;

    parsed.push({
      id: `line_${position}`,
      position,
      itemCode,
      customerCode,
      description,
      finish: attrs.finish || "MF",
      color: attrs.finish || "MF",
      lengthMm: attrs.lengthMm,
      quantityBar: qty.bars,
      quantityLm: qty.lmQty,
      quantityKg: 0,
      unit: "BAR",
      priceUnit: qty.unit.toLowerCase() === "m" ? "M" : qty.unit.toUpperCase(),
      unitPrice: qty.unitPrice,
      barPrice: qty.barPrice,
      netTotal: qty.amount,
      currency: metadata.currency || "EGP",
      temper: attrs.temper,
      alloy: attrs.alloy,
      hsCode: attrs.hsCode,
      isService: false,
      ignored: false,
    });
  }

  return parsed;
}

function rowValue(row, names) {
  for (const name of names) {
    const found = Object.keys(row).find(key => clean(key).toLowerCase().includes(name));
    if (found && row[found] !== undefined && row[found] !== "") return row[found];
  }
  return "";
}

function parseSizeToLengthMm(sizeVal) {
  const str = clean(sizeVal);
  if (!str) return 6000;
  // Format like "6000-101", "5800-101", "3100-101", "6000mm", "5.8m"
  const m = str.match(/^(\d{3,5})/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1000 && n <= 12000) return n;
  }
  const meterMatch = str.match(/^(\d+(?:\.\d+)?)\s*m\b/i);
  if (meterMatch) {
    return Math.round(Number(meterMatch[1]) * 1000);
  }
  return 6000;
}

function parseConfiguration(configVal) {
  const str = clean(configVal);
  const temper = str.match(/\bT[456]\b/i)?.[0]?.toUpperCase() || "T6";
  const alloy = str.match(/\b606[03]\b/)?.[0] || "6063";
  return { temper, alloy };
}

function scanMatrixForMetadata(matrix) {
  const meta = {
    salesOrder: "",
    customerReference: "",
    invoiceNumber: "",
  };

  const allSOCodes = [];
  const allQCodes = [];
  const allSPCodes = [];

  const maxRows = Math.min(matrix.length, 35);
  for (let r = 0; r < maxRows; r++) {
    const row = matrix[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cellVal = clean(row[c]);
      if (!cellVal) continue;

      const soMatches = cellVal.match(/\bSO-\d{3,}\b/gi);
      if (soMatches) soMatches.forEach(m => allSOCodes.push(clean(m)));

      const qMatches = cellVal.match(/\bQ-?\d{3,}[A-Za-z0-9_-]*\b/gi);
      if (qMatches) qMatches.forEach(m => allQCodes.push(clean(m)));

      const spMatches = cellVal.match(/\bSP-?\d{3,}[A-Za-z0-9_-]*\b/gi);
      if (spMatches) spMatches.forEach(m => allSPCodes.push(clean(m)));

      // 1. Check Sales Order labels
      if (/sales\s*order|s\.o\./i.test(cellVal)) {
        // If inline value after colon exists
        const inline = cellVal.replace(/^.*?(?:sales\s*order|s\.o\.)[#:\s]*/i, "").trim();
        if (inline && /^SO-/i.test(inline)) {
          meta.salesOrder = inline;
        } else {
          // Check rightward cells in same row
          for (let offset = 1; offset <= 4; offset++) {
            const nextVal = clean(row[c + offset]);
            if (nextVal && !isKnownLabel(nextVal)) {
              const sanitized = sanitizeMetaValue(nextVal);
              if (sanitized && /^SO-/i.test(sanitized)) {
                meta.salesOrder = sanitized;
                break;
              }
            }
          }
          // Check cell below
          if (!meta.salesOrder && matrix[r + 1]) {
            const belowVal = clean(matrix[r + 1][c]) || clean(matrix[r + 1][c + 1]);
            if (belowVal && !isKnownLabel(belowVal)) {
              const sanitized = sanitizeMetaValue(belowVal);
              if (sanitized && /^SO-/i.test(sanitized)) {
                meta.salesOrder = sanitized;
              }
            }
          }
        }
      }

      // 2. Check Customer Reference labels
      if (/customer\s*ref|cust\.?\s*ref|purchase\s*order|po\s*#/i.test(cellVal)) {
        const inline = cellVal.replace(/^.*?(?:customer\s*ref(?:erence)?|cust\.?\s*ref|po\s*#)[#:\s]*/i, "").trim();
        if (inline && !isKnownLabel(inline)) {
          const sanitized = sanitizeMetaValue(inline);
          if (sanitized) meta.customerReference = sanitized;
        } else {
          // Check rightward cells
          for (let offset = 1; offset <= 4; offset++) {
            const nextVal = clean(row[c + offset]);
            if (nextVal && !isKnownLabel(nextVal)) {
              const sanitized = sanitizeMetaValue(nextVal);
              if (sanitized) {
                meta.customerReference = sanitized;
                break;
              }
            }
          }
          // Check cell below
          if (!meta.customerReference && matrix[r + 1]) {
            const belowVal = clean(matrix[r + 1][c]) || clean(matrix[r + 1][c + 1]);
            if (belowVal && !isKnownLabel(belowVal)) {
              const sanitized = sanitizeMetaValue(belowVal);
              if (sanitized) {
                meta.customerReference = sanitized;
              }
            }
          }
        }
      }
    }
  }

  // Fallbacks:
  if (!meta.salesOrder || !/^SO-/i.test(meta.salesOrder)) {
    const highSO = allSOCodes.find(code => {
      const num = parseInt(code.replace(/\D/g, ""), 10);
      return num >= 1000;
    }) || allSOCodes[0];
    if (highSO) meta.salesOrder = highSO;
  }

  if (!meta.customerReference || isKnownLabel(meta.customerReference)) {
    if (allQCodes.length > 0) {
      meta.customerReference = allQCodes[0];
    } else if (allSPCodes.length > 0) {
      meta.customerReference = allSPCodes[0];
    } else {
      const customerSO = allSOCodes.find(code => code.toUpperCase() !== (meta.salesOrder || "").toUpperCase());
      if (customerSO) {
        meta.customerReference = customerSO;
      }
    }
  }

  return meta;
}

function parseWorkbook(filePath, fileName) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  let sheetText = "";
  try {
    if (XLSX.utils.sheet_to_txt) {
      sheetText = XLSX.utils.sheet_to_txt(sheet);
    }
    if (!sheetText && XLSX.utils.sheet_to_csv) {
      sheetText = XLSX.utils.sheet_to_csv(sheet);
    }
  } catch (e) {
    sheetText = "";
  }

  let metadata = extractMetadata(sheetText, fileName);
  if (!metadata.invoiceNumber || metadata.invoiceNumber.startsWith("INV-")) {
    const fnameNoExt = path.basename(fileName, path.extname(fileName));
    if (/CNX/i.test(fnameNoExt)) metadata.invoiceNumber = fnameNoExt;
  }

  // Scan 2D matrix for labels & codes across grid
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const matrixMeta = scanMatrixForMetadata(matrix);

  if (matrixMeta.salesOrder && (!metadata.salesOrder || !/^SO-/i.test(metadata.salesOrder))) {
    metadata.salesOrder = matrixMeta.salesOrder;
  }
  if (matrixMeta.customerReference && (!metadata.customerReference || isKnownLabel(metadata.customerReference))) {
    metadata.customerReference = matrixMeta.customerReference;
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const lines = rows
    .map((row, idx) => {
      // 1. Item Code: support "item number", "item code", "item", "code", "profile"
      const itemCode = clean(rowValue(row, ["item number", "item code", "item", "code", "profile"]));
      if (!itemCode || /invoice amount|tax amount|total amount/i.test(itemCode)) return null;

      // 2. Customer Code / External: support "external", "customer code", "cust code", "schueco code"
      const customerCode = clean(rowValue(row, ["external", "customer code", "cust code", "schueco code"]));

      // 3. Bars Quantity: support "warehouse (bars)", "bars", "qty bar", "bar qty", "quantity", "qty", "أعواد"
      const qtyBar = parseNum(rowValue(row, ["warehouse (bars)", "bars", "qty bar", "bar qty", "quantity", "qty", "أعواد"]));

      // 4. Description & Attributes:
      let description = clean(rowValue(row, ["description"]));
      const attrs = description ? extractDescriptionAttrs(description) : {};

      // Size / Length:
      const sizeVal = rowValue(row, ["size", "length"]);
      const lengthMm = attrs.lengthMm || parseSizeToLengthMm(sizeVal);

      // Temper & Alloy:
      const configVal = rowValue(row, ["configuration", "temper"]);
      const parsedConfig = configVal ? parseConfiguration(configVal) : {};
      const temper = attrs.temper || parsedConfig.temper || "T6";
      const alloy = attrs.alloy || parsedConfig.alloy || "6063";

      // Color / Finish:
      const color = clean(rowValue(row, ["color", "surface finish", "finish"])) || attrs.finish || "MF";
      const finish = color;

      // If description was missing in tabular format, construct an informative description:
      if (!description) {
        description = `Canex Profile ${itemCode}${customerCode ? ' (' + customerCode + ')' : ''} - ${temper} ${alloy} ${color}`;
      }

      // Per-row SO and Customer Ref (if present in tabular sheets):
      const rowSO = clean(rowValue(row, ["sales order", "so #", "so"]));
      const rowRef = clean(rowValue(row, ["customer reference", "customer ref", "cust ref", "ref"]));

      const unitPrice = parseNum(rowValue(row, ["unit price"]));
      const qtyLm = parseNum(rowValue(row, ["actual total", "qty lm", "total lm"])) || ((qtyBar * lengthMm) / 1000);

      return {
        id: `line_${idx + 1}`,
        position: idx + 1,
        itemCode,
        customerCode,
        description,
        finish,
        color,
        lengthMm,
        quantityBar: qtyBar,
        quantityLm: Number(qtyLm.toFixed(2)),
        quantityKg: 0,
        unit: "BAR",
        priceUnit: "M",
        unitPrice,
        barPrice: parseNum(rowValue(row, ["bar price"])),
        netTotal: parseNum(rowValue(row, ["amount"])) || Number((qtyLm * unitPrice).toFixed(2)),
        currency: "EGP",
        temper,
        alloy,
        hsCode: attrs.hsCode || "7604.21.00",
        salesOrder: rowSO || "",
        customerReference: rowRef || "",
        isService: false,
        ignored: false,
      };
    })
    .filter(line => line && line.itemCode && Number(line.quantityBar) > 0);

  // If document-level SO / Ref was empty or a known label, but line items contain them, populate document metadata:
  if ((!metadata.salesOrder || isKnownLabel(metadata.salesOrder)) && lines.length > 0) {
    const firstLineSO = lines.find(l => l.salesOrder && !isKnownLabel(l.salesOrder))?.salesOrder;
    if (firstLineSO) metadata.salesOrder = firstLineSO;
  }
  if ((!metadata.customerReference || isKnownLabel(metadata.customerReference)) && lines.length > 0) {
    const firstLineRef = lines.find(l => l.customerReference && !isKnownLabel(l.customerReference))?.customerReference;
    if (firstLineRef) metadata.customerReference = firstLineRef;
  }

  return { metadata, lines };
}

function parseSchuecoDate(val) {
  const m = clean(val).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

function parseSchuecoDeliveryNote(text, fileName) {
  const isSchuecoSD = /packing\s*list/i.test(text) && (/\bSD-\d+/i.test(text) || /Delivery\s*Number/i.test(text) || /sch[uü]co/i.test(text));
  if (!isSchuecoSD) return null;

  // 1. Metadata
  const sdNumberMatch = text.match(/\bSD-\d+\b/i)?.[0];
  const invoiceNumber = sdNumberMatch || `SD-${Date.now().toString().slice(-6)}`;
  const soMatch = text.match(/\bSO-\d{3,}\b/i)?.[0] || "";

  const dateMatch = text.match(/\b(\d{1,2}\.\d{1,2}\.\d{4})\b/)?.[1] || "";
  const invoiceDate = parseSchuecoDate(dateMatch);

  let customerReference = "";
  const sotaluxMatch = text.match(/\b(Sotalux|Schueco|Canex|[A-Z][a-z]{3,}\s*(?:LLC|L\.L\.C\.|SARL)?)\b/i)?.[1];
  if (sotaluxMatch && !/packing|schueco|egypt|village/i.test(sotaluxMatch)) {
    customerReference = sotaluxMatch;
  }
  if (!customerReference) {
    customerReference = soMatch || "Schüco Client";
  }

  const metadata = {
    invoiceNumber,
    invoiceDate,
    receiptDate: invoiceDate,
    deliveryDate: invoiceDate,
    supplier: "Schüco Egypt",
    currency: "EGP",
    salesOrder: soMatch,
    customerReference,
    invoiceAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    movementType: "outbound", // Delivery notes are outbound shipments by nature
    fileName,
  };

  // 2. Lines parsing
  const lines = [];
  const textLines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const lineItemRegex = /^(\d+)\s+(\d{5,8}|[A-Za-z0-9_-]{5,})\s+(.+?)\s+(\d+[\d,]*)\s*BAR\s+([\d,.]+)\s*LM\s+([\d,.]+)\s*KG\s+([\d,.]+)/i;

  for (let i = 0; i < textLines.length; i++) {
    const m = textLines[i].match(lineItemRegex);
    if (!m) continue;

    const position = Number(m[1]);
    const itemCode = clean(m[2]);
    const description = clean(m[3]);
    const qtyBar = parseNum(m[4]);
    const qtyLm = parseNum(m[5]);
    const qtyKg = parseNum(m[6]);
    const lengthM = parseNum(m[7]);
    const lengthMm = Math.round(lengthM * 1000) || 5800;

    let finish = "MF";
    if (textLines[i + 1] && !textLines[i + 1].match(lineItemRegex) && !/packing|schueco|total|page/i.test(textLines[i + 1])) {
      const candidateFinish = textLines[i + 1];
      if (candidateFinish.length <= 25) {
        finish = candidateFinish;
      }
    }

    lines.push({
      id: `line_${position}`,
      position,
      itemCode,
      customerCode: itemCode,
      description: `${description} (${finish} - ${lengthMm}mm)`,
      finish,
      color: finish,
      lengthMm,
      quantityBar: qtyBar,
      quantityLm: qtyLm,
      quantityKg: qtyKg,
      unit: "BAR",
      priceUnit: "M",
      unitPrice: 0,
      barPrice: 0,
      netTotal: 0,
      currency: "EGP",
      temper: "T6",
      alloy: "6063",
      hsCode: "7604.21.00",
      salesOrder: soMatch,
      customerReference,
      isService: false,
      ignored: false,
    });
  }

  return { metadata, lines };
}

async function readPdfText(filePath) {
  let pdfParseModule;
  try {
    pdfParseModule = require("pdf-parse");
  } catch (error) {
    throw new Error("PDF parsing dependency is not installed.");
  }

  const dataBuffer = fs.readFileSync(filePath);
  if (typeof pdfParseModule === "function") {
    const pdfData = await pdfParseModule(dataBuffer);
    return pdfData.text || "";
  }
  if (pdfParseModule && pdfParseModule.PDFParse) {
    const pdfInstance = new pdfParseModule.PDFParse({ data: dataBuffer });
    const parsed = await pdfInstance.getText();
    return parsed.text || "";
  }
  return "";
}

async function parseWarehouseInvoice(filePath, originalName = "") {
  const ext = path.extname(originalName || filePath).toLowerCase();
  if (ext === ".pdf") {
    const text = await readPdfText(filePath);
    if (!text.trim()) throw new Error("No readable text was found in the warehouse invoice.");

    // Check if Schüco Delivery Note / Packing List
    const schuecoResult = parseSchuecoDeliveryNote(text, originalName);
    if (schuecoResult && schuecoResult.lines.length > 0) {
      return {
        ...schuecoResult,
        warnings: [],
        parser: "schueco-delivery-note-pdf-v1",
      };
    }

    const metadata = extractMetadata(text, originalName);
    const lines = parseTextLines(text, metadata);
    return {
      metadata,
      lines,
      warnings: lines.length ? [] : ["No Canex stock lines were detected."],
      parser: "canex-warehouse-pdf-v1",
    };
  }

  return { ...parseWorkbook(filePath, originalName), warnings: [], parser: "canex-warehouse-excel-v1" };
}

module.exports = { parseWarehouseInvoice, extractMetadata };
