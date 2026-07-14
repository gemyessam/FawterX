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
