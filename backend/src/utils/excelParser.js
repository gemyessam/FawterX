const XLSX = require("xlsx");

// كلمات مفتاحية للبحث عن صف العناوين (Headers) باللغتين الإنجليزية والعربية
const HEADER_KEYWORDS = [
  "pos", "item", "no", "description", "quantity", "qty", "unit", "measure", "measurement",
  "price", "tax", "vat", "amount", "total", "code", "currency", "internal",
  "الصنف", "الوصف", "الكمية", "السعر", "الوحدة", "الضريبة", "الاجمالي", "رقم", "العملة"
];

// كلمات مفتاحية تدل على نهاية الجدول أو صفوف التعريف
const FOOTER_KEYWORDS = [
  "total", "net", "subtotal", "الإجمالي", "الصافي", "المجموع", 
  "issuer", "receiver", "documenttype", "datetimeissued", "taxpayeractivitycode", "internalid",
  "supplier", "vendor", "customer"
];

function isHeaderRow(rowArr) {
  let matchCount = 0;
  for (const cell of rowArr) {
    if (!cell) continue;
    const val = String(cell).toLowerCase().trim();
    if (HEADER_KEYWORDS.some(kw => val.includes(kw))) {
      matchCount++;
    }
  }
  return matchCount;
}

function isFooterRow(rowArr) {
  for (let i = 0; i < rowArr.length; i++) {
    const cell = rowArr[i];
    if (!cell) continue;
    const val = String(cell).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (FOOTER_KEYWORDS.some(kw => val.includes(kw) || val === kw)) {
      return true;
    }
  }
  return false;
}

