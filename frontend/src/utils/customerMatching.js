function normalizeCustomerName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\b(co|company|ltd|llc|inc|corp|corporation|limited|sarl|شركة|شركه)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function customerNameScore(invoiceName, customerName) {
  const invoice = normalizeCustomerName(invoiceName)
  const customer = normalizeCustomerName(customerName)
  if (!invoice || !customer) return 0
  if (invoice === customer) return 1
  if (invoice.includes(customer) || customer.includes(invoice)) return 0.96

  const invoiceWords = new Set(invoice.split(' ').filter(Boolean))
  const customerWords = new Set(customer.split(' ').filter(Boolean))
  if (!invoiceWords.size || !customerWords.size) return 0

  let shared = 0
  customerWords.forEach(word => {
    if (invoiceWords.has(word)) shared += 1
  })

  return shared / Math.max(invoiceWords.size, customerWords.size)
}

function findSavedCustomerForReceiver(receiver, customers = []) {
  const receiverName = receiver?.name || ''
  let bestMatch = null
  let bestScore = 0

  customers.forEach(customer => {
    const score = customerNameScore(receiverName, customer?.name)
    if (score > bestScore) {
      bestScore = score
      bestMatch = customer
    }
  })

  return bestScore >= 0.9 ? { customer: bestMatch, score: bestScore } : null
}

function applyCustomerToDoc(doc, customer) {
  if (!doc || !customer) return doc

  const nextDoc = { ...doc }
  const currentReceiver = nextDoc.receiver || {}
  const currentAddress = currentReceiver.address || {}
  const customerAddress = customer.address || {}

  nextDoc.receiver = {
    ...currentReceiver,
    name: customer.name || currentReceiver.name || '',
    id: customer.id || currentReceiver.id || '',
    type: customer.type || currentReceiver.type || 'B',
    address: {
      ...currentAddress,
      country: customerAddress.country || currentAddress.country || 'EG',
      street: customerAddress.street || currentAddress.street || currentAddress.addressLine || '',
      buildingNumber: customerAddress.buildingNumber || currentAddress.buildingNumber || '1',
      regionCity: customerAddress.regionCity || currentAddress.regionCity || '',
      governate: customerAddress.governate || currentAddress.governate || '',
    },
  }

  return nextDoc
}

export function applySavedCustomerMatches(docs = [], customers = []) {
  let matchCount = 0
  let firstMatch = null

  const documents = docs.map(doc => {
    const match = findSavedCustomerForReceiver(doc?.receiver, customers)
    if (!match) return doc

    matchCount += 1
    if (!firstMatch) firstMatch = match.customer
    return applyCustomerToDoc(doc, match.customer)
  })

  return { documents, matchCount, firstMatch }
}
