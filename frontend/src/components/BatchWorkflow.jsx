import React, { useState, useEffect, useContext } from 'react'
import { SettingsContext } from '../App'
import UploadStep from './UploadStep'
import { generateInvoice, submitToETA, getETAStatus, getCustomers, saveCustomer, ensureLocalSignerActive } from '../services/api'
import { stampUploadIssuedTimestamp, formatCairoDateTime, formatCairoDateTimeInput, cairoLocalInputToUtcIso } from '../utils/uploadTime'
import { applySavedCustomerMatches } from '../utils/customerMatching'
import toast from 'react-hot-toast'

function textDirection(str) {
  if (!str || typeof str !== 'string') return 'ltr';
  const hasArabic = /[\u0600-\u06FF]/.test(str);
  return hasArabic ? 'rtl' : 'ltr';
}

function cleanCustomerId(id) {
  if (!id) return '';
  return String(id).replace(/\D/g, '');
}

function cleanObject(obj) {
  if (typeof obj === 'number') {
    return parseFloat(obj.toFixed(5));
  }
  if (Array.isArray(obj)) {
    const arr = obj.map(item => cleanObject(item)).filter(item => {
      if (item === null || item === undefined || item === '') return false
      if (typeof item === 'object' && Object.keys(item).length === 0) return false
      return true
    })
    return arr.length > 0 ? arr : undefined
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj = {}
    Object.entries(obj).forEach(([key, value]) => {
      const cleanedValue = cleanObject(value)
      if (cleanedValue !== undefined && cleanedValue !== null && cleanedValue !== '') {
        newObj[key] = cleanedValue
      }
    })
    return Object.keys(newObj).length > 0 ? newObj : undefined
  }
  return obj
}

function escapeJsonString(str) {
  if (typeof str !== 'string') str = String(str);
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = str.charCodeAt(i);
    switch (char) {
      case '"': result += '\\"'; break;
      case '\\': result += '\\\\'; break;
      case '\n': result += '\\n'; break;
      case '\r': result += '\\r'; break;
      case '\t': result += '\\t'; break;
      case '\f': result += '\\f'; break;
      case '\b': result += '\\b'; break;
      default:
        if (code < 32) {
          result += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          result += char;
        }
        break;
    }
  }
  return `"${result}"`;
}

function serializeToken(object) {
  let serialized = "";
  const keys = Object.keys(object);
  for (const key of keys) {
    const val = object[key];
    if (key === "signatures" || val === null || val === undefined) {
      continue;
    }
    serialized += `"${key.toUpperCase()}"`;
    if (Array.isArray(val)) {
      for (const item of val) {
        serialized += `"${key.toUpperCase()}"`;
        if (item !== null && typeof item === "object") {
          serialized += serializeToken(item);
        } else {
          serialized += typeof item === "string" ? escapeJsonString(item) : `"${item.toString()}"`;
        }
      }
    } else if (typeof val === "object") {
      serialized += serializeToken(val);
    } else {
      serialized += typeof val === "string" ? escapeJsonString(val) : `"${val.toString()}"`;
    }
  }
  return serialized;
}