/**
 * Smart Parser لملفات الإكسيل الحقيقية للشركات
 */
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

  if (!rawData || rawData.length === 0) {
    return { headers: [], rows: [], sheetName, parserDebugInfo: null, metadata: {} };
  }

  let headerRowIndex = -1;
  let maxMatchCount = 0;
  const debugInfo = {
    ignoredMetadataRows: 0,
    ignoredFooterRows: 0,
    emptyRowsIgnored: 0,
    parsingWarnings: [],
    confidenceScore: 0,
  };

  // 1. البحث التلقائي عن صف العناوين (Header Row)
  for (let i = 0; i < Math.min(rawData.length, 30); i++) {
    const rowArr = rawData[i];
    const matchCount = isHeaderRow(rowArr);
    if (matchCount > maxMatchCount) {
      maxMatchCount = matchCount;
      headerRowIndex = i;
    }
  }

  if (headerRowIndex === -1 || maxMatchCount < 2) {
    debugInfo.parsingWarnings.push("لم يتم العثور على عناوين جدول واضحة، تم افتراض الصف الأول.");
    headerRowIndex = 0;
    debugInfo.confidenceScore = 20;
  } else {
    debugInfo.confidenceScore = Math.min(100, maxMatchCount * 25);
  }

  debugInfo.detectedHeaderRow = headerRowIndex + 1;
  debugInfo.ignoredMetadataRows = headerRowIndex;

  let rawHeaders = rawData[headerRowIndex] || [];
  const headers = rawHeaders.map((h, i) => {
    let clean = h !== undefined && h !== null ? String(h).trim() : "";
    if (!clean) clean = `Column_${i+1}`;
    return clean;
  });

  debugInfo.detectedColumns = headers.filter(h => !h.startsWith('Column_'));

  const rows = [];
  let reachedFooter = false;

  const extractedMetadata = {
    issuer: "",
    issuerVat: "",
    receiver: "",
    receiverVat: "",
    documentType: "I",
    documentTypeVersion: "1.0",
    dateTimeIssued: "",
    taxpayerActivityCode: "",
    internalID: ""
  };

  // 2. البحث المسبق عن بيانات المورد والمستلم والفاتورة في كامل الملف لضمان استخراجها
  for (let i = 0; i < rawData.length; i++) {
    const rowArr = rawData[i];
    for (let j = 0; j < rowArr.length; j++) {
      const cell = rowArr[j];
      if (!cell) continue;

      const cleanCell = String(cell).toLowerCase().replace(/[^a-z0-9]/g, "").trim();

      const getVal = () => {
        if (rowArr[j + 1] !== undefined && String(rowArr[j + 1]).trim() !== "") {
          return String(rowArr[j + 1]).trim();
        }
        const parts = String(cell).split(":");
        if (parts.length > 1) return parts[1].trim();
        return "";
      };

      if (cleanCell === "issuer" || cleanCell === "suppliername" || cleanCell === "vendorname" || cleanCell === "vendor" || cleanCell === "supplier") {
        const val = getVal();
        if (val) extractedMetadata.issuer = val;
      }
      else if (cleanCell === "issuervat" || cleanCell === "suppliervat" || cleanCell === "vendorvat" || cleanCell === "taxid") {
        const val = getVal();
        if (val) extractedMetadata.issuerVat = val.replace(/[^0-9]/g, "");
      }
      else if (cleanCell === "receiver" || cleanCell === "customername" || cleanCell === "customer") {
        const val = getVal();
        if (val) extractedMetadata.receiver = val;
      }
      else if (cleanCell === "receivervat" || cleanCell === "customervat" || cleanCell === "customerid") {
        const val = getVal();
        if (val) extractedMetadata.receiverVat = val.replace(/[^0-9]/g, "");
      }
      else if (cleanCell === "documenttype" || cleanCell === "doctype") {
        let val = getVal();
        if (val) {
          const lowerVal = val.toLowerCase();
          if (lowerVal.includes("invoice") || lowerVal === "i") {
            extractedMetadata.documentType = "I";
          } else if (lowerVal.includes("credit") || lowerVal === "c") {
            extractedMetadata.documentType = "C";
          } else if (lowerVal.includes("debit") || lowerVal === "d") {
            extractedMetadata.documentType = "D";
          } else {
            extractedMetadata.documentType = val;
          }
        }
      }
      else if (cleanCell === "documenttypeversion" || cleanCell === "version") {
        let val = getVal();
        if (val) {
          extractedMetadata.documentTypeVersion = val.toLowerCase().replace(/v/gi, "").trim();
        }
      }
      else if (cleanCell === "datetimeissued" || cleanCell === "issuedate" || cleanCell === "date") {
        let val = getVal();
        if (val) {
          if (val.toLowerCase().includes("live")) {
            extractedMetadata.dateTimeIssued = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
          } else {
            extractedMetadata.dateTimeIssued = val;
          }
        }
      }
      else if (cleanCell === "taxpayeractivitycode" || cleanCell === "activitycode") {
        const val = getVal();
        if (val) extractedMetadata.taxpayerActivityCode = val;
      }
      else if (cleanCell === "internalid" || cleanCell === "invoicenumber" || cleanCell === "invoiceno" || cleanCell === "billnumber") {
        const val = getVal();
        if (val) extractedMetadata.internalID = val;
      }
    }
  }

  // ضبط dateTimeIssued الافتراضي إذا لم يتم إدخاله أو كان Live Date
  if (!extractedMetadata.dateTimeIssued || String(extractedMetadata.dateTimeIssued).toLowerCase().includes("live")) {
    extractedMetadata.dateTimeIssued = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  } else {
    try {
      const d = new Date(extractedMetadata.dateTimeIssued);
      if (!isNaN(d.getTime())) {
        extractedMetadata.dateTimeIssued = d.toISOString().replace(/\.\d{3}Z$/, "Z");
      }
    } catch(e) {}
  }

  // 3. استخراج بيانات المنتجات وتجاهل الصفوف بعد انتهاء الجدول
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const rowArr = rawData[i];

    if (rowArr.every((cell) => cell === "" || cell === null || cell === undefined)) {
      debugInfo.emptyRowsIgnored++;
      continue;
    }

    if (isFooterRow(rowArr)) {
      reachedFooter = true;
    }

    if (reachedFooter) {
      debugInfo.ignoredFooterRows++;
      continue;
    }

    const rowObj = {};
    let hasData = false;
    headers.forEach((header, idx) => {
      const val = rowArr[idx];
      rowObj[header] = val !== undefined ? val : "";
      if (val !== "" && val !== null && val !== undefined) hasData = true;
    });

    if (hasData) {
      rows.push(rowObj);
    }
  }

  if (rows.length === 0) {
    debugInfo.parsingWarnings.push("لم يتم استخراج أي بنود من الملف.");
    debugInfo.confidenceScore = 0;
  }

  console.log("=== PARSER RESULT ===", {
    rowsCount: rows.length,
    metadata: extractedMetadata,
    firstRow: rows[0]
  });

  return { 
    headers, 
    rows, 
    sheetName, 
    parserDebugInfo: debugInfo, 
    metadata: extractedMetadata
  };
}

/**
 * يجيب قائمة بأسماء كل الـ Sheets في الملف
 */
function getSheetNames(filePath) {
  const workbook = XLSX.readFile(filePath);
  return workbook.SheetNames;
}

module.exports = { parseExcel, getSheetNames };
