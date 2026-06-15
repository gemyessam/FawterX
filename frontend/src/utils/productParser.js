/**
 * محرك استنتاج المنتجات الذكي (Generic Intelligent Invoice Product Inference Engine)
 */

const INDUSTRY_DETECTORS = [
  { family: "Aluminium & Metals", keywords: ["aluminium", "metal", "transom", "mullion", "vent", "track", "t-cleat", "frame", "adaptor", "ألومنيوم", "قطاع", "حديد"] },
  { family: "Electronics & Tech", keywords: ["electronics", "tech", "laptop", "phone", "screen", "cable", "cpu", "ram", "server", "شاشة", "كمبيوتر", "هاتف"] },
  { family: "Furniture & Decor", keywords: ["furniture", "decor", "chair", "table", "desk", "sofa", "wood", "كرسي", "ترابيزة", "مكتب", "خشب"] },
  { family: "Chemicals & Materials", keywords: ["chemical", "material", "paint", "resin", "liquid", "gas", "بويات", "مواد كيميائية", "غاز"] },
  { family: "Construction", keywords: ["construction", "cement", "concrete", "sand", "brick", "gravel", "أسمنت", "خرسانة", "رمل"] }
];

/**
 * تحليل الوصف الخام واستنتاج العائلة والمنتج والمواصفات بشكل ديناميكي مرن
 */
export function parseProductDescription(rawText) {
  if (!rawText) {
    return {
      family: "Generic Item",
      productName: "Unclassified Item",
      specs: [],
      rawDescription: ""
    };
  }

  const cleanText = rawText.replace(/\s+/g, " ");
  const lowerText = cleanText.toLowerCase();

  // 1. الاستنتاج التلقائي لعائلة المنتج (Product Family Inference)
  let family = "Generic Item";
  for (const detector of INDUSTRY_DETECTORS) {
    const matched = detector.keywords.find(k => lowerText.includes(k));
    if (matched) {
      family = detector.family;
      break;
    }
  }

  // 2. استخلاص المسمى الذكي (Product Title Inference)
  const cleanWordsText = cleanText
    .replace(/\b(?:\d+(?:\.\d+)?)\s*(?:KG|kgs|mm|LM|L\.M|meter|EGP|USD|EUR)\b/gi, "")
    .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleanWordsText.split(" ");
  let productName = words.slice(0, 4).join(" ");
  if (!productName || productName.length < 3) {
    productName = "Generic Invoice Item";
  }

  // 3. استخراج المواصفات الاختيارية (Optional Specifications Extraction)
  const specs = [];

  // الوزن (KG)
  const kgMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:KG|kgs|كيلو|كجم)/i);
  if (kgMatch) specs.push({ label: "Weight", value: `${kgMatch[1]} KG` });

  // الطول (mm)
  const mmMatch = cleanText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+)\s*(?:mm|مم|ملي)/i);
  if (mmMatch) specs.push({ label: "Length", value: `${mmMatch[1]} mm` });

  // الدهان/RAL
  const ralMatch = cleanText.match(/RAL\s*\d{4}[A-Z]*/i) || cleanText.match(/\bRAL[A-Za-z0-9]+\b/i);
  if (ralMatch) specs.push({ label: "Finish", value: ralMatch[0].toUpperCase() });

  return {
    family,
    productName,
    specs,
    rawDescription: rawText
  };
}

/**
 * بناء الوصف النصي الموحد لإرساله لمنظومة الضرائب ETA
 */
export function buildEtaDescription(rawText) {
  if (!rawText) return "";

  const noisePatterns = [
    /(?:\b(?:street|st\.?|road|rd\.?|building|bldg|floor|block|district|city|governate|country|postal code|po box|p\.?o\.?|phone|tel|fax|mobile|email|website|www\.|info@|@)\b)/i,
    /(?:\b(?:cr#|vat|tax|reg\.?|cr\.?|cr no\.?|commercial register)\b)/i,
    /(?:\b(?:smart village|giza|cairo|egypt|egyptian tax authority|eta)\b)/i,
    /--\s*\d+\s+of\s+\d+\s*--/i
  ];

  return String(rawText)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !noisePatterns.some(pattern => pattern.test(line)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