export default function BatchWorkflow({ lang, t, fetchUsage }) {
  const settings = useContext(SettingsContext);
  const [step, setStep] = useState(1) // 1: Upload, 2: Processing, 3: Review
  const [invoices, setInvoices] = useState([]) // Array of generated ETA docs
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submissionResults, setSubmissionResults] = useState([])

  // Saved Customers State
  const [customers, setCustomers] = useState([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  useEffect(() => {
    if (invoices.length > 0 && selectedIdx >= invoices.length) {
      setSelectedIdx(0)
    }
  }, [invoices.length, selectedIdx])

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setCustomersLoading(true)
    try {
      const res = await getCustomers()
      if (res?.success && Array.isArray(res.customers)) {
        setCustomers(res.customers)
        return res.customers
      }
    } catch (e) {
      console.error("Failed to fetch customers:", e)
    } finally {
      setCustomersLoading(false)
    }
    return []
  }

  useEffect(() => {
    if (!invoices.length || !customers.length || selectedCustomerId) return

    const matched = applySavedCustomerMatches(invoices, customers)
    if (!matched.firstMatch) return

    const docsChanged = JSON.stringify(matched.documents) !== JSON.stringify(invoices)
    setSelectedCustomerId(matched.firstMatch.id)
    if (docsChanged) {
      setInvoices(matched.documents)
      toast.success(
        lang === 'ar'
          ? `تم تطبيق بيانات ${matched.matchCount} عميل محفوظ تلقائيًا`
          : `Applied ${matched.matchCount} saved customer profiles automatically`
      )
    }
  }, [customers, invoices, selectedCustomerId, lang])

  async function handleBatchUploadSuccess(resultsArray) {
    setStep(2)
    toast.loading(lang === 'ar' ? 'جاري توليد الفواتير ومطابقتها...' : 'Generating and mapping invoices...', { id: 'batch-gen' })
    
    try {
      const uploadTimestamp = new Date()
      const config = settings || {}
      
      const issuer = {
        name: config.companyName || 'الشركة العربية المتميزة للصناعة',
        registrationNumber: config.taxId || '477-840-515',
        activityCode: config.taxpayerActivityCode || '6209',
        governate: 'Cairo',
        regionCity: 'Cairo',
        street: 'Main Street',
        buildingNumber: '1'
      }

      const smartMapping = {
        invoiceNumber: 'invoiceNumber', itemCode: 'itemCode', codeType: 'codeType', internalCode: 'internalCode',
        description: 'description', quantity: 'quantity', unitType: 'unitType', currency: 'currency',
        unitValue: 'unitValue', taxPercent: 'taxPercent'
      }

      const generatedDocs = []
      const customerList = customers.length ? customers : await fetchCustomers()
      let autoMatchedCustomers = 0

      for (const res of resultsArray) {
        if (!res.success) {
          toast.error(`Failed to parse file: ${res.fileName}`)
          continue
        }
        
        try {
          const stampedRes = stampUploadIssuedTimestamp(res, uploadTimestamp)
          const genRes = await generateInvoice(smartMapping, stampedRes.rows || [], issuer, stampedRes.metadata || {})
          if (genRes.success) {
            const docs = genRes.documents || [genRes.document]
            const cleanedDocs = docs.map(d => cleanObject(d))
            const matched = applySavedCustomerMatches(cleanedDocs, customerList)
            autoMatchedCustomers += matched.matchCount
            matched.documents[0]._fileName = res.fileName 
            generatedDocs.push(matched.documents[0])
          }
        } catch (genErr) {
          console.error("Error generating doc for", res.fileName, genErr)
          toast.error(`Failed to generate ETA doc for ${res.fileName}`)
        }
      }

      setInvoices(generatedDocs)
      if (autoMatchedCustomers > 0) {
        toast.success(
          lang === 'ar'
            ? `تم تطبيق بيانات ${autoMatchedCustomers} عميل محفوظ تلقائيًا`
            : `Applied ${autoMatchedCustomers} saved customer profiles automatically`
        )
      }
      toast.success(lang === 'ar' ? `تم تحضير ${generatedDocs.length} فاتورة بنجاح` : `Prepared ${generatedDocs.length} invoices successfully`, { id: 'batch-gen' })
      setStep(3)
    } catch (e) {
      console.error(e)
      toast.error(lang === 'ar' ? 'حدث خطأ أثناء معالجة الفواتير' : 'Error processing invoices', { id: 'batch-gen' })
      setStep(1)
    }
  }

  async function handleOpenSigner() {
    try {
      const pingRes = await fetch("http://localhost:8585/", { method: "GET" })
      if (pingRes.ok) {
        toast.success(lang === 'ar' ? 'أداة التوقيع شغالة بالفعل ⚡' : 'Signer is already running ⚡')
        return
      }
    } catch (e) {}

    try {
      window.location.href = 'fawterx-signer://open'
      toast(
        lang === 'ar'
          ? 'لو الأداة متسطبة، ويندوز هيفتحها الآن. لو لم تفتح، حمّل أحدث إصدار من بطاقة أداة التوقيع.'
          : 'If the signer is installed, Windows will open it now. If nothing opens, download the latest signer from the signer card.',
        { icon: '🔑', duration: 7000 }
      )
    } catch (e) {
      window.open(`/FawterX-Signer.zip?t=${Date.now()}`, '_blank')
    }
  }

  // Update selected invoice metadata
  function updateInvoiceMetadata(field, val) {
    if (invoices.length === 0 || selectedIdx < 0) return
    const nextInvoices = JSON.parse(JSON.stringify(invoices))
    const doc = nextInvoices[selectedIdx]
    if (!doc) return

    if (field === 'internalID') {
      doc.internalID = val
    } else if (field === 'dateTimeIssued') {
      doc.dateTimeIssued = val
    } else if (field === 'documentType') {
      doc.documentType = val
    } else if (field === 'issuerName') {
      if (!doc.issuer) doc.issuer = {}
      doc.issuer.name = val
    } else if (field === 'issuerVat') {
      if (!doc.issuer) doc.issuer = {}
      doc.issuer.id = val
    } else if (field === 'receiverName') {
      if (!doc.receiver) doc.receiver = {}
      doc.receiver.name = val
    } else if (field === 'receiverVat') {
      if (!doc.receiver) doc.receiver = {}
      doc.receiver.id = val
    } else if (field === 'receiverType') {
      if (!doc.receiver) doc.receiver = {}
      doc.receiver.type = val
      
      if (val === 'F') {
        doc.invoiceLines?.forEach(l => {
          if (l.taxableItems && l.taxableItems.length > 0) {
            l.taxableItems[0].rate = 0
            l.taxableItems[0].amount = 0
          }
          l.total = l.netTotal
        })
        doc.taxTotals = [{ taxType: "T1", amount: 0 }]
        doc.totalAmount = doc.netAmount
      }
    } else if (field === 'receiverCountry') {
      if (!doc.receiver) doc.receiver = {}
      if (!doc.receiver.address) doc.receiver.address = {}
      doc.receiver.address.country = val
    } else if (field === 'receiverStreet') {
      if (!doc.receiver) doc.receiver = {}
      if (!doc.receiver.address) doc.receiver.address = {}
      doc.receiver.address.street = val
    } else if (field === 'receiverBuildingNumber') {
      if (!doc.receiver) doc.receiver = {}
      if (!doc.receiver.address) doc.receiver.address = {}
      doc.receiver.address.buildingNumber = val
    } else if (field === 'receiverRegionCity') {
      if (!doc.receiver) doc.receiver = {}
      if (!doc.receiver.address) doc.receiver.address = {}
      doc.receiver.address.regionCity = val
    } else if (field === 'receiverGovernate') {
      if (!doc.receiver) doc.receiver = {}
      if (!doc.receiver.address) doc.receiver.address = {}
      doc.receiver.address.governate = val
    } else if (field === 'taxpayerActivityCode') {
      doc.taxpayerActivityCode = val
    } else if (field === 'codeType') {
      doc.codeType = val
    } else if (field === 'currency' || field === 'exchangeRate') {
      const exRate = field === 'exchangeRate' ? (parseFloat(val) || 1) : (doc.invoiceLines?.[0]?.unitValue?.currencyExchangeRate || 1)
      const curr = field === 'currency' ? val : (doc.invoiceLines?.[0]?.unitValue?.currencySold || 'EGP')
      
      let totalSales = 0
      let totalTax = 0
      
      doc.invoiceLines?.forEach(l => {
        if (l.unitValue) {
          l.unitValue.currencySold = curr
          if (curr !== 'EGP') {
            if (!l.unitValue.amountSold) {
              l.unitValue.amountSold = l.unitValue.amountEGP
            }
            l.unitValue.currencyExchangeRate = exRate
            l.unitValue.amountEGP = parseFloat((l.unitValue.amountSold * exRate).toFixed(5))
          } else {
            if (l.unitValue.amountSold > 0) {
              l.unitValue.amountEGP = l.unitValue.amountSold
            }
            l.unitValue.amountSold = 0
            l.unitValue.currencyExchangeRate = 0
          }
          
          const qty = l.quantity || 0
          const net = qty * l.unitValue.amountEGP
          l.netTotal = net
          l.salesTotal = net
          
          const taxRate = (curr !== 'EGP')
            ? 0
            : (l.taxableItems?.[0]?.rate !== undefined ? l.taxableItems[0].rate : (l.taxPercent !== undefined ? l.taxPercent : 14))
          const taxAmt = curr !== 'EGP' ? 0 : (net * (taxRate / 100))
          if (l.taxableItems && l.taxableItems[0]) {
            l.taxableItems[0].amount = taxAmt
            l.taxableItems[0].rate = taxRate
          }
          l.total = net + taxAmt
        }
        totalSales += l.netTotal || 0
        totalTax += (l.taxableItems?.[0]?.amount || 0)
      })
      
      doc.totalSalesAmount = totalSales
      doc.netAmount = totalSales
      doc.taxTotals = [{ taxType: "T1", amount: totalTax }]
      doc.totalAmount = totalSales + totalTax
    }

    setInvoices(nextInvoices)
  }

  // Update line item inside selected invoice
  function updateInvoiceLine(lineIdx, field, val) {
    if (invoices.length === 0 || selectedIdx < 0) return
    const nextInvoices = JSON.parse(JSON.stringify(invoices))
    const doc = nextInvoices[selectedIdx]
    if (!doc || !doc.invoiceLines?.[lineIdx]) return
    const line = doc.invoiceLines[lineIdx]

    if (field === 'codeType') {
      line.codeType = val
    } else if (field === 'itemCode') {
      line.itemCode = val
    } else if (field === 'internalCode') {
      line.internalCode = val
    } else if (field === 'description') {
      line.description = val
    } else if (field === 'unitType') {
      line.unitType = val
    } else if (field === 'quantity') {
      const qty = parseFloat(val) || 0
      line.quantity = qty
      
      const curr = line.unitValue?.currencySold || 'EGP'
      const unitPrice = curr !== 'EGP' ? (line.unitValue?.amountSold || 0) : (line.unitValue?.amountEGP || 0)
      
      let net = qty * unitPrice
      if (curr !== 'EGP') {
        const exRate = line.unitValue?.currencyExchangeRate || 1
        net = parseFloat((net * exRate).toFixed(5))
      }
      line.netTotal = net
      line.salesTotal = net

      const taxRate = curr !== 'EGP' ? 0 : (line.taxableItems?.[0]?.rate ?? (line.taxPercent ?? 14))
      const taxAmt = curr !== 'EGP' ? 0 : (net * (taxRate / 100))
      
      if (!line.taxableItems || line.taxableItems.length === 0) {
        line.taxableItems = [{ taxType: "T1", amount: taxAmt, subType: "V009", rate: taxRate }]
      } else {
        line.taxableItems[0].amount = taxAmt
        line.taxableItems[0].rate = taxRate
      }
      line.total = net + taxAmt
    } else if (field === 'unitValue') {
      const numPrice = parseFloat(val) || 0
      const curr = line.unitValue?.currencySold || 'EGP'
      
      if (!line.unitValue) line.unitValue = { currencySold: 'EGP' }
      if (curr !== 'EGP') {
        line.unitValue.amountSold = numPrice
        const exRate = line.unitValue.currencyExchangeRate || 1
        line.unitValue.amountEGP = parseFloat((numPrice * exRate).toFixed(5))
      } else {
        line.unitValue.amountEGP = numPrice
        line.unitValue.amountSold = 0
      }

      const qty = line.quantity || 0
      let net = qty * line.unitValue.amountEGP
      line.netTotal = net
      line.salesTotal = net

      const taxRate = curr !== 'EGP' ? 0 : (line.taxableItems?.[0]?.rate ?? (line.taxPercent ?? 14))
      const taxAmt = curr !== 'EGP' ? 0 : (net * (taxRate / 100))
      
      if (!line.taxableItems || line.taxableItems.length === 0) {
        line.taxableItems = [{ taxType: "T1", amount: taxAmt, subType: "V009", rate: taxRate }]
      } else {
        line.taxableItems[0].amount = taxAmt
        line.taxableItems[0].rate = taxRate
      }
      line.total = net + taxAmt
    } else if (field === 'taxPercent') {
      const taxRate = parseFloat(val) || 0
      line.taxPercent = taxRate
      const curr = line.unitValue?.currencySold || 'EGP'
      
      const net = line.netTotal || 0
      const taxAmt = curr !== 'EGP' ? 0 : (net * (taxRate / 100))
      
      if (!line.taxableItems || line.taxableItems.length === 0) {
        line.taxableItems = [{ taxType: "T1", amount: taxAmt, subType: "V009", rate: taxRate }]
      } else {
        line.taxableItems[0].amount = taxAmt
        line.taxableItems[0].rate = taxRate
      }
      line.total = net + taxAmt
    }

    // Recalculate invoice grand totals
    let totalSales = 0
    let totalTax = 0
    let grandTotal = 0
    doc.invoiceLines.forEach(l => {
      totalSales += l.netTotal || 0
      totalTax += (l.taxableItems?.[0]?.amount || 0)
      grandTotal += (l.total || 0)
    })

    doc.totalSalesAmount = totalSales
    doc.netAmount = totalSales
    doc.taxTotals = [{ taxType: "T1", amount: totalTax }]
    doc.totalAmount = grandTotal

    setInvoices(nextInvoices)
  }

  function addInvoiceLine() {
    if (invoices.length === 0 || selectedIdx < 0) return
    const nextInvoices = JSON.parse(JSON.stringify(invoices))
    const doc = nextInvoices[selectedIdx]
    if (!doc) return

    const newLine = {
      description: "صنف جديد",
      itemCode: "EG-111111-1111",
      quantity: 1,
      unitType: "EA",
      unitValue: { currencySold: "EGP", amountEGP: 100 },
      netTotal: 100,
      salesTotal: 100,
      valueDifference: 0,
      totalTaxableFees: 0,
      discount: { rate: 0, amount: 0 },
      taxableItems: [{ taxType: "T1", amount: 14, subType: "V009", rate: 14 }],
      total: 114
    }

    if (!doc.invoiceLines) doc.invoiceLines = []
    doc.invoiceLines.push(newLine)

    let totalSales = 0
    let totalTax = 0
    let grandTotal = 0
    doc.invoiceLines.forEach(l => {
      totalSales += l.netTotal || 0
      totalTax += (l.taxableItems?.[0]?.amount || 0)
      grandTotal += (l.total || 0)
    })

    doc.totalSalesAmount = totalSales
    doc.netAmount = totalSales
    doc.taxTotals = [{ taxType: "T1", amount: totalTax }]
    doc.totalAmount = grandTotal

    setInvoices(nextInvoices)
    toast.success(lang === 'ar' ? 'تم إضافة بند جديد للفاتورة!' : 'New item line added to invoice!')
  }

  function deleteInvoiceLine(lineIdx) {
    if (invoices.length === 0 || selectedIdx < 0) return
    const nextInvoices = JSON.parse(JSON.stringify(invoices))
    const doc = nextInvoices[selectedIdx]
    if (!doc) return

    if (!doc.invoiceLines || doc.invoiceLines.length <= 1) {
      toast.error(lang === 'ar' ? '⚠️ يجب أن تحتوي الفاتورة على بند واحد على الأقل!' : '⚠️ Invoice must contain at least one line!')
      return
    }

    doc.invoiceLines.splice(lineIdx, 1)

    let totalSales = 0
    let totalTax = 0
    let grandTotal = 0
    doc.invoiceLines.forEach(l => {
      totalSales += l.netTotal || 0
      totalTax += (l.taxableItems?.[0]?.amount || 0)
      grandTotal += (l.total || 0)
    })

    doc.totalSalesAmount = totalSales
    doc.netAmount = totalSales
    doc.taxTotals = [{ taxType: "T1", amount: totalTax }]
    doc.totalAmount = grandTotal

    setInvoices(nextInvoices)
    toast.success(lang === 'ar' ? 'تم حذف الصنف من الفاتورة!' : 'Item line deleted from invoice!')
  }

  function currentCustomerPayload() {
    const doc = invoices[selectedIdx]
    const receiver = doc?.receiver || {}
    const address = receiver.address || {}
    return {
      id: cleanCustomerId(receiver.id),
      name: receiver.name || '',
      type: receiver.type || 'B',
      address: {
        country: address.country || 'EG',
        street: address.street || address.addressLine || '',
        buildingNumber: address.buildingNumber || '',
        regionCity: address.regionCity || '',
        governate: address.governate || '',
      },
    }
  }

  async function handleSaveCurrentCustomer() {
    const payload = currentCustomerPayload()
    if (!payload.id) {
      toast.error(lang === 'ar' ? 'رقم تسجيل/ضريبة العميل مطلوب للحفظ' : 'Receiver registration/VAT ID is required')
      return
    }

    try {
      const data = await saveCustomer(payload)
      if (data?.success && data.customer) {
        setCustomers(prev => {
          const others = prev.filter(c => c.id !== data.customer.id)
          return [data.customer, ...others]
        })
        setSelectedCustomerId(data.customer.id)
        toast.success(lang === 'ar' ? 'تم حفظ العميل في حسابك' : 'Customer saved to your account')
      }
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || (lang === 'ar' ? 'فشل حفظ العميل' : 'Failed to save customer'))
    }
  }

  async function applyCustomer(customerId) {
    setSelectedCustomerId(customerId)
    const customer = customers.find(c => c.id === customerId)
    if (!customer || !invoices[selectedIdx]) return

    const nextInvoices = JSON.parse(JSON.stringify(invoices))
    const doc = nextInvoices[selectedIdx]
    if (!doc.receiver) doc.receiver = {}
    if (!doc.receiver.address) doc.receiver.address = {}

    doc.receiver.name = customer.name || ''
    doc.receiver.id = customer.id || ''
    doc.receiver.type = customer.type || 'B'
    doc.receiver.address.country = customer.address?.country || 'EG'
    doc.receiver.address.street = customer.address?.street || ''
    doc.receiver.address.buildingNumber = customer.address?.buildingNumber || '1'
    doc.receiver.address.regionCity = customer.address?.regionCity || ''
    doc.receiver.address.governate = customer.address?.governate || ''

    setInvoices(nextInvoices)
  }

  async function handleBatchSubmit() {
    if (invoices.length === 0) return

    setSubmitting(true)
    toast.loading(lang === 'ar' ? 'جاري التحقق من أداة التوقيع وتوقيع الفواتير...' : 'Signing and submitting batch...', { id: 'batch-submit' })
    
    let signedDocs = []
    
    try {
      // 1. Health check to local signer with auto-launch and smart wait
      const localSignerActive = await ensureLocalSignerActive((msg) => {
        toast.loading(lang === 'ar' ? msg : 'Starting FawterX Signer and checking USB Token...', { id: 'batch-submit' });
      });

      if (!localSignerActive) {
        toast.dismiss('batch-submit');
        setSubmitting(false);
        toast.error(
          lang === 'ar' 
            ? '⚠️ لم يتم العثور على نافذة أداة التوقيع! يرجى فتح FawterX Signer وترك النافذة ظاهرة مع توصيل الدونجل.' 
            : '⚠️ Local signer window not detected! Please open FawterX Signer and keep its window visible with your USB Token plugged in.',
          { duration: 7000 }
        );
        return;
      }

      // 2. Sign each document locally
      const safeDate = new Date();
      safeDate.setMinutes(safeDate.getMinutes() - 5);
      const fallbackIsoTime = safeDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
      for (const doc of invoices) {
        const { _fileName, ...pureDoc } = doc
        if (pureDoc.dateTimeIssued) {
          const parsed = new Date(pureDoc.dateTimeIssued);
          if (!isNaN(parsed.getTime())) {
            pureDoc.dateTimeIssued = parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
          } else {
            pureDoc.dateTimeIssued = fallbackIsoTime;
          }
        } else {
          pureDoc.dateTimeIssued = fallbackIsoTime;
        }
        const cleanedDoc = cleanObject(pureDoc)
        const canonicalString = serializeToken(cleanedDoc)
        
        const signRes = await fetch("http://localhost:8585/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canonicalString })
        });
        
        if (!signRes.ok) throw new Error('Local signing request failed.');
        const signData = await signRes.json();
        if (!signData.success) throw new Error(signData.error || 'Unknown signing error');
        
        signedDocs.push({
          ...cleanedDoc,
          signatures: [{ signatureType: "I", value: signData.signature }]
        })
      }

      // 3. Submit the entire signed batch to ETA
      toast.loading(lang === 'ar' ? 'تم التوقيع بنجاح! جاري إرسال الدفعة لمنظومة الضرائب...' : 'Signed successfully! Submitting batch to ETA...', { id: 'batch-submit' })
      
      const res = await submitToETA(signedDocs, false)
      toast.success(lang === 'ar' ? 'تم إرسال جميع الفواتير بنجاح لـ ETA!' : 'Batch sent successfully to ETA!', { id: 'batch-submit' })
      
      const uuid = res.requestId || res.result?.submissionUUID || res.result?.submissionId || res.result?.requestId;
      if (uuid && uuid !== "N/A") {
        toast(
          lang === 'ar'
            ? 'الدفعة وصلت، وبوابة الضرائب تتحقق منها الآن.'
            : 'The batch has been sent and ETA Portal is verifying it now.',
          { id: 'verify-batch', icon: '⏳' }
        )
        await new Promise(r => setTimeout(r, 3000));
        try {
          await getETAStatus(uuid)
          toast.success(lang === 'ar' ? 'تم تأكيد وصول الدفعة بالبوابة!' : 'Batch appearance verified in Portal!', { id: 'verify-batch' })
        } catch (vErr) {
          toast(
            lang === 'ar'
              ? 'بوابة الضرائب ما زالت تعالج الدفعة، وسيظهر التأكيد بعد قليل.'
              : 'ETA Portal is still processing the batch and confirmation will appear shortly.',
            { id: 'verify-batch', icon: '⏳' }
          )
        } finally {
          if (fetchUsage) fetchUsage()
        }
      }

      setSubmissionResults(signedDocs)
    } catch (err) {
      console.error(err)
      toast.error(lang === 'ar' ? 'فشل إرسال الدفعة' : 'Batch submission failed', { id: 'batch-submit' })
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 1) {
    return (
      <div className="card fade-in">
        <UploadStep onSuccess={handleBatchUploadSuccess} />
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div className="spinner" style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem' }}></div>
        <h2>{lang === 'ar' ? 'جاري معالجة الدفعة...' : 'Processing Batch...'}</h2>
      </div>
    )
  }

  // REVIEW AND SUBMIT STEP
  const selectedDoc = invoices[selectedIdx]

  return (
    <div className="card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
      {/* Header bar matching user design */}
      <div style={{ padding: '1.5rem 2rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.35rem' }}>📑 {lang === 'ar' ? 'مراجعة وتعديل الدفعة (Batch Review & Edit)' : 'Batch Review & Edit'}</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {lang === 'ar' ? `تم تجهيز ${invoices.length} فواتير للإرسال - يمكنك التعديل المباشر على أي فاتورة` : `${invoices.length} invoices ready for submission - edit any invoice inline`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            type="button"
            className="btn btn-ghost" 
            onClick={handleOpenSigner}
            style={{ border: '1px solid rgba(255, 255, 255, 0.15)', fontWeight: 700 }}
          >
            🔑 {lang === 'ar' ? 'فتح أداة التوقيع' : 'Open Signing Tool'}
          </button>
          <button 
            className="btn btn-accent btn-lg" 
            onClick={handleBatchSubmit}
            disabled={submitting || invoices.length === 0}
          >
            {submitting ? <span className="spinner" /> : null}
            🚀 {lang === 'ar' ? 'إرسال الكل لـ ETA' : 'Submit All to ETA'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: '750px', flexDirection: 'row' }}>
        {/* Sidebar */}
        <div style={{ width: '320px', borderRight: lang === 'en' ? '1px solid var(--border)' : 'none', borderLeft: lang === 'ar' ? '1px solid var(--border)' : 'none', background: 'var(--bg)', overflowY: 'auto', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.85rem', textTransform: 'uppercase' }}>
            📋 {lang === 'ar' ? 'قائمة الفواتير المجهزة' : 'Prepared Invoices'} ({invoices.length})
          </div>
          {invoices.map((inv, idx) => (
            <div 
              key={idx}
              onClick={() => setSelectedIdx(idx)}
              style={{
                padding: '1.1rem',
                marginBottom: '0.75rem',
                borderRadius: '12px',
                background: selectedIdx === idx ? 'rgba(0, 224, 161, 0.08)' : 'var(--card-bg)',
                border: selectedIdx === idx ? '1px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: selectedIdx === idx ? '0 4px 15px rgba(0, 224, 161, 0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', fontFamily: 'monospace' }}>
                  {inv.internalID || `Invoice #${idx + 1}`}
                </span>
                <span className="badge badge-accent" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                  #{idx + 1}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.35rem' }}>
                🤝 {inv.receiver?.name || (lang === 'ar' ? 'بدون اسم' : 'No Receiver')}
              </div>
              {inv._fileName && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.35rem' }}>
                  📄 {inv._fileName}
                </div>
              )}
              <div style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 800, textAlign: 'left', dir: 'ltr' }}>
                {(inv.totalAmount || 0).toLocaleString()} EGP
              </div>
            </div>
          ))}
        </div>

        {/* Main Editable Content Area */}
        <div style={{ flex: 1, padding: '2rem', background: 'var(--card-bg)', overflowY: 'auto' }}>
          {selectedDoc ? (
            <div className="animate-fade-in">
              
              {/* SECTION A: INVOICE METADATA & PARTIES REVIEW (HEADER SECTION) */}
              <div className="card animate-fade-in" style={{
                padding: '2rem',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                marginBottom: '2.5rem',
                textAlign: lang === 'ar' ? 'right' : 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 900, color: 'var(--accent)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🏢 {lang === 'ar' ? `البيانات الفوقية ومعلومات الأطراف (الفاتورة رقم ${selectedDoc.internalID || selectedIdx + 1})` : `Invoice Metadata & Parties (Invoice #${selectedDoc.internalID || selectedIdx + 1})`}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {lang === 'ar' ? 'جميع الحقول قابلة للتعديل والمطابقة مع الضرائب المصرية' : 'All fields are editable for Egyptian ETA compliance'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                  
                  {/* Invoice Number */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🔢 {lang === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={selectedDoc.internalID || ''} 
                      onChange={(e) => updateInvoiceMetadata('internalID', e.target.value)} 
                    />
                  </div>

                  {/* Date Issued */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      📅 {lang === 'ar' ? 'تاريخ الإصدار' : 'Date Issued'}
                    </label>
                    <input 
                      type="datetime-local" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={formatCairoDateTimeInput(selectedDoc.dateTimeIssued)} 
                      onChange={(e) => updateInvoiceMetadata('dateTimeIssued', cairoLocalInputToUtcIso(e.target.value))} 
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {lang === 'ar' ? 'عرض القاهرة:' : 'Cairo display:'} {formatCairoDateTime(selectedDoc.dateTimeIssued)}
                    </div>
                  </div>

                  {/* Document Type */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      📄 {lang === 'ar' ? 'نوع المستند' : 'Document Type'}
                    </label>
                    <select
                      className="input"
                      style={{ background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={selectedDoc.documentType || 'I'}
                      onChange={(e) => updateInvoiceMetadata('documentType', e.target.value)}
                    >
                      <option value="I">{lang === 'ar' ? 'فاتورة (Invoice)' : 'Invoice (I)'}</option>
                      <option value="C">{lang === 'ar' ? 'إشعار دائن (Credit Note)' : 'Credit Note (C)'}</option>
                      <option value="D">{lang === 'ar' ? 'إشعار مدين (Debit Note)' : 'Debit Note (D)'}</option>
                    </select>
                  </div>

                  {/* Currency */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      💵 {lang === 'ar' ? 'العملة' : 'Currency'}
                    </label>
                    <select
                      className="input"
                      style={{ background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={selectedDoc.invoiceLines?.[0]?.unitValue?.currencySold || 'EGP'}
                      onChange={(e) => updateInvoiceMetadata('currency', e.target.value)}
                    >
                      <option value="EGP">EGP (جنيه مصري)</option>
                      <option value="USD">USD (دولار أمريكي)</option>
                      <option value="EUR">EUR (يورو)</option>
                    </select>
                  </div>

                  {/* Exchange Rate */}
                  {selectedDoc.invoiceLines?.[0]?.unitValue?.currencySold && selectedDoc.invoiceLines?.[0]?.unitValue?.currencySold !== 'EGP' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                        💱 {lang === 'ar' ? 'سعر الصرف' : 'Exchange Rate'}
                      </label>
                      <input 
                        type="number" 
                        step="0.00001"
                        className="input" 
                        style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#f1c40f', fontWeight: 'bold', borderRadius: '6px', padding: '0.5rem' }} 
                        value={selectedDoc.invoiceLines?.[0]?.unitValue?.currencyExchangeRate || 1} 
                        onChange={(e) => updateInvoiceMetadata('exchangeRate', e.target.value)} 
                      />
                    </div>
                  )}

                  {/* Code Type */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🔑 {lang === 'ar' ? 'نوع الكود الموحد' : 'ETA Code Type'}
                    </label>
                    <select
                      className="input"
                      style={{ background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={selectedDoc.codeType || 'EGS'}
                      onChange={(e) => updateInvoiceMetadata('codeType', e.target.value)}
                    >
                      <option value="EGS">EGS (المصري الموحد)</option>
                      <option value="GS1">GS1 (العالمي المشترك)</option>
                    </select>
                  </div>

                  {/* Taxpayer Activity Code */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      ⚡ {lang === 'ar' ? 'كود النشاط الضريبي' : 'Taxpayer Activity Code'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={selectedDoc.taxpayerActivityCode || '2410'} 
                      onChange={(e) => updateInvoiceMetadata('taxpayerActivityCode', e.target.value)} 
                    />
                  </div>

                  {/* Issuer Name */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🏢 {lang === 'ar' ? 'اسم الشركة المصدرة (المورد)' : 'Issuer Company Name'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={selectedDoc.issuer?.name || ''} 
                      onChange={(e) => updateInvoiceMetadata('issuerName', e.target.value)} 
                    />
                  </div>

                  {/* Issuer VAT */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🆔 {lang === 'ar' ? 'الرقم الضريبي للمصدر' : 'Issuer VAT ID'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={selectedDoc.issuer?.id || selectedDoc.issuer?.registrationNumber || ''} 
                      onChange={(e) => updateInvoiceMetadata('issuerVat', e.target.value)} 
                    />
                  </div>

                  {/* Receiver Name */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🤝 {lang === 'ar' ? 'اسم العميل (المشتري)' : 'Receiver Client Name'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      dir={textDirection(selectedDoc.receiver?.name)}
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={selectedDoc.receiver?.name || ''} 
                      onChange={(e) => updateInvoiceMetadata('receiverName', e.target.value)} 
                    />
                  </div>

                  {/* Receiver VAT */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🆔 {lang === 'ar' ? 'الرقم الضريبي للمشتري' : 'Receiver VAT ID'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      dir={textDirection(selectedDoc.receiver?.id)}
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={selectedDoc.receiver?.id || ''} 
                      onChange={(e) => updateInvoiceMetadata('receiverVat', e.target.value)} 
                    />
                  </div>

                  {/* Receiver Type */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      📋 {lang === 'ar' ? 'نوع المستلم' : 'Receiver Type'}
                    </label>
                    <select
                      className="input"
                      style={{ background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={selectedDoc.receiver?.type || 'B'}
                      onChange={(e) => updateInvoiceMetadata('receiverType', e.target.value)}
                    >
                      <option value="B">{lang === 'ar' ? 'شركة / أعمال (B)' : 'Business (B)'}</option>
                      <option value="P">{lang === 'ar' ? 'شخص (P)' : 'Person (P)'}</option>
                      <option value="F">{lang === 'ar' ? 'أجنبي (F)' : 'Foreigner (F)'}</option>
                    </select>
                  </div>

                  {/* Receiver Country */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🌍 {lang === 'ar' ? 'دولة المستلم (ISO Code)' : 'Receiver Country Code'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      dir={textDirection(selectedDoc.receiver?.address?.country)}
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={selectedDoc.receiver?.address?.country || 'EG'} 
                      onChange={(e) => updateInvoiceMetadata('receiverCountry', e.target.value)} 
                    />
                  </div>

                  {/* Street & Saved Customers (Full Width Row) */}
                  <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {/* Receiver Street */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                        🏠 {lang === 'ar' ? 'عنوان المستلم / الشارع' : 'Receiver Street / Address'}
                      </label>
                      <textarea
                        className="input"
                        dir={textDirection(selectedDoc.receiver?.address?.street || selectedDoc.receiver?.address?.addressLine)}
                        style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.6rem', minHeight: '76px', resize: 'vertical', lineHeight: 1.5 }}
                        value={selectedDoc.receiver?.address?.street || selectedDoc.receiver?.address?.addressLine || ''} 
                        onChange={(e) => updateInvoiceMetadata('receiverStreet', e.target.value)} 
                      />
                    </div>

                    {/* Saved Customers */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                        📘 {lang === 'ar' ? 'دفتر العملاء المحفوظين' : 'Saved Customers'}
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', height: '100%', alignItems: 'flex-start' }}>
                        <select
                          className="input"
                          style={{ background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.55rem', flex: 1, minHeight: '38px' }}
                          value={selectedCustomerId}
                          onChange={(e) => applyCustomer(e.target.value)}
                          disabled={customersLoading}
                        >
                          <option value="">{customersLoading ? (lang === 'ar' ? 'تحميل...' : 'Loading...') : (lang === 'ar' ? 'اختار عميل محفوظ...' : 'Choose saved...')}</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name || customer.id}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-accent btn-sm" onClick={handleSaveCurrentCustomer} style={{ padding: '0 0.75rem', height: '38px' }} title={lang === 'ar' ? 'حفظ العميل الحالي' : 'Save Current Customer'}>
                          💾
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={fetchCustomers} style={{ padding: '0 0.75rem', height: '38px' }} title={lang === 'ar' ? 'تحديث القائمة' : 'Refresh List'}>
                          🔄
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(160px, 0.7fr) minmax(220px, 1fr) minmax(220px, 1fr)', gap: '0.75rem', alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                        🔢 {lang === 'ar' ? 'رقم المبنى' : 'Building Number'}
                      </label>
                      <input
                        type="text"
                        className="input"
                        dir={textDirection(selectedDoc.receiver?.address?.buildingNumber)}
                        style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }}
                        value={selectedDoc.receiver?.address?.buildingNumber || ''} 
                        onChange={(e) => updateInvoiceMetadata('receiverBuildingNumber', e.target.value)} 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                        🏙️ {lang === 'ar' ? 'المدينة / المنطقة' : 'Region / City'}
                      </label>
                      <input
                        type="text"
                        className="input"
                        dir={textDirection(selectedDoc.receiver?.address?.regionCity)}
                        style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }}
                        value={selectedDoc.receiver?.address?.regionCity || ''} 
                        onChange={(e) => updateInvoiceMetadata('receiverRegionCity', e.target.value)} 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderInlineStart: '1px solid rgba(255,255,255,0.18)', paddingInlineStart: '0.9rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                        🗺️ {lang === 'ar' ? 'المحافظة / الولاية' : 'Governate / Province'}
                      </label>
                      <input
                        type="text"
                        className="input"
                        dir={textDirection(selectedDoc.receiver?.address?.governate)}
                        style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }}
                        value={selectedDoc.receiver?.address?.governate || ''} 
                        onChange={(e) => updateInvoiceMetadata('receiverGovernate', e.target.value)} 
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION B: INVOICE LINES SECTION (Editable Lines Grid) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h4 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>🧾 {lang === 'ar' ? 'مراجعة وتعديل بنود الفاتورة' : 'Invoice Items (Editable Grid)'}</h4>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button type="button" className="btn btn-accent btn-sm" onClick={addInvoiceLine}>
                    ➕ {lang === 'ar' ? 'إضافة صنف جديد' : 'Add New Item'}
                  </button>
                  <span className="badge badge-valid" style={{ background: 'rgba(0, 224, 161, 0.1)', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    {lang === 'ar' ? 'رقم الفاتورة:' : 'Invoice ID:'} {selectedDoc.internalID}
                  </span>
                </div>
              </div>

              <div className="table-wrapper" style={{ 
                maxHeight: '650px', 
                overflowX: 'auto', 
                overflowY: 'auto', 
                border: '1px solid rgba(255, 255, 255, 0.08)', 
                borderRadius: '16px', 
                marginBottom: '2.5rem',
                background: 'rgba(20, 24, 46, 0.35)',
                backdropFilter: 'blur(20px)',
                boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)',
                padding: '1.25rem'
              }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 12px', minWidth: '1450px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '40px' }}>#</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '90px' }}>Code Type</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '170px' }}>Item Code</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '110px' }}>Internal Code</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: lang === 'ar' ? 'right' : 'left', width: '320px' }}>Item Description</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '95px' }}>Quantity</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '100px' }}>Qty Unit</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '70px' }}>Currency</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '160px' }}>Unit Price EGP</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '100px' }}>Tax</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: lang === 'ar' ? 'left' : 'right', width: '170px' }}>Total</th>
                      <th style={{ padding: '1.2rem 0.5rem', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDoc.invoiceLines?.map((line, idx) => {
                      const currency = line.unitValue?.currencySold || 'EGP'
                      const isForeign = currency !== 'EGP'
                      const unitPriceDisplay = isForeign ? (line.unitValue?.amountSold || 0) : (line.unitValue?.amountEGP || 0)
                      const currentTaxRate = isForeign ? 0 : (line.taxableItems?.[0]?.rate ?? (line.taxPercent ?? 14))

                      return (
                        <tr key={idx} style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                          <td style={{ padding: '0.8rem 0.5rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-muted)' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem' }}>
                            <select 
                              className="input" 
                              style={{ padding: '0.4rem', fontSize: '0.75rem', background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', width: '100%' }}
                              value={line.codeType || selectedDoc.codeType || 'EGS'}
                              onChange={(e) => updateInvoiceLine(idx, 'codeType', e.target.value)}
                            >
                              <option value="EGS">EGS</option>
                              <option value="GS1">GS1</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem' }}>
                            <input 
                              type="text" 
                              className="input" 
                              style={{ padding: '0.4rem', fontSize: '0.8rem', fontFamily: 'monospace', background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', width: '100%' }}
                              value={line.itemCode || ''} 
                              onChange={(e) => updateInvoiceLine(idx, 'itemCode', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem' }}>
                            <input 
                              type="text" 
                              className="input" 
                              style={{ padding: '0.4rem', fontSize: '0.8rem', fontFamily: 'monospace', background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', width: '100%' }}
                              value={line.internalCode || ''} 
                              onChange={(e) => updateInvoiceLine(idx, 'internalCode', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem' }}>
                            <textarea 
                              className="input" 
                              dir={textDirection(line.description)}
                              style={{ padding: '0.4rem', fontSize: '0.8rem', minHeight: '42px', background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', width: '100%', resize: 'vertical' }}
                              value={line.description || ''} 
                              onChange={(e) => updateInvoiceLine(idx, 'description', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem' }}>
                            <input 
                              type="number" 
                              step="any"
                              className="input" 
                              style={{ padding: '0.4rem', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'center', background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', width: '100%' }}
                              value={line.quantity ?? 0} 
                              onChange={(e) => updateInvoiceLine(idx, 'quantity', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem' }}>
                            <select 
                              className="input" 
                              style={{ padding: '0.4rem', fontSize: '0.75rem', background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', width: '100%' }}
                              value={line.unitType || 'EA'}
                              onChange={(e) => updateInvoiceLine(idx, 'unitType', e.target.value)}
                            >
                              <option value="EA">EA (عدد)</option>
                              <option value="LM">LM (متر طولي)</option>
                              <option value="M">M (متر)</option>
                              <option value="KGM">KGM (كيلوجرام)</option>
                              <option value="BAR">BAR (بار)</option>
                              <option value="TNE">TNE (طن)</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                            {currency}
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem' }}>
                            <input 
                              type="number" 
                              step="any"
                              className="input" 
                              style={{ padding: '0.4rem', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'center', background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', width: '100%' }}
                              value={unitPriceDisplay} 
                              onChange={(e) => updateInvoiceLine(idx, 'unitValue', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem' }}>
                            <select
                              className="input" 
                              disabled={isForeign}
                              style={{ padding: '0.4rem', fontSize: '0.75rem', background: '#0b0d19', border: '1px solid var(--border)', color: isForeign ? 'var(--text-muted)' : '#fff', borderRadius: '6px', width: '100%' }}
                              value={currentTaxRate}
                              onChange={(e) => updateInvoiceLine(idx, 'taxPercent', e.target.value)}
                            >
                              <option value={14}>14% (T1)</option>
                              <option value={5}>5% (T1)</option>
                              <option value={0}>0% (معفى/معاملة خاصة)</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.8rem 0.5rem', textAlign: lang === 'ar' ? 'left' : 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent)', dir: 'ltr' }}>
                              {(line.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', dir: 'ltr' }}>
                              {lang === 'ar' ? 'صافي:' : 'Net:'} {(line.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td style={{ padding: '0.8rem 0.4rem', textAlign: 'center' }}>
                            <button 
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)', padding: '0.3rem 0.5rem' }}
                              onClick={() => deleteInvoiceLine(idx)}
                              title={lang === 'ar' ? 'حذف الصنف' : 'Delete Line'}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2.5rem' }}>
                <div style={{ width: '380px', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: 'var(--text-dim)', fontSize: '1rem' }}>
                    <span>{lang === 'ar' ? 'الإجمالي بدون ضريبة:' : 'Subtotal:'}</span>
                    <strong style={{ color: '#fff', dir: 'ltr' }}>{(selectedDoc.totalSalesAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', color: 'var(--text-dim)', fontSize: '1rem' }}>
                    <span>{lang === 'ar' ? 'قيمة الضريبة المضافة (VAT):' : 'Total VAT:'}</span>
                    <strong style={{ color: '#00e0a1', dir: 'ltr' }}>{(selectedDoc.taxTotals?.[0]?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.35rem', color: 'var(--accent)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                    <span>{lang === 'ar' ? 'الإجمالي النهائي:' : 'Total Amount:'}</span>
                    <strong style={{ dir: 'ltr' }}>{(selectedDoc.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</strong>
                  </div>
                </div>
              </div>

              {/* Bottom Navigation & Action Bar matching user image 3 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <button 
                  type="button"
                  className="btn btn-ghost" 
                  onClick={() => setStep(1)}
                  style={{ border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  ← {lang === 'ar' ? 'السابق (إعادة الرفع)' : 'Back (Re-upload)'}
                </button>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button 
                    type="button"
                    className="btn btn-ghost" 
                    onClick={handleOpenSigner}
                    style={{ border: '1px solid rgba(255,255,255,0.15)', fontWeight: 700 }}
                  >
                    🔑 {lang === 'ar' ? 'فتح أداة التوقيع' : 'Open Signing Tool'}
                  </button>
                  <button 
                    type="button"
                    className="btn btn-accent btn-lg" 
                    onClick={handleBatchSubmit}
                    disabled={submitting || invoices.length === 0}
                  >
                    {submitting ? <span className="spinner" /> : null}
                    🚀 {lang === 'ar' ? 'توقيع وإرسال لـ ETA الحقيقي' : 'Sign & Submit All to ETA'}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
              {lang === 'ar' ? 'اختر فاتورة من القائمة الجانبية لمعاينة وتعديل بياناتها' : 'Select an invoice from the sidebar to preview and edit'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
