/**
 * محرك تحليل وتفكيك مواصفات قطاعات الألومنيوم الصناعية (Smart Product Specification Layer)
 */

const PROFILE_TYPES = [
  { en: "Mullion", ar: "قائم / Mullion", keywords: ["mullion", "قائم", "قوايم"] },
  { en: "Transom", ar: "عارض / Transom", keywords: ["transom", "عارض", "عوارض"] },
  { en: "Vent", ar: "ضلفة / Vent", keywords: ["vent", "ضلفة", "فتحة"] },
  { en: "Track", ar: "سكة / Track", keywords: ["track", "سكة", "مجري"] },
  { en: "T-Cleat", ar: "زاوية تجميع / T-Cleat", keywords: ["t-cleat", "cleat", "زاوية", "تجميع"] },
  { en: "Frame", ar: "حلق / Frame", keywords: ["frame", "حلق", "إطار"] },
  { en: "Adaptor", ar: "محول / Adaptor", keywords: ["adaptor", "adapter", "محول"] }
];

const FINISH_KEYWORDS = [
  "RAL", "RAL8019", "RAL8019SD", "RAL9010", "RAL7016", "Anodized", "Mill Finish", "Powder Coated", 
  "سيلفر", "أبيض", "برونزي", "مات", "لامع", "ميتاليك", "SD"
];

/**
 * تحليل الوصف الخام واستخراج المواصفات المهيكلة
 */
export function parseProductDescription(rawText) {
  if (!rawText) {
    return {
      material: "Aluminium",
      productName: "Industrial Profile",
      weight: 0,
      length: 0,
      finish: "",
      rawDescription: ""
    };
  }

  const cleanText = rawText.replace(/\s+/g, " ");

  // 1. استخراج المادة
  let material = "Aluminium";
  if (/steel|حديد|معادن|معدن/i.test(cleanText)) {
    material = "Steel";
  }

  // 2. الكشف عن نوع القطاع
  let productName = "";
  const lowerText = cleanText.toLowerCase();
  for (const profile of PROFILE_TYPES) {
    const matched = profile.keywords.find(k => lowerText.includes(k));
    if (matched) {
      // محاولة استخراج رقم الموديل بجانب الكلمة المفتاحية
      const reg = new RegExp(`${matched}\\s*([A-Za-z0-9/_-]+)`, "i");
      const modelMatch = cleanText.match(reg);
      if (modelMatch && modelMatch[1]) {
        productName = `${profile.en} ${modelMatch[1]}`;
      } else {
        productName = profile.en;
      }
      break;
    }
  }

  if (!productName) {
    // محاولة البحث عن أي كلمة متبوعة برقم طراز
    const fallbackMatch = cleanText.match(/\b([A-Za-z]+)\s*(\d{2,4}(?:\/\d{2,4})?)\b/);
    if (fallbackMatch && fallbackMatch[1].length > 2) {
      productName = `${fallbackMatch[1]} ${fallbackMatch[2]}`;
    } else {
      productName = "Aluminium Profile";
    }
  }

  // 3. استخراج الوزن (KG)
  const kgMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:KG|kgs|كيلو|كجم)/i) || 
                  cleanText.match(/(?:وزن|الوزن)[\s:-]?\s*(\d+(?:\.\d+)?)/);
  const weight = kgMatch ? parseFloat(kgMatch[1]) : 0;

  // 4. استخراج الطول (mm)
  const mmMatch = cleanText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+)\s*(?:mm|مم|ملي)/i) ||
                  cleanText.match(/(?:طول|الطول)[\s:-]?\s*(\d+(?:\.\d+)?)/);
  const length = mmMatch ? parseFloat(mmMatch[1].replace(/,/g, "")) : 0;

  // 5. استخراج الدهان/اللون (Finish)
  let finish = "";
  for (const keyword of FINISH_KEYWORDS) {
    const reg = new RegExp(`\\b${keyword}[A-Za-z0-9]*\\b`, "i");
    const finishMatch = cleanText.match(reg);
    if (finishMatch) {
      finish = finishMatch[0].toUpperCase();
      break;
    }
  }
  // إذا لم يتم استخراجه بالكلمات القياسية، ابحث عن طراز ألوان RAL
  if (!finish) {
    const ralMatch = cleanText.match(/RAL\s*\d{4}[A-Z]*/i);
    if (ralMatch) {
      finish = ralMatch[0].toUpperCase();
    }
  }

  return {
    material,
    productName,
    weight,
    length,
    finish,
    rawDescription: rawText
  };
}

/**
 * بناء الوصف النصي الموحد لإرساله لمنظومة الضرائب ETA
 */
export function buildEtaDescription(specs) {
  const parts = [specs.material || "Aluminium"];
  if (specs.productName) parts.push(specs.productName);
  if (specs.weight > 0) parts.push(`${specs.weight.toFixed(2)} KG`);
  if (specs.length > 0) parts.push(`${specs.length.toLocaleString()} mm`);
  if (specs.finish) parts.push(specs.finish);
  return parts.join(" | ");
}
