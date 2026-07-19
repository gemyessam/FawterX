const normalizeSpaces = str => (str || "").replace(/\s+/g, " ").trim();

function extractReceiverAddressDetails(lines = [], receiverName = "") {
  const normalizedLines = (Array.isArray(lines) ? lines : [])
    .map(normalizeSpaces)
    .filter(Boolean);

  const lowerName = normalizeSpaces(receiverName).toLowerCase();
  const receiverIdx = lowerName
    ? normalizedLines.findIndex(line => line.toLowerCase() === lowerName || line.toLowerCase().includes(lowerName))
    : -1;
  const shipToIdx = normalizedLines.findIndex(line => /^ship to$/i.test(line));
  const startIdx = receiverIdx >= 0 ? receiverIdx + 1 : 0;
  const endIdx = shipToIdx >= 0 ? shipToIdx : normalizedLines.length;

  const countryHints = [
    { test: /(c[ôo]te.*d.*ivoire|ivory\s*coast|كوت ديفوار)/i, code: "CI" },
    { test: /(kenya|كينيا)/i, code: "KE" },
    { test: /(egypt|مصر)/i, code: "EG" },
    { test: /(saudi|ksa|السعودية)/i, code: "SA" },
    { test: /(uae|dubai|الامارات|دبي)/i, code: "AE" },
    { test: /(usa|امريكا)/i, code: "US" },
    { test: /(uk)/i, code: "GB" },
    { test: /(germany)/i, code: "DE" }
  ];

  const addressLines = [];
  let countryCode = "";
  let countryHit = false;
  let regionCity = "";

  const extractCityFromCountryLine = (line) => {
    if (!line) return "";
    const m = normalizeSpaces(line).match(/^(.+?)\s*,\s*(c[ôo]te.*d.*ivoire|ivory\s*coast|kenya|egypt|saudi arabia|saudi|ksa|uae|dubai|usa|uk|germany|كينيا|مصر|السعودية|الامارات|دبي|امريكا)\.?$/i);
    if (m) return normalizeSpaces(m[1]);
    const m2 = normalizeSpaces(line).match(/^(.+?)\s+(c[ôo]te.*d.*ivoire|ivory\s*coast|kenya|egypt|saudi arabia|saudi|ksa|uae|dubai|usa|uk|germany|كينيا|مصر|السعودية|الامارات|دبي|امريكا)\.?$/i);
    if (m2) return normalizeSpaces(m2[1]);
    return "";
  };

  for (const rawLine of normalizedLines.slice(startIdx, endIdx)) {
    // Preserve the original line for keyword checking
    const checkLine = rawLine.trim();

    if (
      !checkLine ||
      /^0*\d{3,10}$/.test(checkLine) ||
      /^c-\d+$/i.test(checkLine) ||
      /^(customer number|invoice number|terms of delivery|vat\b|cr\s*#|cr#|sales invoice|phone:|tel:|info@|page\s*\d+|--\s*\d+\s+of\s+\d+\s*--)/i.test(checkLine) ||
      /^(production time|from \d+ to \d+ weeks|ex work)/i.test(checkLine)
    ) {
      continue;
    }

    // Now safely replace ONLY dates or purely junk prefixes if needed
    let line = checkLine
      .replace(/^\d{1,4}[.\/-]\d{1,2}[.\/-]\d{1,4}\s*\/\s*/i, "")
      .trim();

    const currentText = (addressLines.join(" ") + " " + line).trim();
    const detectedCountry = countryHints.find(entry => entry.test.test(currentText));
    if (detectedCountry) {
      if (!countryCode) countryCode = detectedCountry.code;
      addressLines.push(line);
      if (!regionCity) {
        regionCity = extractCityFromCountryLine(currentText);
      }
      countryHit = true;
      break;
    }

    addressLines.push(line);
  }

  const addressText = addressLines.join(", ");
  if (!regionCity) {
    const cityLine = addressLines.find(line => /[A-Za-z\u0600-\u06FF]{3,}/.test(line) && /[,]/.test(line)) || "";
    const cityMatch = cityLine.match(/^([^,]+)\s*,\s*(cote d'ivoire|ivory coast|kenya|egypt|saudi arabia|uae|dubai|usa|uk|germany|كينيا|مصر|السعودية|الامارات|دبي|امريكا)/i);
    regionCity = cityMatch ? normalizeSpaces(cityMatch[1]) : "";
  }

  if (!regionCity && addressLines.length >= 2) {
    const lastMeaningful = [...addressLines]
      .slice(0, -1)
      .reverse()
      .find(line => /[A-Za-z\u0600-\u06FF]{3,}/.test(line) && !/(street|road|avenue|lane|p\.?\s*o\.?\s*box|building|unit|area|center|centre|district|zone)/i.test(line));
    if (lastMeaningful) {
      regionCity = normalizeSpaces(lastMeaningful.replace(/[.,]+$/g, ""));
    }
  }

  const streetLines = addressLines.filter(line => {
    if (!line) return false;
    if (countryHints.some(entry => entry.test.test(line))) return false;
    if (/^ship to$/i.test(line)) return false;
    return true;
  });

  let receiverStreet = streetLines.join(", ");
  const buildingCandidates = [
    receiverStreet.match(/\b(?:p\.?\s*o\.?\s*box\s*[\d\-\/]+|\d{1,6}(?:\s*&\s*\d{1,6})?)\b/i)?.[0],
    streetLines.find(line => /\b(?:unit|building|block|plot|villa|house|suite|floor|room|no\.?|#)\s*[\w\-\/&]+/i.test(line))?.match(/\b(?:unit|building|block|plot|villa|house|suite|floor|room|no\.?|#)\s*([\w\-\/&]+(?:\s*&\s*[\w\-\/&]+)*)/i)?.[1],
    streetLines.find(line => /^\d{1,6}\b/.test(line))?.match(/^(\d{1,6}\b(?:\s*&\s*\d{1,6})?)/)?.[1],
    streetLines.find(line => /\b\d{1,6}\b/.test(line))?.match(/\b(\d{1,6}\b(?:\s*&\s*\d{1,6})?)\b/)?.[1]
  ].map(normalizeSpaces).filter(Boolean);
  const receiverBuildingNumber = buildingCandidates[0] || "1";

  // Smart splitting for comma-separated full addresses
  let finalRegionCity = regionCity || "";
  let finalGovernate = regionCity || "";
  
  if (addressText.includes(",")) {
    const parts = addressText.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const lastPart = parts[parts.length - 1];
      const isCountry = countryHints.some(entry => entry.test.test(lastPart)) || /(egypt|مصر|kenya|ksa|uae|uk|usa|germany|cote d'ivoire|ivory coast)/i.test(lastPart);
      if (isCountry) {
        finalGovernate = parts[parts.length - 2] || finalGovernate;
        finalRegionCity = parts[parts.length - 3] || finalRegionCity;
      } else {
        finalGovernate = parts[parts.length - 1] || finalGovernate;
        finalRegionCity = parts[parts.length - 2] || finalRegionCity;
      }
    }
  }

  if (!countryCode) {
    const fullText = addressText.replace(/,/g, " ").replace(/\s+/g, " ");
    const detected = countryHints.find(entry => entry.test.test(fullText));
    if (detected) {
      countryCode = detected.code;
    }
  }

  return {
    receiverAddressText: addressText || "",
    receiverStreet: receiverStreet || "",
    receiverBuildingNumber: receiverBuildingNumber || "1",
    receiverRegionCity: finalRegionCity || "",
    receiverGovernate: finalGovernate || "",
    receiverCountry: countryCode || ""
  };
}

const rawLines = [
  "Sotalux",
  "01 BP 2747",
  "Abidjan 01,",
  "Côte 01",
  "d'Ivoire.",
  "VAT: B1400051",
  "Invoice Number / Date",
  "000000635 / 29.06.2026",
  "Customer number",
  "C-048",
  "Terms of Delivery",
  "PRODUCTION TIME",
  "FROM 6 TO 8 WEEKS",
  "EX WORK",
  "CR # 2503556 G"
];

console.log(JSON.stringify(extractReceiverAddressDetails(rawLines, "Sotalux"), null, 2));
