import { ensureLocalSignerActive } from '../services/api'

function cleanObject(obj) {
  if (typeof obj === 'number') {
    return parseFloat(obj.toFixed(5))
  }

  if (Array.isArray(obj)) {
    return obj
      .map((value) => (value !== null && value !== undefined ? cleanObject(value) : value))
      .filter((value) => value !== null && value !== undefined && value !== '')
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (key === 'signatures') return acc
      if (value === null || value === undefined || value === '') return acc
      if (Array.isArray(value) && value.length === 0) return acc

      const cleanedValue = cleanObject(value)
      if (typeof cleanedValue === 'object' && !Array.isArray(cleanedValue) && Object.keys(cleanedValue).length === 0) return acc
      if (Array.isArray(cleanedValue) && cleanedValue.length === 0) return acc

      acc[key] = cleanedValue
      return acc
    }, {})
  }

  return obj
}

function escapeJsonString(str) {
  if (typeof str !== 'string') str = String(str)
  let result = ''
  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    const code = str.charCodeAt(i)
    switch (char) {
      case '"': result += '\\"'; break
      case '\\': result += '\\\\'; break
      case '\n': result += '\\n'; break
      case '\r': result += '\\r'; break
      case '\t': result += '\\t'; break
      case '\f': result += '\\f'; break
      case '\b': result += '\\b'; break
      default:
        if (code < 32) {
          result += '\\u' + code.toString(16).padStart(4, '0')
        } else {
          result += char
        }
        break
    }
  }
  return `"${result}"`
}

function serializeToken(object) {
  let serialized = ''
  const keys = Object.keys(object)
  for (const key of keys) {
    const val = object[key]
    if (key === 'signatures' || val === null || val === undefined) {
      continue
    }
    serialized += `"${key.toUpperCase()}"`
    if (Array.isArray(val)) {
      for (const item of val) {
        serialized += `"${key.toUpperCase()}"`
        if (item !== null && typeof item === 'object') {
          serialized += serializeToken(item)
        } else {
          serialized += typeof item === 'string' ? escapeJsonString(item) : `"${item.toString()}"`
        }
      }
    } else if (typeof val === 'object') {
      serialized += serializeToken(val)
    } else {
      serialized += typeof val === 'string' ? escapeJsonString(val) : `"${val.toString()}"`
    }
  }
  return serialized
}

function normalizeIssueDate(doc) {
  const safeDate = new Date()
  safeDate.setMinutes(safeDate.getMinutes() - 5)
  const fallbackIsoTime = safeDate.toISOString().replace(/\.\d{3}Z$/, 'Z')

  if (!doc.dateTimeIssued) return fallbackIsoTime

  const parsed = new Date(doc.dateTimeIssued)
  if (Number.isNaN(parsed.getTime())) return fallbackIsoTime

  return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function assertSignedBeforeLiveSubmit(documents) {
  const docs = Array.isArray(documents) ? documents : [documents]
  const missingSignature = docs.some((doc) =>
    !Array.isArray(doc.signatures) ||
    !doc.signatures[0]?.value ||
    String(doc.signatures[0].value).startsWith('MOCK_') ||
    !isLikelyCmsSignature(doc.signatures[0].value)
  )

  if (missingSignature) {
    throw new Error('لا يمكن إرسال الفاتورة للضرائب قبل التوقيع الإلكتروني الحقيقي.')
  }
}

function isLikelyCmsSignature(value) {
  const signature = String(value || '').trim()
  return signature.length > 1000 && /^[A-Za-z0-9+/=\r\n]+$/.test(signature)
}

export async function signEtaDocuments(documents, { onStatusUpdate = null } = {}) {
  const docs = Array.isArray(documents) ? documents : [documents]

  const localSignerActive = await ensureLocalSignerActive(onStatusUpdate)
  if (!localSignerActive) {
    throw new Error('لم يتم الكشف عن أداة التوقيع. افتح FawterX Signer وتأكد من توصيل الدونجل.')
  }

  const signedDocs = []

  for (const sourceDoc of docs) {
    const doc = {
      ...sourceDoc,
      documentType: sourceDoc.documentType || 'I',
      documentTypeVersion: '1.0',
      dateTimeIssued: normalizeIssueDate(sourceDoc),
    }
    const cleanedDoc = cleanObject(doc)
    const canonicalString = serializeToken(cleanedDoc)

    const signRes = await fetch('http://localhost:8585/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canonicalString }),
    })

    if (!signRes.ok) {
      throw new Error('فشلت عملية التوقيع محلياً.')
    }

    const signData = await signRes.json()
    if (!signData.success || !signData.signature) {
      throw new Error(signData.error || 'لم يرجع برنامج التوقيع توقيعاً صالحاً.')
    }

    if (!isLikelyCmsSignature(signData.signature)) {
      throw new Error('برنامج التوقيع رجع قيمة غير صالحة. افتح FawterX Signer وتأكد من اختيار شهادة الدونجل الصحيحة.')
    }

    signedDocs.push({
      ...cleanedDoc,
      signatures: [{
        signatureType: 'I',
        value: signData.signature,
      }],
    })
  }

  assertSignedBeforeLiveSubmit(signedDocs)
  return signedDocs
}
