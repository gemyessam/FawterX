export function getUploadIssuedTimestamp(reference = new Date()) {
  return reference.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function formatCairoDateTime(value) {
  if (!value) return 'N/A'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date)
  } catch {
    const cairoOffsetMs = 3 * 60 * 60 * 1000
    const cairoDate = new Date(date.getTime() + cairoOffsetMs)
    return cairoDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
  }
}

export function formatCairoDateTimeInput(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date)

    const map = Object.fromEntries(parts.map(part => [part.type, part.value]))
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
  } catch {
    const cairoOffsetMs = 3 * 60 * 60 * 1000
    const cairoDate = new Date(date.getTime() + cairoOffsetMs)
    const pad = (n) => String(n).padStart(2, '0')
    return `${cairoDate.getUTCFullYear()}-${pad(cairoDate.getUTCMonth() + 1)}-${pad(cairoDate.getUTCDate())}T${pad(cairoDate.getUTCHours())}:${pad(cairoDate.getUTCMinutes())}`
  }
}

export function cairoLocalInputToUtcIso(value) {
  if (!value) return ''
  const [datePart, timePart] = String(value).split('T')
  if (!datePart || !timePart) return String(value)

  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  if (![year, month, day, hour, minute].every(Number.isFinite)) return String(value)

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  let offsetMinutes = 180
  try {
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      timeZoneName: 'shortOffset',
      hour: '2-digit'
    }).formatToParts(utcGuess)
    const tzName = tzParts.find(part => part.type === 'timeZoneName')?.value || ''
    const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i)
    if (match) {
      const sign = match[1] === '-' ? -1 : 1
      const hours = Number(match[2] || 0)
      const mins = Number(match[3] || 0)
      offsetMinutes = sign * (hours * 60 + mins)
    }
  } catch {
    offsetMinutes = 180
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - (offsetMinutes * 60000))
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
}

export function stampUploadIssuedTimestamp(payload, timestamp = getUploadIssuedTimestamp()) {
  if (!payload) return payload

  if (Array.isArray(payload)) {
    return payload.map(item => stampUploadIssuedTimestamp(item, timestamp))
  }

  if (typeof payload !== 'object') {
    return payload
  }

  const next = { ...payload }

  if (typeof next.dateTimeIssued !== 'undefined') {
    next.dateTimeIssued = timestamp
  }

  if (next.metadata && typeof next.metadata === 'object' && !Array.isArray(next.metadata)) {
    next.metadata = {
      ...next.metadata,
      dateTimeIssued: timestamp,
      uploadedAt: timestamp
    }
  }

  if (next.result && typeof next.result === 'object') {
    next.result = stampUploadIssuedTimestamp(next.result, timestamp)
  }

  if (next.results && Array.isArray(next.results)) {
    next.results = next.results.map(item => stampUploadIssuedTimestamp(item, timestamp))
  }

  return next
}

/**
 * ترتيب المستندات تصاعدياً برقم الفاتورة (ترتيب طبيعي للأرقام 1, 2, ..., 10)
 * وضبط فارق زمني بالثواني (افتراضياً 3 ثوانٍ) بين كل فاتورة والأخرى
 * لضمان عدم ظهور الفواتير بشكل مقلوب أو عشوائي في منصة الضرائب
 */
export function sortAndStaggerDocuments(documents, stepSeconds = 3) {
  if (!Array.isArray(documents) || documents.length === 0) return documents

  // ترتيب طبيعي ذكي للأرقام والأسماء
  const sorted = [...documents].sort((a, b) => {
    const idA = String(a.internalID || a._fileName || a.fileName || '')
    const idB = String(b.internalID || b._fileName || b.fileName || '')
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
  })

  if (sorted.length <= 1) return sorted

  // احتساب وقت أساسي آمن بالماضي لضمان عدم رفض منظومة الضرائب لأي تاريخ مستقبلي
  const totalSpanMs = sorted.length * stepSeconds * 1000
  const firstDocTime = sorted[0].dateTimeIssued ? new Date(sorted[0].dateTimeIssued) : null
  const isValidFirstTime = firstDocTime && !Number.isNaN(firstDocTime.getTime())

  // لو الوقت الحالي أحدث، نبدأ من وقت آمن في الماضي القريب
  const nowMs = Date.now()
  let baseTimeMs = isValidFirstTime ? firstDocTime.getTime() : (nowMs - totalSpanMs)

  // إذا كان الوقت الأساسي + الفارق سيتجاوز الوقت الحالي، نرجع بالأساس للوراء
  if (baseTimeMs + totalSpanMs > nowMs) {
    baseTimeMs = nowMs - totalSpanMs
  }

  return sorted.map((doc, idx) => ({
    ...doc,
    dateTimeIssued: new Date(baseTimeMs + (idx * stepSeconds * 1000))
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z')
  }))
}
