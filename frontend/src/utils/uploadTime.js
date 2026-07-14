export function getUploadIssuedTimestamp(reference = new Date()) {
  return reference.toISOString().replace(/\.\d{3}Z$/, 'Z')
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
